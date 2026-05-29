import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { loginSchema, refreshSchema, logoutSchema, registerTenantSchema } from './auth.schemas.js';
import { findUserByEmail, verifyPassword, registerTenant, hashPassword } from './auth.service.js';
import { db, users, passwordResetTokens, eq, and, gt, isNull } from '@saas/db';
import { randomBytes } from 'node:crypto';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await findUserByEmail(body.email);
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Invalid credentials', message: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials', message: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const tokens = await fastify.signTokens({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as 'owner' | 'admin' | 'agent',
      email: user.email,
    });

    return reply.send(tokens);
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const result = await fastify.rotateRefreshToken(refreshToken);

    if (!result) {
      return reply.status(401).send({ error: 'Invalid token', message: 'Token de refresco inválido o expirado', code: 'INVALID_REFRESH_TOKEN' });
    }

    return reply.send({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    const { refreshToken } = logoutSchema.parse(request.body);
    await fastify.invalidateRefreshToken(refreshToken);
    return reply.status(204).send();
  });

  // POST /api/auth/register-tenant
  fastify.post('/register-tenant', async (request, reply) => {
    const input = registerTenantSchema.parse(request.body);

    try {
      const { tenant, user } = await registerTenant(input);
      const tokens = await fastify.signTokens({
        sub: user.id,
        tenantId: tenant.id,
        role: 'owner',
        email: user.email,
      });

      return reply.status(201).send({
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        ...tokens,
      });
    } catch (err) {
      const pgError = err as { code?: string; message?: string } | undefined;
      if (pgError?.code === '23505') {
        return reply.status(409).send({ error: 'Conflict', message: 'El email o slug ya existe', code: 'CONFLICT' });
      }
      throw err;
    }
  });

  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);

    const user = await findUserByEmail(email);
    if (!user) return reply.status(200).send({ ok: true });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 3600000);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return reply.status(200).send({ ok: true, message: 'Si el email existe, recibirás instrucciones' });
  });

  fastify.post('/reset-password', async (request, reply) => {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(6),
    }).parse(request.body);

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const candidates = await db.select().from(passwordResetTokens)
      .where(and(isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now), gt(passwordResetTokens.createdAt, twoHoursAgo)));

    let matchedUserId: string | null = null;
    let matchedTokenId: string | null = null;
    for (const t of candidates) {
      const valid = await bcrypt.compare(token, t.tokenHash);
      if (valid) {
        matchedUserId = t.userId;
        matchedTokenId = t.id;
        break;
      }
    }

    if (!matchedUserId || !matchedTokenId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Token inválido o expirado', code: 'INVALID_TOKEN' });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, matchedUserId));
    await db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, matchedTokenId));

    return reply.status(200).send({ ok: true });
  });
};

export default authRoutes;

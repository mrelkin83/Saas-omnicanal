import type { FastifyPluginAsync } from 'fastify';
import { loginSchema, refreshSchema, logoutSchema, registerTenantSchema } from './auth.schemas.js';
import { findUserByEmail, verifyPassword, registerTenant } from './auth.service.js';

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
      const msg = err instanceof Error ? err.message : 'Error creating tenant';
      if (msg.includes('unique')) {
        return reply.status(409).send({ error: 'Conflict', message: 'El email o slug ya existe', code: 'CONFLICT' });
      }
      throw err;
    }
  });
};

export default authRoutes;

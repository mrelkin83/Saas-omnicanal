import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, superadminUsers, eq } from '@saas/db';
import { redis } from '../../lib/redis.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

const LOGIN_RATE_PREFIX = 'sa:login:';
const LOGIN_RATE_MAX = 5;
const LOGIN_RATE_WINDOW = 300;

const superadminAuthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const ip = request.ip;
    const rateKey = `${LOGIN_RATE_PREFIX}${ip}`;

    const attempts = await redis.incr(rateKey);
    if (attempts === 1) await redis.expire(rateKey, LOGIN_RATE_WINDOW);
    if (attempts > LOGIN_RATE_MAX) {
      return reply.status(429).send({ error: 'Too Many Requests', message: 'Demasiados intentos. Intenta de nuevo en 5 minutos.', code: 'RATE_LIMITED' });
    }

    const { email, password } = loginSchema.parse(request.body);

    const [user] = await db.select().from(superadminUsers).where(eq(superadminUsers.email, email));
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
    }

    await redis.del(rateKey);
    await db.update(superadminUsers).set({ lastLogin: new Date() }).where(eq(superadminUsers.id, user.id));

    const tokens = await fastify.signTokens({
      sub: user.id,
      tenantId: 'superadmin',
      role: 'owner',
      email: user.email,
      isSuperAdmin: true,
    });

    return tokens;
  });

  fastify.get('/me', { preHandler: [async (request, reply) => {
    if (!request.user?.isSuperAdmin) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Solo superadmins', code: 'FORBIDDEN' });
    }
  }] }, async (request) => {
    const [user] = await db.select().from(superadminUsers).where(eq(superadminUsers.id, request.user!.sub));
    if (!user) return null;
    const { passwordHash: _, ...safe } = user;
    return safe;
  });
};

export default superadminAuthRoutes;

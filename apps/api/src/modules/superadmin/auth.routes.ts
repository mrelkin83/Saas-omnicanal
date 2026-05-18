import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, superadminUsers, eq } from '@saas/db';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

const superadminAuthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const [user] = await db.select().from(superadminUsers).where(eq(superadminUsers.email, email));
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
    }

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

  fastify.get('/me', async (request, reply) => {
    if (!request.user?.isSuperAdmin) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No autorizado', code: 'UNAUTHORIZED' });
    }
    const [user] = await db.select().from(superadminUsers).where(eq(superadminUsers.id, request.user.sub));
    if (!user) return reply.status(404).send({ error: 'Not Found', message: 'Usuario no encontrado', code: 'NOT_FOUND' });
    const { passwordHash: _, ...safe } = user;
    return safe;
  });
};

export default superadminAuthRoutes;

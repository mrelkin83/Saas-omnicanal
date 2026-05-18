import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createUserSchema, updateUserSchema } from './users.schemas.js';
import { listUsers, getUserById, createUser, updateUser, deleteUser } from './users.service.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, users, conversations, eq, and } from '@saas/db';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const adminGuard = { preHandler: [requireAuth('admin')] };
  const ownerGuard = { preHandler: [requireAuth('owner')] };
  const authGuard = { preHandler: [requireAuth()] };

  // GET /api/users
  fastify.get('/', adminGuard, async (request, reply) => {
    const list = await listUsers(request.user!.tenantId);
    return reply.send(list);
  });

  // GET /api/users/:id
  fastify.get('/:id', authGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getUserById(request.user!.tenantId, id);
    if (!user) {
      return reply.status(404).send({ error: 'Not Found', message: 'Usuario no encontrado', code: 'NOT_FOUND' });
    }
    return reply.send(user);
  });

  // POST /api/users
  fastify.post('/', adminGuard, async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    try {
      const user = await createUser(request.user!.tenantId, input);
      return reply.status(201).send(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send({ error: 'Conflict', message: 'El email ya está en uso', code: 'CONFLICT' });
      }
      throw err;
    }
  });

  // PATCH /api/users/:id
  fastify.patch('/:id', adminGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateUserSchema.parse(request.body);
    const updated = await updateUser(request.user!.tenantId, id, input);
    if (!updated) {
      return reply.status(404).send({ error: 'Not Found', message: 'Usuario no encontrado', code: 'NOT_FOUND' });
    }
    return reply.send(updated);
  });

  // PATCH /api/users/me/status — agent sets own status
  const agentStatusSchema = z.object({ status: z.enum(['available', 'busy', 'away', 'offline']) });

  fastify.patch('/me/status', authGuard, async (request, reply) => {
    const { status } = agentStatusSchema.parse(request.body);
    const [updated] = await db
      .update(users)
      .set({ agentStatus: status })
      .where(and(eq(users.id, request.user!.sub), eq(users.tenantId, request.user!.tenantId)))
      .returning({ id: users.id, agentStatus: users.agentStatus });
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Usuario no encontrado', code: 'NOT_FOUND' });
    return updated;
  });

  // POST /api/users/transfer — transfer conversation to another agent
  const transferSchema = z.object({ conversationId: z.string().uuid(), toUserId: z.string().uuid() });

  fastify.post('/transfer', authGuard, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { conversationId, toUserId } = transferSchema.parse(request.body);

    const [agent] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, toUserId), eq(users.tenantId, tenantId)));
    if (!agent) return reply.status(404).send({ error: 'Not Found', message: 'Agente no encontrado', code: 'NOT_FOUND' });

    const [updated] = await db
      .update(conversations)
      .set({ assignedUserId: toUserId, updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
      .returning({ id: conversations.id, assignedUserId: conversations.assignedUserId });

    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return updated;
  });

  // DELETE /api/users/:id  — owner only
  fastify.delete('/:id', ownerGuard, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (id === request.user!.sub) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No puedes eliminarte a ti mismo', code: 'SELF_DELETE' });
    }

    const deleted = await deleteUser(request.user!.tenantId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Usuario no encontrado', code: 'NOT_FOUND' });
    }
    return reply.status(204).send();
  });
};

export default usersRoutes;

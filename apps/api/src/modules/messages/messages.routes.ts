import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, messages, conversations, eq, and, desc, lt } from '@saas/db';

// Paginated message history: GET /api/messages?conversationId=<id>&limit=50&before=<messageId>
const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const q = request.query as Record<string, string | undefined>;
    const conversationId = q['conversationId'];
    const limit = Math.min(parseInt(q['limit'] ?? '50', 10), 100);
    const before = q['before'];

    if (!conversationId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'conversationId es requerido', code: 'MISSING_PARAM' });
    }

    const [conv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));

    if (!conv) {
      return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    }

    const conditions = [
      eq(messages.conversationId, conversationId),
      eq(messages.tenantId, tenantId),
    ];

    if (before) {
      const [cursor] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.id, before), eq(messages.tenantId, tenantId)));
      if (cursor) conditions.push(lt(messages.createdAt, cursor.createdAt));
    }

    const rows = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows.reverse();
  });
};

export default messagesRoutes;

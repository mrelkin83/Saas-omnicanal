import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { patchConversationSchema, createMessageSchema } from './conversations.schemas.js';
import { listConversations, listConversationsWithCustomer, getConversationById, updateConversation, addMessage, setAIState, getAIState } from './conversations.service.js';
import { sendMessage as channelSend } from '../channels/core/channel-manager.js';
import { db, conversations, customers, eq, and } from '@saas/db';

const conversationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const opts: { status?: string; channel?: string; limit?: number } = {};
    if (q['status']) opts.status = q['status'];
    if (q['channel']) opts.channel = q['channel'];
    if (q['limit']) opts.limit = parseInt(q['limit'], 10);
    if (q['withCustomer'] === 'true') return listConversationsWithCustomer(request.user!.tenantId, opts);
    return listConversations(request.user!.tenantId, opts);
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const conv = await getConversationById(request.user!.tenantId, id);
    if (!conv) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return conv;
  });

  fastify.patch('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = patchConversationSchema.parse(request.body);
    const conv = await updateConversation(request.user!.tenantId, id, data);
    if (!conv) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return conv;
  });

  fastify.get('/:id/messages', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(q['limit'] ?? '50', 10), 100);
    const conv = await getConversationById(request.user!.tenantId, id);
    if (!conv) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return conv.messages.slice(-limit);
  });

  fastify.post('/:id/messages', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = createMessageSchema.parse(request.body);
    const msg = await addMessage(tenantId, id, request.user!.sub, data);
    if (!msg) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });

    // Deliver via channel (best-effort: if no active session, just skip)
    try {
      const [row] = await db
        .select({ channel: conversations.channel, customerPhone: customers.phone })
        .from(conversations)
        .innerJoin(customers, eq(customers.id, conversations.customerId))
        .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
      if (row?.customerPhone) {
        await channelSend(tenantId, row.channel as Parameters<typeof channelSend>[1], row.customerPhone, {
          type: 'text',
          text: data.content,
        });
      }
    } catch { /* channel not connected — message saved but not sent */ }

    return reply.status(201).send(msg);
  });

  const aiStateSchema = z.object({ state: z.enum(['IA_ACTIVA', 'AGENTE_ACTIVO']) });

  fastify.put('/:id/ai-state', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { state } = aiStateSchema.parse(request.body);
    const result = await setAIState(request.user!.tenantId, id, state);
    if (!result) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return result;
  });

  fastify.get('/:id/ai-state', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await getAIState(request.user!.tenantId, id);
    if (!result) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return result;
  });
};

export default conversationsRoutes;

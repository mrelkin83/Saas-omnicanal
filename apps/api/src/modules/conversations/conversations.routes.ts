import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { patchConversationSchema, createMessageSchema } from './conversations.schemas.js';
import { listConversations, getConversationById, updateConversation, addMessage } from './conversations.service.js';

const conversationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const opts: { status?: string; limit?: number } = {};
    if (q['status']) opts.status = q['status'];
    if (q['limit']) opts.limit = parseInt(q['limit'], 10);
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

  fastify.post('/:id/messages', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createMessageSchema.parse(request.body);
    const msg = await addMessage(request.user!.tenantId, id, request.user!.sub, data);
    if (!msg) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return reply.status(201).send(msg);
  });
};

export default conversationsRoutes;

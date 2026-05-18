import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { listKnowledge, createKnowledgeEntry, deleteKnowledgeEntry, listUnanswered } from './knowledge-base.service.js';

const createKnowledgeSchema = z.object({
  question: z.string().min(1).max(1000),
  answer: z.string().min(1).max(5000),
  category: z.string().max(50).optional(),
  keywords: z.array(z.string()).optional(),
});

const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/knowledge', { preHandler: [requireAuth()] }, async (request) => {
    return listKnowledge(request.user!.tenantId);
  });

  fastify.post('/knowledge', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const data = createKnowledgeSchema.parse(request.body);
    const entryData: { question: string; answer: string; category?: string; keywords?: string[] } = {
      question: data.question,
      answer: data.answer,
    };
    if (data.category !== undefined) entryData.category = data.category;
    if (data.keywords !== undefined) entryData.keywords = data.keywords;
    const entry = await createKnowledgeEntry(request.user!.tenantId, entryData);
    return reply.status(201).send(entry);
  });

  fastify.delete('/knowledge/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteKnowledgeEntry(request.user!.tenantId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Entrada no encontrada', code: 'NOT_FOUND' });
    }
    return reply.status(204).send();
  });

  fastify.get('/unanswered', { preHandler: [requireAuth()] }, async (request) => {
    return listUnanswered(request.user!.tenantId);
  });
};

export default aiRoutes;

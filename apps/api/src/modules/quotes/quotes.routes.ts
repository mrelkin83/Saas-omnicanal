import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, quotes, customers, eq, and, desc } from '@saas/db';

const patchQuoteSchema = z.object({
  status: z.enum(['pending', 'sent', 'accepted', 'rejected']).optional(),
  total: z.number().positive().optional(),
  notes: z.string().optional(),
  validUntil: z.string().datetime().optional(),
});

const quotesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const q = request.query as Record<string, string | undefined>;
    const conditions = [eq(quotes.tenantId, tenantId)];
    if (q['status']) conditions.push(eq(quotes.status, q['status']));

    return db
      .select({
        id: quotes.id, quoteNumber: quotes.quoteNumber, status: quotes.status,
        total: quotes.total, validUntil: quotes.validUntil, createdAt: quotes.createdAt,
        customerId: quotes.customerId, customerName: customers.displayName,
      })
      .from(quotes)
      .leftJoin(customers, eq(customers.id, quotes.customerId))
      .where(and(...conditions))
      .orderBy(desc(quotes.createdAt))
      .limit(50);
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)));
    if (!quote) return reply.status(404).send({ error: 'Not Found', message: 'Cotización no encontrada', code: 'NOT_FOUND' });
    return quote;
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchQuoteSchema.parse(request.body);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.status !== undefined) set['status'] = data.status;
    if (data.total !== undefined) set['total'] = String(data.total);
    if (data.notes !== undefined) set['notes'] = data.notes;
    if (data.validUntil !== undefined) set['validUntil'] = new Date(data.validUntil);

    const [updated] = await db.update(quotes).set(set).where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId))).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Cotización no encontrada', code: 'NOT_FOUND' });
    return updated;
  });
};

export default quotesRoutes;

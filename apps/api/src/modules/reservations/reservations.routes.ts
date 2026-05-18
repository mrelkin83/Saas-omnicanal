import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, reservations, customers, eq, and, desc } from '@saas/db';

const patchReservationSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  notes: z.string().optional(),
  partySize: z.number().int().positive().optional(),
});

const reservationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const q = request.query as Record<string, string | undefined>;
    const conditions = [eq(reservations.tenantId, tenantId)];
    if (q['status']) conditions.push(eq(reservations.status, q['status']));

    return db
      .select({
        id: reservations.id, status: reservations.status, reservedDate: reservations.reservedDate,
        reservedTime: reservations.reservedTime, partySize: reservations.partySize,
        notes: reservations.notes, createdAt: reservations.createdAt,
        customerId: reservations.customerId, customerName: customers.displayName,
        customerPhone: customers.phone,
      })
      .from(reservations)
      .leftJoin(customers, eq(customers.id, reservations.customerId))
      .where(and(...conditions))
      .orderBy(desc(reservations.reservedDate))
      .limit(50);
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [reservation] = await db.select().from(reservations).where(and(eq(reservations.id, id), eq(reservations.tenantId, tenantId)));
    if (!reservation) return reply.status(404).send({ error: 'Not Found', message: 'Reserva no encontrada', code: 'NOT_FOUND' });
    return reservation;
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchReservationSchema.parse(request.body);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.status !== undefined) set['status'] = data.status;
    if (data.notes !== undefined) set['notes'] = data.notes;
    if (data.partySize !== undefined) set['partySize'] = data.partySize;

    const [updated] = await db.update(reservations).set(set).where(and(eq(reservations.id, id), eq(reservations.tenantId, tenantId))).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Reserva no encontrada', code: 'NOT_FOUND' });
    return updated;
  });
};

export default reservationsRoutes;

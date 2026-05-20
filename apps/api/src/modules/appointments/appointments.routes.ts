import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, appointments, customers, eq, and, ilike, desc } from '@saas/db';

const appointmentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { phone, customerId } = request.query as { phone?: string; customerId?: string };

    if (customerId) {
      return db
        .select()
        .from(appointments)
        .where(and(eq(appointments.tenantId, tenantId), eq(appointments.customerId, customerId)))
        .orderBy(desc(appointments.scheduledAt))
        .limit(20);
    }

    if (phone) {
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), ilike(customers.phone, phone)));

      if (!customer) return [];

      return db
        .select()
        .from(appointments)
        .where(and(eq(appointments.tenantId, tenantId), eq(appointments.customerId, customer.id)))
        .orderBy(desc(appointments.scheduledAt))
        .limit(20);
    }

    return db
      .select()
      .from(appointments)
      .where(eq(appointments.tenantId, tenantId))
      .orderBy(desc(appointments.scheduledAt))
      .limit(50);
  });

  const patchSchema = z.object({
    status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']).optional(),
    notes: z.string().optional(),
  });

  fastify.patch('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchSchema.parse(request.body);

    const [apt] = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
      .returning();

    if (!apt) return reply.status(404).send({ error: 'Not Found', message: 'Cita no encontrada', code: 'NOT_FOUND' });
    return apt;
  });
};

export default appointmentsRoutes;

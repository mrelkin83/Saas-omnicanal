import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, appointments, customers, eq, and, ilike, desc } from '@saas/db';

const appointmentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { phone } = request.query as { phone?: string };

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
};

export default appointmentsRoutes;

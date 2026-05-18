import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, orders, orderItems, customers, payments, deliveries, eq, and, desc } from '@saas/db';

const patchOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
});

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const q = request.query as Record<string, string | undefined>;

    const conditions = [eq(orders.tenantId, tenantId)];
    if (q['status']) conditions.push(eq(orders.status, q['status']));

    const rows = await db
      .select({
        id: orders.id, orderNumber: orders.orderNumber, status: orders.status,
        paymentStatus: orders.paymentStatus, total: orders.total,
        createdAt: orders.createdAt, customerId: orders.customerId,
        customerName: customers.displayName, customerPhone: customers.phone,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(50);

    return rows;
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };

    const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
    if (!order) return reply.status(404).send({ error: 'Not Found', message: 'Pedido no encontrado', code: 'NOT_FOUND' });

    const [items, pms, dels] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, id)),
      db.select().from(payments).where(and(eq(payments.orderId, id), eq(payments.tenantId, tenantId))),
      db.select().from(deliveries).where(and(eq(deliveries.orderId, id), eq(deliveries.tenantId, tenantId))),
    ]);

    return { ...order, items, payments: pms, deliveries: dels };
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchOrderSchema.parse(request.body);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.status !== undefined) set['status'] = data.status;
    if (data.paymentStatus !== undefined) set['paymentStatus'] = data.paymentStatus;
    if (data.shippingAddress !== undefined) set['shippingAddress'] = data.shippingAddress;
    if (data.notes !== undefined) set['notes'] = data.notes;

    const [updated] = await db.update(orders).set(set).where(and(eq(orders.id, id), eq(orders.tenantId, tenantId))).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Pedido no encontrado', code: 'NOT_FOUND' });
    return updated;
  });
};

export default ordersRoutes;

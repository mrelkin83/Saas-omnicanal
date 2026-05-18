import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, deliveries, orders, customers, eq, and, desc } from '@saas/db';

const createDeliverySchema = z.object({
  orderId: z.string().uuid(),
  address: z.string().min(1),
  courierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  estimatedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const patchDeliverySchema = z.object({
  status: z.enum(['pending', 'picked_up', 'in_transit', 'delivered', 'failed']).optional(),
  trackingNumber: z.string().optional(),
  courierName: z.string().optional(),
  estimatedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const deliveriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const q = request.query as Record<string, string | undefined>;
    const conditions = [eq(deliveries.tenantId, tenantId)];
    if (q['status']) conditions.push(eq(deliveries.status, q['status']));

    return db
      .select({
        id: deliveries.id, status: deliveries.status, address: deliveries.address,
        courierName: deliveries.courierName, trackingNumber: deliveries.trackingNumber,
        estimatedAt: deliveries.estimatedAt, deliveredAt: deliveries.deliveredAt,
        createdAt: deliveries.createdAt, orderId: deliveries.orderId,
        orderNumber: orders.orderNumber, customerName: customers.displayName,
      })
      .from(deliveries)
      .leftJoin(orders, eq(orders.id, deliveries.orderId))
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(and(...conditions))
      .orderBy(desc(deliveries.createdAt))
      .limit(50);
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = createDeliverySchema.parse(request.body);

    const [order] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, data.orderId), eq(orders.tenantId, tenantId)));
    if (!order) return reply.status(404).send({ error: 'Not Found', message: 'Pedido no encontrado', code: 'NOT_FOUND' });

    const [delivery] = await db.insert(deliveries).values({
      tenantId,
      orderId: data.orderId,
      address: data.address,
      courierName: data.courierName,
      trackingNumber: data.trackingNumber,
      estimatedAt: data.estimatedAt ? new Date(data.estimatedAt) : undefined,
      notes: data.notes,
      status: 'pending',
    }).returning();

    return reply.status(201).send(delivery);
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchDeliverySchema.parse(request.body);

    const set: Record<string, unknown> = {};
    if (data.status !== undefined) {
      set['status'] = data.status;
      if (data.status === 'delivered') set['deliveredAt'] = new Date();
    }
    if (data.trackingNumber !== undefined) set['trackingNumber'] = data.trackingNumber;
    if (data.courierName !== undefined) set['courierName'] = data.courierName;
    if (data.estimatedAt !== undefined) set['estimatedAt'] = new Date(data.estimatedAt);
    if (data.notes !== undefined) set['notes'] = data.notes;

    const [updated] = await db.update(deliveries).set(set).where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId))).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Domicilio no encontrado', code: 'NOT_FOUND' });
    return updated;
  });
};

export default deliveriesRoutes;

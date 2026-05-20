import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, payments, customers, eq, and, desc } from '@saas/db';
import { createPaymentLink } from '../../lib/wompi-client.js';
import { getTenantWompiCredentials, WompiNotConfiguredError } from '../../lib/wompi-tenant.js';

const createLinkSchema = z.object({
  amount: z.number().positive(),
  customerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  customerEmail: z.string().email().optional(),
  redirectUrl: z.string().url().optional(),
});

const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const q = request.query as Record<string, string | undefined>;
    const conditions = [eq(payments.tenantId, tenantId)];
    if (q['status']) conditions.push(eq(payments.status, q['status']));

    return db
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt))
      .limit(50);
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };

    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.tenantId, tenantId)));

    if (!payment) return reply.status(404).send({ error: 'Not Found', message: 'Pago no encontrado', code: 'NOT_FOUND' });
    return payment;
  });

  fastify.post('/create-link', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = createLinkSchema.parse(request.body);

    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, data.customerId), eq(customers.tenantId, tenantId)));

    if (!customer) {
      return reply.status(404).send({ error: 'Not Found', message: 'Cliente no encontrado', code: 'NOT_FOUND' });
    }

    let creds;
    try {
      creds = await getTenantWompiCredentials(tenantId);
    } catch (err) {
      if (err instanceof WompiNotConfiguredError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Integración Wompi no configurada para este tenant',
          code: 'WOMPI_NOT_CONFIGURED',
        });
      }
      throw err;
    }

    const reference = `PAY-${randomUUID().slice(0, 8).toUpperCase()}`;
    const amountInCents = Math.round(data.amount * 100);

    const { id: linkId, url } = await createPaymentLink(creds, {
      reference,
      amountInCents,
      ...(data.customerEmail ? { customerEmail: data.customerEmail } : {}),
      ...(data.redirectUrl ? { redirectUrl: data.redirectUrl } : {}),
    });

    const [payment] = await db
      .insert(payments)
      .values({
        tenantId,
        customerId: data.customerId,
        orderId: data.orderId,
        appointmentId: data.appointmentId,
        provider: 'wompi',
        externalId: linkId,
        amount: String(data.amount),
        currency: 'COP',
        status: 'pending',
        paymentLink: url,
      })
      .returning();

    return reply.status(201).send(payment!);
  });
};

export default paymentsRoutes;

import type { FastifyRequest, FastifyReply } from 'fastify';
import { db, payments, orders, tenants, eq } from '@saas/db';
import { verifyWompiSignature } from '../../lib/wompi-client.js';
import { getTenantWompiCredentials, WompiNotConfiguredError } from '../../lib/wompi-tenant.js';

interface WompiWebhookPayload {
  event: string;
  data: {
    transaction: {
      id: string;
      status: string;
      reference: string;
      amount_in_cents: number;
    };
  };
  sent_at?: string | undefined;
  timestamp?: number | undefined;
  signature?: { checksum?: string | undefined; properties?: string[] | undefined } | undefined;
}

export async function wompiWebhookHandler(
  request: FastifyRequest<{ Params: { tenantId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = request.params;
  const body = request.body as WompiWebhookPayload;
  const rawBody = JSON.stringify(body);

  // Ensure tenant exists
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    reply.status(404).send({ error: 'Not Found' });
    return;
  }

  // Fetch tenant Wompi credentials to verify signature
  let eventSecret = '';
  try {
    const creds = await getTenantWompiCredentials(tenantId);
    eventSecret = creds.eventSecret;
  } catch (err) {
    if (!(err instanceof WompiNotConfiguredError)) {
      reply.status(500).send({ error: 'Internal error' });
      return;
    }
    reply.status(200).send({ ok: true, skipped: 'no_wompi_config' });
    return;
  }

  const checksum = body.signature?.checksum ?? '';
  const timestamp = String(body.timestamp ?? '');
  if (!checksum || !eventSecret) {
    return reply.status(401).send({ error: 'Missing signature' });
  }
  if (!verifyWompiSignature(rawBody, checksum, timestamp, eventSecret)) {
    return reply.status(401).send({ error: 'Invalid signature' });
  }

  if (body.event !== 'transaction.updated') {
    reply.status(200).send({ ok: true });
    return;
  }

  const tx = body.data.transaction;
  const status = tx.status === 'APPROVED' ? 'paid' : tx.status === 'DECLINED' ? 'failed' : 'pending';

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.reference, tx.reference))
    .limit(1);

  // Reject if payment doesn't belong to this tenant
  if (!payment || payment.tenantId !== tenantId) {
    reply.status(404).send({ error: 'Not Found' });
    return;
  }

  await db
    .update(payments)
    .set({ status, externalId: tx.id, ...(status === 'paid' ? { paidAt: new Date() } : {}) })
    .where(eq(payments.id, payment.id));

  if (payment.orderId) {
    await db
      .update(orders)
      .set({
        paymentStatus: status,
        ...(status === 'paid'
          ? { status: 'confirmed', updatedAt: new Date() }
          : { updatedAt: new Date() }),
      })
      .where(eq(orders.id, payment.orderId));
  }

  reply.status(200).send({ ok: true });
}

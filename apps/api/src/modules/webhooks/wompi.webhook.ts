import type { FastifyRequest, FastifyReply } from 'fastify';
import { db, payments, orders, eq } from '@saas/db';
import { verifyWompiSignature } from '../../lib/wompi-client.js';

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
  sent_at?: string;
  timestamp?: number;
  signature?: { checksum?: string; properties?: string[] };
}

export async function wompiWebhookHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body as WompiWebhookPayload;
  const rawBody = JSON.stringify(body);

  // Verify signature when configured
  const checksum = body.signature?.checksum ?? '';
  const timestamp = String(body.timestamp ?? '');
  if (checksum && !verifyWompiSignature(rawBody, checksum, timestamp)) {
    reply.status(401).send({ error: 'Invalid signature' });
    return;
  }

  if (body.event !== 'transaction.updated') {
    reply.status(200).send({ ok: true });
    return;
  }

  const tx = body.data.transaction;
  const externalId = tx.id;
  const status = tx.status === 'APPROVED' ? 'paid' : tx.status === 'DECLINED' ? 'failed' : 'pending';

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.externalId, externalId))
    .limit(1);

  if (!payment) {
    reply.status(200).send({ ok: true });
    return;
  }

  await db.update(payments).set({
    status,
    ...(status === 'paid' ? { paidAt: new Date() } : {}),
  }).where(eq(payments.id, payment.id));

  // If payment is linked to an order, update it too
  if (payment.orderId) {
    await db.update(orders).set({
      paymentStatus: status,
      ...(status === 'paid' ? { status: 'confirmed', updatedAt: new Date() } : { updatedAt: new Date() }),
    }).where(eq(orders.id, payment.orderId));
  }

  reply.status(200).send({ ok: true });
}

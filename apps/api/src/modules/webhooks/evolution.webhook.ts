import type { FastifyRequest, FastifyReply } from 'fastify';
import { db, channelSessions, tenants, eq, and } from '@saas/db';
import { pushSSEEvent } from '../channels/core/sse-registry.js';
import { updateSessionStatus } from '../channels/channels.service.js';
import { findOrCreateCustomer, findOrCreateConversation, saveInboundMessage, saveOutboundMessage } from '../conversations/conversations.messaging.js';
import { runAIEngine } from '../ai/ai.engine.js';
import * as evo from '../../lib/evolution-api.client.js';

interface EvoEvent {
  event: string;
  instance: string;
  data: Record<string, unknown>;
}

async function findTenantByInstance(instanceName: string) {
  const [session] = await db
    .select({ tenantId: channelSessions.tenantId })
    .from(channelSessions)
    .where(and(eq(channelSessions.externalId, instanceName), eq(channelSessions.channel, 'whatsapp')));
  if (!session) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, session.tenantId));
  return tenant ?? null;
}

async function handleQRCodeUpdated(instanceName: string, data: Record<string, unknown>) {
  const qr = data['qrcode'] as { base64?: string } | undefined;
  if (!qr?.base64) return;

  const tenant = await findTenantByInstance(instanceName);
  if (tenant) {
    pushSSEEvent(tenant.id, 'qr', { qrCode: qr.base64 });
  }
}

async function handleConnectionUpdate(instanceName: string, data: Record<string, unknown>) {
  const state = data['state'] as string | undefined;
  const number = (data['wuid'] as string | undefined)?.replace('@s.whatsapp.net', '');

  const tenant = await findTenantByInstance(instanceName);
  if (!tenant) return;

  if (state === 'open') {
    await updateSessionStatus(tenant.id, 'whatsapp', 'connected', number ?? undefined);
    pushSSEEvent(tenant.id, 'connected', { phone: number ?? null });
  } else if (state === 'close' || state === 'refused') {
    await updateSessionStatus(tenant.id, 'whatsapp', 'disconnected');
    pushSSEEvent(tenant.id, 'disconnected', {});
  }
}

async function handleMessagesUpsert(instanceName: string, data: Record<string, unknown>) {
  const msgs = data['messages'] as { key?: { remoteJid?: string; id?: string; fromMe?: boolean }; message?: { conversation?: string; extendedTextMessage?: { text?: string } } }[] | undefined;
  if (!Array.isArray(msgs)) return;

  const tenant = await findTenantByInstance(instanceName);
  if (!tenant) return;

  for (const msg of msgs) {
    if (msg.key?.fromMe) continue;
    const remoteJid = msg.key?.remoteJid ?? '';
    if (remoteJid.endsWith('@g.us')) continue; // skip groups for now

    const phone = remoteJid.replace('@s.whatsapp.net', '');
    const text = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? '';
    if (!text.trim()) continue;

    const externalId = msg.key?.id;

    try {
      const customer = await findOrCreateCustomer(tenant.id, phone);
      const conversation = await findOrCreateConversation(tenant.id, customer.id, 'whatsapp', null);

      await saveInboundMessage(tenant.id, conversation.id, customer.id, text, externalId);

      const result = await runAIEngine(tenant, customer.id, text, 'whatsapp', conversation.id);

      let outboundExternalId: string | undefined;
      try {
        const sent = await evo.sendText(instanceName, remoteJid, result.response);
        outboundExternalId = sent.key.id;
      } catch (err) {
        console.error('Failed to send WhatsApp reply:', err);
      }

      await saveOutboundMessage(tenant.id, conversation.id, customer.id, result.response, outboundExternalId);
    } catch (err) {
      console.error('Error processing WhatsApp message:', err);
    }
  }
}

export async function evolutionWebhookHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body as EvoEvent;
  const { event, instance, data } = body;

  request.log.info({ event, instance }, 'Evolution webhook received');

  switch (event) {
    case 'QRCODE_UPDATED':
      await handleQRCodeUpdated(instance, data);
      break;
    case 'CONNECTION_UPDATE':
      await handleConnectionUpdate(instance, data);
      break;
    case 'MESSAGES_UPSERT':
      await handleMessagesUpsert(instance, data);
      break;
    default:
      break;
  }

  await reply.status(200).send({ ok: true });
}

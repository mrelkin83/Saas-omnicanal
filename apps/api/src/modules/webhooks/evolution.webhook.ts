import type { FastifyRequest, FastifyReply } from 'fastify';
import { db, channelSessions, eq, and } from '@saas/db';
import { pushSSEEvent } from '../channels/core/sse-registry.js';
import { updateSessionStatus } from '../channels/channels.service.js';
import { whatsappDriver } from '../channels/drivers/whatsapp/whatsapp.driver.js';

interface EvoEvent {
  event: string;
  instance: string;
  data: Record<string, unknown>;
}

async function findTenantIdByInstance(instanceName: string): Promise<string | null> {
  const [session] = await db
    .select({ tenantId: channelSessions.tenantId })
    .from(channelSessions)
    .where(and(eq(channelSessions.externalId, instanceName), eq(channelSessions.channel, 'whatsapp')));
  return session?.tenantId ?? null;
}

async function handleQRCodeUpdated(instanceName: string, data: Record<string, unknown>) {
  const qr = data['qrcode'] as { base64?: string } | undefined;
  if (!qr?.base64) return;

  const tenantId = await findTenantIdByInstance(instanceName);
  if (tenantId) {
    pushSSEEvent(tenantId, 'qr', { qrCode: qr.base64 });
  }
}

async function handleConnectionUpdate(instanceName: string, data: Record<string, unknown>) {
  const state = data['state'] as string | undefined;
  const number = (data['wuid'] as string | undefined)?.replace('@s.whatsapp.net', '');

  const tenantId = await findTenantIdByInstance(instanceName);
  if (!tenantId) return;

  if (state === 'open') {
    await updateSessionStatus(tenantId, 'whatsapp', 'connected', number ?? undefined);
    pushSSEEvent(tenantId, 'connected', { phone: number ?? null });
  } else if (state === 'close' || state === 'refused') {
    await updateSessionStatus(tenantId, 'whatsapp', 'disconnected');
    pushSSEEvent(tenantId, 'disconnected', {});
  }
}

async function handleMessagesUpsert(instanceName: string, data: Record<string, unknown>) {
  const msgs = data['messages'] as {
    key?: { remoteJid?: string; id?: string; fromMe?: boolean };
    message?: { conversation?: string; extendedTextMessage?: { text?: string } };
  }[] | undefined;
  if (!Array.isArray(msgs)) return;

  const tenantId = await findTenantIdByInstance(instanceName);
  if (!tenantId) return;

  for (const msg of msgs) {
    if (msg.key?.fromMe) continue;
    const remoteJid = msg.key?.remoteJid ?? '';
    if (remoteJid.endsWith('@g.us')) continue;

    const phone = remoteJid.replace('@s.whatsapp.net', '');
    const text = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? '';
    if (!text.trim()) continue;

    try {
      await whatsappDriver.dispatchIncoming({
        externalId: msg.key?.id ?? '',
        tenantId,
        channel: 'whatsapp',
        sessionId: instanceName,
        from: phone,
        text,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Error dispatching incoming WhatsApp message:', err);
    }
  }
}

export async function evolutionWebhookHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = (request.headers['apikey'] as string | undefined)
    ?? (request.headers['x-api-key'] as string | undefined);
  if (!apiKey || apiKey !== process.env['EVOLUTION_API_GLOBAL_KEY']) {
    reply.status(403).send({ error: 'Forbidden', message: 'Invalid API key' });
    return;
  }

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

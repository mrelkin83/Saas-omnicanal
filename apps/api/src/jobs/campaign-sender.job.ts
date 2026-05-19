import { Queue, Worker } from 'bullmq';
import { db, campaigns, campaignLogs, contactListEntries, channelSessions, eq, and } from '@saas/db';
import { makeBullMQConnection } from '../lib/redis.js';
import * as evo from '../lib/evolution-api.client.js';

const QUEUE_NAME = 'campaign-sender';
const RATE_LIMIT = 30; // messages per minute

let queue: Queue | null = null;
let worker: Worker | null = null;

function resolveVariables(template: string, vars: Record<string, string>, name?: string | null): string {
  let result = template;
  if (name) result = result.replace(/\{\{nombre\}\}/gi, name);
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), v);
  }
  return result;
}

async function runCampaign(campaignId: string, tenantId: string): Promise<void> {
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)));
  if (!campaign || campaign.status === 'cancelled' || campaign.status === 'done') return;

  await db.update(campaigns).set({ status: 'running', updatedAt: new Date() }).where(eq(campaigns.id, campaignId));

  // Get WhatsApp session for this tenant
  const [session] = campaign.channelSessionId
    ? await db.select().from(channelSessions).where(eq(channelSessions.id, campaign.channelSessionId))
    : await db.select().from(channelSessions).where(and(eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, 'whatsapp'), eq(channelSessions.status, 'connected')));

  if (!session?.externalId) {
    await db.update(campaigns).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
    return;
  }

  const instanceName = session.externalId;
  const messages = campaign.messages as { text: string }[];
  const contacts = await db.select().from(contactListEntries).where(eq(contactListEntries.listId, campaign.listId));

  let sent = 0;
  let failed = 0;
  const intervalMs = Math.ceil(60_000 / RATE_LIMIT); // ms between sends

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]!;

    // Check if cancelled mid-run
    const [current] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, campaignId));
    if (current?.status === 'cancelled' || current?.status === 'paused') break;

    // Rotate through messages
    const msgIndex = i % messages.length;
    const template = messages[msgIndex]!.text;
    const vars = (contact.variables ?? {}) as Record<string, string>;
    const text = resolveVariables(template, vars, contact.name);

    const jid = contact.phone.includes('@') ? contact.phone : `${contact.phone}@s.whatsapp.net`;

    const [logRow] = await db.insert(campaignLogs).values({
      campaignId,
      contactPhone: contact.phone,
      contactName: contact.name,
      messageIndex: msgIndex,
      status: 'pending',
    }).returning({ id: campaignLogs.id });

    try {
      await evo.sendText(instanceName, jid, text);
      await db.update(campaignLogs).set({ status: 'sent', sentAt: new Date() }).where(eq(campaignLogs.id, logRow!.id));
      sent++;
    } catch {
      await db.update(campaignLogs).set({ status: 'failed', errorMessage: 'Send error' }).where(eq(campaignLogs.id, logRow!.id));
      failed++;
    }

    // Rate limit — wait between sends (skip wait after last contact)
    if (i < contacts.length - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  await db.update(campaigns).set({
    status: 'done',
    sentCount: sent,
    failedCount: failed,
    updatedAt: new Date(),
  }).where(eq(campaigns.id, campaignId));
}

export async function scheduleCampaign(campaignId: string, tenantId: string, delayMs: number): Promise<void> {
  if (!queue) return;
  await queue.add('send', { campaignId, tenantId }, {
    delay: delayMs,
    removeOnComplete: 20,
    removeOnFail: 10,
    jobId: `campaign-${campaignId}`,
  });
}

export function startCampaignSender(): void {
  queue = new Queue(QUEUE_NAME, { connection: makeBullMQConnection() });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { campaignId, tenantId } = job.data as { campaignId: string; tenantId: string };
      await runCampaign(campaignId, tenantId);
    },
    { connection: makeBullMQConnection(), concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    console.error('[campaign-sender] Job failed', job?.id, err.message);
  });
}

export async function stopCampaignSender(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

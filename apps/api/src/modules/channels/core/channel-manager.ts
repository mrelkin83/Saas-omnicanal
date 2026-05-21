import type { IChannelDriver, ChannelType, OutgoingMessage, NormalizedMessage } from './channel-driver.interface.js';
import { db, channelSessions, eq, and } from '@saas/db';
import { redis, makeBullMQConnection } from '../../../lib/redis.js';
import { Queue, Worker } from 'bullmq';

const WHATSAPP_MAX_PER_MINUTE = 30;
const SEND_QUEUE = 'channel-send';

const drivers = new Map<ChannelType, IChannelDriver>();

let sendQueue: Queue | null = null;
let sendWorker: Worker | null = null;

export function registerDriver(driver: IChannelDriver): void {
  drivers.set(driver.channel, driver);
}

export function getDriver(channel: ChannelType): IChannelDriver | undefined {
  return drivers.get(channel);
}

export function onIncomingMessage(channel: ChannelType, handler: (msg: NormalizedMessage) => Promise<void>): void {
  const driver = drivers.get(channel);
  if (driver) driver.onIncoming(handler);
}

async function whatsappRateCheck(instanceId: string): Promise<{ allowed: boolean; delayMs: number }> {
  const key = `rl:wa:${instanceId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  if (count > WHATSAPP_MAX_PER_MINUTE) {
    const ttl = await redis.ttl(key);
    return { allowed: false, delayMs: ((ttl > 0 ? ttl : 60) * 1000) + 500 };
  }
  return { allowed: true, delayMs: 0 };
}

export async function sendMessage(
  tenantId: string,
  channel: ChannelType,
  to: string,
  message: OutgoingMessage,
): Promise<void> {
  const driver = drivers.get(channel);
  if (!driver) throw new Error(`No driver registered for channel: ${channel}`);

  const [session] = await db
    .select({ id: channelSessions.id, externalId: channelSessions.externalId })
    .from(channelSessions)
    .where(and(eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, channel), eq(channelSessions.status, 'connected')));

  if (!session) throw new Error(`No active ${channel} session for tenant ${tenantId}`);

  const instanceId = session.externalId ?? session.id;

  if (channel === 'whatsapp') {
    const { allowed, delayMs } = await whatsappRateCheck(instanceId);
    if (!allowed) {
      if (sendQueue) {
        await sendQueue.add(
          'send',
          { channel, sessionExternalId: instanceId, to, message },
          { delay: delayMs, removeOnComplete: 50, removeOnFail: 20 },
        );
      }
      return;
    }
  }

  await driver.sendMessage(instanceId, to, message);
}

export function initChannelSendQueue(): void {
  if (sendQueue) return;
  sendQueue = new Queue(SEND_QUEUE, { connection: makeBullMQConnection() });
  sendWorker = new Worker(
    SEND_QUEUE,
    async (job) => {
      const { channel, sessionExternalId, to, message } = job.data as {
        channel: ChannelType;
        sessionExternalId: string;
        to: string;
        message: OutgoingMessage;
      };
      const driver = drivers.get(channel);
      if (!driver) throw new Error(`No driver for channel: ${channel}`);
      await driver.sendMessage(sessionExternalId, to, message);
    },
    { connection: makeBullMQConnection(), concurrency: 5 },
  );
  sendWorker.on('failed', (job, err) => {
    console.error('[channel-send] Job failed', job?.id, err.message);
  });
}

export async function stopChannelSendQueue(): Promise<void> {
  await sendWorker?.close();
  await sendQueue?.close();
  sendWorker = null;
  sendQueue = null;
}

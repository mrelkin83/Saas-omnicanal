import { Queue, Worker } from 'bullmq';
import { db, channelSessions, eq, and } from '@saas/db';
import { makeBullMQConnection } from '../lib/redis.js';
import { instagramDriver } from '../modules/channels/drivers/instagram/instagram.driver.js';
import { handleIncomingMessage } from '../modules/channels/core/incoming-handler.js';

const QUEUE_NAME = 'instagram-poller';
const INTERVAL_MS = (parseInt(process.env['IG_POLL_INTERVAL_SECONDS'] ?? '20', 10)) * 1000;

let queue: Queue | null = null;
let worker: Worker | null = null;

export function startInstagramPoller(): void {
  queue = new Queue(QUEUE_NAME, { connection: makeBullMQConnection() });

  // Schedule recurring poll job
  queue.add('poll', {}, {
    repeat: { every: INTERVAL_MS },
    removeOnComplete: 10,
    removeOnFail: 5,
  }).catch(() => null);

  worker = new Worker(
    QUEUE_NAME,
    async () => {
      const sessions = await db
        .select({ tenantId: channelSessions.tenantId, externalId: channelSessions.externalId })
        .from(channelSessions)
        .where(and(eq(channelSessions.channel, 'instagram'), eq(channelSessions.status, 'connected')));

      for (const session of sessions) {
        await instagramDriver.pollAndDispatch(session.externalId ?? session.tenantId);
      }
    },
    { connection: makeBullMQConnection(), concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error('[instagram-poller] Job failed', job?.id, err.message);
  });

  // Register incoming handler
  instagramDriver.onIncoming(handleIncomingMessage);
}

export async function stopInstagramPoller(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

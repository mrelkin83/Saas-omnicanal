import { Queue, Worker } from 'bullmq';
import { db, channelSessions, eq, and } from '@saas/db';
import { makeBullMQConnection } from '../lib/redis.js';
import { tiktokDriver } from '../modules/channels/drivers/tiktok/tiktok.driver.js';
import { handleIncomingMessage } from '../modules/channels/core/incoming-handler.js';

const QUEUE_NAME = 'tiktok-scraper';
const INTERVAL_MS = (parseInt(process.env['TT_POLL_INTERVAL_SECONDS'] ?? '60', 10)) * 1000;

let queue: Queue | null = null;
let worker: Worker | null = null;

export function startTikTokScraper(): void {
  queue = new Queue(QUEUE_NAME, { connection: makeBullMQConnection() });

  queue.add('scrape', {}, {
    repeat: { every: INTERVAL_MS },
    removeOnComplete: 10,
    removeOnFail: 5,
  }).catch(() => null);

  worker = new Worker(
    QUEUE_NAME,
    async () => {
      const sessions = await db
        .select({ tenantId: channelSessions.tenantId })
        .from(channelSessions)
        .where(and(eq(channelSessions.channel, 'tiktok'), eq(channelSessions.status, 'connected')));

      for (const session of sessions) {
        await tiktokDriver.pollAndDispatch(session.tenantId);
      }
    },
    { connection: makeBullMQConnection(), concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error('[tiktok-scraper] Job failed', job?.id, err.message);
  });

  tiktokDriver.onIncoming(handleIncomingMessage);
}

export async function stopTikTokScraper(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

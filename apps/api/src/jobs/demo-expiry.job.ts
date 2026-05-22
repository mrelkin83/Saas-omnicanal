import { Queue, Worker } from 'bullmq';
import { db, tenants, and, eq, lte, isNull, isNotNull } from '@saas/db';
import { makeBullMQConnection } from '../lib/redis.js';

const QUEUE_NAME = 'demo-expiry-job';
const INTERVAL_MS = 3_600_000; // 1 hora

let queue: Queue | null = null;
let worker: Worker | null = null;

async function checkExpiredDemos(): Promise<void> {
  try {
    const now = new Date();
    await db
      .update(tenants)
      .set({ suspendedAt: now, suspendedReason: 'Demo vencida', updatedAt: now })
      .where(
        and(
          eq(tenants.isDemo, true),
          isNotNull(tenants.demoExpiresAt),
          lte(tenants.demoExpiresAt, now),
          isNull(tenants.suspendedAt),
        ),
      );
  } catch {
    // DB tables may not exist yet (migrations pending) — retry on next interval
  }
}

export function startDemoExpiryJob(): void {
  queue = new Queue(QUEUE_NAME, { connection: makeBullMQConnection() });
  queue.add('check', {}, {
    repeat: { every: INTERVAL_MS },
    removeOnComplete: 10,
    removeOnFail: 5,
  }).catch(() => null);
  worker = new Worker(QUEUE_NAME, async () => {
    await checkExpiredDemos();
  }, { connection: makeBullMQConnection(), concurrency: 1 });
  worker.on('failed', (job, err) => {
    console.error('[demo-expiry-job] Job failed', job?.id, err.message);
  });
}

export async function stopDemoExpiryJob(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

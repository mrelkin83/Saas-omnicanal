import { Queue, Worker } from 'bullmq';
import { checkAndSuspendExpiredSubscriptions } from '../modules/billing/billing.service.js';
import { makeBullMQConnection } from '../lib/redis.js';

const QUEUE_NAME = 'billing-enforcement';
const INTERVAL_MS = 3_600_000;

let queue: Queue | null = null;
let worker: Worker | null = null;

export function startBillingEnforcement(): void {
  queue = new Queue(QUEUE_NAME, { connection: makeBullMQConnection() });
  queue.add('check', {}, {
    repeat: { every: INTERVAL_MS },
    removeOnComplete: 10,
    removeOnFail: 5,
  }).catch(() => null);
  worker = new Worker(QUEUE_NAME, async () => {
    const count = await checkAndSuspendExpiredSubscriptions();
    if (count > 0) console.log(`[billing-enforcement] Suspended ${count} expired subscriptions`);
  }, { connection: makeBullMQConnection(), concurrency: 1 });
  worker.on('failed', (job, err) => {
    console.error('[billing-enforcement] Job failed', job?.id, err.message);
  });
}

export async function stopBillingEnforcement(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

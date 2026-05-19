import { Redis } from 'ioredis';

const REDIS_URL = process.env['REDIS_URL'];
if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});

// BullMQ workers use blocking commands and require maxRetriesPerRequest: null.
// Each call creates an independent connection (BullMQ manages its own lifecycle).
export function makeBullMQConnection(): Redis {
  const conn = new Redis(REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  conn.on('error', (err: Error) => {
    console.error('[redis/bullmq] connection error:', err.message);
  });
  return conn;
}

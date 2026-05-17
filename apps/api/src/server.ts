import Fastify from 'fastify';

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const HOST = process.env['API_HOST'] ?? '0.0.0.0';
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';

const app = Fastify({
  logger: {
    level: LOG_LEVEL,
    ...(process.env['NODE_ENV'] !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  },
});

app.get('/health', async () => {
  return { ok: true, timestamp: new Date().toISOString(), version: '0.0.1' };
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

await start();

import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { redis } from '../lib/redis.js';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (request) => {
      const tenantId = request.headers['x-tenant-id'] as string | undefined;
      return tenantId
        ? `rate:tenant:${tenantId}:${request.ip}`
        : `rate:ip:${request.ip}`;
    },
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'Has excedido el límite de solicitudes. Intenta de nuevo en un minuto.',
      code: 'RATE_LIMIT_EXCEEDED',
    }),
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });

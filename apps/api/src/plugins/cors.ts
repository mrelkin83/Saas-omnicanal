import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const isProd = process.env['NODE_ENV'] === 'production';
  const allowedOrigins = process.env['CORS_ALLOWED_ORIGINS']
    ? process.env['CORS_ALLOWED_ORIGINS'].split(',')
    : true;

  await fastify.register(fastifyCors, {
    origin: isProd ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials: true,
  });
};

export default fp(corsPlugin, { name: 'cors' });

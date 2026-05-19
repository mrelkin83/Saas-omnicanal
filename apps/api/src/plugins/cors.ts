import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyCors, {
    // Allow all origins — the API is only reachable through the Caddy reverse
    // proxy; JWT auth on every protected route is the actual access control.
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials: true,
  });
};

export default fp(corsPlugin, { name: 'cors' });

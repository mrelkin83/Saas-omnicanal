import type { FastifyPluginAsync } from 'fastify';
import { evolutionWebhookHandler } from './evolution.webhook.js';
import { wompiWebhookHandler } from './wompi.webhook.js';

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/evolution', evolutionWebhookHandler);
  // Per-tenant URL: each tenant configures https://domain/api/webhooks/wompi/{tenantId} in their Wompi account
  fastify.post('/wompi/:tenantId', wompiWebhookHandler);
};

export default webhooksRoutes;

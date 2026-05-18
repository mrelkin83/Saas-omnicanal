import type { FastifyPluginAsync } from 'fastify';
import { evolutionWebhookHandler } from './evolution.webhook.js';
import { wompiWebhookHandler } from './wompi.webhook.js';

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/evolution', evolutionWebhookHandler);
  fastify.post('/wompi', wompiWebhookHandler);
};

export default webhooksRoutes;

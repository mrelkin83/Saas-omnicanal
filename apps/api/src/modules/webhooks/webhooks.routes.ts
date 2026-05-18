import type { FastifyPluginAsync } from 'fastify';
import { evolutionWebhookHandler } from './evolution.webhook.js';

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // Evolution API webhook — no auth (called by Evolution API server)
  fastify.post('/evolution', evolutionWebhookHandler);
};

export default webhooksRoutes;

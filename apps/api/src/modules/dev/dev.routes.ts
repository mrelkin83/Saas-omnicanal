import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { getTenantById } from '../tenants/tenants.service.js';
import { findOrCreateCustomer } from '../conversations/conversations.messaging.js';
import { runAIEngine } from '../ai/ai.engine.js';
import type { ChannelType } from '../channels/core/channel-driver.interface.js';

const simulateBodySchema = z.object({
  customerPhone: z.string().min(1),
  message: z.string().min(1),
  channel: z.enum(['whatsapp', 'instagram', 'facebook', 'tiktok']).default('whatsapp'),
});

const devRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/simulate-message', { preHandler: [requireAuth()] }, async (request, reply) => {
    if (process.env['NODE_ENV'] === 'production') {
      return reply.status(404).send({ error: 'Not Found' });
    }
    const tenantId = request.user!.tenantId;

    const parsed = simulateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', message: 'customerPhone y message son requeridos', code: 'VALIDATION_ERROR' });
    }

    const { customerPhone, message, channel } = parsed.data;

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tenant no encontrado', code: 'NOT_FOUND' });
    }

    const customer = await findOrCreateCustomer(tenantId, customerPhone);
    const result = await runAIEngine(tenant, customer.id, message, channel as ChannelType, null);

    if (result.llmFailed) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'El servicio de IA no está disponible. Verifica la configuración de la API key de OpenAI.',
        code: 'LLM_UNAVAILABLE',
      });
    }

    return { aiResponse: result.response, customerId: customer.id, tool: result.toolName };
  });
};

export default devRoutes;

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, customers, eq, and, ilike } from '@saas/db';
import { getTenantById } from '../tenants/tenants.service.js';
import { getHistory, appendHistory } from '../ai/conversation-state.service.js';
import { buildDynamicContext } from '../ai/ai.context-builder.js';
import { searchKnowledge, logUnanswered } from '../ai/knowledge-base.service.js';
import { buildSystemPrompt } from '../ai/ai.prompt-builder.js';
import { callLLM } from '../../lib/llm-client.js';
import { parseAction } from '../ai/ai.action-parser.js';
import { routeAction } from '../ai/ai.action-router.js';

const simulateBodySchema = z.object({
  customerPhone: z.string().min(1),
  message: z.string().min(1),
  channel: z.string().default('whatsapp'),
});

const devRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/simulate-message', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;

    const parsed = simulateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', message: 'customerPhone y message son requeridos', code: 'VALIDATION_ERROR' });
    }

    const { customerPhone, message, channel } = parsed.data;

    // Find or create customer by phone
    let [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), ilike(customers.phone, customerPhone)));

    if (!customer) {
      const [created] = await db
        .insert(customers)
        .values({ tenantId, phone: customerPhone, displayName: customerPhone })
        .returning();
      customer = created!;
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tenant no encontrado', code: 'NOT_FOUND' });
    }

    const capabilities = tenant.capabilities ?? [];
    const history = await getHistory(tenantId, customer.id, channel);
    const dynamicContext = await buildDynamicContext(tenantId, customer.id);
    const knowledgeContext = await searchKnowledge(tenantId, message);

    const currentDateTime = new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const systemPrompt = buildSystemPrompt({ tenant, capabilities, knowledgeContext, dynamicContext, currentDateTime });

    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    const llmOpts: { tenantId: string; model?: string; temperature?: number; maxTokens?: number } = { tenantId };
    if (tenant.aiModel) llmOpts.model = tenant.aiModel;
    if (tenant.aiTemperature) llmOpts.temperature = Number(tenant.aiTemperature);
    if (tenant.aiMaxTokens) llmOpts.maxTokens = tenant.aiMaxTokens;

    let llmResponse: string;
    try {
      llmResponse = await callLLM(llmMessages, llmOpts);
    } catch (err) {
      request.log.error({ err }, 'LLM call failed');
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'El servicio de IA no está disponible en este momento. Verifica la configuración de la API key de OpenAI.',
        code: 'LLM_UNAVAILABLE',
      });
    }

    let aiResponse = llmResponse;

    const action = parseAction(llmResponse);
    if (action) {
      aiResponse = await routeAction(action.accion, action.params, tenant, customer.id, capabilities);
    } else if (knowledgeContext === '' && !llmResponse.trim()) {
      await logUnanswered(tenantId, customer.id, null, message);
    }

    await appendHistory(tenantId, customer.id, channel, 'user', message);
    await appendHistory(tenantId, customer.id, channel, 'assistant', aiResponse);

    return { aiResponse, customerId: customer.id, action: action?.accion ?? null };
  });
};

export default devRoutes;

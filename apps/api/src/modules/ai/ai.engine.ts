import type { Tenant } from '@saas/db';
import { db, conversationState, eq, and } from '@saas/db';
import { getHistory, appendHistory } from './conversation-state.service.js';
import { buildDynamicContext } from './ai.context-builder.js';
import { searchKnowledge, logUnanswered } from './knowledge-base.service.js';
import { buildSystemPrompt } from './ai.prompt-builder.js';
import { callLLM } from '../../lib/llm-client.js';
import { parseAction } from './ai.action-parser.js';
import { routeAction } from './ai.action-router.js';

export interface AIEngineResult {
  response: string;
  action: string | null;
  llmFailed: boolean;
}

export async function runAIEngine(
  tenant: Tenant,
  customerId: string,
  message: string,
  channel: string,
  conversationId: string | null,
): Promise<AIEngineResult> {
  const tenantId = tenant.id;
  const capabilities = tenant.capabilities ?? [];

  const [history, dynamicContext, knowledgeContext] = await Promise.all([
    getHistory(tenantId, customerId, channel),
    buildDynamicContext(tenantId, customerId),
    searchKnowledge(tenantId, message),
  ]);

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
  } catch {
    return { response: 'Lo siento, nuestro asistente no está disponible en este momento. Un agente te atenderá pronto.', action: null, llmFailed: true };
  }

  let aiResponse = llmResponse;
  let action: string | null = null;

  const parsed = parseAction(llmResponse);
  if (parsed) {
    action = parsed.accion;
    aiResponse = await routeAction(parsed.accion, parsed.params, tenant, customerId, capabilities);

    if (parsed.accion === 'ESCALAMIENTO') {
      await db
        .insert(conversationState)
        .values({ tenantId, customerId, channel, state: 'AGENTE_ACTIVO' })
        .onConflictDoUpdate({
          target: [conversationState.tenantId, conversationState.customerId, conversationState.channel],
          set: { state: 'AGENTE_ACTIVO', updatedAt: new Date() },
        });
    }
  } else if (knowledgeContext === '' && !llmResponse.trim()) {
    await logUnanswered(tenantId, customerId, conversationId, message);
  }

  await appendHistory(tenantId, customerId, channel, 'user', message);
  await appendHistory(tenantId, customerId, channel, 'assistant', aiResponse);

  return { response: aiResponse, action, llmFailed: false };
}

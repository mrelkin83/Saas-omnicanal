import type { Tenant } from '@saas/db';
import { db, conversationState } from '@saas/db';
import type { ChannelType } from '../channels/core/channel-driver.interface.js';
import { getHistory, appendHistory } from './conversation-state.service.js';
import { buildDynamicContext } from './ai.context-builder.js';
import { searchKnowledge, logUnanswered } from './knowledge-base.service.js';
import { buildSystemPrompt } from './ai.prompt-builder.js';
import { callLLM } from '../../lib/llm-client.js';
import { getMCPServersForCapabilities } from '../../mcp/core/mcp-registry.js';
import { executeToolFromResponse } from '../../mcp/core/mcp-client.js';

export interface AIEngineResult {
  response: string;
  toolName: string | null;
  llmFailed: boolean;
}

export async function runAIEngine(
  tenant: Tenant,
  customerId: string,
  message: string,
  channel: ChannelType,
  conversationId: string | null,
): Promise<AIEngineResult> {
  const tenantId = tenant.id;
  const capabilities = tenant.capabilities ?? [];

  const [history, dynamicContext, knowledgeContext] = await Promise.all([
    getHistory(tenantId, customerId, channel),
    buildDynamicContext(tenantId, customerId, channel),
    searchKnowledge(tenantId, message),
  ]);

  const currentDateTime = new Date().toLocaleString('es-CO', {
    timeZone: tenant.timezone ?? 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Load MCP servers available for this tenant's capabilities
  const mcpServers = getMCPServersForCapabilities(capabilities);

  const systemPrompt = buildSystemPrompt({
    tenant,
    channel,
    capabilities,
    knowledgeContext,
    dynamicContext,
    currentDateTime,
    mcpServers,
  });

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
    await logUnanswered(tenantId, customerId, conversationId, message).catch(() => undefined);
    return {
      response: 'Lo siento, nuestro asistente no está disponible en este momento. Un agente te atenderá pronto.',
      toolName: null,
      llmFailed: true,
    };
  }

  // Check if LLM invoked a tool
  const toolResult = await executeToolFromResponse(llmResponse, {
    tenantId,
    customerId,
    channel,
    conversationId,
  });

  let finalResponse = llmResponse;
  let toolName: string | null = null;

  if (toolResult) {
    toolName = toolResult.toolName;

    if (toolResult.toolName === 'escalamiento') {
      // Set conversation state to AGENTE_ACTIVO
      await db
        .insert(conversationState)
        .values({ tenantId, customerId, channel, state: 'AGENTE_ACTIVO' })
        .onConflictDoUpdate({
          target: [conversationState.tenantId, conversationState.customerId, conversationState.channel],
          set: { state: 'AGENTE_ACTIVO', updatedAt: new Date() },
        });
      finalResponse = toolResult.success
        ? 'Voy a transferirte con un agente humano. Por favor espera un momento. ⏳'
        : `No pude transferirte: ${toolResult.result}`;
    } else if (toolResult.success) {
      // Re-prompt the LLM with the tool result to format a natural response
      const toolMessages = [
        ...llmMessages,
        { role: 'assistant' as const, content: llmResponse },
        { role: 'system' as const, content: `Resultado de la herramienta "${toolResult.toolName}":\n${toolResult.result}\n\nFormatea este resultado de forma natural para el cliente, respetando las REGLAS DEL CANAL.` },
      ];

      try {
        const formatted = await callLLM(toolMessages, llmOpts);
        finalResponse = formatted || toolResult.result;
      } catch {
        // Fallback: use raw tool result
        finalResponse = toolResult.result;
      }
    } else {
      // Tool failed
      finalResponse = `Lo siento, no pude completar esa acción: ${toolResult.result}`;
    }
  } else if (knowledgeContext === '' && !llmResponse.trim()) {
    await logUnanswered(tenantId, customerId, conversationId, message);
  }

  await appendHistory(tenantId, customerId, channel, 'user', message);
  await appendHistory(tenantId, customerId, channel, 'assistant', finalResponse);

  return { response: finalResponse, toolName, llmFailed: false };
}

import OpenAI from 'openai';
import { db, integrations, eq, and } from '@saas/db';

const defaultClient = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'] ?? '',
});

interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMOptions {
  tenantId: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

async function getClientForTenant(tenantId: string): Promise<{ client: OpenAI; model: string }> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenantId), eq(integrations.category, 'llm'), eq(integrations.isPrimary, true), eq(integrations.isActive, true)));

  if (integration) {
    const cfg = integration.config as Record<string, string>;
    const apiKey = cfg['apiKey'] ?? '';
    const baseURL = cfg['baseURL'] as string | undefined;
    const model = cfg['model'] ?? 'gpt-4o-mini';
    return { client: new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) }), model };
  }

  return { client: defaultClient, model: 'gpt-4o-mini' };
}

export async function callLLM(messages: LLMMessage[], opts: LLMOptions): Promise<string> {
  const { client, model: defaultModel } = await getClientForTenant(opts.tenantId);
  const model = opts.model ?? defaultModel;

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 500,
  });

  return response.choices[0]?.message?.content ?? '';
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await defaultClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0]?.embedding ?? [];
}

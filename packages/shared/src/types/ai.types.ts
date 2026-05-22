import type { ChannelType } from '../constants/channels.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ParsedAction {
  accion: string;
  params: Record<string, unknown>;
}

export interface AIEngineInput {
  tenantId: string;
  customerId?: string;
  customerPhone?: string;
  channel: ChannelType;
  sessionId: string;
  message: string;
  mediaUrl?: string;
}

export interface LLMRequest {
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

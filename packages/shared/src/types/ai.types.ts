import type { AIAction } from '../constants/actions.js';
import type { ChannelType } from '../constants/channels.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ParsedAction {
  accion: AIAction;
  datos: Record<string, unknown>;
  razonamiento?: string;
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

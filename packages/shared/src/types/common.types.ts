export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  code: string;
  statusCode: number;
}

export type UserRole = 'owner' | 'admin' | 'agent';
export type AgentStatus = 'available' | 'busy' | 'away' | 'offline';
export type ConversationStatus = 'open' | 'closed' | 'archived';
export type ConversationState = 'IA_ACTIVA' | 'AGENTE_HUMANO' | 'PAUSADA';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageSenderType = 'customer' | 'ai' | 'agent' | 'system';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';

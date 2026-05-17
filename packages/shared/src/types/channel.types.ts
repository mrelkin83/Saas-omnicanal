import type { ChannelType } from '../constants/channels.js';
import type { MessageType } from './common.types.js';

export interface NormalizedMessage {
  id: string;
  tenantId: string;
  channel: ChannelType;
  sessionId: string;
  customerId?: string;
  customerPhone?: string;
  customerInstagramId?: string;
  customerFacebookId?: string;
  customerTiktokId?: string;
  customerName?: string;
  direction: 'inbound';
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  externalId?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface OutgoingMessage {
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  externalId: string;
  sentAt: Date;
}

export type ChannelStatus = 'pending' | 'connected' | 'disconnected' | 'failed';

export interface ConnectResult {
  sessionId: string;
  status: ChannelStatus;
  qrCode?: string;
  phoneNumber?: string;
}

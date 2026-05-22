import type { ChannelType } from '../constants/channels.js';

export interface NormalizedMessage {
  externalId: string;
  tenantId: string;
  channel: ChannelType;
  sessionId: string;
  from: string;
  text: string;
  timestamp: Date;
}

export interface OutgoingMessage {
  type: 'text';
  text: string;
}

export interface SendResult {
  externalId: string;
}

export interface ChannelStatusResult {
  status: 'connected' | 'disconnected' | 'pending_qr' | 'error';
  displayName?: string;
}

export interface ConnectResult {
  sessionId: string;
  status: 'pending_qr' | 'connected' | 'error';
  qrCode?: string;
  errorMessage?: string;
}

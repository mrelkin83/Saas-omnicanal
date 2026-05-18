export type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';

export interface ConnectResult {
  sessionId: string;
  qrCode?: string | undefined;
  status: 'pending_qr' | 'connected' | 'error';
  errorMessage?: string | undefined;
}

export interface ChannelStatus {
  status: 'connected' | 'disconnected' | 'pending_qr' | 'error';
  displayName?: string;
}

export interface OutgoingMessage {
  type: 'text';
  text: string;
}

export interface SendResult {
  externalId: string;
}

export interface NormalizedMessage {
  externalId: string;
  tenantId: string;
  channel: ChannelType;
  sessionId: string;
  from: string;
  text: string;
  timestamp: Date;
}

export interface IChannelDriver {
  readonly channel: ChannelType;
  connect(tenantId: string, credentials: unknown): Promise<ConnectResult>;
  disconnect(sessionId: string): Promise<void>;
  getStatus(sessionId: string): Promise<ChannelStatus>;
  sendMessage(sessionId: string, to: string, message: OutgoingMessage): Promise<SendResult>;
  onIncoming(handler: (msg: NormalizedMessage) => Promise<void>): void;
}

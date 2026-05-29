export type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'location'
  | 'button_reply'
  | 'list_reply'
  | 'template';

// ── Outgoing messages (rich messages) ──────────────────────────────────────

export interface BaseOutgoingMessage {
  // channel is inferred from the driver / sendMessage call, not needed here
}

export interface TextMessage extends BaseOutgoingMessage {
  type: 'text';
  text: string;
  previewUrl?: boolean;
}

export interface ButtonOption {
  id: string;
  title: string;
  description?: string;
}

export interface ButtonMessage extends BaseOutgoingMessage {
  type: 'button';
  body: string;
  footer?: string;
  buttons: ButtonOption[]; // max 3 for WhatsApp
}

export interface ListSection {
  title: string;
  rows: ButtonOption[];
}

export interface ListMessage extends BaseOutgoingMessage {
  type: 'list';
  body: string;
  buttonText: string; // e.g. "Ver opciones"
  footer?: string;
  sections: ListSection[];
}

export interface QuickReplyOption {
  id: string;
  title: string;
  imageUrl?: string;
}

export interface QuickReplyMessage extends BaseOutgoingMessage {
  type: 'quick_reply';
  text: string;
  options: QuickReplyOption[]; // max 11 for FB
}

export interface TemplateMessage extends BaseOutgoingMessage {
  type: 'template';
  templateName: string;
  languageCode: string;
  components?: Record<string, unknown>[];
}

export interface MediaMessage extends BaseOutgoingMessage {
  type: 'media';
  mediaType: 'image' | 'video' | 'audio' | 'document';
  url: string;
  caption?: string;
  filename?: string;
}

export interface LocationMessage extends BaseOutgoingMessage {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export type OutgoingMessage =
  | TextMessage
  | ButtonMessage
  | ListMessage
  | QuickReplyMessage
  | TemplateMessage
  | MediaMessage
  | LocationMessage;

// ── Incoming messages (normalized) ─────────────────────────────────────────

export interface MessageLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MessageMedia {
  url?: string;
  mimeType?: string;
  caption?: string;
  filename?: string;
}

export interface NormalizedMessage {
  externalId: string;
  tenantId: string;
  channel: ChannelType;
  sessionId: string;
  from: string;
  text: string;
  timestamp: Date;
  messageType: MessageType;
  // Rich message fields
  media?: MessageMedia;
  location?: MessageLocation;
  buttonPayload?: string;
  buttonTitle?: string;
  listReplyId?: string;
  listReplyTitle?: string;
  // Metadata
  quotedMessageId?: string;
  isForwarded?: boolean;
}

// ── Channel driver interface ───────────────────────────────────────────────

export interface ConnectResult {
  sessionId: string;
  qrCode?: string | undefined;
  status: 'pending_qr' | 'connected' | 'error';
  errorMessage?: string | undefined;
}

export interface ChannelStatus {
  status: 'connected' | 'disconnected' | 'pending_qr' | 'error';
  displayName?: string | undefined;
}

export interface SendResult {
  externalId: string;
}

export interface IChannelDriver {
  readonly channel: ChannelType;
  connect(tenantId: string, credentials: unknown): Promise<ConnectResult>;
  disconnect(sessionId: string): Promise<void>;
  getStatus(sessionId: string): Promise<ChannelStatus>;
  sendMessage(sessionId: string, to: string, message: OutgoingMessage): Promise<SendResult>;
  onIncoming(handler: (msg: NormalizedMessage) => Promise<void>): void;
}

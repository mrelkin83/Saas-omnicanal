import type {
  IChannelDriver, ChannelType, ConnectResult, ChannelStatus,
  OutgoingMessage, SendResult, NormalizedMessage,
} from '../../core/channel-driver.interface.js';
import * as bridge from './instagram.bridge-client.js';

type IncomingHandler = (msg: NormalizedMessage) => Promise<void>;

class InstagramDriver implements IChannelDriver {
  readonly channel: ChannelType = 'instagram';
  private handler: IncomingHandler | null = null;
  private lastPolled = new Map<string, number>(); // sessionId → timestamp

  async connect(tenantId: string, credentials: unknown): Promise<ConnectResult> {
    const creds = credentials as { username: string; password: string; twoFactorCode?: string };
    const result = await bridge.createSession(tenantId, creds.username, creds.password, creds.twoFactorCode);

    if (result.requires_2fa) {
      return { sessionId: tenantId, status: 'pending_qr', errorMessage: 'requires_2fa' };
    }

    return { sessionId: tenantId, status: 'connected' };
  }

  async disconnect(sessionId: string): Promise<void> {
    await bridge.logoutSession(sessionId);
  }

  async getStatus(sessionId: string): Promise<ChannelStatus> {
    const s = await bridge.getStatus(sessionId);
    return s.status === 'connected' ? { status: 'connected', displayName: s.username } : { status: 'disconnected' };
  }

  async sendMessage(sessionId: string, to: string, message: OutgoingMessage): Promise<SendResult> {
    // Instagram DM only supports text and media (no buttons, lists, quick replies)
    switch (message.type) {
      case 'text':
        await bridge.sendMessage(sessionId, to, message.text);
        return { externalId: `ig-${Date.now()}` };

      case 'button':
      case 'list': {
        // Fallback to text with numbered options
        const options = message.type === 'button'
          ? message.buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')
          : message.sections.flatMap((s) => s.rows.map((r, i) => `${i + 1}. ${r.title}`)).join('\n');
        await bridge.sendMessage(sessionId, to, `${message.body}\n\n${options}`);
        return { externalId: `ig-${Date.now()}` };
      }

      case 'quick_reply': {
        const opts = message.options.map((o, i) => `${i + 1}. ${o.title}`).join('\n');
        await bridge.sendMessage(sessionId, to, `${message.text}\n\n${opts}`);
        return { externalId: `ig-${Date.now()}` };
      }

      case 'media': {
        // Instagram bridge doesn't support media sending yet; fallback to text
        await bridge.sendMessage(sessionId, to, message.caption || '[Media shared]');
        return { externalId: `ig-${Date.now()}` };
      }

      case 'location': {
        const mapsUrl = `https://maps.google.com/?q=${message.latitude},${message.longitude}`;
        await bridge.sendMessage(sessionId, to, `${message.name ? `${message.name}\n` : ''}${mapsUrl}`);
        return { externalId: `ig-${Date.now()}` };
      }

      case 'template': {
        await bridge.sendMessage(sessionId, to, `[Template: ${message.templateName}]`);
        return { externalId: `ig-${Date.now()}` };
      }

      default: {
        await bridge.sendMessage(sessionId, to, 'Mensaje no soportado en Instagram.');
        return { externalId: `ig-${Date.now()}` };
      }
    }
  }

  onIncoming(handler: IncomingHandler): void {
    this.handler = handler;
  }

  async pollAndDispatch(tenantId: string): Promise<void> {
    if (!this.handler) return;
    const since = this.lastPolled.get(tenantId) ?? 0;
    let messages: Awaited<ReturnType<typeof bridge.pollInbox>> = [];
    try {
      messages = await bridge.pollInbox(tenantId, since);
    } catch {
      return;
    }

    if (messages.length > 0) {
      this.lastPolled.set(tenantId, Date.now() / 1000);
    }

    for (const msg of messages) {
      await this.handler({
        externalId: msg.id,
        tenantId,
        channel: 'instagram',
        sessionId: tenantId,
        from: msg.from_username,
        text: msg.text,
        timestamp: new Date(msg.timestamp * 1000),
        messageType: 'text',
      });
    }
  }
}

export const instagramDriver = new InstagramDriver();

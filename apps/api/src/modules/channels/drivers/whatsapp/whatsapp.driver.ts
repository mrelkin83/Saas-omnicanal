import type {
  IChannelDriver, ChannelType, ConnectResult, ChannelStatus,
  OutgoingMessage, SendResult, NormalizedMessage,
} from '../../core/channel-driver.interface.js';
import * as evo from '../../../../lib/evolution-api.client.js';

type IncomingHandler = (msg: NormalizedMessage) => Promise<void>;

const API_BASE_URL = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

class WhatsAppDriver implements IChannelDriver {
  readonly channel: ChannelType = 'whatsapp';
  private handler: IncomingHandler | null = null;

  async connect(tenantId: string, _credentials: unknown): Promise<ConnectResult> {
    const instanceName = `tenant-${tenantId}`;
    const webhookUrl = `${API_BASE_URL}/api/webhooks/evolution`;

    try {
      await evo.createInstance(instanceName, webhookUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('409')) throw err;
    }

    let qrCode: string | undefined;
    try {
      const qr = await evo.getQR(instanceName);
      qrCode = qr.base64;
    } catch {
      // QR not ready yet; client will get it via SSE webhook
    }

    return { sessionId: instanceName, qrCode, status: 'pending_qr' };
  }

  async disconnect(sessionId: string): Promise<void> {
    await evo.logoutInstance(sessionId);
    await evo.deleteInstance(sessionId);
  }

  async getStatus(sessionId: string): Promise<ChannelStatus> {
    try {
      const state = await evo.getConnectionState(sessionId);
      const s = state.instance.state;
      if (s === 'open') return { status: 'connected' };
      if (s === 'close' || s === 'refused') return { status: 'disconnected' };
      return { status: 'pending_qr' };
    } catch {
      return { status: 'error' };
    }
  }

  async sendMessage(sessionId: string, to: string, message: OutgoingMessage): Promise<SendResult> {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    switch (message.type) {
      case 'text': {
        const result = await evo.sendText(sessionId, jid, message.text);
        return { externalId: result.key.id };
      }

      case 'button': {
        const result = await evo.sendButtons(
          sessionId,
          jid,
          message.body.slice(0, 50), // title max 50
          message.body,
          message.footer,
          message.buttons.map((b) => ({ buttonId: b.id, buttonText: b.title })),
        );
        return { externalId: result.key.id };
      }

      case 'list': {
        const result = await evo.sendList(
          sessionId,
          jid,
          message.body.slice(0, 50),
          message.body,
          message.buttonText,
          message.footer,
          message.sections.map((s) => ({
            title: s.title,
            rows: s.rows.map((r) => ({ title: r.title, rowId: r.id, description: r.description ?? '' })),
          })),
        );
        return { externalId: result.key.id };
      }

      case 'media': {
        // Evolution API doesn't support audio directly; send as document
        const mediaType = message.mediaType === 'audio' ? 'document' : message.mediaType;
        const result = await evo.sendMedia(
          sessionId,
          jid,
          message.url,
          mediaType,
          message.caption,
          message.filename,
        );
        return { externalId: result.key.id };
      }

      case 'location': {
        // Evolution API doesn't have direct location endpoint; fallback to text with maps link
        const mapsUrl = `https://maps.google.com/?q=${message.latitude},${message.longitude}`;
        const text = `${message.name ? `📍 ${message.name}\n` : ''}${message.address ? `${message.address}\n` : ''}${mapsUrl}`;
        const result = await evo.sendText(sessionId, jid, text);
        return { externalId: result.key.id };
      }

      case 'quick_reply': {
        const result = await evo.sendText(sessionId, jid, message.text);
        return { externalId: result.key.id };
      }

      case 'template': {
        const result = await evo.sendText(sessionId, jid, `[Template: ${message.templateName}]`);
        return { externalId: result.key.id };
      }

      default: {
        // Fallback for any unknown type
        const result = await evo.sendText(sessionId, jid, 'Mensaje no soportado en este canal.');
        return { externalId: result.key.id };
      }
    }
  }

  onIncoming(handler: IncomingHandler): void {
    this.handler = handler;
  }

  async dispatchIncoming(msg: NormalizedMessage): Promise<void> {
    if (this.handler) await this.handler(msg);
  }
}

export const whatsappDriver = new WhatsAppDriver();

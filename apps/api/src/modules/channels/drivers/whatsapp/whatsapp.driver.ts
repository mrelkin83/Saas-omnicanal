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
    const result = await evo.sendText(sessionId, jid, message.text);
    return { externalId: result.key.id };
  }

  onIncoming(handler: IncomingHandler): void {
    this.handler = handler;
  }

  async dispatchIncoming(msg: NormalizedMessage): Promise<void> {
    if (this.handler) await this.handler(msg);
  }
}

export const whatsappDriver = new WhatsAppDriver();

import { createRequire } from 'node:module';
import type {
  IChannelDriver, ChannelType, ConnectResult, ChannelStatus,
  OutgoingMessage, SendResult, NormalizedMessage,
} from '../../core/channel-driver.interface.js';

const require = createRequire(import.meta.url);

type FcaAPI = {
  listenMqtt: (handler: (err: Error | null, msg: FcaMessage) => void) => { stopListening: () => void };
  sendMessage: (msg: { body: string }, threadID: string, callback: (err: Error | null) => void) => void;
  getCurrentUserID: () => string;
};

interface FcaMessage {
  type: string;
  threadID: string;
  senderID: string;
  body: string;
  timestamp: string;
  messageID: string;
}

type IncomingHandler = (msg: NormalizedMessage) => Promise<void>;

class FacebookDriver implements IChannelDriver {
  readonly channel: ChannelType = 'facebook';
  private handler: IncomingHandler | null = null;
  private sessions = new Map<string, { api: FcaAPI; stop: () => void }>();

  async connect(tenantId: string, credentials: unknown): Promise<ConnectResult> {
    const creds = credentials as { appState: string };
    let appState: unknown;
    try {
      appState = JSON.parse(creds.appState);
    } catch {
      return { sessionId: tenantId, status: 'error', errorMessage: 'appState JSON inválido' };
    }

    return new Promise((resolve) => {
      const login = require('fca-unofficial') as (opts: unknown, cb: (err: Error | null, api: FcaAPI) => void) => void;

      login({ appState }, (err, api) => {
        if (err) {
          resolve({ sessionId: tenantId, status: 'error', errorMessage: err.message });
          return;
        }

        const stopHandle = api.listenMqtt((mqttErr, msg) => {
          if (mqttErr || !this.handler) return;
          if (msg.type !== 'message' || msg.senderID === api.getCurrentUserID()) return;

          this.handler({
            externalId: msg.messageID,
            tenantId,
            channel: 'facebook',
            sessionId: tenantId,
            from: msg.senderID,
            text: msg.body,
            timestamp: new Date(parseInt(msg.timestamp, 10)),
            messageType: 'text',
          }).catch(() => null);
        });

        this.sessions.set(tenantId, { api, stop: stopHandle.stopListening });
        resolve({ sessionId: tenantId, status: 'connected' });
      });
    });
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stop();
      this.sessions.delete(sessionId);
    }
  }

  async getStatus(sessionId: string): Promise<ChannelStatus> {
    return this.sessions.has(sessionId) ? { status: 'connected' } : { status: 'disconnected' };
  }

  async sendMessage(sessionId: string, to: string, message: OutgoingMessage): Promise<SendResult> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('No active Facebook session');

    let text: string;

    switch (message.type) {
      case 'text':
        text = message.text;
        break;

      case 'button':
      case 'list': {
        const options = message.type === 'button'
          ? message.buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')
          : message.sections.flatMap((s) => s.rows.map((r, i) => `${i + 1}. ${r.title}`)).join('\n');
        text = `${message.body}\n\n${options}`;
        break;
      }

      case 'quick_reply': {
        const opts = message.options.map((o, i) => `${i + 1}. ${o.title}`).join('\n');
        text = `${message.text}\n\n${opts}`;
        break;
      }

      case 'media': {
        text = message.caption || '[Media shared]';
        break;
      }

      case 'location': {
        const mapsUrl = `https://maps.google.com/?q=${message.latitude},${message.longitude}`;
        text = `${message.name ? `${message.name}\n` : ''}${message.address ? `${message.address}\n` : ''}${mapsUrl}`;
        break;
      }

      case 'template': {
        text = `[Template: ${message.templateName}]`;
        break;
      }

      default:
        text = 'Mensaje no soportado en Facebook.';
    }

    return new Promise((resolve, reject) => {
      session.api.sendMessage({ body: text }, to, (err) => {
        if (err) reject(err);
        else resolve({ externalId: `fb-${Date.now()}` });
      });
    });
  }

  onIncoming(handler: IncomingHandler): void {
    this.handler = handler;
  }
}

export const facebookDriver = new FacebookDriver();

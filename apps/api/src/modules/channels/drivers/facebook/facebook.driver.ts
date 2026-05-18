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

    return new Promise((resolve, reject) => {
      session.api.sendMessage({ body: message.text }, to, (err) => {
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

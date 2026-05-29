import type {
  IChannelDriver, ChannelType, ConnectResult, ChannelStatus,
  OutgoingMessage, SendResult, NormalizedMessage,
} from '../../core/channel-driver.interface.js';

type IncomingHandler = (msg: NormalizedMessage) => Promise<void>;

interface TikTokComment {
  id: string;
  videoId: string;
  username: string;
  text: string;
  createdAt: number;
}

interface TikTokSession {
  cookies: string;
  username: string;
  lastSeen: Map<string, number>; // videoId → latest comment timestamp
}

class TikTokDriver implements IChannelDriver {
  readonly channel: ChannelType = 'tiktok';
  private handler: IncomingHandler | null = null;
  private sessions = new Map<string, TikTokSession>();

  async connect(tenantId: string, credentials: unknown): Promise<ConnectResult> {
    const creds = credentials as { cookies: string; username: string };
    this.sessions.set(tenantId, {
      cookies: creds.cookies,
      username: creds.username,
      lastSeen: new Map(),
    });
    return { sessionId: tenantId, status: 'connected' };
  }

  async disconnect(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async getStatus(sessionId: string): Promise<ChannelStatus> {
    const session = this.sessions.get(sessionId);
    return session ? { status: 'connected', displayName: session.username } : { status: 'disconnected' };
  }

  async sendMessage(_sessionId: string, _to: string, _message: OutgoingMessage): Promise<SendResult> {
    // TikTok comment replies are not automated; mark as sent for tracking
    return { externalId: `tt-${Date.now()}` };
  }

  onIncoming(handler: IncomingHandler): void {
    this.handler = handler;
  }

  async pollAndDispatch(tenantId: string): Promise<void> {
    if (!this.handler) return;
    const session = this.sessions.get(tenantId);
    if (!session) return;

    try {
      const comments = await this.fetchRecentComments(session);
      for (const comment of comments) {
        await this.handler({
          externalId: comment.id,
          tenantId,
          channel: 'tiktok',
          sessionId: tenantId,
          from: comment.username,
          text: comment.text,
          timestamp: new Date(comment.createdAt * 1000),
          messageType: 'text',
        });
      }
    } catch {
      // Network or API errors; will retry next poll
    }
  }

  private async fetchRecentComments(session: TikTokSession): Promise<TikTokComment[]> {
    const headers = {
      Cookie: session.cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.tiktok.com/',
    };

    const userRes = await fetch(
      `https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(session.username)}`,
      { headers },
    );
    if (!userRes.ok) return [];
    const userData = await userRes.json() as { userInfo?: { user?: { id?: string } } };
    const userId = userData?.userInfo?.user?.id;
    if (!userId) return [];

    const videosRes = await fetch(
      `https://www.tiktok.com/api/post/item_list/?userId=${userId}&count=5&cursor=0`,
      { headers },
    );
    if (!videosRes.ok) return [];
    const videosData = await videosRes.json() as { itemList?: { id?: string }[] };
    const videoIds = (videosData?.itemList ?? []).map((v) => v.id).filter(Boolean) as string[];

    const all: TikTokComment[] = [];
    for (const videoId of videoIds.slice(0, 5)) {
      const lastSeen = session.lastSeen.get(videoId) ?? 0;
      const commentsRes = await fetch(
        `https://www.tiktok.com/api/comment/list/?aweme_id=${videoId}&count=20&cursor=0`,
        { headers },
      );
      if (!commentsRes.ok) continue;
      const commentsData = await commentsRes.json() as { comments?: { cid?: string; text?: string; create_time?: number; user?: { unique_id?: string } }[] };
      const comments = commentsData?.comments ?? [];

      let maxTs = lastSeen;
      for (const c of comments) {
        const ts = c.create_time ?? 0;
        if (ts > lastSeen && c.cid && c.user?.unique_id !== session.username) {
          all.push({ id: c.cid, videoId, username: c.user?.unique_id ?? 'unknown', text: c.text ?? '', createdAt: ts });
          if (ts > maxTs) maxTs = ts;
        }
      }
      session.lastSeen.set(videoId, maxTs);
    }

    return all.sort((a, b) => a.createdAt - b.createdAt);
  }
}

export const tiktokDriver = new TikTokDriver();

import type { ServerResponse } from 'node:http';

const inboxStreams = new Map<string, Set<ServerResponse>>();

export function addInboxClient(tenantId: string, res: ServerResponse): void {
  const set = inboxStreams.get(tenantId) ?? new Set();
  set.add(res);
  inboxStreams.set(tenantId, set);
}

export function removeInboxClient(tenantId: string, res: ServerResponse): void {
  inboxStreams.get(tenantId)?.delete(res);
}

export function pushInboxEvent(tenantId: string, event: string, data: unknown): void {
  const clients = inboxStreams.get(tenantId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

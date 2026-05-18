import type { ServerResponse } from 'node:http';

const streams = new Map<string, Set<ServerResponse>>();

export function addSSEClient(tenantId: string, res: ServerResponse): void {
  const set = streams.get(tenantId) ?? new Set();
  set.add(res);
  streams.set(tenantId, set);
}

export function removeSSEClient(tenantId: string, res: ServerResponse): void {
  streams.get(tenantId)?.delete(res);
}

export function pushSSEEvent(tenantId: string, event: string, data: unknown): void {
  const clients = streams.get(tenantId);
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

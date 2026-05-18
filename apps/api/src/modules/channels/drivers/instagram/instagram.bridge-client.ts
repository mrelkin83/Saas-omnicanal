const BASE = process.env['INSTAGRAM_BRIDGE_URL'] ?? 'http://localhost:8000';

async function bridgeRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram Bridge ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CreateSessionResult {
  session_id: string;
  status: string;
  requires_2fa: boolean;
}

export interface IGMessage {
  id: string;
  thread_id: string;
  from_user_id: string;
  from_username: string;
  text: string;
  timestamp: number;
}

export async function createSession(tenantId: string, username: string, password: string, twoFactorCode?: string): Promise<CreateSessionResult> {
  return bridgeRequest<CreateSessionResult>('POST', '/sessions/create', {
    tenant_id: tenantId,
    username,
    password,
    ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
  });
}

export async function logoutSession(sessionId: string): Promise<void> {
  await bridgeRequest<void>('POST', `/sessions/${sessionId}/logout`);
}

export async function getStatus(sessionId: string): Promise<{ status: string; username?: string }> {
  return bridgeRequest('GET', `/sessions/${sessionId}/status`);
}

export async function pollInbox(sessionId: string, since?: number): Promise<IGMessage[]> {
  const qs = since ? `?since=${since}` : '';
  const res = await bridgeRequest<{ messages: IGMessage[] }>('GET', `/sessions/${sessionId}/inbox${qs}`);
  return res.messages;
}

export async function sendMessage(sessionId: string, threadId: string, text: string): Promise<void> {
  await bridgeRequest<void>('POST', `/sessions/${sessionId}/messages/send`, { thread_id: threadId, text });
}

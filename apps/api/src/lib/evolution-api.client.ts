const BASE = process.env['EVOLUTION_API_URL'] ?? 'http://localhost:8080';
const GLOBAL_KEY = process.env['EVOLUTION_API_GLOBAL_KEY'] ?? '';

async function evoRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: GLOBAL_KEY,
    },
    signal: AbortSignal.timeout(10000),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API ${method} ${path} → ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface EvoInstance {
  instance: {
    instanceName: string;
    status: string;
    serverUrl?: string;
  };
  qrcode?: { base64: string; code: string };
}

export interface EvoQR {
  base64: string;
  code: string;
}

export interface EvoConnectionState {
  instance: { state: string };
}

export interface EvoSendTextResult {
  key: { id: string };
  status: string;
}

export async function createInstance(instanceName: string, webhookUrl: string): Promise<EvoInstance> {
  return evoRequest<EvoInstance>('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    webhook: {
      url: webhookUrl,
      events: ['QRCODE_UPDATED', 'MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'MESSAGES_UPDATE'],
      webhookByEvents: false,
      webhookBase64: false,
    },
  });
}

export async function getQR(instanceName: string): Promise<EvoQR> {
  const res = await evoRequest<{ base64: string; code: string }>('GET', `/instance/connect/${instanceName}`);
  return res;
}

export async function getConnectionState(instanceName: string): Promise<EvoConnectionState> {
  return evoRequest<EvoConnectionState>('GET', `/instance/connectionState/${instanceName}`);
}

export async function sendText(instanceName: string, number: string, text: string): Promise<EvoSendTextResult> {
  return evoRequest<EvoSendTextResult>('POST', `/message/sendText/${instanceName}`, { number, text });
}

export async function sendMedia(
  instanceName: string,
  number: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'document',
  caption?: string,
  fileName?: string,
): Promise<EvoSendTextResult> {
  const mimeMap: Record<string, string> = { image: 'image/jpeg', video: 'video/mp4', document: 'application/pdf' };
  return evoRequest<EvoSendTextResult>('POST', `/message/sendMedia/${instanceName}`, {
    number,
    mediatype: mediaType,
    mimetype: mimeMap[mediaType] ?? 'application/octet-stream',
    caption: caption ?? '',
    media: mediaUrl,
    fileName: fileName ?? (mediaType === 'image' ? 'imagen.jpg' : mediaType === 'video' ? 'video.mp4' : 'documento.pdf'),
  });
}

export async function logoutInstance(instanceName: string): Promise<void> {
  await evoRequest<void>('DELETE', `/instance/logout/${instanceName}`);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await evoRequest<void>('DELETE', `/instance/delete/${instanceName}`);
}

export async function sendButtons(
  instanceName: string,
  number: string,
  title: string,
  description: string,
  footer: string | undefined,
  buttons: { buttonId: string; buttonText: string }[],
): Promise<EvoSendTextResult> {
  return evoRequest<EvoSendTextResult>('POST', `/message/sendButtons/${instanceName}`, {
    number,
    title,
    description,
    footerText: footer ?? '',
    buttons,
  });
}

export async function sendList(
  instanceName: string,
  number: string,
  title: string,
  description: string,
  buttonText: string,
  footer: string | undefined,
  sections: { title: string; rows: { title: string; rowId: string; description?: string }[] }[],
): Promise<EvoSendTextResult> {
  return evoRequest<EvoSendTextResult>('POST', `/message/sendList/${instanceName}`, {
    number,
    title,
    description,
    buttonText,
    footerText: footer ?? '',
    sections,
  });
}

export async function fetchInstances(): Promise<{ instance: { instanceName: string; status: string } }[]> {
  return evoRequest<{ instance: { instanceName: string; status: string } }[]>('GET', '/instance/fetchInstances');
}

export interface EvoGroup {
  id: string;
  subject: string;
  subjectOwner: string;
  subjectTime: number;
  size: number;
  creation: number;
  desc?: string;
}

export async function fetchGroups(instanceName: string): Promise<EvoGroup[]> {
  return evoRequest<EvoGroup[]>('GET', `/group/fetchAllGroups/${instanceName}?getParticipants=false`);
}

export async function createGroup(instanceName: string, subject: string, participants: string[]): Promise<{ groupJid: string; inviteCode: string }> {
  return evoRequest<{ groupJid: string; inviteCode: string }>('POST', `/group/create/${instanceName}`, { subject, participants });
}

export async function addGroupParticipants(instanceName: string, groupJid: string, participants: string[]): Promise<unknown> {
  return evoRequest<unknown>('PUT', `/group/updateParticipant/${instanceName}`, { groupJid, action: 'add', participants });
}

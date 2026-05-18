const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const { token, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });

  if (res.status === 204) return undefined as T;

  const data = await res.json() as unknown;
  if (!res.ok) {
    const err = data as { code?: string; message?: string };
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Error desconocido');
  }
  return data as T;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoginResponse { accessToken: string; refreshToken: string; }

export interface TenantMe {
  id: string; name: string; slug: string; businessType: string;
  capabilities: string[]; timezone: string; phone: string | null;
  address: string | null; description: string | null; logoUrl: string | null;
  website: string | null; aiModel: string; aiTemperature: string;
  aiMaxTokens: number; aiAgentName: string; aiTone: string;
  billingEmail: string | null; createdAt: string; updatedAt: string;
}

export interface ProductInput {
  name?: string; type?: string; categoryId?: string | null;
  description?: string | null; sku?: string | null;
  price?: number | null; cost?: number | null;
  durationMinutes?: number | null; hasVariants?: boolean;
  stock?: number | null; images?: string[];
  customAttributes?: Record<string, unknown>; isActive?: boolean;
}

export interface RegisterTenantInput {
  ownerName: string; ownerEmail: string; ownerPassword: string;
  tenantName: string; businessType: string; plan: string;
}

export interface Category {
  id: string; tenantId: string; name: string;
  parentId: string | null; sortOrder: number; createdAt: string;
}

export interface Product {
  id: string; tenantId: string; categoryId: string | null;
  type: string; name: string; description: string | null;
  sku: string | null; price: string | null; cost: string | null;
  durationMinutes: number | null; hasVariants: boolean; stock: number | null;
  images: string[]; customAttributes: Record<string, unknown>;
  isActive: boolean; createdAt: string; updatedAt: string;
}

export interface Customer {
  id: string; tenantId: string; phone: string | null;
  fullName: string | null; displayName: string | null;
  email: string | null; cedula: string | null; address: string | null;
  tags: string[]; customAttributes: Record<string, unknown>;
  createdAt: string; updatedAt: string;
}

export interface User {
  id: string; tenantId: string; email: string;
  fullName: string | null; role: 'owner' | 'admin' | 'agent';
  agentStatus: string | null; maxConcurrentChats: number;
  isActive: boolean; createdAt: string;
}

// ── API ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    refresh: (refreshToken: string) =>
      request<LoginResponse>('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
    logout: (refreshToken: string, token: string) =>
      request<void>('/api/auth/logout', { method: 'POST', token, body: JSON.stringify({ refreshToken }) }),
    register: (input: RegisterTenantInput) =>
      request<{ tenantId: string; userId: string }>('/api/auth/register-tenant', { method: 'POST', body: JSON.stringify(input) }),
  },

  tenants: {
    me: (token: string) => request<TenantMe>('/api/tenants/me', { token }),
    patch: (token: string, data: Partial<Pick<TenantMe, 'name' | 'phone' | 'address' | 'description' | 'logoUrl' | 'website' | 'aiModel' | 'aiAgentName' | 'aiTone' | 'billingEmail'> & { aiTemperature?: number; aiMaxTokens?: number }>) =>
      request<TenantMe>('/api/tenants/me', { method: 'PATCH', token, body: JSON.stringify(data) }),
  },

  categories: {
    list: (token: string) => request<Category[]>('/api/categories', { token }),
    create: (token: string, data: { name: string; parentId?: string; sortOrder?: number }) =>
      request<Category>('/api/categories', { method: 'POST', token, body: JSON.stringify(data) }),
    update: (token: string, id: string, data: Partial<{ name: string; sortOrder: number }>) =>
      request<Category>(`/api/categories/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) =>
      request<void>(`/api/categories/${id}`, { method: 'DELETE', token }),
  },

  products: {
    list: (token: string, params?: { search?: string; type?: string; categoryId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.type) qs.set('type', params.type);
      if (params?.categoryId) qs.set('categoryId', params.categoryId);
      const q = qs.toString();
      return request<Product[]>(`/api/products${q ? `?${q}` : ''}`, { token });
    },
    get: (token: string, id: string) => request<Product>(`/api/products/${id}`, { token }),
    create: (token: string, data: ProductInput) =>
      request<Product>('/api/products', { method: 'POST', token, body: JSON.stringify(data) }),
    update: (token: string, id: string, data: ProductInput) =>
      request<Product>(`/api/products/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) =>
      request<void>(`/api/products/${id}`, { method: 'DELETE', token }),
  },

  customers: {
    list: (token: string, search?: string) => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      return request<Customer[]>(`/api/customers${qs}`, { token });
    },
    create: (token: string, data: Partial<Customer> & { fullName: string }) =>
      request<Customer>('/api/customers', { method: 'POST', token, body: JSON.stringify(data) }),
    update: (token: string, id: string, data: Partial<Customer>) =>
      request<Customer>(`/api/customers/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) =>
      request<void>(`/api/customers/${id}`, { method: 'DELETE', token }),
  },

  users: {
    list: (token: string) => request<User[]>('/api/users', { token }),
    create: (token: string, data: { email: string; password: string; fullName: string; role: string }) =>
      request<User>('/api/users', { method: 'POST', token, body: JSON.stringify(data) }),
    update: (token: string, id: string, data: Partial<{ fullName: string; role: string; isActive: boolean }>) =>
      request<User>(`/api/users/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) =>
      request<void>(`/api/users/${id}`, { method: 'DELETE', token }),
  },

  channels: {
    status: (token: string) =>
      request<{ whatsapp: { id: string; status: string; displayName: string | null; lastSeenAt: string | null } | null }>('/api/channels/status', { token }),
    allStatus: (token: string) =>
      request<Record<string, { id: string; status: string; displayName: string | null } | null>>('/api/channels/all-status', { token }),
    connectWhatsApp: (token: string) =>
      request<{ sessionId: string; status: string; qrCode: string | null }>('/api/channels/whatsapp/connect', { method: 'POST', token }),
    disconnectWhatsApp: (token: string, id: string) =>
      request<void>(`/api/channels/whatsapp/${id}`, { method: 'DELETE', token }),
    getQR: (token: string) =>
      request<{ qrCode: string }>('/api/channels/whatsapp/qr', { token }),
    connectInstagram: (token: string, data: { username: string; password: string; twoFactorCode?: string }) =>
      request<{ ok: boolean; requires2FA?: boolean; username?: string }>('/api/channels/instagram/connect', { method: 'POST', token, body: JSON.stringify(data) }),
    disconnectInstagram: (token: string, id: string) =>
      request<void>(`/api/channels/instagram/${id}`, { method: 'DELETE', token }),
    connectFacebook: (token: string, data: { appState: string }) =>
      request<{ ok: boolean }>('/api/channels/facebook/connect', { method: 'POST', token, body: JSON.stringify(data) }),
    disconnectFacebook: (token: string, id: string) =>
      request<void>(`/api/channels/facebook/${id}`, { method: 'DELETE', token }),
    connectTikTok: (token: string, data: { cookies: string; username: string }) =>
      request<{ ok: boolean; username: string }>('/api/channels/tiktok/connect', { method: 'POST', token, body: JSON.stringify(data) }),
    disconnectTikTok: (token: string, id: string) =>
      request<void>(`/api/channels/tiktok/${id}`, { method: 'DELETE', token }),
  },

  conversations: {
    list: (token: string, params?: { status?: string; channel?: string; withCustomer?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.channel) qs.set('channel', params.channel);
      if (params?.withCustomer) qs.set('withCustomer', 'true');
      const q = qs.toString();
      return request<ConversationSummary[]>(`/api/conversations${q ? `?${q}` : ''}`, { token });
    },
    get: (token: string, id: string) => request<ConversationDetail>(`/api/conversations/${id}`, { token }),
    sendMessage: (token: string, id: string, data: { type: string; content: string }) =>
      request<Message>(`/api/conversations/${id}/messages`, { method: 'POST', token, body: JSON.stringify(data) }),
    getAIState: (token: string, id: string) =>
      request<{ state: string }>(`/api/conversations/${id}/ai-state`, { token }),
    setAIState: (token: string, id: string, state: 'IA_ACTIVA' | 'AGENTE_ACTIVO') =>
      request<{ state: string }>(`/api/conversations/${id}/ai-state`, { method: 'PUT', token, body: JSON.stringify({ state }) }),
  },
};

export interface ConversationSummary {
  id: string; channel: string; status: string | null;
  unreadCount: number | null; lastMessageAt: string | null;
  customerId: string; customerName: string | null; customerPhone: string | null;
}

export interface Message {
  id: string; conversationId: string; direction: string;
  senderType: string; type: string | null; content: string | null;
  createdAt: string;
}

export interface ConversationDetail {
  id: string; channel: string; status: string | null;
  customerId: string; unreadCount: number | null;
  lastMessageAt: string | null; createdAt: string;
  messages: Message[];
}

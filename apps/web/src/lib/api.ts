import { useAuthStore } from '@/store/auth';

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

// Deduplicates concurrent refresh attempts so only one network call is made
let refreshPromise: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();
      if (!refreshToken) { clearAuth(); return null; }
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { clearAuth(); return null; }
      const data = await res.json() as { accessToken: string; refreshToken: string };
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      useAuthStore.getState().clearAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(
  path: string,
  init?: RequestInit & { token?: string; _retried?: boolean },
): Promise<T> {
  const { token, _retried, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    ...(rest.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });

  if (res.status === 401 && token && !_retried) {
    const newToken = await attemptRefresh();
    if (newToken) return request<T>(path, { ...init, token: newToken, _retried: true });
  }

  if (res.status === 204) return undefined as T;

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof data.code === 'string' ? data.code : 'UNKNOWN';
    const message = typeof data.message === 'string' ? data.message : 'Error desconocido';
    throw new ApiError(res.status, code, message);
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

export interface RegisterTenantResponse {
  tenant: { id: string; name: string; slug: string };
  accessToken: string;
  refreshToken: string;
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
      request<RegisterTenantResponse>('/api/auth/register-tenant', { method: 'POST', body: JSON.stringify(input) }),
  },

  tenants: {
    me: (token: string) => request<TenantMe>('/api/tenants/me', { token }),
    patch: (token: string, data: Partial<Pick<TenantMe, 'name' | 'phone' | 'address' | 'description' | 'logoUrl' | 'website' | 'aiModel' | 'aiAgentName' | 'aiTone' | 'billingEmail' | 'capabilities'> & { aiTemperature?: number; aiMaxTokens?: number }>) =>
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
    connectFacebook: (token: string, data: { email?: string; password?: string; twoFactorCode?: string; appState?: string }) =>
      request<{ ok: boolean; requires2FA?: boolean }>('/api/channels/facebook/connect', { method: 'POST', token, body: JSON.stringify(data) }),
    disconnectFacebook: (token: string, id: string) =>
      request<void>(`/api/channels/facebook/${id}`, { method: 'DELETE', token }),
    connectTikTok: (token: string, data: { cookies: string; username: string }) =>
      request<{ ok: boolean; username: string }>('/api/channels/tiktok/connect', { method: 'POST', token, body: JSON.stringify(data) }),
    disconnectTikTok: (token: string, id: string) =>
      request<void>(`/api/channels/tiktok/${id}`, { method: 'DELETE', token }),
  },

  orders: {
    list: (token: string, params?: { status?: string; customerId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.customerId) qs.set('customerId', params.customerId);
      const q = qs.toString();
      return request<Order[]>(`/api/orders${q ? `?${q}` : ''}`, { token });
    },
    get: (token: string, id: string) => request<Order & { items: unknown[]; payments: unknown[]; deliveries: unknown[] }>(`/api/orders/${id}`, { token }),
    patch: (token: string, id: string, data: Partial<{ status: string; paymentStatus: string; notes: string }>) =>
      request<Order>(`/api/orders/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
  },

  quotes: {
    list: (token: string, params?: { status?: string }) => {
      const qs = params?.status ? `?status=${params.status}` : '';
      return request<Quote[]>(`/api/quotes${qs}`, { token });
    },
    patch: (token: string, id: string, data: Partial<{ status: string; total: number; notes: string }>) =>
      request<Quote>(`/api/quotes/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
  },

  reservations: {
    list: (token: string, params?: { status?: string }) => {
      const qs = params?.status ? `?status=${params.status}` : '';
      return request<Reservation[]>(`/api/reservations${qs}`, { token });
    },
    patch: (token: string, id: string, data: Partial<{ status: string; notes: string }>) =>
      request<Reservation>(`/api/reservations/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
  },

  deliveries: {
    list: (token: string, params?: { status?: string }) => {
      const qs = params?.status ? `?status=${params.status}` : '';
      return request<Delivery[]>(`/api/deliveries${qs}`, { token });
    },
    create: (token: string, data: { orderId: string; address: string; courierName?: string; trackingNumber?: string }) =>
      request<Delivery>('/api/deliveries', { method: 'POST', token, body: JSON.stringify(data) }),
    patch: (token: string, id: string, data: Partial<{ status: string; trackingNumber: string; courierName: string }>) =>
      request<Delivery>(`/api/deliveries/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
  },

  kanban: {
    board: (token: string) =>
      request<{ columns: KanbanColumn[]; unassigned: KanbanConversation[] }>('/api/kanban/board', { token }),
    columns: (token: string) => request<KanbanColumn[]>('/api/kanban/columns', { token }),
    createColumn: (token: string, data: { name: string; color?: string; sortOrder?: number }) =>
      request<KanbanColumn>('/api/kanban/columns', { method: 'POST', token, body: JSON.stringify(data) }),
    patchColumn: (token: string, id: string, data: Partial<{ name: string; color: string; sortOrder: number; isFinal: boolean }>) =>
      request<KanbanColumn>(`/api/kanban/columns/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    deleteColumn: (token: string, id: string) =>
      request<void>(`/api/kanban/columns/${id}`, { method: 'DELETE', token }),
    move: (token: string, data: { conversationId: string; columnId: string; assignedUserId?: string }) =>
      request<{ id: string; kanbanColumnId: string | null }>('/api/kanban/move', { method: 'POST', token, body: JSON.stringify(data) }),
  },

  departments: {
    list: (token: string) => request<Department[]>('/api/departments', { token }),
    create: (token: string, data: { name: string; description?: string; autoAssign?: boolean }) =>
      request<Department>('/api/departments', { method: 'POST', token, body: JSON.stringify(data) }),
    patch: (token: string, id: string, data: Partial<{ name: string; autoAssign: boolean; isActive: boolean }>) =>
      request<Department>(`/api/departments/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) =>
      request<void>(`/api/departments/${id}`, { method: 'DELETE', token }),
    addMember: (token: string, deptId: string, userId: string, role?: string) =>
      request<DepartmentMember>(`/api/departments/${deptId}/members`, { method: 'POST', token, body: JSON.stringify({ userId, role }) }),
    removeMember: (token: string, deptId: string, userId: string) =>
      request<void>(`/api/departments/${deptId}/members/${userId}`, { method: 'DELETE', token }),
  },

  agentStatus: {
    set: (token: string, status: 'available' | 'busy' | 'away' | 'offline') =>
      request<{ id: string; agentStatus: string | null }>('/api/users/me/status', { method: 'PATCH', token, body: JSON.stringify({ status }) }),
    transfer: (token: string, conversationId: string, toUserId: string) =>
      request<{ id: string; assignedUserId: string | null }>('/api/users/transfer', { method: 'POST', token, body: JSON.stringify({ conversationId, toUserId }) }),
  },

  campaigns: {
    list: (token: string) => request<Campaign[]>('/api/campaigns', { token }),
    get: (token: string, id: string) => request<Campaign>(`/api/campaigns/${id}`, { token }),
    create: (token: string, data: {
      name: string; listId: string; messages: { text: string }[];
      scheduledAt?: string; mediaUrl?: string; mediaType?: string; recurrence?: string;
    }) => request<Campaign>('/api/campaigns', { method: 'POST', token, body: JSON.stringify(data) }),
    patch: (token: string, id: string, data: Partial<{ status: string; scheduledAt: string }>) =>
      request<Campaign>(`/api/campaigns/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) => request<void>(`/api/campaigns/${id}`, { method: 'DELETE', token }),
    launch: (token: string, id: string) => request<{ ok: boolean }>(`/api/campaigns/${id}/launch`, { method: 'POST', token }),
    logs: (token: string, id: string) => request<CampaignLog[]>(`/api/campaigns/${id}/logs`, { token }),
  },

  contactLists: {
    list: (token: string) => request<ContactList[]>('/api/contact-lists', { token }),
    create: (token: string, data: { name: string; description?: string }) =>
      request<ContactList>('/api/contact-lists', { method: 'POST', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) => request<void>(`/api/contact-lists/${id}`, { method: 'DELETE', token }),
    entries: (token: string, id: string) => request<ContactEntry[]>(`/api/contact-lists/${id}/entries`, { token }),
    importCsv: async (token: string, listId: string, formData: FormData): Promise<{ imported: number; total: number }> => {
      const doFetch = (t: string) => fetch(`${API_BASE}/api/contact-lists/${listId}/import-csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
        body: formData,
      });
      let res = await doFetch(token);
      if (res.status === 401) {
        const newToken = await attemptRefresh();
        if (newToken) res = await doFetch(newToken);
      }
      if (!res.ok) {
        const err = await res.json() as { code?: string; message?: string };
        throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Error desconocido');
      }
      return res.json() as Promise<{ imported: number; total: number }>;
    },
  },

  groups: {
    list: (token: string) => request<WaGroup[]>('/api/groups', { token }),
    create: (token: string, data: { subject: string; participants: string[] }) =>
      request<{ groupJid: string }>('/api/groups', { method: 'POST', token, body: JSON.stringify(data) }),
    addParticipants: (token: string, groupId: string, participants: string[]) =>
      request<unknown>(`/api/groups/${groupId}/participants`, { method: 'POST', token, body: JSON.stringify({ participants }) }),
    sendMessage: (token: string, groupId: string, text: string) =>
      request<{ ok: boolean }>(`/api/groups/${groupId}/message`, { method: 'POST', token, body: JSON.stringify({ text }) }),
  },

  integrations: {
    list: (token: string) => request<Integration[]>('/api/integrations', { token }),
    getConfig: (token: string, id: string) => request<Integration>(`/api/integrations/${id}/config`, { token }),
    create: (token: string, data: { provider: string; category: string; config: Record<string, unknown>; isActive?: boolean; isPrimary?: boolean }) =>
      request<Integration>('/api/integrations', { method: 'POST', token, body: JSON.stringify(data) }),
    patch: (token: string, id: string, data: Partial<{ isActive: boolean; isPrimary: boolean; config: Record<string, unknown> }>) =>
      request<Integration>(`/api/integrations/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (token: string, id: string) => request<void>(`/api/integrations/${id}`, { method: 'DELETE', token }),
  },

  appointments: {
    list: (token: string, params?: { phone?: string; customerId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.phone) qs.set('phone', params.phone);
      if (params?.customerId) qs.set('customerId', params.customerId);
      const q = qs.toString();
      return request<Appointment[]>(`/api/appointments${q ? `?${q}` : ''}`, { token });
    },
    patch: (token: string, id: string, data: Partial<{ status: string; notes: string }>) =>
      request<Appointment>(`/api/appointments/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
  },

  payments: {
    list: (token: string, params?: { status?: string }) => {
      const qs = params?.status ? `?status=${params.status}` : '';
      return request<Payment[]>(`/api/payments${qs}`, { token });
    },
    get: (token: string, id: string) => request<Payment>(`/api/payments/${id}`, { token }),
    createLink: (token: string, data: { amount: number; customerId: string; orderId?: string; appointmentId?: string; customerEmail?: string; redirectUrl?: string }) =>
      request<Payment>('/api/payments/create-link', { method: 'POST', token, body: JSON.stringify(data) }),
  },

  ai: {
    simulate: (token: string, data: { customerPhone: string; message: string; channel?: string }) =>
      request<{ aiResponse: string; customerId: string; action: string | null }>('/api/dev/simulate-message', { method: 'POST', token, body: JSON.stringify(data) }),
    knowledge: {
      list: (token: string) => request<KnowledgeEntry[]>('/api/ai/knowledge', { token }),
      create: (token: string, data: { question: string; answer: string; category?: string; keywords?: string[] }) =>
        request<KnowledgeEntry>('/api/ai/knowledge', { method: 'POST', token, body: JSON.stringify(data) }),
      delete: (token: string, id: string) => request<void>(`/api/ai/knowledge/${id}`, { method: 'DELETE', token }),
    },
    unanswered: (token: string) => request<UnansweredQuery[]>('/api/ai/unanswered', { token }),
  },

  analytics: {
    dashboard: (token: string) =>
      request<{
        conversationsToday: number; aiHandledPct: number; ordersToday: number;
        revenueToday: number; appointmentsToday: number; pendingOrders: number;
        channelBreakdown: Record<string, number>;
      }>('/api/analytics/dashboard', { token }),
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

export interface Order {
  id: string; orderNumber: string; status: string | null; paymentStatus: string | null;
  total: string; createdAt: string; customerId: string;
  customerName: string | null; customerPhone: string | null;
}

export interface Quote {
  id: string; quoteNumber: string; status: string | null; total: string;
  validUntil: string | null; createdAt: string; customerId: string; customerName: string | null;
}

export interface Reservation {
  id: string; status: string | null; reservedDate: string; reservedTime: string;
  partySize: number | null; notes: string | null; createdAt: string;
  customerId: string; customerName: string | null; customerPhone: string | null;
}

export interface Delivery {
  id: string; status: string | null; address: string; courierName: string | null;
  trackingNumber: string | null; estimatedAt: string | null; deliveredAt: string | null;
  createdAt: string; orderId: string; orderNumber: string | null; customerName: string | null;
}

export interface Appointment {
  id: string; serviceName: string; status: string | null; scheduledAt: string;
  durationMinutes: number; notes: string | null; createdAt: string; customerId: string;
}

export interface KanbanColumn {
  id: string; name: string; color: string | null; sortOrder: number | null;
  isFinal: boolean | null; tenantId: string;
  conversations?: KanbanConversation[];
}

export interface KanbanConversation {
  id: string; customerId: string; channel: string; status: string | null;
  assignedUserId: string | null; kanbanColumnId: string | null;
  unreadCount: number | null; lastMessageAt: string | null;
}

export interface Department {
  id: string; name: string; description: string | null; autoAssign: boolean | null;
  isActive: boolean | null; queueOrder: number | null; createdAt: string;
  members: DepartmentMember[];
}

export interface DepartmentMember {
  departmentId: string; userId: string; role: string | null;
  fullName: string | null; email: string; agentStatus: string | null;
}

export interface ConversationDetail {
  id: string; channel: string; status: string | null;
  customerId: string; unreadCount: number | null;
  lastMessageAt: string | null; createdAt: string;
  messages: Message[];
}

export interface Campaign {
  id: string; name: string; status: string | null;
  scheduledAt: string | null; totalContacts: number | null;
  sentCount: number | null; failedCount: number | null;
  mediaUrl: string | null; mediaType: string | null;
  recurrence: string | null; createdAt: string;
}

export interface CampaignLog {
  id: string; campaignId: string; contactPhone: string; contactName: string | null;
  messageIndex: number | null; status: string | null; errorMessage: string | null;
  sentAt: string | null;
}

export interface ContactList {
  id: string; name: string; description: string | null;
  contactCount: number | null; createdAt: string;
}

export interface ContactEntry {
  id: string; phone: string; name: string | null;
}

export interface Integration {
  id: string; provider: string; category: string;
  isActive: boolean | null; isPrimary: boolean | null;
  config: Record<string, unknown>; createdAt: string; updatedAt: string;
}

export interface WaGroup {
  id: string; subject: string; size: number; desc?: string | undefined;
}

export interface KnowledgeEntry {
  id: string; tenantId: string; question: string; answer: string;
  category: string | null; keywords: string[]; isActive: boolean | null;
  createdAt: string; updatedAt: string;
}

export interface UnansweredQuery {
  id: string; tenantId: string; question: string; status: string | null;
  customerId: string | null; conversationId: string | null; createdAt: string;
}

export interface Payment {
  id: string; customerId: string; orderId: string | null; appointmentId: string | null;
  provider: string | null; externalId: string | null; amount: string;
  currency: string | null; status: string | null; paymentLink: string | null;
  createdAt: string; updatedAt: string;
}

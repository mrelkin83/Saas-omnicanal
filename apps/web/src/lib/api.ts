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

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, data.code ?? 'UNKNOWN', data.message ?? 'Error desconocido');
  }
  return data as T;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface TenantMe {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  capabilities: string[];
  timezone: string;
  aiAgentName: string;
  aiTone: string;
}

export interface RegisterTenantInput {
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  tenantName: string;
  businessType: string;
  plan: string;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    refresh: (refreshToken: string) =>
      request<LoginResponse>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),

    logout: (refreshToken: string, token: string) =>
      request<void>('/api/auth/logout', {
        method: 'POST',
        token,
        body: JSON.stringify({ refreshToken }),
      }),

    register: (input: RegisterTenantInput) =>
      request<{ tenantId: string; userId: string }>('/api/auth/register-tenant', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  },

  tenants: {
    me: (token: string) =>
      request<TenantMe>('/api/tenants/me', { token }),
  },
};

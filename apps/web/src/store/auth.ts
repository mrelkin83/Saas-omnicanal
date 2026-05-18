'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    sub: string;
    tenantId: string;
    role: 'owner' | 'admin' | 'agent';
    email: string;
  } | null;
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
}

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]!)) as {
      sub: string;
      tenantId: string;
      role: 'owner' | 'admin' | 'agent';
      email: string;
    };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (access, refresh) => {
        const payload = parseJwt(access);
        set({ accessToken: access, refreshToken: refresh, user: payload });
        document.cookie = 'has_session=1; path=/; max-age=604800; SameSite=Lax';
      },

      clearAuth: () => {
        set({ accessToken: null, refreshToken: null, user: null });
        document.cookie = 'has_session=; path=/; max-age=0';
      },
    }),
    {
      name: 'auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);

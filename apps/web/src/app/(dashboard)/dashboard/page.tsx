'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type TenantMe } from '@/lib/api';

const CHANNEL_CARDS = [
  { label: 'WhatsApp', icon: '💬', color: 'var(--channel-whatsapp)', active: false },
  { label: 'Instagram', icon: '📸', color: 'var(--channel-instagram)', active: false },
  { label: 'Facebook', icon: '📘', color: 'var(--channel-facebook)', active: false },
  { label: 'TikTok', icon: '🎵', color: 'var(--channel-tiktok)', active: false },
];

const STAT_CARDS = [
  { label: 'Conversaciones hoy', value: '0', trend: null },
  { label: 'Mensajes enviados', value: '0', trend: null },
  { label: 'Tiempo de respuesta', value: '—', trend: null },
  { label: 'Satisfacción', value: '—', trend: null },
];

export default function DashboardPage() {
  const { accessToken, user } = useAuthStore();
  const [tenant, setTenant] = useState<TenantMe | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    api.tenants.me(accessToken).then(setTenant).catch(() => null);
  }, [accessToken]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Bienvenido, {user?.email?.split('@')[0]}
        </h1>
        <p className="text-text-secondary mt-1">
          {tenant ? tenant.name : 'Cargando...'} · Panel principal
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 border"
            style={{
              background: 'var(--bg-surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <p className="text-xs text-text-tertiary mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Channels */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
          Canales conectados
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CHANNEL_CARDS.map((ch) => (
            <div
              key={ch.label}
              className="rounded-xl p-5 border flex flex-col items-center gap-3 cursor-pointer transition-all"
              style={{
                background: 'var(--bg-surface-1)',
                borderColor: ch.active ? ch.color : 'var(--border-subtle)',
                opacity: ch.active ? 1 : 0.6,
              }}
            >
              <span className="text-3xl">{ch.icon}</span>
              <span className="text-sm font-medium text-text-primary">{ch.label}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: ch.active ? `${ch.color}22` : 'var(--bg-surface-2)',
                  color: ch.active ? ch.color : 'var(--text-tertiary)',
                }}
              >
                {ch.active ? 'Activo' : 'Conectar'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Agent info */}
      {tenant && (
        <div
          className="rounded-xl p-5 border"
          style={{
            background: 'var(--bg-surface-1)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-primary-subtle)' }}
            >
              🤖
            </div>
            <div>
              <p className="font-semibold text-text-primary text-sm">{tenant.aiAgentName}</p>
              <p className="text-xs text-text-tertiary">Agente IA · Tono {tenant.aiTone}</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Tu agente de IA está listo. Conecta un canal para comenzar a responder clientes
            automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}

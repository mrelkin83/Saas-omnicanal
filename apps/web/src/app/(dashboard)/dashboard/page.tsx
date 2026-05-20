'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { api, type TenantMe } from '@/lib/api';

interface DashboardKPIs {
  conversationsToday: number;
  aiHandledPct: number;
  ordersToday: number;
  revenueToday: number;
  appointmentsToday: number;
  pendingOrders: number;
  channelBreakdown: Record<string, number>;
}

interface ChannelStatus { id: string; status: string; displayName: string | null; }

const CHANNEL_META: Record<string, { label: string; icon: string; color: string }> = {
  whatsapp:  { label: 'WhatsApp',  icon: '💬', color: '#25D366' },
  instagram: { label: 'Instagram', icon: '📸', color: '#E1306C' },
  facebook:  { label: 'Facebook',  icon: '📘', color: '#1877F2' },
  tiktok:    { label: 'TikTok',    icon: '🎵', color: '#010101' },
};

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

export default function DashboardPage() {
  const { accessToken, user } = useAuthStore();
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [channels, setChannels] = useState<Record<string, ChannelStatus | null>>({});

  useEffect(() => {
    if (!accessToken) return;
    void api.tenants.me(accessToken).then(setTenant).catch(() => null);
    void api.analytics.dashboard(accessToken).then(setKpis).catch(() => null);
    void api.channels.allStatus(accessToken).then((s) => setChannels(s as Record<string, ChannelStatus | null>)).catch(() => null);
  }, [accessToken]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const statCards = kpis
    ? [
        { label: 'Conversaciones hoy', value: fmtNum(kpis.conversationsToday), icon: '💬' },
        { label: 'IA autónoma',         value: `${kpis.aiHandledPct}%`,          icon: '🤖' },
        { label: 'Ventas hoy',          value: fmtCOP(kpis.revenueToday),         icon: '💰' },
        { label: 'Pedidos hoy',         value: fmtNum(kpis.ordersToday),           icon: '🛒' },
        { label: 'Citas hoy',           value: fmtNum(kpis.appointmentsToday),     icon: '📅' },
        { label: 'Pedidos pendientes',  value: fmtNum(kpis.pendingOrders),          icon: '⏳', alert: kpis.pendingOrders > 0 },
      ]
    : [
        { label: 'Conversaciones hoy', value: '—', icon: '💬' },
        { label: 'IA autónoma',         value: '—', icon: '🤖' },
        { label: 'Ventas hoy',          value: '—', icon: '💰' },
        { label: 'Pedidos hoy',         value: '—', icon: '🛒' },
        { label: 'Citas hoy',           value: '—', icon: '📅' },
        { label: 'Pedidos pendientes',  value: '—', icon: '⏳' },
      ];

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
          {greeting}, {tenant?.name ?? user?.email?.split('@')[0] ?? ''}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Vista general del día · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{
            padding: '18px 20px',
            borderRadius: 12,
            border: `1px solid ${(s as { alert?: boolean }).alert ? '#f59e0b' : 'var(--border-subtle)'}`,
            background: 'var(--bg-surface-1)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{s.icon}</span> {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: (s as { alert?: boolean }).alert ? '#f59e0b' : 'var(--text-primary)' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Channels status */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Canales
          </h2>
          <Link href="/dashboard/channels" style={{ fontSize: 12, color: 'var(--accent-primary)', textDecoration: 'none' }}>
            Gestionar
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Object.entries(CHANNEL_META).map(([key, meta]) => {
            const session = channels[key];
            const connected = session?.status === 'connected';
            const count = kpis?.channelBreakdown[key] ?? 0;
            return (
              <Link key={key} href="/dashboard/channels" style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `1px solid ${connected ? meta.color : 'var(--border-subtle)'}`,
                  background: 'var(--bg-surface-1)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 22 }}>{meta.icon}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: connected ? `${meta.color}22` : 'var(--bg-surface-2)',
                      color: connected ? meta.color : 'var(--text-tertiary)',
                    }}>
                      {connected ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
                    {connected && session?.displayName && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{session.displayName}</div>
                    )}
                    {count > 0 && (
                      <div style={{ fontSize: 11, color: meta.color, marginTop: 2 }}>{count} conv. hoy</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Agent info + quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {tenant && (
          <div style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tenant.aiAgentName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Tono {tenant.aiTone} · {tenant.aiModel}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Tu agente responde clientes 24/7 en todos los canales conectados.
            </p>
            <Link href="/dashboard/ai-config" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
              Probar agente →
            </Link>
          </div>
        )}

        <div style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-1)' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Accesos rápidos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { href: '/dashboard/inbox', icon: '📥', label: 'Bandeja de entrada' },
              { href: '/dashboard/orders', icon: '🛒', label: 'Ver pedidos' },
              { href: '/dashboard/appointments', icon: '📅', label: 'Ver citas' },
              { href: '/dashboard/catalog', icon: '📦', label: 'Gestionar catálogo' },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
                transition: 'background 0.15s',
              }}>
                <span>{item.icon}</span> {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

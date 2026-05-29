'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { api, type TenantMe } from '@/lib/api';
import { Card, SkeletonKpiGrid, Badge, EmptyState } from '@/components/ui';
import {
  MessageSquare, Bot, ShoppingCart, CalendarDays, Clock,
  TrendingUp, ArrowRight, Radio, Zap, AlertTriangle,
} from 'lucide-react';

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

const CHANNEL_META: Record<string, { label: string; color: string; icon: typeof Radio }> = {
  whatsapp:  { label: 'WhatsApp',  color: '#25D366', icon: MessageSquare },
  instagram: { label: 'Instagram', color: '#E1306C', icon: Zap },
  facebook:  { label: 'Facebook',  color: '#1877F2', icon: Zap },
  tiktok:    { label: 'TikTok',    color: '#FE2C55', icon: Zap },
};

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

export default function DashboardPage() {
  const { accessToken, user } = useAuthStore();
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [channels, setChannels] = useState<Record<string, ChannelStatus | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.tenants.me(accessToken).catch(() => null),
      api.analytics.dashboard(accessToken).catch(() => null),
      api.channels.allStatus(accessToken).then((s) => s as Record<string, ChannelStatus | null>).catch(() => ({} as Record<string, ChannelStatus | null>)),
    ]).then(([t, k, c]) => {
      setTenant(t);
      setKpis(k);
      setChannels(c);
      if (!t && !k) setError('No se pudo cargar el dashboard. Verifica tu conexión.');
    }).catch(() => setError('Error cargando dashboard')).finally(() => setLoading(false));
  }, [accessToken]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const statCards = kpis
    ? [
        { label: 'Conversaciones hoy', value: fmtNum(kpis.conversationsToday), icon: MessageSquare, alert: false },
        { label: 'IA autónoma', value: `${kpis.aiHandledPct}%`, icon: Bot, alert: false },
        { label: 'Ventas hoy', value: fmtCOP(kpis.revenueToday), icon: TrendingUp, alert: false },
        { label: 'Pedidos hoy', value: fmtNum(kpis.ordersToday), icon: ShoppingCart, alert: false },
        { label: 'Citas hoy', value: fmtNum(kpis.appointmentsToday), icon: CalendarDays, alert: false },
        { label: 'Pendientes', value: fmtNum(kpis.pendingOrders), icon: Clock, alert: kpis.pendingOrders > 0 },
      ]
    : [];

  return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-text-primary">
          {greeting}, {tenant?.name ?? user?.email?.split('@')[0] ?? ''}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Vista general del día · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* KPI grid */}
      {loading ? (
        <SkeletonKpiGrid count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className={s.alert ? 'border-amber-500/30' : ''}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${s.alert ? 'text-amber-400' : 'text-text-tertiary'}`} />
                  <span className="text-xs text-text-tertiary">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold ${s.alert ? 'text-amber-400' : 'text-text-primary'}`}>
                  {s.value}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Channels status */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Canales
          </h2>
          <Link
            href="/dashboard/channels"
            className="text-xs text-accent-primary hover:text-accent-primary-hover font-medium flex items-center gap-1"
          >
            Gestionar <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-bg-surface-1 border border-border-subtle animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(CHANNEL_META).map(([key, meta]) => {
              const session = channels[key];
              const connected = session?.status === 'connected';
              const count = kpis?.channelBreakdown[key] ?? 0;
              const Icon = meta.icon;
              return (
                <Link key={key} href="/dashboard/channels" className="group">
                  <Card className="h-full transition-all hover:border-border-strong hover:shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                      <Badge
                        variant={connected ? 'success' : 'default'}
                        size="sm"
                      >
                        {connected ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold text-text-primary">{meta.label}</div>
                    {connected && session?.displayName && (
                      <div className="text-[11px] text-text-tertiary mt-0.5 truncate">{session.displayName}</div>
                    )}
                    {count > 0 && (
                      <div className="text-[11px] mt-1" style={{ color: meta.color }}>
                        {count} conv. hoy
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tenant && (
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent-primary-subtle flex items-center justify-center">
                <Bot className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary">{tenant.aiAgentName}</div>
                <div className="text-xs text-text-tertiary">Tono {tenant.aiTone} · {tenant.aiModel}</div>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-3">
              Tu agente responde clientes 24/7 en todos los canales conectados.
            </p>
            <Link
              href="/dashboard/ai-config"
              className="text-sm text-accent-primary hover:text-accent-primary-hover font-medium inline-flex items-center gap-1"
            >
              Probar agente <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Card>
        )}

        <Card>
          <div className="font-semibold text-sm text-text-primary mb-3">Accesos rápidos</div>
          <div className="flex flex-col gap-1">
            {[
              { href: '/dashboard/inbox', icon: MessageSquare, label: 'Bandeja de entrada' },
              { href: '/dashboard/orders', icon: ShoppingCart, label: 'Ver pedidos' },
              { href: '/dashboard/appointments', icon: CalendarDays, label: 'Ver citas' },
              { href: '/dashboard/catalog', icon: Zap, label: 'Gestionar catálogo' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
                >
                  <Icon className="w-4 h-4 text-text-tertiary" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

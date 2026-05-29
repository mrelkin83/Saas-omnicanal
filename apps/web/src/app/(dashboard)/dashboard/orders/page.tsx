'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Order } from '@/lib/api';
import { toast } from '@/hooks/useToast';

const STATUS_FLOW: Record<string, { next: string; label: string; color: string } | undefined> = {
  pending:    { next: 'confirmed',   label: 'Confirmar',      color: '#3b82f6' },
  confirmed:  { next: 'processing', label: 'En preparación',  color: '#f59e0b' },
  processing: { next: 'shipped',    label: 'Despachar',       color: '#8b5cf6' },
  shipped:    { next: 'delivered',  label: 'Entregado',       color: '#22c55e' },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', processing: 'En preparación',
  shipped: 'Despachado', delivered: 'Entregado', cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
  shipped: '#6366f1', delivered: '#22c55e', cancelled: '#ef4444',
};
const PAY_LABELS: Record<string, string> = {
  pending: 'Por cobrar', paid: 'Pagado', failed: 'Fallido', refunded: 'Reembolsado',
};
const PAY_COLORS: Record<string, string> = {
  pending: '#f59e0b', paid: '#22c55e', failed: '#ef4444', refunded: '#6366f1',
};

const fmt = (n: string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));

export default function OrdersPage() {
  const { accessToken } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    if (!accessToken) return;
    setLoading(true);
    api.orders.list(accessToken, filter !== 'all' ? { status: filter } : {})
      .then(setOrders)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Error inesperado');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [accessToken, filter]);

  const advance = async (order: Order) => {
    const next = STATUS_FLOW[order.status ?? ''];
    if (!next || !accessToken) return;
    setUpdating(order.id);
    try {
      const updated = await api.orders.patch(accessToken, order.id, { status: next.next });
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, ...updated } : o));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally { setUpdating(null); }
  };

  const statuses = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Pedidos</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statuses.map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-default)',
              background: filter === s ? 'var(--accent-primary)' : 'transparent',
              color: filter === s ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 12,
            }}>
              {s === 'all' ? 'Todos' : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>}
      {!loading && orders.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No hay pedidos con este filtro.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orders.map((order) => {
          const action = STATUS_FLOW[order.status ?? ''];
          return (
            <div key={order.id} style={{
              background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 10,
              padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>#{order.orderNumber}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {order.customerName ?? 'Cliente'} · {order.customerPhone ?? ''} · {new Date(order.createdAt).toLocaleDateString('es-CO')}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(order.total)}</div>
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: STATUS_COLORS[order.status ?? ''] ?? '#888', color: '#fff', whiteSpace: 'nowrap',
              }}>
                {STATUS_LABELS[order.status ?? ''] ?? order.status}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: PAY_COLORS[order.paymentStatus ?? ''] ?? '#888', color: '#fff', whiteSpace: 'nowrap',
              }}>
                {PAY_LABELS[order.paymentStatus ?? ''] ?? order.paymentStatus}
              </span>
              {action && (
                <button
                  onClick={() => void advance(order)}
                  disabled={updating === order.id}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: action.color, color: '#fff', fontWeight: 600,
                    fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                    opacity: updating === order.id ? 0.6 : 1,
                  }}
                >
                  {updating === order.id ? '...' : action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

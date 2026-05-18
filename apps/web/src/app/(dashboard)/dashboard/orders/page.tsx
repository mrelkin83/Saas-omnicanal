'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Order } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', processing: 'En proceso',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};
const PAY_LABELS: Record<string, string> = {
  pending: 'Pendiente', paid: 'Pagado', failed: 'Fallido', refunded: 'Reembolsado',
};
const PAY_COLORS: Record<string, string> = {
  pending: '#f59e0b', paid: '#22c55e', failed: '#ef4444', refunded: '#6366f1',
};

export default function OrdersPage() {
  const { accessToken } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api.orders.list(accessToken, filter !== 'all' ? { status: filter } : {})
      .then(setOrders).catch(() => null).finally(() => setLoading(false));
  }, [accessToken, filter]);

  const statuses = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const fmt = (amount: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(amount));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Pedidos</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statuses.map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)',
              background: filter === s ? 'var(--primary)' : 'transparent',
              color: filter === s ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 12,
            }}>
              {s === 'all' ? 'Todos' : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>}
      {!loading && orders.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay pedidos.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orders.map((order) => (
          <div key={order.id} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{order.orderNumber}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                {order.customerName ?? 'Cliente'} · {new Date(order.createdAt).toLocaleDateString('es-CO')}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(order.total)}</div>
            <span style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: 'var(--accent)', color: 'inherit',
            }}>
              {STATUS_LABELS[order.status ?? ''] ?? order.status}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: PAY_COLORS[order.paymentStatus ?? ''] ?? '#888', color: '#fff',
            }}>
              {PAY_LABELS[order.paymentStatus ?? ''] ?? order.paymentStatus}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Delivery } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', picked_up: 'Recogido', in_transit: 'En tránsito',
  delivered: 'Entregado', failed: 'Fallido',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', picked_up: '#3b82f6', in_transit: '#8b5cf6',
  delivered: '#22c55e', failed: '#ef4444',
};

export default function DeliveriesPage() {
  const { accessToken } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api.deliveries.list(accessToken, filter !== 'all' ? { status: filter } : {})
      .then(setDeliveries).catch(() => null).finally(() => setLoading(false));
  }, [accessToken, filter]);

  const changeStatus = async (id: string, status: string) => {
    if (!accessToken) return;
    setUpdating(id);
    try {
      const updated = await api.deliveries.patch(accessToken, id, { status });
      setDeliveries((prev) => prev.map((d) => d.id === id ? { ...d, ...updated } : d));
    } catch { /* ignore */ } finally { setUpdating(null); }
  };

  const statuses = ['all', 'pending', 'picked_up', 'in_transit', 'delivered', 'failed'];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Domicilios</h1>
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
      {!loading && deliveries.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay domicilios registrados.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deliveries.map((d) => (
          <div key={d.id} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{ fontSize: 28 }}>🛵</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{d.orderNumber ?? 'Pedido'} — {d.customerName ?? 'Cliente'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                📍 {d.address}
                {d.courierName && ` · Courier: ${d.courierName}`}
                {d.trackingNumber && ` · Track: ${d.trackingNumber}`}
              </div>
              {d.estimatedAt && (
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  ETA: {new Date(d.estimatedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                </div>
              )}
            </div>
            <span style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: STATUS_COLORS[d.status ?? ''] ?? '#888', color: '#fff',
            }}>
              {STATUS_LABELS[d.status ?? ''] ?? d.status}
            </span>
            <select
              value={d.status ?? 'pending'}
              disabled={updating === d.id}
              onChange={(e) => void changeStatus(d.id, e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--background)', color: 'inherit', fontSize: 12, cursor: 'pointer',
              }}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

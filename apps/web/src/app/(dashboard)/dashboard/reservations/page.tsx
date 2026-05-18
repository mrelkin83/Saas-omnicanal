'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Reservation } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#22c55e', cancelled: '#ef4444', completed: '#6366f1',
};

export default function ReservationsPage() {
  const { accessToken } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api.reservations.list(accessToken, filter !== 'all' ? { status: filter } : {})
      .then(setReservations).catch(() => null).finally(() => setLoading(false));
  }, [accessToken, filter]);

  const changeStatus = async (id: string, status: string) => {
    if (!accessToken) return;
    setUpdating(id);
    try {
      const updated = await api.reservations.patch(accessToken, id, { status });
      setReservations((prev) => prev.map((r) => r.id === id ? { ...r, ...updated } : r));
    } catch { /* ignore */ } finally { setUpdating(null); }
  };

  const statuses = ['all', 'pending', 'confirmed', 'cancelled', 'completed'];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Reservas</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {statuses.map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)',
              background: filter === s ? 'var(--primary)' : 'transparent',
              color: filter === s ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 12,
            }}>
              {s === 'all' ? 'Todas' : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>}
      {!loading && reservations.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay reservas.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reservations.map((r) => (
          <div key={r.id} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{ fontSize: 28 }}>🗓️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {r.reservedDate} a las {r.reservedTime} — {r.partySize} persona(s)
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                {r.customerName ?? r.customerPhone ?? 'Cliente'}
                {r.notes ? ` · ${r.notes}` : ''}
              </div>
            </div>
            <span style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: STATUS_COLORS[r.status ?? ''] ?? '#888', color: '#fff',
            }}>
              {STATUS_LABELS[r.status ?? ''] ?? r.status}
            </span>
            <select
              value={r.status ?? 'pending'}
              disabled={updating === r.id}
              onChange={(e) => void changeStatus(r.id, e.target.value)}
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

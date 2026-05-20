'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Appointment } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada',
  pending: 'Pendiente', no_show: 'No se presentó',
};
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#22c55e', cancelled: '#ef4444', completed: '#6366f1',
  pending: '#f59e0b', no_show: '#9ca3af',
};

export default function AppointmentsPage() {
  const { accessToken } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const load = () => {
    if (!accessToken) return;
    setLoading(true);
    api.appointments.list(accessToken).then(setAppointments).catch(() => null).finally(() => setLoading(false));
  };

  useEffect(load, [accessToken]);

  const updateStatus = async (id: string, status: string) => {
    if (!accessToken) return;
    setUpdating(id);
    try {
      const updated = await api.appointments.patch(accessToken, id, { status });
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a));
    } catch { /* ignore */ } finally { setUpdating(null); }
  };

  const statuses = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

  const filtered = filter === 'all' ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Citas</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statuses.map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-default)',
              background: filter === s ? 'var(--accent-primary)' : 'transparent',
              color: filter === s ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 12,
            }}>
              {s === 'all' ? 'Todas' : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>}
      {!loading && filtered.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No hay citas con este filtro.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((apt) => {
          const dateStr = new Date(apt.scheduledAt).toLocaleString('es-CO', {
            timeZone: 'America/Bogota', weekday: 'short', day: 'numeric',
            month: 'short', hour: '2-digit', minute: '2-digit',
          });
          const isActive = apt.status === 'confirmed' || apt.status === 'pending';
          return (
            <div key={apt.id} style={{
              background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 10,
              padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center',
            }}>
              <div style={{ fontSize: 26 }}>📅</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{apt.serviceName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {dateStr} · {apt.durationMinutes} min{apt.notes ? ` · ${apt.notes}` : ''}
                </div>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: STATUS_COLORS[apt.status ?? ''] ?? '#888', color: '#fff', whiteSpace: 'nowrap',
              }}>
                {STATUS_LABELS[apt.status ?? ''] ?? apt.status}
              </span>
              {isActive && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => void updateStatus(apt.id, 'completed')}
                    disabled={updating === apt.id}
                    style={{
                      padding: '5px 12px', borderRadius: 8, border: 'none',
                      background: '#22c55e', color: '#fff', fontWeight: 600,
                      fontSize: 12, cursor: 'pointer', opacity: updating === apt.id ? 0.6 : 1,
                    }}
                  >
                    Completar
                  </button>
                  <button
                    onClick={() => void updateStatus(apt.id, 'no_show')}
                    disabled={updating === apt.id}
                    style={{
                      padding: '5px 12px', borderRadius: 8, border: 'none',
                      background: '#9ca3af', color: '#fff', fontWeight: 600,
                      fontSize: 12, cursor: 'pointer', opacity: updating === apt.id ? 0.6 : 1,
                    }}
                  >
                    No vino
                  </button>
                  <button
                    onClick={() => void updateStatus(apt.id, 'cancelled')}
                    disabled={updating === apt.id}
                    style={{
                      padding: '5px 12px', borderRadius: 8, border: 'none',
                      background: '#ef4444', color: '#fff', fontWeight: 600,
                      fontSize: 12, cursor: 'pointer', opacity: updating === apt.id ? 0.6 : 1,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

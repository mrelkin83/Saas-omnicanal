'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Appointment } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#22c55e', cancelled: '#ef4444', completed: '#6366f1', pending: '#f59e0b',
};

export default function AppointmentsPage() {
  const { accessToken } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    api.appointments.list(accessToken).then(setAppointments).catch(() => null).finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Citas</h1>

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>}
      {!loading && appointments.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay citas registradas.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {appointments.map((apt) => {
          const dateStr = new Date(apt.scheduledAt).toLocaleString('es-CO', {
            timeZone: 'America/Bogota', weekday: 'short', day: 'numeric',
            month: 'short', hour: '2-digit', minute: '2-digit',
          });
          return (
            <div key={apt.id} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center',
            }}>
              <div style={{ fontSize: 28 }}>📅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{apt.serviceName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  {dateStr} · {apt.durationMinutes} min
                  {apt.notes ? ` · ${apt.notes}` : ''}
                </div>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: STATUS_COLORS[apt.status ?? ''] ?? '#888', color: '#fff',
              }}>
                {apt.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

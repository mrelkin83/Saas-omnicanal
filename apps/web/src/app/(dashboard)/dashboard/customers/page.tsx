'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Customer, type Order, type Appointment } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
  shipped: '#6366f1', delivered: '#22c55e', cancelled: '#ef4444',
};
const APT_COLORS: Record<string, string> = {
  confirmed: '#22c55e', cancelled: '#ef4444', completed: '#6366f1',
  pending: '#f59e0b', no_show: '#9ca3af',
};
const fmt = (n: string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));

interface CustomerHistory { orders: Order[]; appointments: Appointment[]; }

export default function CustomersPage() {
  const { accessToken, user } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, CustomerHistory>>({});
  const [histLoading, setHistLoading] = useState<string | null>(null);
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    const data = await api.customers.list(accessToken, search || undefined);
    setCustomers(data);
  }, [accessToken, search]);

  useEffect(() => { void load(); }, [load]);

  const toggleHistory = async (c: Customer) => {
    if (expanded === c.id) { setExpanded(null); return; }
    setExpanded(c.id);
    if (histories[c.id] || !accessToken) return;
    setHistLoading(c.id);
    const [orders, appointments] = await Promise.all([
      api.orders.list(accessToken, { customerId: c.id }).catch(() => [] as Order[]),
      api.appointments.list(accessToken, { customerId: c.id }).catch(() => [] as Appointment[]),
    ]);
    setHistories((prev) => ({ ...prev, [c.id]: { orders, appointments } }));
    setHistLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm('¿Eliminar cliente y todo su historial?')) return;
    await api.customers.delete(accessToken, id);
    void load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Clientes</h1>
        <span className="text-sm text-text-tertiary">{customers.length} registros</span>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, teléfono o email..."
        className="w-full max-w-sm px-3 py-2 rounded-lg text-sm text-text-primary mb-5 outline-none"
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
      />

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--bg-surface-1)' }}>
            <tr>
              {['Nombre', 'Teléfono', 'Email', 'Tags', 'Registrado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-tertiary text-sm">Sin clientes</td></tr>
            )}
            {customers.map((c, i) => {
              const isExp = expanded === c.id;
              const hist = histories[c.id];
              return (
                <>
                  <tr
                    key={c.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined, background: 'var(--bg-surface-1)', cursor: 'pointer' }}
                    onClick={() => void toggleHistory(c)}
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">{c.displayName ?? c.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{c.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(c.tags ?? []).map((tag) => (
                          <span key={tag} style={{ padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}>{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-tertiary text-xs">{new Date(c.createdAt).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{isExp ? '▲' : '▼'} historial</span>
                        {isAdmin && (
                          <button onClick={() => handleDelete(c.id)} className="text-xs" style={{ color: 'var(--accent-danger)' }}>
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExp && (
                    <tr key={`hist-${c.id}`} style={{ background: 'var(--bg-surface-2)' }}>
                      <td colSpan={6} style={{ padding: '16px 20px' }}>
                        {histLoading === c.id && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Cargando historial...</p>}
                        {hist && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {/* Orders */}
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.05em' }}>
                                PEDIDOS ({hist.orders.length})
                              </div>
                              {hist.orders.length === 0 ? (
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Sin pedidos</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {hist.orders.map((o) => (
                                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>#{o.orderNumber}</span>
                                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{fmt(o.total)}</span>
                                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: STATUS_COLORS[o.status ?? ''] ?? '#888', color: '#fff' }}>
                                        {o.status}
                                      </span>
                                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(o.createdAt).toLocaleDateString('es-CO')}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Appointments */}
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.05em' }}>
                                CITAS ({hist.appointments.length})
                              </div>
                              {hist.appointments.length === 0 ? (
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Sin citas</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {hist.appointments.map((a) => (
                                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{a.serviceName}</span>
                                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        {new Date(a.scheduledAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                                      </span>
                                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: APT_COLORS[a.status ?? ''] ?? '#888', color: '#fff' }}>
                                        {a.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

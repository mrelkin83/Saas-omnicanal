'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Customer } from '@/lib/api';

export default function CustomersPage() {
  const { accessToken, user } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    const data = await api.customers.list(accessToken, search || undefined);
    setCustomers(data);
  }, [accessToken, search]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm('¿Eliminar cliente?')) return;
    await api.customers.delete(accessToken, id);
    await load();
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
              {['Nombre', 'Teléfono', 'Email', 'Cédula', 'Registrado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-tertiary text-sm">Sin clientes</td></tr>
            )}
            {customers.map((c, i) => (
              <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined, background: 'var(--bg-surface-1)' }}>
                <td className="px-4 py-3 font-medium text-text-primary">{c.displayName ?? c.fullName ?? '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{c.cedula ?? '—'}</td>
                <td className="px-4 py-3 text-text-tertiary text-xs">{new Date(c.createdAt).toLocaleDateString('es-CO')}</td>
                <td className="px-4 py-3">
                  {isAdmin && (
                    <button onClick={() => handleDelete(c.id)} className="text-xs" style={{ color: 'var(--accent-danger)' }}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

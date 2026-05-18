'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Tenant {
  id: string; name: string; slug: string; businessType: string;
  planId: string | null; isDemo: boolean | null; demoExpiresAt: string | null;
  suspendedAt: string | null; mrr: string | null; createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function saToken() { return localStorage.getItem('sa_token') ?? ''; }

export default function SuperAdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    setLoading(true);
    const res = await fetch(`${API}/api/superadmin/tenants${search ? `?search=${encodeURIComponent(search)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) { router.push('/superadmin/login'); return; }
    if (res.ok) setTenants(await res.json() as Tenant[]);
    setLoading(false);
  }, [router, search]);

  useEffect(() => { void load(); }, [load]);

  const suspend = async (id: string) => {
    await fetch(`${API}/api/superadmin/tenants/${id}/suspend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saToken()}` },
      body: JSON.stringify({ reason: 'Suspendido manualmente' }),
    });
    void load();
  };

  const unsuspend = async (id: string) => {
    await fetch(`${API}/api/superadmin/tenants/${id}/unsuspend`, { method: 'POST', headers: { Authorization: `Bearer ${saToken()}` } });
    void load();
  };

  const impersonate = async (id: string) => {
    setImpersonating(id);
    const res = await fetch(`${API}/api/superadmin/tenants/${id}/impersonate`, { method: 'POST', headers: { Authorization: `Bearer ${saToken()}` } });
    if (res.ok) {
      const { accessToken, refreshToken } = await res.json() as { accessToken: string; refreshToken: string };
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      window.open('/dashboard', '_blank');
    }
    setImpersonating(null);
  };

  const filtered = tenants.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 32, color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Tenants ({tenants.length})</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o slug..."
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', fontSize: 14, width: 260 }} />
      </div>

      {loading && <p style={{ color: '#64748b' }}>Cargando...</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#64748b' }}>
              {['Nombre', 'Slug', 'Tipo', 'MRR', 'Demo', 'Estado', 'Creado', 'Acciones'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.name}</td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{t.slug}</td>
                <td style={{ padding: '10px 12px' }}>{t.businessType}</td>
                <td style={{ padding: '10px 12px', color: '#22c55e' }}>${parseFloat(t.mrr ?? '0').toLocaleString('es-CO')}</td>
                <td style={{ padding: '10px 12px' }}>
                  {t.isDemo ? (
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#78350f', color: '#fbbf24' }}>
                      Demo {t.demoExpiresAt ? `hasta ${new Date(t.demoExpiresAt).toLocaleDateString('es-CO')}` : ''}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {t.suspendedAt
                    ? <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#7f1d1d', color: '#fca5a5' }}>Suspendido</span>
                    : <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#14532d', color: '#86efac' }}>Activo</span>}
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString('es-CO')}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => void impersonate(t.id)} disabled={impersonating === t.id}
                      style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>
                      {impersonating === t.id ? '...' : 'Impersonar'}
                    </button>
                    {t.suspendedAt
                      ? <button onClick={() => void unsuspend(t.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #16a34a', background: 'transparent', color: '#86efac', cursor: 'pointer', fontSize: 11 }}>Reactivar</button>
                      : <button onClick={() => void suspend(t.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #dc2626', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 11 }}>Suspender</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={8} style={{ padding: '16px 12px', color: '#64748b', textAlign: 'center' }}>No hay tenants.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

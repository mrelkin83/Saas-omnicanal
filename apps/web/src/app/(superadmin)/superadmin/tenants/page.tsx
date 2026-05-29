'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, X, UserCircle } from 'lucide-react';
import { BUSINESS_TYPES as BT } from '@saas/shared';
import { Card, Badge, Button, EmptyState, Skeleton } from '@/components/ui';

interface Tenant {
  id: string; name: string; slug: string; businessType: string;
  planId: string | null; isDemo: boolean | null; demoExpiresAt: string | null;
  suspendedAt: string | null; mrr: string | null; createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function saToken() { return localStorage.getItem('sa_token') ?? ''; }

const BUSINESS_TYPES = Object.entries(BT).map(([value, cfg]) => ({ value, label: `${cfg.icon} ${cfg.label}` }));

export default function SuperAdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [plans, setPlans] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [form, setForm] = useState({
    tenantName: '', businessType: 'restaurante_comida_rapida',
    ownerName: '', ownerEmail: '', ownerPassword: '', plan: '',
  });

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

  useEffect(() => {
    const token = saToken();
    if (!token) return;
    void fetch(`${API}/api/superadmin/plans`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() as Promise<{ id: string; name: string; slug: string }[]> : [])
      .then((p) => { setPlans(p); if (p.length > 0 && !form.plan) setForm((f) => ({ ...f, plan: p[0]!.id })); })
      .catch(() => {});
  }, []);

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
      const payload = JSON.parse(atob(accessToken.split('.')[1]!)) as { sub: string; tenantId: string; role: 'owner' | 'admin' | 'agent'; email: string };
      localStorage.setItem('auth', JSON.stringify({ state: { accessToken, refreshToken, user: payload }, version: 0 }));
      document.cookie = 'has_session=1; path=/; max-age=604800; SameSite=Lax';
      window.open('/dashboard', '_blank');
    }
    setImpersonating(null);
  };

  const createTenant = async () => {
    if (!form.tenantName || !form.ownerEmail || !form.ownerPassword) return;
    setCreating(true); setCreateError('');
    try {
      const res = await fetch(`${API}/api/auth/register-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: form.tenantName,
          businessType: form.businessType,
          ownerName: form.ownerName || form.ownerEmail.split('@')[0],
          ownerEmail: form.ownerEmail,
          ownerPassword: form.ownerPassword,
          plan: form.plan,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? 'Error creando tenant');
      }
      setShowCreate(false);
      setForm({ tenantName: '', businessType: 'restaurante_comida_rapida', ownerName: '', ownerEmail: '', ownerPassword: '', plan: plans[0]?.id ?? '' });
      void load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error desconocido');
    } finally { setCreating(false); }
  };

  const filtered = tenants.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-text-primary bg-bg-surface-2 border border-border-default outline-none focus:ring-2 focus:ring-accent-primary/50';

  return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto text-text-primary">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Tenants ({tenants.length})</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o slug..."
              className="pl-9 pr-3 py-2 rounded-lg text-sm text-text-primary bg-bg-surface-2 border border-border-default outline-none focus:ring-2 focus:ring-accent-primary/50 w-64"
            />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Crear Tenant
          </Button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md relative">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold mb-5">Crear Tenant</h2>
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Nombre del negocio</label>
                <input value={form.tenantName} onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))} placeholder="Burger Palace" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Tipo de negocio</label>
                <select value={form.businessType} onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))} className={inputCls}>
                  {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Email del dueño</label>
                <input type="email" value={form.ownerEmail} onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))} placeholder="dueno@negocio.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Nombre del dueño</label>
                <input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} placeholder="Juan García" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Contraseña inicial</label>
                <input type="password" value={form.ownerPassword} onChange={(e) => setForm((f) => ({ ...f, ownerPassword: e.target.value }))} placeholder="••••••••" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Plan</label>
                <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} className={inputCls}>
                  {plans.length === 0 && <option value="">Cargando planes...</option>}
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>)}
                </select>
              </div>
              {createError && <p className="text-red-400 text-xs">{createError}</p>}
              <Button
                onClick={() => void createTenant()}
                disabled={creating || !form.tenantName || !form.ownerEmail || !form.ownerPassword}
                isLoading={creating}
              >
                Crear Tenant
              </Button>
            </div>
          </Card>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState icon={UserCircle} title="No hay tenants" description="Crea el primer tenant para comenzar." />
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-text-tertiary">
                {['Nombre', 'Slug', 'Tipo', 'MRR', 'Demo', 'Estado', 'Creado', 'Acciones'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border-subtle/50">
                  <td className="px-3 py-2.5 font-semibold text-text-primary">{t.name}</td>
                  <td className="px-3 py-2.5 text-text-tertiary font-mono text-xs">{t.slug}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{t.businessType}</td>
                  <td className="px-3 py-2.5 text-emerald-400">${parseFloat(t.mrr ?? '0').toLocaleString('es-CO')}</td>
                  <td className="px-3 py-2.5">
                    {t.isDemo ? (
                      <Badge variant="warning">
                        Demo {t.demoExpiresAt ? `hasta ${new Date(t.demoExpiresAt).toLocaleDateString('es-CO')}` : ''}
                      </Badge>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {t.suspendedAt
                      ? <Badge variant="danger">Suspendido</Badge>
                      : <Badge variant="success">Activo</Badge>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-text-tertiary text-xs">{new Date(t.createdAt).toLocaleDateString('es-CO')}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => void impersonate(t.id)} disabled={impersonating === t.id} isLoading={impersonating === t.id}>
                        Impersonar
                      </Button>
                      {t.suspendedAt
                        ? <Button size="sm" variant="secondary" onClick={() => void unsuspend(t.id)}>Reactivar</Button>
                        : <Button size="sm" variant="danger" onClick={() => void suspend(t.id)}>Suspender</Button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BUSINESS_TYPES as BT } from '@saas/shared';

const BUSINESS_TYPE_OPTIONS = Object.entries(BT).map(([value, cfg]) => ({ value, label: `${cfg.icon} ${cfg.label}` }));

interface DemoTenant {
  id: string; name: string; slug: string; businessType: string;
  isDemo: boolean | null; demoExpiresAt: string | null; suspendedAt: string | null; createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function saToken() { return localStorage.getItem('sa_token') ?? ''; }

export default function SuperAdminDemosPage() {
  const router = useRouter();
  const [demos, setDemos] = useState<DemoTenant[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ tenantName: '', ownerEmail: '', ownerPassword: 'Demo123!', ownerName: '', businessType: 'restaurante_comida_rapida', durationDays: '14' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ tenantId: string; demoExpiresAt: string } | null>(null);

  const load = useCallback(async () => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    const res = await fetch(`${API}/api/superadmin/demos`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setDemos(await res.json() as DemoTenant[]);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const createDemo = async () => {
    setSaving(true); setResult(null);
    try {
      const res = await fetch(`${API}/api/superadmin/demos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saToken()}` },
        body: JSON.stringify({ ...form, durationDays: parseInt(form.durationDays, 10) }),
      });
      if (res.ok) {
        const data = await res.json() as { tenantId: string; demoExpiresAt: string };
        setResult(data);
        setShowCreate(false);
        void load();
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const deleteDemo = async (id: string) => {
    await fetch(`${API}/api/superadmin/demos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${saToken()}` } });
    void load();
  };

  const daysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  return (
    <div style={{ padding: 32, color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Demos ({demos.length})</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ Nueva demo</button>
      </div>

      {result && (
        <div style={{ background: '#14532d', border: '1px solid #16a34a', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ color: '#86efac', margin: 0, fontSize: 13 }}>
            Demo creada · ID: <code style={{ fontFamily: 'monospace' }}>{result.tenantId}</code> · Vence: {new Date(result.demoExpiresAt).toLocaleDateString('es-CO')}
          </p>
        </div>
      )}

      {showCreate && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Nueva cuenta demo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'tenantName', label: 'Nombre del negocio', placeholder: 'Mi Tienda Demo' },
              { key: 'ownerEmail', label: 'Email del owner', placeholder: 'owner@empresa.com' },
              { key: 'ownerName', label: 'Nombre del owner', placeholder: 'Juan Pérez' },
              { key: 'ownerPassword', label: 'Contraseña inicial', placeholder: 'Demo123!' },
              { key: 'durationDays', label: 'Duración (días)', placeholder: '14' },
            ].map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{f.label.toUpperCase()}</div>
                <input value={form[f.key as keyof typeof form]} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} type={f.key === 'ownerPassword' ? 'password' : 'text'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>TIPO DE NEGOCIO</div>
              <select value={form.businessType} onChange={(e) => setForm((prev) => ({ ...prev, businessType: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' as const }}>
                {BUSINESS_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => void createDemo()} disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creando...' : 'Crear demo'}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {demos.map((d) => {
          const days = daysLeft(d.demoExpiresAt);
          return (
            <div key={d.id} style={{ background: '#1e293b', border: `1px solid ${d.suspendedAt ? '#7f1d1d' : '#334155'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {d.businessType} · Creada: {new Date(d.createdAt).toLocaleDateString('es-CO')}
                  {d.demoExpiresAt && ` · Vence: ${new Date(d.demoExpiresAt).toLocaleDateString('es-CO')}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {days !== null && (
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: days <= 0 ? '#7f1d1d' : days <= 3 ? '#78350f' : '#14532d', color: days <= 0 ? '#fca5a5' : days <= 3 ? '#fbbf24' : '#86efac' }}>
                    {days <= 0 ? 'Vencida' : `${days}d restantes`}
                  </span>
                )}
                {d.suspendedAt && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#7f1d1d', color: '#fca5a5' }}>Suspendida</span>}
                <button onClick={() => void deleteDemo(d.id)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #dc2626', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 11 }}>Eliminar</button>
              </div>
            </div>
          );
        })}
        {demos.length === 0 && <p style={{ color: '#64748b' }}>No hay cuentas demo activas.</p>}
      </div>
    </div>
  );
}

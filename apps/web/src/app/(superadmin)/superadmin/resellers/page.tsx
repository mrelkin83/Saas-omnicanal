'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Reseller {
  id: string; name: string; company: string | null; email: string;
  phone: string | null; commissionPct: string | null; referralCode: string;
  totalReferrals: number | null; totalEarnings: string | null; isActive: boolean | null; createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function saToken() { return localStorage.getItem('sa_token') ?? ''; }

export default function SuperAdminResellersPage() {
  const router = useRouter();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', commissionPct: '10' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    const res = await fetch(`${API}/api/superadmin/resellers`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setResellers(await res.json() as Reseller[]);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const createReseller = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/superadmin/resellers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saToken()}` },
        body: JSON.stringify({ ...form, commissionPct: parseFloat(form.commissionPct) }),
      });
      if (res.ok) { setShowCreate(false); void load(); }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const deleteReseller = async (id: string) => {
    await fetch(`${API}/api/superadmin/resellers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${saToken()}` } });
    void load();
  };

  return (
    <div style={{ padding: 32, color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Resellers ({resellers.length})</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ Nuevo reseller</button>
      </div>

      {showCreate && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Nuevo reseller</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'name', label: 'Nombre', placeholder: 'Nombre del reseller' },
              { key: 'company', label: 'Empresa', placeholder: 'Empresa SAS' },
              { key: 'email', label: 'Email', placeholder: 'reseller@empresa.com' },
              { key: 'phone', label: 'Teléfono', placeholder: '+573001234567' },
              { key: 'commissionPct', label: 'Comisión (%)', placeholder: '10' },
            ].map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{f.label.toUpperCase()}</div>
                <input value={form[f.key as keyof typeof form]} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => void createReseller()} disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Crear reseller'}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {resellers.map((r) => (
          <div key={r.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name} {r.company && <span style={{ color: '#64748b', fontWeight: 400 }}>· {r.company}</span>}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {r.email} · Código: <code style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{r.referralCode}</code>
                {' · '}Comisión: {r.commissionPct ?? '10'}%
                {' · '}Referidos: {r.totalReferrals ?? 0}
                {' · '}Ganancias: ${parseFloat(r.totalEarnings ?? '0').toLocaleString('es-CO')}
              </div>
            </div>
            <button onClick={() => void deleteReseller(r.id)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 11 }}>
              Eliminar
            </button>
          </div>
        ))}
        {resellers.length === 0 && <p style={{ color: '#64748b' }}>No hay resellers registrados.</p>}
      </div>
    </div>
  );
}

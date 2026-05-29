'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/useToast';

interface Plan {
  id: string; name: string; slug: string; priceCop: string;
  billingCycle: string | null; limits: Record<string, unknown>;
  features: string[] | null; isActive: boolean | null; sortOrder: number | null; createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function saToken() { return localStorage.getItem('sa_token') ?? ''; }

export default function SuperAdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', priceCop: '', billingCycle: 'monthly', limits: '{"maxUsers":5,"maxConversations":1000}', features: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    const res = await fetch(`${API}/api/superadmin/plans`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setPlans(await res.json() as Plan[]);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const createPlan = async () => {
    setSaving(true);
    try {
      const limits = JSON.parse(form.limits) as Record<string, unknown>;
      const features = form.features.split(',').map((f) => f.trim()).filter(Boolean);
      const res = await fetch(`${API}/api/superadmin/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saToken()}` },
        body: JSON.stringify({ name: form.name, slug: form.slug, priceCop: parseFloat(form.priceCop), billingCycle: form.billingCycle, limits, features }),
      });
      if (res.ok) { setShowCreate(false); void load(); }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); } finally { setSaving(false); }
  };

  const deletePlan = async (id: string) => {
    await fetch(`${API}/api/superadmin/plans/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${saToken()}` } });
    void load();
  };

  const toggleActive = async (plan: Plan) => {
    await fetch(`${API}/api/superadmin/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saToken()}` },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    void load();
  };

  return (
    <div style={{ padding: 32, color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Planes SaaS</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ Nuevo plan</button>
      </div>

      {showCreate && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Nuevo plan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'name', label: 'Nombre', placeholder: 'Starter' },
              { key: 'slug', label: 'Slug', placeholder: 'starter' },
              { key: 'priceCop', label: 'Precio COP/mes', placeholder: '150000' },
              { key: 'billingCycle', label: 'Ciclo', placeholder: 'monthly' },
            ].map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{f.label.toUpperCase()}</div>
                <input value={form[f.key as keyof typeof form]} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>LÍMITES (JSON)</div>
              <textarea value={form.limits} onChange={(e) => setForm((prev) => ({ ...prev, limits: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 13, fontFamily: 'monospace', resize: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>FEATURES (separadas por coma)</div>
              <input value={form.features} onChange={(e) => setForm((prev) => ({ ...prev, features: e.target.value }))}
                placeholder="WhatsApp, IA, Campañas, Multiagente"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => void createPlan()} disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creando...' : 'Crear plan'}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map((plan) => (
          <div key={plan.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{plan.name}</span>
                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{plan.slug}</span>
                {!plan.isActive && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, background: '#7f1d1d', color: '#fca5a5' }}>Inactivo</span>}
              </div>
              <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>
                ${parseFloat(plan.priceCop).toLocaleString('es-CO')} / {plan.billingCycle ?? 'monthly'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Límites: {JSON.stringify(plan.limits)} · Features: {(plan.features ?? []).join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void toggleActive(plan)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>
                {plan.isActive ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => void deletePlan(plan.id)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 11 }}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && <p style={{ color: '#64748b' }}>No hay planes creados.</p>}
      </div>
    </div>
  );
}

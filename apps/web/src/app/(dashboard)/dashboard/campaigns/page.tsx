'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

interface Campaign {
  id: string; name: string; status: string | null; scheduledAt: string | null;
  totalContacts: number | null; sentCount: number | null; failedCount: number | null;
  createdAt: string;
}

interface ContactList { id: string; name: string; contactCount: number | null; }

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af', scheduled: '#3b82f6', running: '#f59e0b',
  done: '#22c55e', cancelled: '#ef4444', paused: '#8b5cf6',
};

export default function CampaignsPage() {
  const { accessToken } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', listId: '', messages: [''], scheduledAt: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [camps, cls] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/campaigns`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()) as Promise<Campaign[]>,
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/contact-lists`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()) as Promise<ContactList[]>,
    ]);
    setCampaigns(camps);
    setLists(cls);
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const addMessage = () => setForm((f) => ({ ...f, messages: [...f.messages, ''] }));
  const setMessage = (i: number, v: string) => setForm((f) => ({ ...f, messages: f.messages.map((m, j) => j === i ? v : m) }));
  const removeMessage = (i: number) => setForm((f) => ({ ...f, messages: f.messages.filter((_, j) => j !== i) }));

  const createCampaign = async () => {
    if (!accessToken || !form.name || !form.listId || form.messages.every((m) => !m.trim())) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        listId: form.listId,
        messages: form.messages.filter((m) => m.trim()).map((text) => ({ text })),
      };
      if (form.scheduledAt) body['scheduledAt'] = new Date(form.scheduledAt).toISOString();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) { setShowCreate(false); setForm({ name: '', listId: '', messages: [''], scheduledAt: '' }); void load(); }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const deleteCampaign = async (id: string) => {
    if (!accessToken) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/campaigns/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    void load();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Campañas masivas</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Nueva campaña
        </button>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Nueva campaña</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre de la campaña"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }} />
            <select value={form.listId} onChange={(e) => setForm((f) => ({ ...f, listId: e.target.value }))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }}>
              <option value="">Seleccionar lista de contactos...</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.contactCount ?? 0} contactos)</option>)}
            </select>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>MENSAJES (máx. 5 — se rotan)</div>
              {form.messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <textarea value={msg} onChange={(e) => setMessage(i, e.target.value)} rows={2}
                    placeholder={`Mensaje ${i + 1} — usa {{nombre}} para variables`}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 13, resize: 'none', fontFamily: 'inherit' }} />
                  {form.messages.length > 1 && (
                    <button onClick={() => removeMessage(i)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 13, alignSelf: 'flex-start' }}>✕</button>
                  )}
                </div>
              ))}
              {form.messages.length < 5 && (
                <button onClick={addMessage} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>+ Agregar variante</button>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>PROGRAMAR (opcional)</div>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void createCampaign()} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Creando...' : 'Crear campaña'}
              </button>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>}
      {!loading && campaigns.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay campañas creadas.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {campaigns.map((c) => (
          <div key={c.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                {c.scheduledAt ? `Programada: ${new Date(c.scheduledAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}` : 'Sin programar'}
                {' · '}Enviados: {c.sentCount ?? 0}/{c.totalContacts ?? 0} · Fallidos: {c.failedCount ?? 0}
              </div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: STATUS_COLORS[c.status ?? ''] ?? '#888', color: '#fff' }}>
              {c.status}
            </span>
            <button onClick={() => void deleteCampaign(c.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

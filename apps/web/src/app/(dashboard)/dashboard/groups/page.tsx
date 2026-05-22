'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type WaGroup } from '@/lib/api';

export default function GroupsPage() {
  const { accessToken } = useAuthStore();
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [participants, setParticipants] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    api.groups.list(accessToken)
      .then((data) => setGroups(data))
      .catch(() => setError('WhatsApp no está conectado o no hay grupos.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const createGroup = async () => {
    if (!accessToken || !subject.trim() || !participants.trim()) return;
    setSaving(true);
    const phones = participants.split(',').map((p) => p.trim()).filter(Boolean);
    try {
      const g = await api.groups.create(accessToken, { subject: subject.trim(), participants: phones });
      setGroups((prev) => [...prev, { id: g.groupJid, subject: subject.trim(), size: phones.length + 1 }]);
      setShowCreate(false); setSubject(''); setParticipants('');
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Grupos WhatsApp</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Nuevo grupo
        </button>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Crear grupo</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Nombre del grupo"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }} />
            <textarea value={participants} onChange={(e) => setParticipants(e.target.value)} rows={3}
              placeholder="Teléfonos separados por coma: +573001234567, +573007654321"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14, resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void createGroup()} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Creando...' : 'Crear'}
              </button>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando grupos...</p>}
      {error && <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>}
      {!loading && !error && groups.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay grupos de WhatsApp.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map((g) => (
          <div key={g.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 26 }}>👥</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{g.subject}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                {g.size} participante(s) · ID: {g.id}
              </div>
              {g.desc && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{g.desc}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

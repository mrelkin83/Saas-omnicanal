'use client';

import { Building2 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Department, type User } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e', busy: '#f59e0b', away: '#6366f1', offline: '#9ca3af',
};
const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible', busy: 'Ocupado', away: 'Ausente', offline: 'Desconectado',
};

export default function DepartmentsPage() {
  const { accessToken, user: me } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [myStatus, setMyStatus] = useState<string>('available');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = me?.role === 'owner' || me?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError('');
    try {
      const [depts, usrs] = await Promise.all([
        api.departments.list(accessToken),
        api.users.list(accessToken),
      ]);
      setDepartments(depts);
      setUsers(usrs);
      const self = usrs.find((u) => u.id === me?.sub);
      if (self?.agentStatus) setMyStatus(self.agentStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando departamentos');
    } finally {
      setLoading(false);
    }
  }, [accessToken, me?.sub]);

  useEffect(() => { void load(); }, [load]);

  const createDept = async () => {
    if (!accessToken || !newName.trim()) return;
    setSaving(true);
    try {
      await api.departments.create(accessToken, { name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName(''); setNewDesc(''); setShowCreate(false);
      void load();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const deleteDept = async (id: string) => {
    if (!accessToken) return;
    await api.departments.delete(accessToken, id).catch(() => null);
    void load();
  };

  const addMember = async (deptId: string, userId: string) => {
    if (!accessToken) return;
    await api.departments.addMember(accessToken, deptId, userId).catch(() => null);
    void load();
  };

  const removeMember = async (deptId: string, userId: string) => {
    if (!accessToken) return;
    await api.departments.removeMember(accessToken, deptId, userId).catch(() => null);
    void load();
  };

  const changeMyStatus = async (status: string) => {
    if (!accessToken) return;
    const prev = myStatus;
    setMyStatus(status);
    try {
      await api.agentStatus.set(accessToken, status as 'available' | 'busy' | 'away' | 'offline');
    } catch {
      setMyStatus(prev);
    }
  };

  const memberIds = (dept: Department) => new Set(dept.members.map((m) => m.userId));

  return (
    <div style={{ padding: 24 }}>
      {/* My status bar */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[myStatus] ?? '#9ca3af', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Mi estado: {STATUS_LABELS[myStatus] ?? myStatus}</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {(['available', 'busy', 'away', 'offline'] as const).map((s) => (
            <button
              key={s}
              onClick={() => void changeMyStatus(s)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12,
                background: myStatus === s ? STATUS_COLORS[s] : 'transparent',
                color: myStatus === s ? '#fff' : 'inherit', fontWeight: myStatus === s ? 600 : 400,
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Departamentos</h1>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            + Nuevo departamento
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del departamento"
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }} />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descripción (opcional)"
              style={{ flex: 2, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14 }} />
            <button onClick={() => void createDept()} disabled={saving || !newName.trim()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              Crear
            </button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>}
      {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      {!loading && departments.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay departamentos. Crea el primero.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {departments.map((dept) => (
          <div key={dept.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div
              onClick={() => setExpanded(expanded === dept.id ? null : dept.id)}
              style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <span style={{ fontSize: 20 }}><Building2 className="w-4 h-4 inline-block" /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{dept.name}</div>
                {dept.description && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{dept.description}</div>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{dept.members.length} miembro(s)</span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{expanded === dept.id ? '▲' : '▼'}</span>
              {isAdmin && (
                <button onClick={(e) => { e.stopPropagation(); void deleteDept(dept.id); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                  Eliminar
                </button>
              )}
            </div>

            {expanded === dept.id && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>MIEMBROS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {dept.members.map((m) => (
                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[m.agentStatus ?? 'offline'] }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{m.fullName ?? m.email}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{m.role}</span>
                      {isAdmin && (
                        <button onClick={() => void removeMember(dept.id, m.userId)} style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#ef4444' }}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {dept.members.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Sin miembros.</p>}
                </div>

                {isAdmin && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>AGREGAR MIEMBRO</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {users.filter((u) => !memberIds(dept).has(u.id)).map((u) => (
                        <button key={u.id} onClick={() => void addMember(dept.id, u.id)} style={{
                          padding: '4px 10px', borderRadius: 16, border: '1px solid var(--border)',
                          background: 'transparent', cursor: 'pointer', fontSize: 12,
                        }}>
                          + {u.fullName ?? u.email}
                        </button>
                      ))}
                      {users.filter((u) => !memberIds(dept).has(u.id)).length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Todos los usuarios ya son miembros.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: string; action: string; targetType: string | null; targetId: string | null;
  details: Record<string, unknown> | null; ipAddress: string | null;
  createdAt: string; adminId: string; adminEmail: string | null; adminName: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function saToken() { return localStorage.getItem('sa_token') ?? ''; }

const ACTION_COLORS: Record<string, string> = {
  CREATE_DEMO: '#1d4ed8', DELETE_DEMO: '#dc2626',
  SUSPEND_TENANT: '#b45309', UNSUSPEND_TENANT: '#16a34a',
  PATCH_TENANT: '#7c3aed', IMPERSONATE_TENANT: '#db2777',
  CREATE_PLAN: '#0e7490', DELETE_PLAN: '#dc2626',
  CREATE_RESELLER: '#15803d', PATCH_RESELLER: '#7c3aed',
};

export default function SuperAdminAuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (offset = 0) => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    setLoading(true);
    const res = await fetch(`${API}/api/superadmin/audit?limit=100&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) { router.push('/superadmin/login'); return; }
    if (res.ok) setLogs(await res.json() as AuditLog[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: 32, color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Auditoría ({logs.length})</h1>
        <button onClick={() => void load()} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>↻ Actualizar</button>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Cargando...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logs.map((log) => (
          <div key={log.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap',
              background: `${ACTION_COLORS[log.action] ?? '#334155'}22`,
              color: ACTION_COLORS[log.action] ?? '#94a3b8',
              border: `1px solid ${ACTION_COLORS[log.action] ?? '#334155'}44`,
            }}>{log.action}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#cbd5e1' }}>
                <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{log.adminName ?? log.adminEmail ?? log.adminId}</span>
                {log.targetType && <span style={{ color: '#64748b' }}> → {log.targetType}</span>}
                {log.targetId && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}> {log.targetId.slice(0, 8)}…</span>}
              </div>
              {log.details && Object.keys(log.details).length > 0 && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                  {JSON.stringify(log.details)}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
              <div>{new Date(log.createdAt).toLocaleDateString('es-CO')}</div>
              <div>{new Date(log.createdAt).toLocaleTimeString('es-CO')}</div>
              {log.ipAddress && <div style={{ marginTop: 2 }}>{log.ipAddress}</div>}
            </div>
          </div>
        ))}
        {logs.length === 0 && !loading && <p style={{ color: '#64748b' }}>No hay registros de auditoría.</p>}
      </div>
    </div>
  );
}

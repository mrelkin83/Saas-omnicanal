'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface MonitorData {
  cpu: number;
  ram: { totalMb: number; usedMb: number; freeMb: number; percent: number };
  disk: { totalGb: number; usedGb: number; freeGb: number; percent: number } | null;
  uptime: number;
  nodeVersion: string;
  platform: string;
  cores: number;
  timestamp: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function saToken() { return localStorage.getItem('sa_token') ?? ''; }

function Bar({ percent, color = '#3b82f6' }: { percent: number; color?: string }) {
  return (
    <div style={{ height: 8, background: '#334155', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, percent)}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  );
}

function StatCard({ label, value, sub, bar, barColor }: { label: string; value: string; sub?: string; bar?: number; barColor?: string }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{sub}</div>}
      {bar !== undefined && <Bar percent={bar} color={barColor ?? (bar > 85 ? '#ef4444' : bar > 65 ? '#f59e0b' : '#22c55e')} />}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

export default function SuperAdminMonitorPage() {
  const router = useRouter();
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    const res = await fetch(`${API}/api/superadmin/monitor/health`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) { router.push('/superadmin/login'); return; }
    if (res.ok) setData(await res.json() as MonitorData);
    else setError('Error cargando métricas');
  }, [router]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ padding: 32, color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Monitor VPS</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {data && <span style={{ fontSize: 12, color: '#64748b' }}>Actualizado: {new Date(data.timestamp).toLocaleTimeString('es-CO')}</span>}
          <button onClick={() => void load()} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>↻ Actualizar</button>
        </div>
      </div>

      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {!data && !error && <p style={{ color: '#64748b' }}>Cargando métricas...</p>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard label="CPU (load avg)" value={`${data.cpu}%`} sub={`${data.cores} cores · ${data.platform}`} bar={data.cpu} />
            <StatCard label="RAM" value={`${data.ram.usedMb} MB`} sub={`${data.ram.freeMb} MB libres de ${data.ram.totalMb} MB`} bar={data.ram.percent} />
            {data.disk
              ? <StatCard label="Disco" value={`${data.disk.usedGb} GB`} sub={`${data.disk.freeGb} GB libres de ${data.disk.totalGb} GB`} bar={data.disk.percent} />
              : <StatCard label="Disco" value="N/D" sub="No disponible en Windows" />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <StatCard label="Uptime" value={formatUptime(data.uptime)} sub="Tiempo desde el último reinicio" />
            <StatCard label="Node.js" value={data.nodeVersion} sub={`Platform: ${data.platform}`} />
          </div>
        </>
      )}
    </div>
  );
}

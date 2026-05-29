'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui';

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

function Bar({ percent }: { percent: number }) {
  const colorClass = percent > 85 ? 'bg-red-500' : percent > 65 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="h-2 bg-bg-surface-2 rounded-full overflow-hidden">
      <div className={colorClass + ' h-full rounded-full transition-all duration-500'} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: number }) {
  return (
    <Card>
      <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-text-primary mb-1">{value}</div>
      {sub && <div className="text-xs text-text-tertiary mb-2">{sub}</div>}
      {bar !== undefined && <Bar percent={bar} />}
    </Card>
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
    <div className="p-5 lg:p-8 max-w-6xl mx-auto text-text-primary">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">Monitor VPS</h1>
        <div className="flex items-center gap-3">
          {data && <span className="text-xs text-text-tertiary">Actualizado: {new Date(data.timestamp).toLocaleTimeString('es-CO')}</span>}
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 mb-4">{error}</p>}
      {!data && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5].map((i) => (
            <Card key={i}>
              <div className="h-2.5 w-16 bg-bg-surface-2 rounded mb-3" />
              <div className="h-8 w-24 bg-bg-surface-2 rounded mb-2" />
              <div className="h-2 w-full bg-bg-surface-2 rounded" />
            </Card>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <StatCard label="CPU (load avg)" value={`${data.cpu}%`} sub={`${data.cores} cores · ${data.platform}`} bar={data.cpu} />
            <StatCard label="RAM" value={`${data.ram.usedMb} MB`} sub={`${data.ram.freeMb} MB libres de ${data.ram.totalMb} MB`} bar={data.ram.percent} />
            {data.disk
              ? <StatCard label="Disco" value={`${data.disk.usedGb} GB`} sub={`${data.disk.freeGb} GB libres de ${data.disk.totalGb} GB`} bar={data.disk.percent} />
              : <StatCard label="Disco" value="N/D" sub="No disponible en Windows" />
            }
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard label="Uptime" value={formatUptime(data.uptime)} sub="Tiempo desde el último reinicio" />
            <StatCard label="Node.js" value={data.nodeVersion} sub={`Platform: ${data.platform}`} />
          </div>
        </>
      )}
    </div>
  );
}

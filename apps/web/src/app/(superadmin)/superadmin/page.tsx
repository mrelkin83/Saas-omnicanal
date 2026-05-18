'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardData {
  totalTenants: number; activeDemos: number; suspended: number;
  mrr: number; totalUsers: number; totalResellers: number;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function saToken() { return typeof window !== 'undefined' ? (localStorage.getItem('sa_token') ?? '') : ''; }

const KPI_STYLE = { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '18px 22px' };
const KPI_VAL = { fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: '4px 0 0' };
const KPI_LABEL = { fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    fetch(`${API}/api/superadmin/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 403 || res.status === 401) { router.push('/superadmin/login'); return; }
        setData(await res.json() as DashboardData);
      })
      .catch(() => setError('Error cargando KPIs'));
  }, [router]);

  if (error) return <div style={{ padding: 32, color: '#ef4444' }}>{error}</div>;
  if (!data) return <div style={{ padding: 32, color: '#64748b' }}>Cargando...</div>;

  const kpis = [
    { label: 'Total Tenants', value: data.totalTenants, icon: '🏢' },
    { label: 'Demos activas', value: data.activeDemos, icon: '🧪' },
    { label: 'Suspendidos', value: data.suspended, icon: '🚫' },
    { label: 'MRR', value: `$${data.mrr.toLocaleString('es-CO')}`, icon: '💰' },
    { label: 'Total Usuarios', value: data.totalUsers, icon: '👤' },
    { label: 'Resellers', value: data.totalResellers, icon: '🤝' },
  ];

  return (
    <div style={{ padding: 32, color: '#f1f5f9' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 24px', color: '#f1f5f9' }}>Dashboard SaaS</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {kpis.map((k) => (
          <div key={k.label} style={KPI_STYLE}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{k.icon}</span>
              <span style={KPI_LABEL}>{k.label}</span>
            </div>
            <div style={KPI_VAL}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '18px 22px' }}>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          Navega usando el menú lateral para gestionar tenants, planes, demos, resellers, monitoreo del VPS y auditoría de acciones.
        </p>
      </div>
    </div>
  );
}

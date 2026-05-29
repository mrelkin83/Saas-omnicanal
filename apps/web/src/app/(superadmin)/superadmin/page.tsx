'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, FlaskConical, Ban, TrendingUp, User, Handshake } from 'lucide-react';
import { Card, SkeletonKpiGrid } from '@/components/ui';
import { toast } from '@/hooks/useToast';

interface DashboardData {
  totalTenants: number; activeDemos: number; suspended: number;
  mrr: number; totalUsers: number; totalResellers: number;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function saToken() { return typeof window !== 'undefined' ? (localStorage.getItem('sa_token') ?? '') : ''; }

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = saToken();
    if (!token) { router.push('/superadmin/login'); return; }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    fetch(`${API}/api/superadmin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (res.status === 403 || res.status === 401) { router.push('/superadmin/login'); return; }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        setData(await res.json() as DashboardData);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : 'Error cargando KPIs';
        setError(msg);
        toast.error(msg);
      });
  }, [router]);

  if (error) return <div className="p-5 lg:p-8 max-w-6xl mx-auto text-red-400">{error}</div>;
  if (!data) return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Dashboard SaaS</h1>
      <SkeletonKpiGrid count={6} />
    </div>
  );

  const kpis = [
    { label: 'Total Tenants', value: data.totalTenants, icon: Building2 },
    { label: 'Demos activas', value: data.activeDemos, icon: FlaskConical },
    { label: 'Suspendidos', value: data.suspended, icon: Ban },
    { label: 'MRR', value: `$${data.mrr.toLocaleString('es-CO')}`, icon: TrendingUp },
    { label: 'Total Usuarios', value: data.totalUsers, icon: User },
    { label: 'Resellers', value: data.totalResellers, icon: Handshake },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto text-text-primary">
      <h1 className="text-2xl font-bold mb-6">Dashboard SaaS</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((k) => (
          <Card key={k.label}>
            <div className="flex items-center gap-2 mb-1">
              <k.icon className="w-5 h-5 text-text-secondary" />
              <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{k.label}</span>
            </div>
            <div className="text-3xl font-bold text-text-primary mt-1">{k.value}</div>
          </Card>
        ))}
      </div>
      <Card>
        <p className="text-sm text-text-secondary">
          Navega usando el menú lateral para gestionar tenants, planes, demos, resellers, monitoreo del VPS y auditoría de acciones.
        </p>
      </Card>
    </div>
  );
}

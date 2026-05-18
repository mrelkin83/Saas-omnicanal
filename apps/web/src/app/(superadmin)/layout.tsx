'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const SA_NAV = [
  { href: '/superadmin', label: 'Dashboard', icon: '📊' },
  { href: '/superadmin/tenants', label: 'Tenants', icon: '🏢' },
  { href: '/superadmin/plans', label: 'Planes', icon: '💳' },
  { href: '/superadmin/demos', label: 'Demos', icon: '🧪' },
  { href: '/superadmin/resellers', label: 'Resellers', icon: '🤝' },
  { href: '/superadmin/monitor', label: 'Monitor VPS', icon: '🖥️' },
  { href: '/superadmin/audit', label: 'Auditoría', icon: '🔍' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('sa_token');
    router.push('/superadmin/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'inherit' }}>
      <aside style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#0f172a', color: '#e2e8f0', borderRight: '1px solid #1e293b',
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>👑</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>SuperAdmin</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Panel de control SaaS</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {SA_NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 8, marginBottom: 2, textDecoration: 'none', fontSize: 13,
                background: active ? '#1e40af' : 'transparent',
                color: active ? '#bfdbfe' : '#94a3b8',
              }}>
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid #1e293b' }}>
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13,
          }}>
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', background: '#0f172a', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}

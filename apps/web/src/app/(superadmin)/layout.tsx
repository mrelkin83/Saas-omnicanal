'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/ui/cn';
import {
  LayoutDashboard, Building2, CreditCard, FlaskConical, Handshake,
  Monitor, Search, LogOut, Crown, Menu, X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const SA_NAV = [
  { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/superadmin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/superadmin/plans', label: 'Planes', icon: CreditCard },
  { href: '/superadmin/demos', label: 'Demos', icon: FlaskConical },
  { href: '/superadmin/resellers', label: 'Resellers', icon: Handshake },
  { href: '/superadmin/monitor', label: 'Monitor VPS', icon: Monitor },
  { href: '/superadmin/audit', label: 'Auditoría', icon: Search },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('sa_token');
    // Clear the cookie used by middleware for superadmin route protection
    document.cookie = 'sa_token=;path=/;max-age=0';
    router.push('/superadmin/login');
  };

  useEffect(() => {
    // SECURITY WARNING: sa_token is stored in localStorage (XSS vulnerable).
    // The primary defense is inbox XSS sanitization (BUG 2). Move to httpOnly
    // cookie when backend supports it.
    if (!localStorage.getItem('sa_token')) {
      router.push('/superadmin/login');
    }
  }, [router]);

  if (pathname === '/superadmin/login') return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-border-subtle bg-bg-surface-1',
          'transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-primary-subtle text-accent-primary">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-text-primary text-sm">SuperAdmin</div>
              <div className="text-[11px] text-text-tertiary">Panel de control SaaS</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-surface-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {SA_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                  active
                    ? 'bg-accent-primary-subtle text-accent-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-2',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border-subtle">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary transition-all hover:text-red-400 hover:bg-red-500/5"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto bg-bg-root">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg-surface-1/80 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-2"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-text-primary">SuperAdmin</span>
        </div>
        {children}
      </main>
    </div>
  );
}

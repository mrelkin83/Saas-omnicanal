'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import OnboardingWizard from '@/components/OnboardingWizard';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/dashboard/inbox', label: 'Bandeja', icon: '📥' },
  { href: '/dashboard/conversations', label: 'Conversaciones', icon: '💬' },
  { href: '/dashboard/channels', label: 'Canales', icon: '📡' },
  { href: '/dashboard/catalog', label: 'Catálogo', icon: '📦' },
  { href: '/dashboard/orders', label: 'Pedidos', icon: '🛒' },
  { href: '/dashboard/appointments', label: 'Citas', icon: '📅' },
  { href: '/dashboard/reservations', label: 'Reservas', icon: '🗓️' },
  { href: '/dashboard/quotes', label: 'Cotizaciones', icon: '📋' },
  { href: '/dashboard/deliveries', label: 'Domicilios', icon: '🛵' },
  { href: '/dashboard/customers', label: 'Clientes', icon: '👥' },
  { href: '/dashboard/kanban', label: 'Kanban', icon: '🗂️' },
  { href: '/dashboard/team', label: 'Equipo', icon: '🧑‍💼' },
  { href: '/dashboard/departments', label: 'Departamentos', icon: '🏢' },
  { href: '/dashboard/campaigns', label: 'Campañas', icon: '📢' },
  { href: '/dashboard/contacts', label: 'Contactos', icon: '📋' },
  { href: '/dashboard/groups', label: 'Grupos WA', icon: '💬' },
  { href: '/dashboard/ai-config', label: 'Probar IA', icon: '🤖' },
  { href: '/dashboard/ai-training', label: 'Entrenar IA', icon: '🧠' },
  { href: '/dashboard/settings/integrations', label: 'Integraciones', icon: '🔌' },
  { href: '/dashboard/settings', label: 'Configuración', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, refreshToken, accessToken, clearAuth } = useAuthStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Only show for owners and only once per tenant
    if (user.role !== 'owner') return;
    const done = localStorage.getItem(`onboarding_done_${user.tenantId}`);
    if (!done) setShowOnboarding(true);
  }, [user]);

  const handleLogout = async () => {
    if (refreshToken && accessToken) {
      await api.auth.logout(refreshToken, accessToken).catch(() => null);
    }
    clearAuth();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="w-60 flex flex-col border-r"
        style={{
          background: 'var(--bg-surface-1)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: 'var(--accent-primary-subtle)' }}
            >
              ⚡
            </div>
            <span className="font-semibold text-text-primary text-sm">Omnicanal</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary transition-all hover:text-text-primary"
              style={{ transition: 'var(--transition-fast)' }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-text-primary truncate">{user?.email}</p>
            <p className="text-xs text-text-tertiary capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary transition-all hover:text-accent-danger"
          >
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-root)' }}>
        {children}
      </main>

      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}

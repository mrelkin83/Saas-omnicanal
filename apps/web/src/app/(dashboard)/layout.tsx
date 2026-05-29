'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import OnboardingWizard from '@/components/OnboardingWizard';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { cn } from '@/lib/ui/cn';
import {
  Home, Inbox, MessageSquare, Radio, Package, ShoppingCart,
  CalendarDays, Calendar, ClipboardList, Bike, Users, LayoutGrid,
  UsersRound, Building2, Megaphone, Contact, MessagesSquare,
  Bot, Brain, Plug, Settings, LogOut, Menu, X, Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/dashboard/inbox', label: 'Bandeja', icon: Inbox },
  { href: '/dashboard/conversations', label: 'Conversaciones', icon: MessageSquare },
  { href: '/dashboard/channels', label: 'Canales', icon: Radio },
  { href: '/dashboard/catalog', label: 'Catálogo', icon: Package },
  { href: '/dashboard/orders', label: 'Pedidos', icon: ShoppingCart },
  { href: '/dashboard/appointments', label: 'Citas', icon: CalendarDays },
  { href: '/dashboard/reservations', label: 'Reservas', icon: Calendar },
  { href: '/dashboard/quotes', label: 'Cotizaciones', icon: ClipboardList },
  { href: '/dashboard/deliveries', label: 'Domicilios', icon: Bike },
  { href: '/dashboard/customers', label: 'Clientes', icon: Users },
  { href: '/dashboard/kanban', label: 'Kanban', icon: LayoutGrid },
  { href: '/dashboard/team', label: 'Equipo', icon: UsersRound },
  { href: '/dashboard/departments', label: 'Departamentos', icon: Building2 },
  { href: '/dashboard/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/dashboard/contacts', label: 'Contactos', icon: Contact },
  { href: '/dashboard/groups', label: 'Grupos WA', icon: MessagesSquare },
  { href: '/dashboard/ai-config', label: 'Probar IA', icon: Bot },
  { href: '/dashboard/ai-training', label: 'Entrenar IA', icon: Brain },
  { href: '/dashboard/settings/integrations', label: 'Integraciones', icon: Plug },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, refreshToken, accessToken, clearAuth } = useAuthStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
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
          'fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border-subtle bg-bg-surface-1',
          'transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-primary-subtle text-accent-primary">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-semibold text-text-primary text-sm">Omnicanal</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-surface-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-text-primary truncate">{user?.email}</p>
            <p className="text-xs text-text-tertiary capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary transition-all hover:text-red-400 hover:bg-red-500/5"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto bg-bg-root">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg-surface-1/80 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-2"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-text-primary">Omnicanal</span>
        </div>
        {children}
      </main>

      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <ToastProvider />
    </div>
  );
}

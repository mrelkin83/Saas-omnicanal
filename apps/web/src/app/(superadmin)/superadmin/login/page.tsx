'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/superadmin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { setError('Credenciales inválidas'); return; }
      const { accessToken } = await res.json() as { accessToken: string };
      localStorage.setItem('sa_token', accessToken);
      // SECURITY WARNING: localStorage is vulnerable to XSS. The primary fix is
      // inbox sanitization (BUG 2). Move sa_token to an httpOnly cookie when the
      // backend supports setting it.
      document.cookie = `sa_token=${accessToken};path=/;max-age=86400`;
      router.push('/superadmin');
    } catch { setError('Error de conexión'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg-surface-1 flex items-center justify-center">
      <div className="w-full max-w-sm bg-bg-surface-2 rounded-2xl p-8 border border-border-subtle">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bg-surface-1 border border-border-subtle mb-3">
            <Crown className="w-6 h-6 text-text-primary" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">SuperAdmin Panel</h1>
          <p className="text-sm text-text-tertiary mt-1">Acceso restringido</p>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="flex flex-col gap-3.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-text-primary bg-bg-surface-1 border border-border-default outline-none focus:ring-2 focus:ring-accent-primary/50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Contraseña"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-text-primary bg-bg-surface-1 border border-border-default outline-none focus:ring-2 focus:ring-accent-primary/50"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" isLoading={loading} className="w-full">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

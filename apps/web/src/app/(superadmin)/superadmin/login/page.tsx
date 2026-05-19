'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('admin123');
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
      router.push('/superadmin');
    } catch { setError('Error de conexión'); } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, background: '#1e293b', borderRadius: 16, padding: 32, border: '1px solid #334155' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👑</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>SuperAdmin Panel</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>Acceso restringido</p>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="Email"
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14 }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="Contraseña"
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14 }} />
            {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ padding: '10px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

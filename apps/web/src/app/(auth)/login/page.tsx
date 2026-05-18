'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const res = await api.auth.login(data.email, data.password);
      setTokens(res.accessToken, res.refreshToken);
      const from = params.get('from') ?? '/dashboard';
      router.push(from);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Error de conexión. Intenta de nuevo.');
      }
    }
  };

  return (
    <div
      className="rounded-2xl border p-8"
      style={{
        background: 'var(--bg-surface-1)',
        borderColor: 'var(--border-default)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="mb-8 text-center">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
          style={{ background: 'var(--accent-primary-subtle)' }}
        >
          <span className="text-2xl">⚡</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Iniciar sesión</h1>
        <p className="text-text-secondary text-sm mt-1">Plataforma Omnicanal</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Correo electrónico
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="tú@empresa.co"
            className="w-full px-4 py-2.5 rounded-lg text-text-primary text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-default)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
          />
          {errors.email && (
            <p className="mt-1 text-xs" style={{ color: 'var(--accent-danger)' }}>
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Contraseña
          </label>
          <input
            {...register('password')}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-lg text-text-primary text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-default)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
          />
          {errors.password && (
            <p className="mt-1 text-xs" style={{ color: 'var(--accent-danger)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <div
            className="px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--accent-danger)',
            }}
          >
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-60"
          style={{
            background: 'var(--gradient-primary)',
            color: '#fff',
            boxShadow: isSubmitting ? 'none' : 'var(--shadow-glow-primary)',
          }}
        >
          {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        ¿No tienes cuenta?{' '}
        <Link
          href="/register"
          className="font-medium"
          style={{ color: 'var(--accent-primary)' }}
        >
          Crear empresa
        </Link>
      </p>
    </div>
  );
}

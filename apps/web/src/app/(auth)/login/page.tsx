'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Input, Button } from '@/components/ui';
import { Zap, AlertTriangle } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
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
    <div className="rounded-2xl border border-border-default bg-bg-surface-1 p-8 shadow-lg w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-accent-primary-subtle">
          <Zap className="w-6 h-6 text-accent-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Iniciar sesión</h1>
        <p className="text-text-secondary text-sm mt-1">Plataforma Omnicanal</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="tú@empresa.co"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        {serverError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {serverError}
          </div>
        )}

        <Button type="submit" isLoading={isSubmitting} className="w-full mt-2">
          Iniciar sesión
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="font-medium text-accent-primary hover:text-accent-primary-hover">
          Crear empresa
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

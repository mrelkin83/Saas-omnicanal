'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { BUSINESS_TYPES as BT } from '@saas/shared';
import { Input, Button } from '@/components/ui';
import { Rocket, AlertTriangle } from 'lucide-react';

const BUSINESS_TYPES = Object.entries(BT).map(([value, cfg]) => ({ value, label: `${cfg.icon} ${cfg.label}` }));

const schema = z.object({
  ownerName: z.string().min(2, 'Nombre requerido'),
  ownerEmail: z.string().email('Email inválido'),
  ownerPassword: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir mayúscula')
    .regex(/[0-9]/, 'Debe incluir número'),
  tenantName: z.string().min(2, 'Nombre de empresa requerido'),
  businessType: z.string().min(1, 'Selecciona un tipo'),
  plan: z.enum(['free', 'starter', 'pro']).default('free'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'free' },
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const result = await api.auth.register(data);
      setTokens(result.accessToken, result.refreshToken);
      router.push('/dashboard');
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
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-accent-primary-subtle">
          <Rocket className="w-6 h-6 text-accent-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Crear empresa</h1>
        <p className="text-text-secondary text-sm mt-1">14 días gratis, sin tarjeta</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Tu nombre completo"
          type="text"
          placeholder="Ana Gómez"
          error={errors.ownerName?.message}
          {...register('ownerName')}
        />

        <Input
          label="Tu correo"
          type="email"
          placeholder="tú@empresa.co"
          error={errors.ownerEmail?.message}
          {...register('ownerEmail')}
        />

        <Input
          label="Contraseña"
          type="password"
          placeholder="••••••••"
          error={errors.ownerPassword?.message}
          {...register('ownerPassword')}
        />

        <Input
          label="Nombre de tu empresa"
          type="text"
          placeholder="Mi Empresa SAS"
          error={errors.tenantName?.message}
          {...register('tenantName')}
        />

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Tipo de negocio
          </label>
          <select
            {...register('businessType')}
            className="w-full px-3 py-2 rounded-lg bg-bg-surface-2 border border-border-default text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50 transition-all"
          >
            <option value="">Selecciona...</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.businessType && (
            <p className="mt-1 text-xs text-red-400">{errors.businessType.message}</p>
          )}
        </div>

        {serverError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {serverError}
          </div>
        )}

        <Button type="submit" isLoading={isSubmitting} className="w-full mt-2">
          Comenzar prueba gratis
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-accent-primary hover:text-accent-primary-hover">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}

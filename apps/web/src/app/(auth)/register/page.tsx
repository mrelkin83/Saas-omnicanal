'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const BUSINESS_TYPES = [
  { value: 'beauty_salon', label: 'Salón de Belleza / Spa' },
  { value: 'restaurant', label: 'Restaurante / Comida' },
  { value: 'clinic', label: 'Clínica / Salud' },
  { value: 'retail', label: 'Tienda / Retail' },
  { value: 'automotive', label: 'Taller / Automotriz' },
  { value: 'legal', label: 'Despacho Legal' },
  { value: 'hotel', label: 'Hotel / Hospedaje' },
  { value: 'other', label: 'Otro' },
];

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
  plan: z.literal('trial'),
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
    defaultValues: { plan: 'trial' },
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await api.auth.register(data);
      const login = await api.auth.login(data.ownerEmail, data.ownerPassword);
      setTokens(login.accessToken, login.refreshToken);
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
    <div
      className="rounded-2xl border p-8"
      style={{
        background: 'var(--bg-surface-1)',
        borderColor: 'var(--border-default)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="mb-6 text-center">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
          style={{ background: 'var(--accent-primary-subtle)' }}
        >
          <span className="text-2xl">🚀</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Crear empresa</h1>
        <p className="text-text-secondary text-sm mt-1">14 días gratis, sin tarjeta</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {(
          [
            { name: 'ownerName', label: 'Tu nombre completo', type: 'text', placeholder: 'Ana Gómez' },
            { name: 'ownerEmail', label: 'Tu correo', type: 'email', placeholder: 'tú@empresa.co' },
            { name: 'ownerPassword', label: 'Contraseña', type: 'password', placeholder: '••••••••' },
            { name: 'tenantName', label: 'Nombre de tu empresa', type: 'text', placeholder: 'Mi Empresa SAS' },
          ] as const
        ).map(({ name, label, type, placeholder }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">{label}</label>
            <input
              {...register(name)}
              type={type}
              placeholder={placeholder}
              className="w-full px-4 py-2.5 rounded-lg text-text-primary text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-default)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
            />
            {errors[name] && (
              <p className="mt-1 text-xs" style={{ color: 'var(--accent-danger)' }}>
                {errors[name]?.message}
              </p>
            )}
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Tipo de negocio
          </label>
          <select
            {...register('businessType')}
            className="w-full px-4 py-2.5 rounded-lg text-text-primary text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-default)',
            }}
          >
            <option value="">Selecciona...</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.businessType && (
            <p className="mt-1 text-xs" style={{ color: 'var(--accent-danger)' }}>
              {errors.businessType.message}
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
          className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-60 mt-2"
          style={{
            background: 'var(--gradient-primary)',
            color: '#fff',
            boxShadow: isSubmitting ? 'none' : 'var(--shadow-glow-primary)',
          }}
        >
          {isSubmitting ? 'Creando cuenta...' : 'Comenzar prueba gratis'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium" style={{ color: 'var(--accent-primary)' }}>
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { api, type TenantMe } from '@/lib/api';
import { toast } from '@/hooks/useToast';

const SECTIONS = ['Negocio', 'IA y Agente', 'Pagos', 'Apariencia'] as const;
type Section = typeof SECTIONS[number];

const businessSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  billingEmail: z.string().email().optional().or(z.literal('')),
});

const aiSchema = z.object({
  aiAgentName: z.string().min(1).max(100),
  aiTone: z.enum(['amigable', 'profesional', 'formal', 'casual']),
  aiModel: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']),
  aiTemperature: z.coerce.number().min(0).max(1),
  aiMaxTokens: z.coerce.number().int().min(100).max(4000),
});

type BusinessForm = z.infer<typeof businessSchema>;
type AiForm = z.infer<typeof aiSchema>;

const inputCls = 'w-full px-3 py-2.5 rounded-lg text-text-primary text-sm outline-none transition-all';
const inputStyle = { background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' };
const labelCls = 'block text-sm font-medium text-text-secondary mb-1.5';

function SaveBtn({ loading }: { loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent-primary)' }}>
      {loading ? 'Guardando...' : 'Guardar cambios'}
    </button>
  );
}

function BusinessSection({ tenant, token, onSaved }: { tenant: TenantMe; token: string; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: tenant.name,
      phone: tenant.phone ?? '',
      address: tenant.address ?? '',
      description: tenant.description ?? '',
      website: tenant.website ?? '',
      billingEmail: tenant.billingEmail ?? '',
    },
  });

  const onSubmit = async (data: BusinessForm) => {
    setLoading(true);
    setError('');
    try {
      await api.tenants.patch(token, {
        name: data.name,
        phone: data.phone || undefined,
        address: data.address || undefined,
        description: data.description || undefined,
        website: data.website || undefined,
        billingEmail: data.billingEmail || undefined,
      });
      setOk(true);
      onSaved();
      setTimeout(() => setOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Nombre de la empresa *</label>
          <input {...register('name')} className={inputCls} style={inputStyle} />
          {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--accent-danger)' }}>{errors.name.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input {...register('phone')} placeholder="+57 300 000 0000" className={inputCls} style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Dirección</label>
          <input {...register('address')} placeholder="Cra 7 # 50-20, Bogotá" className={inputCls} style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Descripción del negocio</label>
          <textarea {...register('description')} rows={3} className={inputCls} style={inputStyle} placeholder="¿Qué hace tu empresa?" />
        </div>
        <div>
          <label className={labelCls}>Sitio web</label>
          <input {...register('website')} placeholder="https://tuempresa.co" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls}>Email de facturación</label>
          <input {...register('billingEmail')} type="email" placeholder="pagos@tuempresa.co" className={inputCls} style={inputStyle} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SaveBtn loading={loading} />
        {ok && <span className="text-sm" style={{ color: 'var(--accent-success)' }}>✓ Guardado</span>}
        {error && <span className="text-sm" style={{ color: 'var(--accent-danger)' }}>{error}</span>}
      </div>
    </form>
  );
}

function AiSection({ tenant, token, onSaved }: { tenant: TenantMe; token: string; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<AiForm>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      aiAgentName: tenant.aiAgentName,
      aiTone: tenant.aiTone as AiForm['aiTone'],
      aiModel: tenant.aiModel as AiForm['aiModel'],
      aiTemperature: Number(tenant.aiTemperature),
      aiMaxTokens: tenant.aiMaxTokens,
    },
  });

  const onSubmit = async (data: AiForm) => {
    setLoading(true);
    setError('');
    try {
      await api.tenants.patch(token, data);
      setOk(true);
      onSaved();
      setTimeout(() => setOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Nombre del agente IA</label>
          <input {...register('aiAgentName')} placeholder="Asistente" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls}>Tono de voz</label>
          <select {...register('aiTone')} className={inputCls} style={inputStyle}>
            <option value="amigable">Amigable</option>
            <option value="profesional">Profesional</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Modelo de IA</label>
          <select {...register('aiModel')} className={inputCls} style={inputStyle}>
            <option value="gpt-4o-mini">GPT-4o Mini (rápido, económico)</option>
            <option value="gpt-4o">GPT-4o (recomendado)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo (máxima capacidad)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Temperatura (0 = preciso, 1 = creativo)</label>
          <input {...register('aiTemperature')} type="number" step="0.05" min="0" max="1" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls}>Máx. tokens por respuesta</label>
          <input {...register('aiMaxTokens')} type="number" step="50" min="100" max="4000" className={inputCls} style={inputStyle} />
        </div>
      </div>
      <div
        className="p-4 rounded-xl text-sm"
        style={{ background: 'var(--accent-primary-subtle)', border: '1px solid var(--border-glow)' }}
      >
        <p className="font-medium" style={{ color: 'var(--accent-primary)' }}>💡 ¿Cómo funciona el agente IA?</p>
        <p className="text-text-secondary mt-1">
          El agente responde automáticamente a tus clientes en WhatsApp, Instagram y otros canales. Puedes entrenarlo con tu base de conocimiento en la sección de IA.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <SaveBtn loading={loading} />
        {ok && <span className="text-sm" style={{ color: 'var(--accent-success)' }}>✓ Guardado</span>}
        {error && <span className="text-sm" style={{ color: 'var(--accent-danger)' }}>{error}</span>}
      </div>
    </form>
  );
}

function PaymentsSection({ token }: { token: string }) {
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [eventSecret, setEventSecret] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api.integrations.list(token).then((list) => {
      const wompi = list.find((i) => i.provider === 'wompi' && i.isActive);
      if (wompi) {
        setExistingId(wompi.id);
        void api.integrations.getConfig(token, wompi.id).then((c) => {
          const cfg = c.config as Record<string, string>;
          setPublicKey(cfg['publicKey'] ?? '');
          setPrivateKey(cfg['privateKey'] ?? '');
          setEventSecret(cfg['eventSecret'] ?? '');
        }).catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Error inesperado');
        });
      }
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    }).finally(() => setLoading(false));
  }, [token]);

  const save = async () => {
    setSaving(true);
    setError('');
    const config = {
      ...(publicKey.trim() ? { publicKey: publicKey.trim() } : {}),
      ...(privateKey.trim() ? { privateKey: privateKey.trim() } : {}),
      ...(eventSecret.trim() ? { eventSecret: eventSecret.trim() } : {}),
    };
    try {
      if (existingId) {
        await api.integrations.patch(token, existingId, { config });
      } else {
        const created = await api.integrations.create(token, { provider: 'wompi', category: 'payment', config, isActive: true, isPrimary: true });
        setExistingId(created.id);
      }
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar credenciales');
    } finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-text-tertiary">Cargando...</p>;

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--accent-primary-subtle)', border: '1px solid var(--border-glow)' }}>
        <p className="font-medium" style={{ color: 'var(--accent-primary)' }}>💳 Pagos con Wompi</p>
        <p className="text-text-secondary mt-1">
          Wompi procesa Nequi, Daviplata, tarjetas débito/crédito, PSE y más. El cliente elige su método dentro del checkout de Wompi.
          Webhook URL para configurar en Wompi:{' '}
          <code className="text-xs bg-black/20 px-1.5 py-0.5 rounded">
            {`${process.env.NEXT_PUBLIC_API_URL ?? 'https://tudominio.com'}/api/webhooks/wompi/[tenantId]`}
          </code>
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Public Key</label>
          <input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="pub_prod_XXXXXXXXXX" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className={labelCls}>Private Key</label>
          <input type="password" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="prv_prod_XXXXXXXXXX" className={inputCls} style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Events Secret (para validar webhooks)</label>
          <input type="password" value={eventSecret} onChange={(e) => setEventSecret(e.target.value)} placeholder="prod_integrity_XXXXXXXXXX" className={inputCls} style={inputStyle} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'var(--accent-primary)' }}
        >
          {saving ? 'Guardando...' : existingId ? 'Actualizar credenciales' : 'Guardar credenciales'}
        </button>
        {ok && <span className="text-sm" style={{ color: 'var(--accent-success)' }}>✓ Guardado</span>}
        {error && <span className="text-sm" style={{ color: 'var(--accent-danger)' }}>{error}</span>}
      </div>
    </div>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as 'dark' | 'light' | null;
      if (stored) {
        setTheme(stored);
        document.documentElement.setAttribute('data-theme', stored);
      }
    }
  }, []);

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  const themes = [
    { key: 'dark' as const, label: 'Oscuro', bg: '#08090E' },
    { key: 'light' as const, label: 'Claro', bg: '#F5F6FA' },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">Personaliza la apariencia de la plataforma.</p>
      <div className="grid grid-cols-2 gap-3">
        {themes.map((t) => {
          const active = theme === t.key;
          return (
            <button
              key={t.key}
              onClick={() => applyTheme(t.key)}
              className="rounded-xl p-4 border text-center text-xs transition-all cursor-pointer"
              style={{
                background: t.bg,
                borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                boxShadow: active ? '0 0 0 2px var(--accent-primary)' : 'none',
              }}
            >
              <div className="h-8 rounded mb-2" style={{ background: t.bg }} />
              {t.label}
              {active && <span className="block mt-1" style={{ color: 'var(--accent-primary)' }}>✓ Activo</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { accessToken } = useAuthStore();
  const [section, setSection] = useState<Section>('Negocio');
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    if (!accessToken) return;
    try {
      setTenant(await api.tenants.me(accessToken));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error cargando configuración');
    }
  };

  useEffect(() => { void load(); }, [accessToken]);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-bold text-text-primary mb-6">Configuración</h1>

      <div className="flex gap-1 mb-8 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className="px-4 py-2.5 text-sm font-medium transition-all"
            style={{
              color: section === s ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: section === s ? '2px solid var(--accent-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {!tenant ? (
        loadError ? <p className="text-sm" style={{ color: 'var(--accent-danger)' }}>{loadError}</p> : <p className="text-text-tertiary text-sm">Cargando...</p>
      ) : (
        <>
          {section === 'Negocio' && <BusinessSection tenant={tenant} token={accessToken!} onSaved={load} />}
          {section === 'IA y Agente' && <AiSection tenant={tenant} token={accessToken!} onSaved={load} />}
          {section === 'Pagos' && <PaymentsSection token={accessToken!} />}
          {section === 'Apariencia' && <AppearanceSection />}
        </>
      )}
    </div>
  );
}

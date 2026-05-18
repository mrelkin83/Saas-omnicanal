'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { api, type User } from '@/lib/api';

const schema = z.object({
  fullName: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['admin', 'agent']),
});

type FormData = z.infer<typeof schema>;

const ROLE_LABELS: Record<string, string> = { owner: 'Propietario', admin: 'Admin', agent: 'Agente' };

export default function TeamPage() {
  const { accessToken, user: me } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isOwner = me?.role === 'owner';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setUsers(await api.users.list(accessToken));
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'agent' },
  });

  const onCreate = async (data: FormData) => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await api.users.create(accessToken, data);
      reset();
      setShowCreate(false);
      await load();
    } finally { setIsLoading(false); }
  };

  const handleToggleActive = async (u: User) => {
    if (!accessToken) return;
    await api.users.update(accessToken, u.id, { isActive: !u.isActive });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm('¿Eliminar usuario?')) return;
    await api.users.delete(accessToken, id);
    await load();
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg text-text-primary text-sm outline-none';
  const inputStyle = { background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Equipo</h1>
        {isOwner && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
          >
            + Agregar miembro
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleSubmit(onCreate)}
          className="rounded-xl border p-5 mb-6 space-y-3"
          style={{ background: 'var(--bg-surface-1)', borderColor: 'var(--border-default)' }}
        >
          <p className="text-sm font-medium text-text-primary mb-2">Nuevo miembro</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Nombre completo</label>
              <input {...register('fullName')} className={inputCls} style={inputStyle} />
              {errors.fullName && <p className="text-xs mt-1" style={{ color: 'var(--accent-danger)' }}>{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Email</label>
              <input {...register('email')} type="email" className={inputCls} style={inputStyle} />
              {errors.email && <p className="text-xs mt-1" style={{ color: 'var(--accent-danger)' }}>{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Contraseña</label>
              <input {...register('password')} type="password" className={inputCls} style={inputStyle} />
              {errors.password && <p className="text-xs mt-1" style={{ color: 'var(--accent-danger)' }}>{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Rol</label>
              <select {...register('role')} className={inputCls} style={inputStyle}>
                <option value="agent">Agente</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary border" style={{ borderColor: 'var(--border-default)' }}>Cancelar</button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent-primary)' }}>
              {isLoading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: 'var(--bg-surface-1)', borderColor: 'var(--border-subtle)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary)' }}>
              {(u.fullName ?? u.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{u.fullName ?? '—'}</p>
              <p className="text-xs text-text-tertiary">{u.email}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}>
              {ROLE_LABELS[u.role] ?? u.role}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: u.isActive ? 'rgba(16,185,129,0.12)' : 'var(--bg-surface-2)',
                color: u.isActive ? 'var(--accent-success)' : 'var(--text-tertiary)',
              }}>
              {u.isActive ? 'Activo' : 'Inactivo'}
            </span>
            {isOwner && u.id !== me?.sub && (
              <div className="flex gap-2">
                <button onClick={() => handleToggleActive(u)} className="text-xs text-text-secondary hover:text-text-primary">
                  {u.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => handleDelete(u.id)} className="text-xs" style={{ color: 'var(--accent-danger)' }}>Eliminar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

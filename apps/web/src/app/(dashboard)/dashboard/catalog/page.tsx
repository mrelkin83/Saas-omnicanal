'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { api, type Product, type Category } from '@/lib/api';

const PRODUCT_TYPES = [
  { value: 'product', label: 'Producto' },
  { value: 'service', label: 'Servicio' },
  { value: 'combo', label: 'Combo' },
];

const schema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  type: z.enum(['product', 'service', 'combo']),
  price: z.coerce.number().positive().optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  sku: z.string().optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-lg rounded-2xl border p-6"
        style={{ background: 'var(--bg-surface-1)', borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductForm({
  defaultValues,
  categories,
  onSubmit,
  onCancel,
  isLoading,
}: {
  defaultValues?: Partial<FormData>;
  categories: Category[];
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'service', isActive: true, ...defaultValues },
  });

  const inputCls = 'w-full px-3 py-2 rounded-lg text-text-primary text-sm outline-none';
  const inputStyle = { background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-text-secondary mb-1">Nombre *</label>
          <input {...register('name')} className={inputCls} style={inputStyle} />
          {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--accent-danger)' }}>{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Tipo</label>
          <select {...register('type')} className={inputCls} style={inputStyle}>
            {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Categoría</label>
          <select {...register('categoryId')} className={inputCls} style={inputStyle}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Precio (COP)</label>
          <input {...register('price')} type="number" step="100" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Duración (min)</label>
          <input {...register('durationMinutes')} type="number" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">SKU</label>
          <input {...register('sku')} className={inputCls} style={inputStyle} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input {...register('isActive')} type="checkbox" id="isActive" className="rounded" />
          <label htmlFor="isActive" className="text-sm text-text-secondary">Activo</label>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-text-secondary mb-1">Descripción</label>
          <textarea {...register('description')} rows={2} className={inputCls} style={inputStyle} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-text-secondary border" style={{ borderColor: 'var(--border-default)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={isLoading} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent-primary)' }}>
          {isLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

export default function CatalogPage() {
  const { accessToken, user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'categories' | null>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [prods, cats] = await Promise.all([
      api.products.list(accessToken, search ? { search } : undefined),
      api.categories.list(accessToken),
    ]);
    setProducts(prods);
    setCategories(cats);
  }, [accessToken, search]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (data: FormData) => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await api.products.create(accessToken, data);
      setModalMode(null);
      await load();
    } finally { setIsLoading(false); }
  };

  const handleEdit = async (data: FormData) => {
    if (!accessToken || !editTarget) return;
    setIsLoading(true);
    try {
      await api.products.update(accessToken, editTarget.id, data);
      setModalMode(null);
      setEditTarget(null);
      await load();
    } finally { setIsLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm('¿Eliminar producto?')) return;
    await api.products.delete(accessToken, id);
    await load();
  };

  const handleCatCreate = async () => {
    if (!accessToken || !newCatName.trim()) return;
    setCatSaving(true);
    await api.categories.create(accessToken, { name: newCatName.trim() });
    setNewCatName('');
    await load();
    setCatSaving(false);
  };

  const handleCatDelete = async (id: string) => {
    if (!accessToken) return;
    await api.categories.delete(accessToken, id);
    await load();
  };

  const formatPrice = (price: string | null) =>
    price ? `$${Number(price).toLocaleString('es-CO')}` : '—';

  const getCatName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? '—') : '—';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Catálogo</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setModalMode('categories')}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Categorías ({categories.length})
            </button>
            <button
              onClick={() => setModalMode('create')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent-primary)' }}
            >
              + Nuevo producto
            </button>
          </div>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar productos..."
        className="w-full max-w-xs px-3 py-2 rounded-lg text-sm text-text-primary mb-5 outline-none"
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}
      />

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--bg-surface-1)' }}>
            <tr>
              {['Nombre', 'Tipo', 'Categoría', 'Precio', 'Duración', 'Estado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-tertiary text-sm">Sin productos</td></tr>
            )}
            {products.map((p, i) => (
              <tr
                key={p.id}
                style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined, background: 'var(--bg-surface-1)' }}
              >
                <td className="px-4 py-3 text-text-primary font-medium">{p.name}</td>
                <td className="px-4 py-3 text-text-secondary capitalize">{p.type}</td>
                <td className="px-4 py-3 text-text-secondary">{getCatName(p.categoryId)}</td>
                <td className="px-4 py-3 text-text-secondary">{formatPrice(p.price)}</td>
                <td className="px-4 py-3 text-text-secondary">{p.durationMinutes ? `${p.durationMinutes}m` : '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs"
                    style={{
                      background: p.isActive ? 'rgba(16,185,129,0.12)' : 'var(--bg-surface-2)',
                      color: p.isActive ? 'var(--accent-success)' : 'var(--text-tertiary)',
                    }}>
                    {p.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditTarget(p); setModalMode('edit'); }} className="text-xs text-text-secondary hover:text-text-primary">Editar</button>
                      <button onClick={() => handleDelete(p.id)} className="text-xs hover:text-red-400" style={{ color: 'var(--accent-danger)' }}>Eliminar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalMode === 'create' && (
        <Modal title="Nuevo producto" onClose={() => setModalMode(null)}>
          <ProductForm categories={categories} onSubmit={handleCreate} onCancel={() => setModalMode(null)} isLoading={isLoading} />
        </Modal>
      )}

      {modalMode === 'edit' && editTarget && (
        <Modal title="Editar producto" onClose={() => { setModalMode(null); setEditTarget(null); }}>
          <ProductForm
            categories={categories}
            defaultValues={{
              name: editTarget.name,
              type: editTarget.type as 'product' | 'service' | 'combo',
              price: editTarget.price ? Number(editTarget.price) : undefined,
              durationMinutes: editTarget.durationMinutes ?? undefined,
              description: editTarget.description ?? undefined,
              categoryId: editTarget.categoryId ?? undefined,
              sku: editTarget.sku ?? undefined,
              isActive: editTarget.isActive,
            }}
            onSubmit={handleEdit}
            onCancel={() => { setModalMode(null); setEditTarget(null); }}
            isLoading={isLoading}
          />
        </Modal>
      )}

      {modalMode === 'categories' && (
        <Modal title="Gestionar categorías" onClose={() => setModalMode(null)}>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCatCreate(); }}
                placeholder="Nueva categoría..."
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => void handleCatCreate()}
                disabled={catSaving || !newCatName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent-primary)' }}
              >
                Crear
              </button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {categories.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>Sin categorías</p>}
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-surface-2)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
                  <button onClick={() => void handleCatDelete(cat.id)} className="text-xs hover:text-red-400" style={{ color: 'var(--accent-danger)' }}>Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

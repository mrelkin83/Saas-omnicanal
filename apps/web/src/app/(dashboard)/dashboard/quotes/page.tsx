'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Quote } from '@/lib/api';
import { toast } from '@/hooks/useToast';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', sent: '#3b82f6', accepted: '#22c55e', rejected: '#ef4444',
};

export default function QuotesPage() {
  const { accessToken } = useAuthStore();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    api.quotes.list(accessToken).then(setQuotes).catch(() => null).finally(() => setLoading(false));
  }, [accessToken]);

  const changeStatus = async (id: string, status: string) => {
    if (!accessToken) return;
    setUpdating(id);
    try {
      const updated = await api.quotes.patch(accessToken, id, { status });
      setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, ...updated } : q));
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); } finally { setUpdating(null); }
  };

  const fmt = (amount: string) => Number(amount) > 0
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(amount))
    : 'Por definir';

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Cotizaciones</h1>

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>}
      {!loading && quotes.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>No hay cotizaciones.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {quotes.map((quote) => (
          <div key={quote.id} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{quote.quoteNumber}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                {quote.customerName ?? 'Cliente'} · {new Date(quote.createdAt).toLocaleDateString('es-CO')}
                {quote.validUntil && ` · Vence: ${new Date(quote.validUntil).toLocaleDateString('es-CO')}`}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(quote.total)}</div>
            <span style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: STATUS_COLORS[quote.status ?? ''] ?? '#888', color: '#fff',
            }}>
              {STATUS_LABELS[quote.status ?? ''] ?? quote.status}
            </span>
            <select
              value={quote.status ?? 'pending'}
              disabled={updating === quote.id}
              onChange={(e) => void changeStatus(quote.id, e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--background)', color: 'inherit', fontSize: 12, cursor: 'pointer',
              }}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

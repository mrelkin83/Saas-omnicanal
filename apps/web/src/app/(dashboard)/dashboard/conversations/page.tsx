'use client';

import { MessagesSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type ConversationSummary } from '@/lib/api';

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬', instagram: '📸', facebook: '📘', tiktok: '🎵', web: '🌐',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Abierta', color: 'var(--accent-success)' },
  pending: { label: 'Pendiente', color: 'var(--accent-warning)' },
  resolved: { label: 'Resuelta', color: 'var(--text-tertiary)' },
  spam: { label: 'Spam', color: 'var(--accent-danger)' },
};

export default function ConversationsPage() {
  const { accessToken } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    void api.conversations.list(accessToken, statusFilter ? { status: statusFilter } : undefined)
      .then(setConversations)
      .catch(() => null);
  }, [accessToken, statusFilter]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Conversaciones</h1>
        <div className="flex gap-2">
          {['', 'open', 'pending', 'resolved'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-surface-1)',
                color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {s === '' ? 'Todas' : STATUS_LABELS[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {conversations.length === 0 && (
          <div className="text-center py-16 text-text-tertiary">
            <p className="text-4xl mb-3"><MessagesSquare className="w-4 h-4 inline-block" /></p>
            <p className="text-sm">No hay conversaciones aún.</p>
            <p className="text-xs mt-1">Se crearán automáticamente cuando conectes un canal.</p>
          </div>
        )}
        {conversations.map((conv) => {
          const s = STATUS_LABELS[conv.status ?? ''] ?? { label: conv.status ?? '', color: 'var(--text-tertiary)' };
          return (
            <div
              key={conv.id}
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{ background: 'var(--bg-surface-1)', borderColor: 'var(--border-subtle)' }}
            >
              <span className="text-2xl">{CHANNEL_ICONS[conv.channel] ?? '💬'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{conv.customerName ?? conv.customerPhone ?? 'Cliente'}</p>
                <p className="text-xs text-text-tertiary">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString('es-CO') : 'Sin mensajes'}</p>
              </div>
              {(conv.unreadCount ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ background: 'var(--accent-primary)' }}>
                  {conv.unreadCount ?? 0}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: s.color, background: `${s.color}18` }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

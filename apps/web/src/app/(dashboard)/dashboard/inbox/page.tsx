'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type ConversationSummary, type ConversationDetail, type Message } from '@/lib/api';
import { toast } from '@/hooks/useToast';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬',
  instagram: '📸',
  facebook: '📘',
  tiktok: '🎵',
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#010101',
};

type AIState = 'IA_ACTIVA' | 'AGENTE_ACTIVO';

interface InboxSSEMessage {
  conversationId: string;
  message: Message;
  customer: { id: string; displayName: string; phone: string | null };
}

export default function InboxPage() {
  const { accessToken } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [aiState, setAIState] = useState<AIState>('IA_ACTIVA');
  const [outgoing, setOutgoing] = useState('');
  const [sending, setSending] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  const loadConversations = useCallback(async () => {
    if (!accessToken) return;
    try {
      const rows = await api.conversations.list(accessToken, {
        withCustomer: true,
        ...(channelFilter !== 'all' ? { channel: channelFilter } : {}),
      });
      setConversations(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cargando conversaciones');
    } finally {
      setLoadingList(false);
    }
  }, [accessToken, channelFilter]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // SSE for real-time inbox updates
  useEffect(() => {
    if (!accessToken) return;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    const connect = () => {
      const es = new EventSource(`${API_BASE}/api/channels/inbox/stream?token=${encodeURIComponent(accessToken)}`);
      sseRef.current = es;

      es.addEventListener('message', (e) => {
        try {
          const payload = JSON.parse(e.data) as InboxSSEMessage;
          setConversations((prev) => {
            const exists = prev.find((c) => c.id === payload.conversationId);
            if (!exists) {
              void loadConversations();
              return prev;
            }
            return prev.map((c) =>
              c.id === payload.conversationId
                ? { ...c, unreadCount: (c.unreadCount ?? 0) + (payload.message.direction === 'inbound' ? 1 : 0), lastMessageAt: payload.message.createdAt }
                : c,
            ).sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime());
          });

          if (selectedId === payload.conversationId) {
            setDetail((prev) => prev ? { ...prev, messages: [...prev.messages, payload.message] } : prev);
          }
        } catch {
          toast.error('Mensaje en tiempo real malformado');
        }
      });

      es.onerror = () => {
        es.close();
        void loadConversations();
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      sseRef.current?.close();
    };
  }, [accessToken, selectedId, loadConversations]);

  const selectConversation = async (id: string) => {
    if (!accessToken) return;
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const [d, s] = await Promise.all([
        api.conversations.get(accessToken, id),
        api.conversations.getAIState(accessToken, id),
      ]);
      setDetail(d);
      setAIState((s.state as AIState) ?? 'IA_ACTIVA');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cargando conversación');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages]);

  const toggleAI = async () => {
    if (!accessToken || !selectedId) return;
    const next: AIState = aiState === 'IA_ACTIVA' ? 'AGENTE_ACTIVO' : 'IA_ACTIVA';
    try {
      await api.conversations.setAIState(accessToken, selectedId, next);
      setAIState(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cambiando modo IA');
    }
  };

  const sendMessage = async () => {
    if (!accessToken || !selectedId || !outgoing.trim()) return;
    setSending(true);
    try {
      const msg = await api.conversations.sendMessage(accessToken, selectedId, { type: 'text', content: outgoing.trim() });
      setDetail((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setOutgoing('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedId);
  const channels = ['all', 'whatsapp', 'instagram', 'facebook', 'tiktok'];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', fontFamily: 'inherit' }}>
      {/* ── Left: conversation list ── */}
      <aside style={{ width: 300, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Bandeja de entrada</h2>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {channels.map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                style={{
                  padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)',
                  background: channelFilter === ch ? 'var(--primary)' : 'transparent',
                  color: channelFilter === ch ? '#fff' : 'inherit',
                  cursor: 'pointer', fontSize: 12,
                }}
              >
                {ch === 'all' ? 'Todos' : `${CHANNEL_ICONS[ch]} ${ch.charAt(0).toUpperCase() + ch.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingList && <p style={{ padding: 16, color: 'var(--muted-foreground)', fontSize: 13 }}>Cargando conversaciones...</p>}
          {!loadingList && conversations.length === 0 && (
            <p style={{ padding: 16, color: 'var(--muted-foreground)', fontSize: 13 }}>No hay conversaciones</p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => void selectConversation(conv.id)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: selectedId === conv.id ? 'var(--accent)' : 'transparent',
                borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: 22 }}>{CHANNEL_ICONS[conv.channel] ?? '💬'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.customerName ?? conv.customerPhone ?? 'Desconocido'}
                  </span>
                  {(conv.unreadCount ?? 0) > 0 && (
                    <span style={{ background: CHANNEL_COLORS[conv.channel] ?? '#888', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Center: message thread ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
            Selecciona una conversación
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>{CHANNEL_ICONS[selectedConv?.channel ?? ''] ?? '💬'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {selectedConv?.customerName ?? selectedConv?.customerPhone ?? 'Desconocido'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>
                  {selectedConv?.channel}
                </div>
              </div>
              {/* AI toggle */}
              <button
                onClick={() => void toggleAI()}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: aiState === 'IA_ACTIVA' ? '#22c55e' : '#f59e0b',
                  color: '#fff',
                }}
              >
                {aiState === 'IA_ACTIVA' ? '🤖 IA activa' : '🧑 Tomar control'}
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingDetail && <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Cargando...</p>}
              {detail?.messages.map((msg) => {
                const isOutbound = msg.direction === 'outbound';
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%', padding: '8px 12px', borderRadius: isOutbound ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: isOutbound ? 'var(--primary)' : 'var(--accent)',
                      color: isOutbound ? '#fff' : 'inherit',
                      fontSize: 14, lineHeight: 1.5,
                    }}>
                      <div>{msg.content ? escapeHtml(msg.content) : ''}</div>
                      <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, textAlign: 'right' }}>
                        {new Date(msg.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        {isOutbound && <span style={{ marginLeft: 4 }}>{msg.senderType === 'ai' ? '🤖' : '✓'}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <textarea
                value={outgoing}
                onChange={(e) => setOutgoing(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                placeholder="Escribe un mensaje... (Enter para enviar)"
                rows={2}
                style={{
                  flex: 1, resize: 'none', borderRadius: 8, border: '1px solid var(--border)',
                  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit',
                  background: 'var(--background)', color: 'inherit',
                }}
              />
              <button
                onClick={() => void sendMessage()}
                disabled={sending || !outgoing.trim()}
                style={{
                  padding: '0 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 14,
                  opacity: sending || !outgoing.trim() ? 0.5 : 1,
                }}
              >
                Enviar
              </button>
            </div>
          </>
        )}
      </main>

      {/* ── Right: customer profile ── */}
      {selectedConv && (
        <aside style={{ width: 260, borderLeft: '1px solid var(--border)', padding: '20px 16px', flexShrink: 0, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Perfil del cliente</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <ProfileRow label="Nombre" value={selectedConv.customerName ?? '—'} />
            <ProfileRow label="Teléfono" value={selectedConv.customerPhone ?? '—'} />
            <ProfileRow label="Canal" value={`${CHANNEL_ICONS[selectedConv.channel] ?? ''} ${selectedConv.channel}`} />
            <ProfileRow label="Estado conv." value={selectedConv.status ?? '—'} />
            <ProfileRow label="Mensajes sin leer" value={String(selectedConv.unreadCount ?? 0)} />
            <ProfileRow label="Modo IA" value={aiState === 'IA_ACTIVA' ? 'Activa' : 'Pausada (agente)'} />
          </div>
        </aside>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

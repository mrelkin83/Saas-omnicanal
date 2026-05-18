'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

interface WaSession {
  id: string;
  status: string;
  displayName: string | null;
  lastSeenAt: string | null;
}

type ModalState = 'idle' | 'connecting' | 'waiting_qr' | 'has_qr' | 'connected' | 'error';

const CHANNEL_DEFS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'var(--channel-whatsapp)' },
  { key: 'instagram', label: 'Instagram', icon: '📸', color: 'var(--channel-instagram)' },
  { key: 'facebook', label: 'Facebook', icon: '📘', color: 'var(--channel-facebook)' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵', color: 'var(--channel-tiktok)' },
] as const;

export default function ChannelsPage() {
  const { accessToken } = useAuthStore();
  const [waSession, setWaSession] = useState<WaSession | null>(null);
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  useEffect(() => {
    if (!accessToken) return;
    api.channels.status(accessToken).then((s) => setWaSession(s.whatsapp)).catch(() => null);
  }, [accessToken]);

  function closeModal() {
    setShowModal(false);
    setModalState('idle');
    setQrCode(null);
    setErrorMsg('');
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }

  function startSSE() {
    if (!accessToken) return;
    const es = new EventSource(`${API_BASE}/api/channels/whatsapp/stream?token=${encodeURIComponent(accessToken)}`);

    es.addEventListener('qr', (e) => {
      const data = JSON.parse(e.data) as { qrCode: string };
      setQrCode(data.qrCode);
      setModalState('has_qr');
    });

    es.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data) as { phone: string | null };
      setModalState('connected');
      setWaSession({ id: '', status: 'connected', displayName: data.phone, lastSeenAt: new Date().toISOString() });
      setTimeout(closeModal, 3000);
    });

    es.addEventListener('disconnected', () => {
      setWaSession(null);
    });

    es.onerror = () => {
      // SSE closed or errored; try to refresh QR manually
    };

    eventSourceRef.current = es;
  }

  async function handleConnectWhatsApp() {
    if (!accessToken) return;
    setShowModal(true);
    setModalState('connecting');
    setQrCode(null);
    setErrorMsg('');

    startSSE();

    try {
      const res = await api.channels.connectWhatsApp(accessToken);
      if (res.qrCode) {
        setQrCode(res.qrCode);
        setModalState('has_qr');
      } else {
        setModalState('waiting_qr');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al conectar';
      setErrorMsg(msg);
      setModalState('error');
    }
  }

  async function handleDisconnect() {
    if (!accessToken || !waSession) return;
    try {
      await api.channels.disconnectWhatsApp(accessToken, waSession.id);
      setWaSession(null);
    } catch {
      // ignore
    }
  }

  async function handleRefreshQR() {
    if (!accessToken) return;
    try {
      const res = await api.channels.getQR(accessToken);
      setQrCode(res.qrCode);
      setModalState('has_qr');
    } catch {
      setModalState('waiting_qr');
    }
  }

  const isWaConnected = waSession?.status === 'connected';

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Canales</h1>
        <p className="text-text-secondary mt-1">Conecta tus canales de mensajería para atender clientes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CHANNEL_DEFS.map((ch) => {
          const isWa = ch.key === 'whatsapp';
          const connected = isWa ? isWaConnected : false;
          const comingSoon = !isWa;

          return (
            <div
              key={ch.key}
              className="rounded-xl p-5 border flex flex-col gap-4"
              style={{
                background: 'var(--bg-surface-1)',
                borderColor: connected ? ch.color : 'var(--border-default)',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{ch.icon}</span>
                <div>
                  <p className="font-semibold text-text-primary">{ch.label}</p>
                  {isWa && isWaConnected && (
                    <p className="text-xs text-accent-success" style={{ color: 'var(--accent-success)' }}>
                      Conectado {waSession?.displayName ? `· ${waSession.displayName}` : ''}
                    </p>
                  )}
                  {comingSoon && (
                    <p className="text-xs text-text-tertiary">Próximamente</p>
                  )}
                </div>
              </div>

              {isWa && (
                <div>
                  {isWaConnected ? (
                    <button
                      onClick={handleDisconnect}
                      className="w-full text-sm py-2 px-4 rounded-lg border transition-all"
                      style={{
                        borderColor: 'var(--accent-danger)',
                        color: 'var(--accent-danger)',
                        background: 'transparent',
                      }}
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectWhatsApp}
                      className="w-full text-sm py-2 px-4 rounded-lg font-medium transition-all"
                      style={{
                        background: ch.color,
                        color: '#fff',
                      }}
                    >
                      Conectar WhatsApp
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* QR Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6 relative"
            style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' }}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-colors text-lg"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-text-primary">Conectar WhatsApp</h2>

            {modalState === 'connecting' && (
              <>
                <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--channel-whatsapp)', borderTopColor: 'transparent' }} />
                <p className="text-text-secondary text-sm">Iniciando conexión...</p>
              </>
            )}

            {modalState === 'waiting_qr' && (
              <>
                <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--channel-whatsapp)', borderTopColor: 'transparent' }} />
                <p className="text-text-secondary text-sm text-center">Generando código QR...</p>
                <button onClick={handleRefreshQR} className="text-xs underline" style={{ color: 'var(--accent-primary)' }}>
                  Actualizar QR
                </button>
              </>
            )}

            {modalState === 'has_qr' && qrCode && (
              <>
                <div className="p-3 rounded-xl" style={{ background: '#fff' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="WhatsApp QR" width={220} height={220} />
                </div>
                <div className="text-center">
                  <p className="text-text-secondary text-sm">Escanea este código con WhatsApp</p>
                  <p className="text-text-tertiary text-xs mt-1">Ajustes → Dispositivos vinculados → Vincular un dispositivo</p>
                </div>
                <button onClick={handleRefreshQR} className="text-xs underline" style={{ color: 'var(--accent-primary)' }}>
                  El QR expiró — actualizar
                </button>
              </>
            )}

            {modalState === 'connected' && (
              <>
                <div className="text-5xl">✅</div>
                <p className="text-text-primary font-semibold">¡WhatsApp conectado!</p>
                <p className="text-text-secondary text-sm">Ya puedes recibir y responder mensajes.</p>
              </>
            )}

            {modalState === 'error' && (
              <>
                <div className="text-5xl">❌</div>
                <p className="text-text-primary font-semibold">Error al conectar</p>
                <p className="text-text-secondary text-sm text-center">{errorMsg}</p>
                <button
                  onClick={() => { closeModal(); handleConnectWhatsApp(); }}
                  className="text-sm py-2 px-4 rounded-lg font-medium"
                  style={{ background: 'var(--channel-whatsapp)', color: '#fff' }}
                >
                  Reintentar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

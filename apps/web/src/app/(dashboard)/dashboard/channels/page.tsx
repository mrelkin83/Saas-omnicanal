'use client';

import { CheckCircle, XCircle, MessageCircle, Instagram, Facebook, Music2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { toast } from '@/hooks/useToast';

type ChannelKey = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';

interface SessionInfo {
  id: string;
  status: string;
  displayName: string | null;
}

type AllStatus = Record<ChannelKey, SessionInfo | null>;

type ModalType = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | null;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const CHANNEL_META: Record<ChannelKey, { label: string; icon: React.ElementType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  whatsapp:  { label: 'WhatsApp Business', icon: MessageCircle, color: '#25D366' },
  instagram: { label: 'Instagram',         icon: Instagram,     color: '#E1306C' },
  facebook:  { label: 'Facebook Messenger',icon: Facebook,      color: '#1877F2' },
  tiktok:    { label: 'TikTok',            icon: Music2,        color: '#010101' },
};

export default function ChannelsPage() {
  const { accessToken } = useAuthStore();
  const [status, setStatus] = useState<AllStatus>({ whatsapp: null, instagram: null, facebook: null, tiktok: null });
  const [modal, setModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // WhatsApp specific
  const [waModalState, setWaModalState] = useState<'connecting' | 'waiting_qr' | 'has_qr' | 'connected' | 'error'>('connecting');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Instagram fields
  const [igUser, setIgUser] = useState('');
  const [igPass, setIgPass] = useState('');
  const [ig2fa, setIg2fa] = useState('');
  const [igNeeds2fa, setIgNeeds2fa] = useState(false);

  // Facebook fields
  const [fbEmail, setFbEmail] = useState('');
  const [fbPassword, setFbPassword] = useState('');
  const [fb2fa, setFb2fa] = useState('');
  const [fbNeeds2fa, setFbNeeds2fa] = useState(false);

  // TikTok fields
  const [ttCookies, setTtCookies] = useState('');
  const [ttUser, setTtUser] = useState('');

  const loadStatus = async () => {
    if (!accessToken) return;
    try {
      const s = await api.channels.allStatus(accessToken);
      setStatus(s as AllStatus);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cargando canales');
    }
  };

  useEffect(() => { void loadStatus(); }, [accessToken]);

  function closeModal() {
    setModal(null);
    setLoading(false);
    setError('');
    setQrCode(null);
    setWaModalState('connecting');
    setIgUser(''); setIgPass(''); setIg2fa(''); setIgNeeds2fa(false);
    setFbEmail(''); setFbPassword(''); setFb2fa(''); setFbNeeds2fa(false);
    setTtCookies(''); setTtUser('');
    esRef.current?.close();
    esRef.current = null;
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────

  async function openWhatsApp() {
    if (!accessToken) return;
    setModal('whatsapp');
    setWaModalState('connecting');
    setError('');

    const es = new EventSource(`${API_BASE}/api/channels/whatsapp/stream?token=${encodeURIComponent(accessToken)}`);
    esRef.current = es;

    es.addEventListener('qr', (e) => {
      const d = JSON.parse(e.data) as { qrCode: string };
      setQrCode(d.qrCode);
      setWaModalState('has_qr');
    });
    es.addEventListener('connected', () => {
      setWaModalState('connected');
      void loadStatus();
      setTimeout(closeModal, 2500);
    });

    try {
      const res = await api.channels.connectWhatsApp(accessToken);
      if (res.qrCode) { setQrCode(res.qrCode); setWaModalState('has_qr'); }
      else setWaModalState('waiting_qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar');
      setWaModalState('error');
    }
  }

  async function refreshQR() {
    if (!accessToken) return;
    try {
      const res = await api.channels.getQR(accessToken);
      setQrCode(res.qrCode);
      setWaModalState('has_qr');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error actualizando QR');
      setWaModalState('waiting_qr');
    }
  }

  async function disconnectChannel(ch: ChannelKey) {
    if (!accessToken) return;
    const session = status[ch];
    if (!session) return;
    setLoading(true);
    try {
      if (ch === 'whatsapp') await api.channels.disconnectWhatsApp(accessToken, session.id);
      else if (ch === 'instagram') await api.channels.disconnectInstagram(accessToken, session.id);
      else if (ch === 'facebook') await api.channels.disconnectFacebook(accessToken, session.id);
      else if (ch === 'tiktok') await api.channels.disconnectTikTok(accessToken, session.id);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconectando canal');
    } finally { setLoading(false); }
  }

  // ── Instagram ─────────────────────────────────────────────────────────────

  async function connectInstagram() {
    if (!accessToken) return;
    setLoading(true); setError('');
    try {
      const res = await api.channels.connectInstagram(accessToken, {
        username: igUser, password: igPass,
        ...(igNeeds2fa && ig2fa ? { twoFactorCode: ig2fa } : {}),
      });
      if (res.requires2FA) { setIgNeeds2fa(true); setLoading(false); return; }
      await loadStatus();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error conectando Instagram');
    } finally { setLoading(false); }
  }

  // ── Facebook ──────────────────────────────────────────────────────────────

  async function connectFacebook() {
    if (!accessToken) return;
    setLoading(true); setError('');
    try {
      const res = await api.channels.connectFacebook(accessToken, {
        email: fbEmail,
        password: fbPassword,
        ...(fbNeeds2fa ? { twoFactorCode: fb2fa } : {}),
      });
      if (res.requires2FA) { setFbNeeds2fa(true); setLoading(false); return; }
      await loadStatus();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error conectando Facebook');
    } finally { setLoading(false); }
  }

  // ── TikTok ────────────────────────────────────────────────────────────────

  async function connectTikTok() {
    if (!accessToken) return;
    setLoading(true); setError('');
    try {
      await api.channels.connectTikTok(accessToken, { cookies: ttCookies, username: ttUser });
      await loadStatus();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error conectando TikTok');
    } finally { setLoading(false); }
  }

  const inp = {
    padding: '10px 12px', borderRadius: 8, width: '100%', fontSize: 14,
    border: '1px solid var(--border-default)', background: 'var(--bg-surface-2)',
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ padding: 32, maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Canales</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 28px' }}>
        Conecta tus canales de mensajería. La IA responderá automáticamente en cada canal conectado.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {(Object.keys(CHANNEL_META) as ChannelKey[]).map((ch) => {
          const meta = CHANNEL_META[ch];
          const session = status[ch];
          const connected = session?.status === 'connected';

          return (
            <div key={ch} style={{
              padding: 20, borderRadius: 12, border: `1px solid ${connected ? meta.color : 'var(--border-default)'}`,
              background: 'var(--bg-surface-1)', display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
                  <meta.icon className="w-7 h-7" style={{ color: meta.color }} />
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{meta.label}</div>
                  <div style={{ fontSize: 12, color: connected ? meta.color : 'var(--text-tertiary)', marginTop: 2 }}>
                    {connected
                      ? `Conectado${session?.displayName ? ` · ${session.displayName}` : ''}`
                      : 'Sin conectar'}
                  </div>
                </div>
              </div>

              {connected ? (
                <button
                  onClick={() => void disconnectChannel(ch)}
                  disabled={loading}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: `1px solid var(--accent-danger, #ef4444)`,
                    background: 'transparent', color: 'var(--accent-danger, #ef4444)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  Desconectar
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (ch === 'whatsapp') void openWhatsApp();
                    else setModal(ch);
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: meta.color, color: ch === 'tiktok' ? '#fff' : '#fff',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Conectar {meta.label.split(' ')[0]}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modal overlay ── */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, position: 'relative' }}>
            <button onClick={closeModal} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)' }}>✕</button>

            {/* WhatsApp modal */}
            {modal === 'whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Conectar WhatsApp</h2>
                {waModalState === 'connecting' || waModalState === 'waiting_qr' ? (
                  <>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${CHANNEL_META.whatsapp.color}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
                      {waModalState === 'connecting' ? 'Iniciando conexión...' : 'Generando código QR...'}
                    </p>
                    {waModalState === 'waiting_qr' && (
                      <button onClick={refreshQR} style={{ fontSize: 12, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Actualizar QR
                      </button>
                    )}
                  </>
                ) : waModalState === 'has_qr' && qrCode ? (
                  <>
                    <div style={{ padding: 12, borderRadius: 12, background: '#fff' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCode} alt="WhatsApp QR" width={220} height={220} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 4px' }}>Escanea con WhatsApp</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Ajustes → Dispositivos vinculados → Vincular dispositivo</p>
                    </div>
                    <button onClick={refreshQR} style={{ fontSize: 12, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      QR expirado — actualizar
                    </button>
                  </>
                ) : waModalState === 'connected' ? (
                  <>
                    <span style={{ fontSize: 48 }}><CheckCircle className="w-4 h-4 inline-block" /></span>
                    <p style={{ fontWeight: 600, margin: 0 }}>¡WhatsApp conectado!</p>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 48 }}><XCircle className="w-4 h-4 inline-block" /></span>
                    <p style={{ fontWeight: 600, margin: 0 }}>Error al conectar</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>{error}</p>
                    <button onClick={() => { closeModal(); void openWhatsApp(); }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: CHANNEL_META.whatsapp.color, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      Reintentar
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Instagram modal */}
            {modal === 'instagram' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Conectar Instagram</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Usa una cuenta secundaria. No uses tu cuenta personal principal.
                </p>
                {!igNeeds2fa ? (
                  <>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Usuario</label>
                      <input value={igUser} onChange={(e) => setIgUser(e.target.value)} placeholder="@usuario" style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Contraseña</label>
                      <input type="password" value={igPass} onChange={(e) => setIgPass(e.target.value)} placeholder="••••••••" style={inp} />
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Código de verificación (2FA)</label>
                    <input value={ig2fa} onChange={(e) => setIg2fa(e.target.value)} placeholder="123456" style={inp} autoFocus />
                  </div>
                )}
                {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
                <button
                  onClick={connectInstagram}
                  disabled={loading || (!igNeeds2fa && (!igUser || !igPass)) || (igNeeds2fa && !ig2fa)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: CHANNEL_META.instagram.color, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? 'Conectando...' : igNeeds2fa ? 'Verificar código' : 'Conectar'}
                </button>
              </div>
            )}

            {/* Facebook modal */}
            {modal === 'facebook' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Conectar Facebook</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Ingresa tu email y contraseña de Facebook. El sistema inicia sesión automáticamente y gestiona la sesión por ti.
                </p>
                {!fbNeeds2fa ? (
                  <>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email de Facebook</label>
                      <input type="email" value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} placeholder="tuemail@ejemplo.com" style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Contraseña</label>
                      <input type="password" value={fbPassword} onChange={(e) => setFbPassword(e.target.value)} placeholder="••••••••" style={inp} />
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Código de verificación (2FA)</label>
                    <input value={fb2fa} onChange={(e) => setFb2fa(e.target.value)} placeholder="123456" style={inp} autoFocus />
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Abre tu app de autenticación o espera el SMS.</p>
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--accent-warning, #f59e0b)', background: 'var(--bg-surface-1)', padding: 10, borderRadius: 6 }}>
                  ⚠️ Usa una cuenta secundaria de Facebook. No uses tu cuenta personal principal.
                </div>
                {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
                <button
                  onClick={connectFacebook}
                  disabled={loading || (!fbNeeds2fa && (!fbEmail || !fbPassword)) || (fbNeeds2fa && !fb2fa)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: CHANNEL_META.facebook.color, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? 'Conectando...' : fbNeeds2fa ? 'Verificar código' : 'Conectar'}
                </button>
              </div>
            )}

            {/* TikTok modal */}
            {modal === 'tiktok' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Conectar TikTok</h2>

                {/* Bookmarklet helper */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-surface-1)', padding: 12, borderRadius: 8, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Método recomendado — Extracción automática:</strong>
                  <ol style={{ paddingLeft: 16, margin: '6px 0 0' }}>
                    <li><strong>Copia el bookmarklet</strong> haciendo clic en el botón de abajo.</li>
                    <li>Abre <strong>tiktok.com</strong> en Chrome/Edge e inicia sesión.</li>
                    <li>En la barra de bookmarks del navegador, haz clic derecho → <strong>Añadir página</strong>. Pega el código copiado en la URL y nómbralo <strong>&quot;Extraer cookies&quot;</strong>.</li>
                    <li>Mientras estés en TikTok, haz clic en el bookmark. Se copiarán las cookies automáticamente.</li>
                    <li>Vuelve aquí y <strong>pega</strong> (Ctrl+V) en el campo de cookies.</li>
                  </ol>
                  <button
                    onClick={() => {
                      const bm = "javascript:(function(){const c=document.cookie.split(';').reduce((a,b)=>{const[i,v]=b.trim().split('=');if(i)a[i]=v;return a},{});const j=JSON.stringify(c);navigator.clipboard.writeText(j).then(()=>alert('Cookies copiadas. Pega aquí con Ctrl+V.')).catch(()=>prompt('Copia este texto:',j));})();";
                      navigator.clipboard.writeText(bm).then(() => toast.success('Bookmarklet copiado. Crea un bookmark con este código como URL.')).catch(() => toast.error('No se pudo copiar. Copia manualmente el código del bookmarklet.'));
                    }}
                    style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--accent-primary)', background: 'transparent', color: 'var(--accent-primary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Copiar bookmarklet de extracción
                  </button>
                </div>

                <div style={{ fontSize: 11, color: 'var(--accent-warning, #f59e0b)', background: 'var(--bg-surface-1)', padding: 10, borderRadius: 6 }}>
                  ⚠️ Usa una cuenta de empresa o secundaria. Las sesiones pueden expirar y requerir renovación manual.
                </div>

                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Usuario de TikTok</label>
                  <input value={ttUser} onChange={(e) => setTtUser(e.target.value)} placeholder="@miusuario" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Cookies (JSON) — pega aquí después de usar el bookmarklet</label>
                  <textarea
                    value={ttCookies}
                    onChange={(e) => setTtCookies(e.target.value)}
                    placeholder='{"sessionid":"...","tt_webid":"...","tt_webid_v2":"..."}'
                    rows={4}
                    style={{ ...inp, resize: 'vertical' as const }}
                  />
                </div>
                {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
                <button
                  onClick={connectTikTok}
                  disabled={loading || !ttUser || !ttCookies.trim()}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#010101', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? 'Conectando...' : 'Conectar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

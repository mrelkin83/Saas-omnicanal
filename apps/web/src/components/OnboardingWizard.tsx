'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { toast } from '@/hooks/useToast';

const CAPABILITIES = [
  { id: 'VER_CATALOGO',  label: 'Mostrar catálogo / precios',   desc: 'El agente puede mostrar productos y precios al cliente' },
  { id: 'CREAR_CITA',   label: 'Agendar citas',                desc: 'El agente agenda citas directamente en WhatsApp' },
  { id: 'CREAR_PEDIDO', label: 'Tomar pedidos',                desc: 'El agente puede tomar y registrar pedidos' },
  { id: 'COTIZAR',      label: 'Generar cotizaciones',         desc: 'El agente crea cotizaciones para el cliente' },
  { id: 'ENVIAR_PAGO',  label: 'Cobrar por WhatsApp (Wompi)',  desc: 'El agente genera links de pago y cobra online' },
  { id: 'RESERVAR',     label: 'Reservar mesa / espacio',      desc: 'El agente gestiona reservaciones' },
];

const TONES = [
  { value: 'amigable',     label: 'Amigable',     desc: 'Cercano y cálido, usa emojis' },
  { value: 'profesional',  label: 'Profesional',  desc: 'Serio y formal, sin emojis' },
  { value: 'casual',       label: 'Casual',        desc: 'Relajado, como un amigo' },
  { value: 'formal',       label: 'Formal',        desc: 'Muy corporativo y estructurado' },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { accessToken, user } = useAuthStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [business, setBusiness] = useState({ name: '', description: '', phone: '' });
  const [agentName, setAgentName] = useState('Asistente');
  const [tone, setTone] = useState('amigable');
  const [capabilities, setCapabilities] = useState<string[]>(['VER_CATALOGO']);

  const toggleCap = (id: string) =>
    setCapabilities((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);

  const finish = async () => {
    if (!accessToken || !user) return;
    setSaving(true);
    try {
      await api.tenants.patch(accessToken, {
        ...(business.name.trim() ? { name: business.name.trim() } : {}),
        ...(business.description.trim() ? { description: business.description.trim() } : {}),
        ...(business.phone.trim() ? { phone: business.phone.trim() } : {}),
        aiAgentName: agentName || 'Asistente',
        aiTone: tone,
        capabilities,
      });
      // Persist capabilities via a second patch (they're in the same endpoint)
      // Note: capabilities field is managed via tenant config — we store it in a free-form way
      localStorage.setItem(`onboarding_done_${user.tenantId}`, '1');
      onComplete();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); } finally { setSaving(false); }
  };

  const skip = () => {
    if (user) localStorage.setItem(`onboarding_done_${user.tenantId}`, '1');
    onComplete();
  };

  const inp = {
    padding: '10px 14px', borderRadius: 10, border: '1px solid #334155',
    background: '#1e293b', color: '#f1f5f9', fontSize: 14, width: '100%',
    boxSizing: 'border-box' as const, outline: 'none',
  };

  const steps = [
    // Step 0: Welcome
    <div key="welcome" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>⚡</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Bienvenido a Omnicanal</h2>
      <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
        En los próximos 3 pasos configuraremos tu agente IA para que empiece a atender clientes en WhatsApp, Instagram y más —<strong style={{ color: '#f1f5f9' }}> sin que tengas que hacer nada más.</strong>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 32, textAlign: 'left' }}>
        {[
          { icon: '🤖', label: 'IA responde 24/7', desc: 'Atiende, vende y agenda sin intervención humana' },
          { icon: '📡', label: 'Multi-canal', desc: 'WhatsApp, Instagram, Facebook, TikTok' },
          { icon: '📊', label: 'Dashboard en vivo', desc: 'Monitorea todo desde un solo lugar' },
        ].map((f) => (
          <div key={f.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{f.desc}</div>
          </div>
        ))}
      </div>
      <button onClick={() => setStep(1)} style={{ padding: '12px 40px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Empezar configuración →
      </button>
    </div>,

    // Step 1: Business info
    <div key="business">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Cuéntanos sobre tu negocio</h2>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>Esta información la usará el agente IA para presentarse y responder correctamente.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Nombre de tu negocio</label>
          <input value={business.name} onChange={(e) => setBusiness((b) => ({ ...b, name: e.target.value }))} placeholder="Ej. Burger Palace, Salón Valentina..." style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>¿A qué se dedica? (2-3 frases)</label>
          <textarea
            value={business.description}
            onChange={(e) => setBusiness((b) => ({ ...b, description: e.target.value }))}
            placeholder="Somos un restaurante de comida rápida en Bogotá. Ofrecemos hamburguesas artesanales, alitas y bebidas. Atendemos de lunes a domingo de 11am a 10pm."
            rows={4}
            style={{ ...inp, resize: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Teléfono / WhatsApp del negocio</label>
          <input value={business.phone} onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))} placeholder="+57 300 000 0000" style={inp} />
        </div>
      </div>
    </div>,

    // Step 2: AI agent config
    <div key="ai">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Configura tu agente IA</h2>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>Elige cómo se presentará y qué podrá hacer tu agente.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Nombre del agente</label>
          <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Asistente" style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Tono de voz</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TONES.map((t) => (
              <button key={t.value} onClick={() => setTone(t.value)} style={{
                padding: '12px 14px', borderRadius: 10, border: `2px solid ${tone === t.value ? '#3b82f6' : '#334155'}`,
                background: tone === t.value ? 'rgba(59,130,246,0.1)' : '#1e293b', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8 }}>¿Qué puede hacer el agente? (selecciona todos los que apliquen)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CAPABILITIES.map((cap) => {
              const active = capabilities.includes(cap.id);
              return (
                <button key={cap.id} onClick={() => toggleCap(cap.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
                  border: `2px solid ${active ? '#3b82f6' : '#334155'}`, background: active ? 'rgba(59,130,246,0.1)' : '#1e293b', cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${active ? '#3b82f6' : '#475569'}`, background: active ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {active && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{cap.label}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{cap.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,

    // Step 3: Complete
    <div key="done" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>¡Todo listo!</h2>
      <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
        Tu agente IA está configurado. El siguiente paso es conectar tu WhatsApp para que empiece a atender clientes.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {[
          { icon: '📡', action: async () => { await finish(); router.push('/dashboard/channels'); }, label: 'Conectar WhatsApp ahora', primary: true },
          { icon: '📦', action: async () => { await finish(); router.push('/dashboard/catalog'); }, label: 'Agregar mis productos / servicios', primary: false },
          { icon: '🧠', action: async () => { await finish(); router.push('/dashboard/ai-training'); }, label: 'Entrenar la IA con mis preguntas frecuentes', primary: false },
        ].map((btn) => (
          <button key={btn.label} onClick={() => void btn.action()} disabled={saving} style={{
            padding: '12px 20px', borderRadius: 10, border: btn.primary ? 'none' : '1px solid #334155',
            background: btn.primary ? '#3b82f6' : 'transparent', color: btn.primary ? '#fff' : '#94a3b8',
            cursor: 'pointer', fontWeight: btn.primary ? 700 : 400, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>{btn.icon}</span>{btn.label}
          </button>
        ))}
      </div>
      <button onClick={() => void finish()} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? '#334155' : '#22c55e', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Guardando...' : 'Ir al dashboard →'}
      </button>
    </div>,
  ];

  const totalSteps = 3; // steps 1-3 (0 is welcome)
  const progressStep = Math.max(0, step - 1);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 36 }}>
        {/* Progress bar (steps 1-3 only) */}
        {step > 0 && step < 4 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Paso {progressStep} de {totalSteps}</span>
              <button onClick={skip} style={{ fontSize: 12, color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>Omitir configuración</button>
            </div>
            <div style={{ height: 4, background: '#1e293b', borderRadius: 2 }}>
              <div style={{ height: '100%', background: '#3b82f6', borderRadius: 2, width: `${(progressStep / totalSteps) * 100}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Step content */}
        <div style={{ color: '#f1f5f9' }}>
          {steps[step]}
        </div>

        {/* Navigation (steps 1-2 only) */}
        {step >= 1 && step <= 2 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button onClick={() => setStep((s) => s - 1)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>
              ← Atrás
            </button>
            <button onClick={() => setStep((s) => s + 1)} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {step === 2 ? 'Finalizar →' : 'Siguiente →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

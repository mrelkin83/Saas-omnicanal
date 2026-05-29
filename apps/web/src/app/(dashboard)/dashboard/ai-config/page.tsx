'use client';

import { Bot } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  action?: string | null;
}

const TEST_PHONE = '+573009999999';

export default function AiConfigPage() {
  const { accessToken } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: '¡Hola! Soy tu agente de IA. Escríbeme para probar cómo respondo a tus clientes.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !accessToken || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const result = await api.ai.simulate(accessToken, { customerPhone: TEST_PHONE, message: text });
      setMessages((prev) => [...prev, { role: 'bot', text: result.aiResponse, action: result.action }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'bot', text: 'Error al contactar el motor de IA. Verifica la configuración de API key en Configuración → IA y Agente.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clear = () => {
    setMessages([{ role: 'bot', text: '¡Hola! Soy tu agente de IA. Escríbeme para probar cómo respondo a tus clientes.' }]);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Probar Agente de IA</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Simula una conversación para ver cómo responde tu agente antes de conectarlo a WhatsApp.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--bg-surface-1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}><Bot className="w-4 h-4 inline-block" /></span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Simulador de conversación</span>
          </div>
          <button
            onClick={clear}
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            Limpiar historial
          </button>
        </div>

        {/* Chat area */}
        <div style={{ height: 420, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.text}
                {msg.action && (
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                    Accion ejecutada: {msg.action}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '16px 16px 16px 4px',
                background: 'var(--bg-surface-2)',
                fontSize: 14,
                color: 'var(--text-tertiary)',
              }}>
                Escribiendo...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: 12,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 8,
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje como si fuera un cliente... (Enter para enviar)"
            rows={2}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface-2)',
              color: 'var(--text-primary)',
              fontSize: 13,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            Enviar
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
          Este simulador usa un cliente de prueba ({TEST_PHONE}). Las conversaciones de prueba se guardan en la base de datos.
          Para borrar el historial del cliente de prueba, usa el boton "Limpiar historial" que reinicia la vista (el historial en DB se reinicia con la proxima sesion).
        </p>
      </div>
    </div>
  );
}

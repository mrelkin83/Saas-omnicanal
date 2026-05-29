'use client';

import { Brain, CheckCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type KnowledgeEntry, type UnansweredQuery } from '@/lib/api';
import { toast } from '@/hooks/useToast';

const CATEGORIES = ['general', 'precios', 'horarios', 'productos', 'servicios', 'pagos', 'envios', 'garantias', 'otro'];

export default function AITrainingPage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<'entries' | 'unanswered'>('entries');

  // ── Entries state ──────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ question: '', answer: '', category: 'general', keywords: '' });
  const [catFilter, setCatFilter] = useState('');

  // ── Unanswered state ───────────────────────────────────────────────────────
  const [unanswered, setUnanswered] = useState<UnansweredQuery[]>([]);
  const [uLoading, setULoading] = useState(false);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertAnswer, setConvertAnswer] = useState('');
  const [convertSaving, setConvertSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const data = await api.ai.knowledge.list(accessToken).catch(() => [] as KnowledgeEntry[]);
    setEntries(data);
    setLoading(false);
  }, [accessToken]);

  const loadUnanswered = useCallback(async () => {
    if (!accessToken) return;
    setULoading(true);
    const data = await api.ai.unanswered(accessToken).catch(() => [] as UnansweredQuery[]);
    setUnanswered(data);
    setULoading(false);
  }, [accessToken]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  useEffect(() => {
    if (tab === 'unanswered') void loadUnanswered();
  }, [tab, loadUnanswered]);

  const createEntry = async () => {
    if (!accessToken || !form.question.trim() || !form.answer.trim()) return;
    setSaving(true);
    try {
      const keywords = form.keywords.split(',').map((k) => k.trim()).filter(Boolean);
      await api.ai.knowledge.create(accessToken, {
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: form.category,
        keywords,
      });
      setForm({ question: '', answer: '', category: 'general', keywords: '' });
      setShowForm(false);
      void loadEntries();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); } finally { setSaving(false); }
  };

  const deleteEntry = async (id: string) => {
    if (!accessToken) return;
    setDeleting(id);
    await api.ai.knowledge.delete(accessToken, id).catch(() => null);
    void loadEntries();
    setDeleting(null);
  };

  const convertToEntry = async (query: UnansweredQuery) => {
    if (!accessToken || !convertAnswer.trim()) return;
    setConvertSaving(true);
    try {
      await api.ai.knowledge.create(accessToken, {
        question: query.question,
        answer: convertAnswer.trim(),
        category: 'general',
      });
      setConvertId(null);
      setConvertAnswer('');
      void loadUnanswered();
      void loadEntries();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); } finally { setConvertSaving(false); }
  };

  const grouped = entries.reduce<Record<string, KnowledgeEntry[]>>((acc, e) => {
    const cat = e.category ?? 'general';
    acc[cat] = acc[cat] ?? [];
    acc[cat].push(e);
    return acc;
  }, {});

  const filtered = catFilter ? (grouped[catFilter] ?? []) : entries;

  const inp = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)',
    background: 'var(--bg-surface-2)', color: 'inherit', fontSize: 13, width: '100%',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Entrenamiento IA</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            Enseña a tu agente a responder preguntas específicas de tu negocio con búsqueda semántica (pgvector).
          </p>
        </div>
        {tab === 'entries' && (
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            {showForm ? '✕ Cancelar' : '+ Nueva entrada'}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['entries', 'unanswered'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: 13,
            background: tab === t ? '#3b82f6' : 'transparent', color: tab === t ? '#fff' : 'inherit', fontWeight: tab === t ? 600 : 400,
          }}>
            {t === 'entries' ? `Base de conocimiento (${entries.length})` : `Sin respuesta (${unanswered.length})`}
          </button>
        ))}
      </div>

      {/* ── TAB: Entries ── */}
      {tab === 'entries' && (
        <>
          {/* Create form */}
          {showForm && (
            <div style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '20px', marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Nueva entrada de conocimiento</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>PREGUNTA (como la haría el cliente)</label>
                  <input
                    value={form.question}
                    onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                    placeholder="¿Cuánto cuesta el envío?"
                    style={inp}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>RESPUESTA</label>
                  <textarea
                    value={form.answer}
                    onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                    placeholder="El envío cuesta $8,000 COP para Bogotá y $12,000 para el resto del país. Despachos de lunes a viernes."
                    rows={4}
                    style={{ ...inp, resize: 'none', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>CATEGORÍA</label>
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inp}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>PALABRAS CLAVE (separadas por coma)</label>
                    <input
                      value={form.keywords}
                      onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                      placeholder="envío, domicilio, entrega"
                      style={inp}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => void createEntry()}
                    disabled={saving || !form.question.trim() || !form.answer.trim()}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Guardando...' : 'Guardar (genera embedding)'}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                  El sistema generará un embedding semántico automáticamente para búsqueda vectorial.
                </p>
              </div>
            </div>
          )}

          {/* Category filter */}
          {entries.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => setCatFilter('')} style={{ padding: '3px 12px', borderRadius: 20, border: '1px solid var(--border-default)', fontSize: 12, cursor: 'pointer', background: !catFilter ? '#3b82f6' : 'transparent', color: !catFilter ? '#fff' : 'inherit' }}>
                Todas ({entries.length})
              </button>
              {Object.entries(grouped).map(([cat, items]) => (
                <button key={cat} onClick={() => setCatFilter(cat)} style={{ padding: '3px 12px', borderRadius: 20, border: '1px solid var(--border-default)', fontSize: 12, cursor: 'pointer', background: catFilter === cat ? '#3b82f6' : 'transparent', color: catFilter === cat ? '#fff' : 'inherit' }}>
                  {cat} ({items.length})
                </button>
              ))}
            </div>
          )}

          {loading && <p style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>}
          {!loading && entries.length === 0 && (
            <div style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}><Brain className="w-4 h-4 inline-block" /></div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Base de conocimiento vacía</p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                Agrega preguntas y respuestas frecuentes para que tu agente IA las use cuando los clientes pregunten.
              </p>
              <button onClick={() => setShowForm(true)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                + Agregar primera entrada
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((entry) => (
              <div key={entry.id} style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'var(--bg-surface-2)', color: 'var(--text-tertiary)' }}>
                        {entry.category ?? 'general'}
                      </span>
                      {(entry.keywords ?? []).slice(0, 4).map((kw) => (
                        <span key={kw} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>#{kw}</span>
                      ))}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      P: {entry.question}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      R: {entry.answer}
                    </div>
                  </div>
                  <button
                    onClick={() => void deleteEntry(entry.id)}
                    disabled={deleting === entry.id}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', opacity: deleting === entry.id ? 0.5 : 1 }}
                  >
                    {deleting === entry.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB: Unanswered ── */}
      {tab === 'unanswered' && (
        <>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
            <strong>Preguntas que el agente no pudo responder.</strong> Agrega una respuesta para entrenar la IA y que pueda contestarlas en el futuro.
          </div>

          {uLoading && <p style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>}
          {!uLoading && unanswered.length === 0 && (
            <div style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}><CheckCircle className="w-4 h-4 inline-block" /></div>
              <p style={{ fontWeight: 600 }}>Sin preguntas pendientes</p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Tu agente pudo responder todo lo que le preguntaron.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unanswered.map((q) => (
              <div key={q.id} style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      "{q.question}"
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {new Date(q.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                    </div>
                    {convertId === q.id && (
                      <div style={{ marginTop: 10 }}>
                        <textarea
                          value={convertAnswer}
                          onChange={(e) => setConvertAnswer(e.target.value)}
                          placeholder="Escribe la respuesta correcta para esta pregunta..."
                          rows={3}
                          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-surface-2)', color: 'inherit', fontSize: 13, width: '100%', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            onClick={() => void convertToEntry(q)}
                            disabled={convertSaving || !convertAnswer.trim()}
                            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12, opacity: convertSaving ? 0.6 : 1 }}
                          >
                            {convertSaving ? 'Guardando...' : 'Guardar y entrenar IA'}
                          </button>
                          <button onClick={() => { setConvertId(null); setConvertAnswer(''); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {convertId !== q.id && (
                    <button
                      onClick={() => { setConvertId(q.id); setConvertAnswer(''); }}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      + Responder
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

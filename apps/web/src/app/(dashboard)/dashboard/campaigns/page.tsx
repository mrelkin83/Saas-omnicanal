'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { api, type Campaign, type ContactList, type WaGroup, type CampaignLog } from '@/lib/api';

interface ContactEntry { id: string; phone: string; name: string | null; }

const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b', scheduled: '#3b82f6', running: '#f59e0b',
  done: '#22c55e', cancelled: '#ef4444', paused: '#8b5cf6',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', scheduled: 'Programada', running: 'Enviando',
  done: 'Completada', cancelled: 'Cancelada', paused: 'Pausada',
};
const LOG_COLORS: Record<string, string> = {
  pending: '#64748b', sent: '#22c55e', failed: '#ef4444', delivered: '#6366f1',
};
const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Una vez', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const inp = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)',
  background: 'var(--bg-surface-2)', color: 'inherit', fontSize: 13, width: '100%',
  boxSizing: 'border-box' as const,
};
const btn = (bg: string, color = '#fff') => ({
  padding: '6px 14px', borderRadius: 8, border: 'none',
  background: bg, color, cursor: 'pointer', fontSize: 12, fontWeight: 600,
});

export default function CampaignsPage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<'campaigns' | 'lists' | 'groups'>('campaigns');

  // ── Campaigns ──────────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campsLoading, setCampsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedCamp, setExpandedCamp] = useState<string | null>(null);
  const [campLogs, setCampLogs] = useState<Record<string, CampaignLog[]>>({});
  const [form, setForm] = useState({
    name: '', listId: '', messages: [''], scheduledAt: '',
    mediaUrl: '', mediaType: 'image', recurrence: 'once',
  });

  // ── Lists ──────────────────────────────────────────────────────────────────
  const [lists, setLists] = useState<ContactList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [listEntries, setListEntries] = useState<Record<string, ContactEntry[]>>({});
  const [importingList, setImportingList] = useState<string | null>(null);
  const csvInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Groups ─────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [sendGroupId, setSendGroupId] = useState<string | null>(null);
  const [groupText, setGroupText] = useState('');
  const [sendingGroup, setSendingGroup] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    if (!accessToken) return;
    setCampsLoading(true);
    const cs = await api.campaigns.list(accessToken).catch(() => [] as Campaign[]);
    setCampaigns(cs);
    setCampsLoading(false);
  }, [accessToken]);

  const loadLists = useCallback(async () => {
    if (!accessToken) return;
    setListsLoading(true);
    const ls = await api.contactLists.list(accessToken).catch(() => [] as ContactList[]);
    setLists(ls);
    setListsLoading(false);
  }, [accessToken]);

  useEffect(() => { void loadLists(); }, [loadLists]);

  useEffect(() => {
    if (tab === 'campaigns') void loadCampaigns();
    else if (tab === 'lists') void loadLists();
  }, [tab, loadCampaigns, loadLists]);

  // ── Campaign actions ───────────────────────────────────────────────────────
  const createCampaign = async () => {
    if (!accessToken || !form.name || !form.listId || form.messages.every((m) => !m.trim())) return;
    setSaving(true);
    try {
      const body: Parameters<typeof api.campaigns.create>[1] = {
        name: form.name,
        listId: form.listId,
        messages: form.messages.filter((m) => m.trim()).map((text) => ({ text })),
        recurrence: form.recurrence,
      };
      if (form.scheduledAt) body.scheduledAt = new Date(form.scheduledAt).toISOString();
      if (form.mediaUrl.trim()) { body.mediaUrl = form.mediaUrl.trim(); body.mediaType = form.mediaType; }
      await api.campaigns.create(accessToken, body);
      setShowCreate(false);
      setForm({ name: '', listId: '', messages: [''], scheduledAt: '', mediaUrl: '', mediaType: 'image', recurrence: 'once' });
      void loadCampaigns();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const launchCampaign = async (id: string) => {
    if (!accessToken) return;
    setActioning(id);
    await api.campaigns.launch(accessToken, id).catch(() => null);
    void loadCampaigns();
    setActioning(null);
  };

  const patchStatus = async (id: string, status: string) => {
    if (!accessToken) return;
    setActioning(id);
    await api.campaigns.patch(accessToken, id, { status }).catch(() => null);
    void loadCampaigns();
    setActioning(null);
  };

  const deleteCampaign = async (id: string) => {
    if (!accessToken || !confirm('¿Eliminar campaña?')) return;
    setActioning(id);
    await api.campaigns.delete(accessToken, id).catch(() => null);
    void loadCampaigns();
    setActioning(null);
  };

  const toggleLogs = async (id: string) => {
    if (expandedCamp === id) { setExpandedCamp(null); return; }
    setExpandedCamp(id);
    if (!campLogs[id] && accessToken) {
      const logs = await api.campaigns.logs(accessToken, id).catch(() => [] as CampaignLog[]);
      setCampLogs((prev) => ({ ...prev, [id]: logs }));
    }
  };

  const addMsg = () => { if (form.messages.length < 5) setForm((f) => ({ ...f, messages: [...f.messages, ''] })); };
  const setMsg = (i: number, v: string) => setForm((f) => ({ ...f, messages: f.messages.map((m, j) => j === i ? v : m) }));
  const removeMsg = (i: number) => setForm((f) => ({ ...f, messages: f.messages.filter((_, j) => j !== i) }));

  // ── List actions ───────────────────────────────────────────────────────────
  const createList = async () => {
    if (!accessToken || !newListName.trim()) return;
    setCreatingList(true);
    await api.contactLists.create(accessToken, { name: newListName.trim() }).catch(() => null);
    setNewListName('');
    void loadLists();
    setCreatingList(false);
  };

  const deleteList = async (id: string) => {
    if (!accessToken || !confirm('¿Eliminar lista y todos sus contactos?')) return;
    await api.contactLists.delete(accessToken, id).catch(() => null);
    void loadLists();
  };

  const toggleEntries = async (id: string) => {
    if (expandedList === id) { setExpandedList(null); return; }
    setExpandedList(id);
    if (!listEntries[id] && accessToken) {
      const entries = await api.contactLists.entries(accessToken, id).catch(() => [] as ContactEntry[]);
      setListEntries((prev) => ({ ...prev, [id]: entries }));
    }
  };

  const importCsv = async (listId: string, file: File) => {
    if (!accessToken) return;
    setImportingList(listId);
    const fd = new FormData();
    fd.append('file', file);
    await api.contactLists.importCsv(accessToken, listId, fd).catch(() => {});
    void loadLists();
    if (expandedList === listId) {
      const entries = await api.contactLists.entries(accessToken, listId).catch(() => [] as ContactEntry[]);
      setListEntries((prev) => ({ ...prev, [listId]: entries }));
    }
    setImportingList(null);
  };

  // ── Group actions ──────────────────────────────────────────────────────────
  const loadGroups = async () => {
    if (!accessToken) return;
    setGroupsLoading(true);
    const gs = await api.groups.list(accessToken).catch(() => [] as WaGroup[]);
    setGroups(gs);
    setGroupsLoading(false);
  };

  const sendToGroup = async () => {
    if (!accessToken || !sendGroupId || !groupText.trim()) return;
    setSendingGroup(true);
    await api.groups.sendMessage(accessToken, sendGroupId, groupText).catch(() => null);
    setSendGroupId(null);
    setGroupText('');
    setSendingGroup(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const card = { background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 18px' };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Campañas masivas</h1>
        {tab === 'campaigns' && (
          <button onClick={() => setShowCreate((v) => !v)} style={btn('#3b82f6')}>
            {showCreate ? '✕ Cancelar' : '+ Nueva campaña'}
          </button>
        )}
        {tab === 'groups' && (
          <button onClick={() => void loadGroups()} style={btn('#3b82f6')} disabled={groupsLoading}>
            {groupsLoading ? 'Cargando...' : 'Cargar grupos'}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['campaigns', 'lists', 'groups'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: 13,
            background: tab === t ? '#3b82f6' : 'transparent', color: tab === t ? '#fff' : 'inherit', fontWeight: tab === t ? 600 : 400,
          }}>
            {t === 'campaigns' ? 'Campañas' : t === 'lists' ? 'Listas de contactos' : 'Grupos WhatsApp'}
          </button>
        ))}
      </div>

      {/* ── TAB: Campañas ── */}
      {tab === 'campaigns' && (
        <>
          {/* Create form */}
          {showCreate && (
            <div style={{ ...card, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Nueva campaña</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre de la campaña" style={inp} />
                <select value={form.listId} onChange={(e) => setForm((f) => ({ ...f, listId: e.target.value }))} style={inp}>
                  <option value="">Seleccionar lista de contactos...</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.contactCount ?? 0} contactos)</option>)}
                </select>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.05em' }}>
                    MENSAJES (hasta 5 — se rotan aleatoriamente, soportan {'{{'}<span>variable</span>{'}}'})
                  </div>
                  {form.messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <textarea value={msg} onChange={(e) => setMsg(i, e.target.value)} rows={2}
                        placeholder={`Mensaje ${i + 1} — usa {{nombre}} para personalizar`}
                        style={{ ...inp, resize: 'none', fontFamily: 'inherit' }} />
                      {form.messages.length > 1 && (
                        <button onClick={() => removeMsg(i)} style={{ ...btn('transparent', '#ef4444'), border: '1px solid #ef4444', padding: '4px 10px', alignSelf: 'flex-start' }}>✕</button>
                      )}
                    </div>
                  ))}
                  {form.messages.length < 5 && (
                    <button onClick={addMsg} style={{ ...btn('transparent', 'inherit'), border: '1px solid var(--border-default)', fontSize: 12 }}>+ Agregar variante</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>URL de archivo adjunto (opcional)</label>
                    <input value={form.mediaUrl} onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))} placeholder="https://..." style={inp} />
                  </div>
                  {form.mediaUrl.trim() && (
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Tipo de archivo</label>
                      <select value={form.mediaType} onChange={(e) => setForm((f) => ({ ...f, mediaType: e.target.value }))} style={inp}>
                        <option value="image">Imagen</option>
                        <option value="video">Video</option>
                        <option value="document">Documento</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Recurrencia</label>
                    <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))} style={inp}>
                      <option value="once">Una vez</option>
                      <option value="daily">Diario</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Programar para (opcional)</label>
                    <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} style={inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button onClick={() => void createCampaign()} disabled={saving || !form.name || !form.listId} style={{ ...btn('#3b82f6'), opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Creando...' : 'Crear campaña'}
                  </button>
                  <button onClick={() => setShowCreate(false)} style={{ ...btn('transparent', 'inherit'), border: '1px solid var(--border-default)' }}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {campsLoading && <p style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>}
          {!campsLoading && campaigns.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No hay campañas. Crea una para empezar.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {campaigns.map((c) => {
              const pct = c.totalContacts ? Math.round(((c.sentCount ?? 0) / c.totalContacts) * 100) : 0;
              const isExpanded = expandedCamp === c.id;
              const logs = campLogs[c.id] ?? [];
              return (
                <div key={c.id} style={{ ...card, padding: 0 }}>
                  <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {c.scheduledAt ? `Programada: ${new Date(c.scheduledAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}` : 'Sin programar'}
                        {' · '}{RECURRENCE_LABELS[c.recurrence ?? 'once'] ?? c.recurrence}
                        {c.mediaUrl && ' · 📎 Adjunto'}
                      </div>
                      {(c.status === 'running' || c.status === 'done') && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>
                            <span>{c.sentCount ?? 0}/{c.totalContacts ?? 0} enviados</span>
                            <span>{pct}%</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--border-default)' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: '#22c55e', width: `${pct}%`, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[c.status ?? ''] ?? '#888', color: '#fff', whiteSpace: 'nowrap' }}>
                      {STATUS_LABELS[c.status ?? ''] ?? c.status}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'paused') && (
                        <button onClick={() => void launchCampaign(c.id)} disabled={actioning === c.id} style={btn('#22c55e')}>
                          {actioning === c.id ? '...' : 'Lanzar'}
                        </button>
                      )}
                      {c.status === 'running' && (
                        <button onClick={() => void patchStatus(c.id, 'paused')} disabled={actioning === c.id} style={btn('#8b5cf6')}>
                          Pausar
                        </button>
                      )}
                      {(c.status === 'running' || c.status === 'scheduled' || c.status === 'paused') && (
                        <button onClick={() => void patchStatus(c.id, 'cancelled')} disabled={actioning === c.id} style={{ ...btn('transparent', '#ef4444'), border: '1px solid #ef4444' }}>
                          Cancelar
                        </button>
                      )}
                      {(c.status === 'done' || c.status === 'draft' || c.status === 'cancelled') && (
                        <button onClick={() => void deleteCampaign(c.id)} disabled={actioning === c.id} style={{ ...btn('transparent', '#ef4444'), border: '1px solid #ef4444' }}>
                          Eliminar
                        </button>
                      )}
                      <button onClick={() => void toggleLogs(c.id)} style={{ ...btn('transparent', 'inherit'), border: '1px solid var(--border-default)' }}>
                        {isExpanded ? 'Ocultar log' : 'Ver log'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-default)', padding: '12px 18px' }}>
                      {logs.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Sin registros aún.</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ color: 'var(--text-tertiary)' }}>
                              {['Teléfono', 'Nombre', 'Variante', 'Estado', 'Enviado a'].map((h) => (
                                <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log) => (
                              <tr key={log.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{log.contactPhone}</td>
                                <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{log.contactName ?? '—'}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'center' }}>#{(log.messageIndex ?? 0) + 1}</td>
                                <td style={{ padding: '4px 8px' }}>
                                  <span style={{ padding: '2px 8px', borderRadius: 8, background: LOG_COLORS[log.status ?? ''] ?? '#888', color: '#fff', fontSize: 11 }}>
                                    {log.status}
                                  </span>
                                </td>
                                <td style={{ padding: '4px 8px', color: 'var(--text-tertiary)' }}>
                                  {log.sentAt ? new Date(log.sentAt).toLocaleTimeString('es-CO') : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── TAB: Listas ── */}
      {tab === 'lists' && (
        <>
          <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={newListName} onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void createList(); }}
              placeholder="Nombre de nueva lista..." style={{ ...inp, maxWidth: 320 }} />
            <button onClick={() => void createList()} disabled={creatingList || !newListName.trim()} style={btn('#3b82f6')}>
              {creatingList ? 'Creando...' : 'Crear lista'}
            </button>
          </div>

          {listsLoading && <p style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>}
          {!listsLoading && lists.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>Sin listas. Crea una para importar contactos.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lists.map((list) => {
              const isExp = expandedList === list.id;
              const entries = listEntries[list.id] ?? [];
              return (
                <div key={list.id} style={{ ...card, padding: 0 }}>
                  <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{list.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {list.contactCount ?? 0} contactos
                        {list.description ? ` · ${list.description}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { csvInputs.current[list.id]?.click(); }}
                        disabled={importingList === list.id}
                        style={{ ...btn('#f59e0b'), opacity: importingList === list.id ? 0.6 : 1 }}
                      >
                        {importingList === list.id ? 'Importando...' : '⬆ CSV'}
                      </button>
                      <input
                        type="file" accept=".csv,.txt" style={{ display: 'none' }}
                        ref={(el) => { csvInputs.current[list.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void importCsv(list.id, file);
                          e.target.value = '';
                        }}
                      />
                      <button onClick={() => void toggleEntries(list.id)} style={{ ...btn('transparent', 'inherit'), border: '1px solid var(--border-default)' }}>
                        {isExp ? 'Ocultar' : 'Ver contactos'}
                      </button>
                      <button onClick={() => void deleteList(list.id)} style={{ ...btn('transparent', '#ef4444'), border: '1px solid #ef4444' }}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                  {isExp && (
                    <div style={{ borderTop: '1px solid var(--border-default)', padding: '10px 18px' }}>
                      {entries.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                          Sin contactos. Importa un CSV con columna <code>phone</code> o <code>telefono</code>.
                        </p>
                      ) : (
                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ color: 'var(--text-tertiary)' }}>
                                {['Teléfono', 'Nombre'].map((h) => (
                                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {entries.slice(0, 200).map((e) => (
                                <tr key={e.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{e.phone}</td>
                                  <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{e.name ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {entries.length >= 200 && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '6px 8px 0', textAlign: 'center' }}>Mostrando 200 de {list.contactCount ?? entries.length}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── TAB: Grupos WA ── */}
      {tab === 'groups' && (
        <>
          {groupsLoading && <p style={{ color: 'var(--text-tertiary)' }}>Cargando grupos...</p>}
          {!groupsLoading && groups.length === 0 && (
            <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 16 }}>Presiona "Cargar grupos" para obtener tus grupos de WhatsApp</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Requiere WhatsApp conectado en Canales</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groups.map((g) => (
              <div key={g.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{g.subject}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {g.size} miembros{g.desc ? ` · ${g.desc}` : ''}
                  </div>
                </div>
                <button onClick={() => { setSendGroupId(g.id); setGroupText(''); }} style={btn('#3b82f6')}>
                  Enviar mensaje
                </button>
              </div>
            ))}
          </div>

          {/* Group send modal */}
          {sendGroupId && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
                  Enviar al grupo: {groups.find((g) => g.id === sendGroupId)?.subject}
                </h3>
                <textarea
                  value={groupText}
                  onChange={(e) => setGroupText(e.target.value)}
                  rows={5}
                  placeholder="Mensaje para el grupo... usa {{nombre}} si quieres"
                  style={{ ...inp, resize: 'none', fontFamily: 'inherit', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => void sendToGroup()} disabled={sendingGroup || !groupText.trim()} style={{ ...btn('#22c55e'), flex: 1, opacity: sendingGroup ? 0.6 : 1 }}>
                    {sendingGroup ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button onClick={() => setSendGroupId(null)} style={{ ...btn('transparent', 'inherit'), flex: 1, border: '1px solid var(--border-default)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

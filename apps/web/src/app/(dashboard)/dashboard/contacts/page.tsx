'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth';

interface ContactList { id: string; name: string; description: string | null; contactCount: number | null; createdAt: string; }
interface Entry { id: string; phone: string; name: string | null; }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function ContactsPage() {
  const { accessToken } = useAuthStore();
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch(`${API}/api/contact-lists`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) setLists(await res.json() as ContactList[]);
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const loadEntries = async (id: string) => {
    if (!accessToken) return;
    setSelected(id); setImportResult(null);
    const res = await fetch(`${API}/api/contact-lists/${id}/entries`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) setEntries(await res.json() as Entry[]);
  };

  const createList = async () => {
    if (!accessToken || !newName.trim()) return;
    await fetch(`${API}/api/contact-lists`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ name: newName.trim() }) });
    setNewName(''); setShowCreate(false); void load();
  };

  const deleteList = async (id: string) => {
    if (!accessToken) return;
    await fetch(`${API}/api/contact-lists/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    if (selected === id) { setSelected(null); setEntries([]); }
    void load();
  };

  const importCSV = async (file: File) => {
    if (!accessToken || !selected) return;
    setImporting(true); setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/api/contact-lists/${selected}/import-csv`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
      if (res.ok) {
        const result = await res.json() as { imported: number; total: number };
        setImportResult(result);
        void load();
        void loadEntries(selected);
      }
    } catch { /* ignore */ } finally { setImporting(false); }
  };

  return (
    <div style={{ padding: 24, display: 'flex', gap: 20, height: 'calc(100vh - 64px)' }}>
      {/* List panel */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Listas de contactos</h1>
          <button onClick={() => setShowCreate(true)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+</button>
        </div>

        {showCreate && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la lista" autoFocus
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 13 }}
              onKeyDown={(e) => { if (e.key === 'Enter') void createList(); if (e.key === 'Escape') setShowCreate(false); }} />
            <button onClick={() => void createList()} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>✓</button>
          </div>
        )}

        {lists.map((list) => (
          <div key={list.id} onClick={() => void loadEntries(list.id)} style={{
            padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            background: selected === list.id ? 'var(--accent)' : 'var(--card)',
            border: `1px solid ${selected === list.id ? 'var(--primary)' : 'var(--border)'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{list.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{list.contactCount ?? 0} contactos</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); void deleteList(list.id); }} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Entries panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)' }}>
            Selecciona una lista para ver los contactos
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{entries.length} contactos</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {importResult && <span style={{ fontSize: 12, color: '#22c55e' }}>✓ {importResult.imported}/{importResult.total} importados</span>}
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) void importCSV(e.target.files[0]); }} />
                <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: importing ? 0.6 : 1 }}>
                  {importing ? 'Importando...' : '📂 Importar CSV'}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10 }}>
              El CSV debe tener columnas: <code>phone</code> (requerido), <code>name</code> (opcional), variables adicionales para <code>{'{{variable}}'}</code>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Teléfono</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>{e.phone}</td>
                      <td style={{ padding: '8px 12px', color: e.name ? 'inherit' : 'var(--muted-foreground)' }}>{e.name ?? '—'}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={2} style={{ padding: '16px 12px', color: 'var(--muted-foreground)', textAlign: 'center' }}>Lista vacía. Importa un CSV para agregar contactos.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

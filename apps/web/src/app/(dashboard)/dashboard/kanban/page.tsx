'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useAuthStore } from '@/store/auth';
import { api, type KanbanColumn, type KanbanConversation } from '@/lib/api';

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬', instagram: '📸', facebook: '📘', tiktok: '🎵',
};

// ── Draggable card ────────────────────────────────────────────────────────────

function ConvCard({ conv, isDragging }: { conv: KanbanConversation; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: conv.id });
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        marginBottom: 8,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.2)' : undefined,
      }}
      {...listeners}
      {...attributes}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18 }}>{CHANNEL_ICONS[conv.channel] ?? '💬'}</span>
        {(conv.unreadCount ?? 0) > 0 && (
          <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
            {conv.unreadCount}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
      </div>
    </div>
  );
}

// ── Droppable column ──────────────────────────────────────────────────────────

function KanbanColumnUI({ col, convs, activeId }: { col: KanbanColumn; convs: KanbanConversation[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        width: 220,
        flexShrink: 0,
        background: isOver ? 'var(--accent)' : 'var(--card)',
        border: `2px solid ${isOver ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: 12,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: col.color ?? '#6366f1', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{col.name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--accent)', borderRadius: 10, padding: '1px 7px' }}>
          {convs.length}
        </span>
      </div>
      <div style={{ minHeight: 60 }}>
        {convs.map((conv) => (
          <ConvCard key={conv.id} conv={conv} isDragging={activeId === conv.id} />
        ))}
      </div>
    </div>
  );
}

// ── Unassigned column (droppable but not a real column) ───────────────────────

function UnassignedColumn({ convs, activeId }: { convs: KanbanConversation[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });
  return (
    <div
      ref={setNodeRef}
      style={{
        width: 220, flexShrink: 0,
        background: isOver ? 'var(--accent)' : 'var(--card)',
        border: `2px dashed ${isOver ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 12, padding: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--muted-foreground)' }}>
        Sin columna ({convs.length})
      </div>
      {convs.map((conv) => (
        <ConvCard key={conv.id} conv={conv} isDragging={activeId === conv.id} />
      ))}
    </div>
  );
}

// ── New column modal ──────────────────────────────────────────────────────────

function NewColumnModal({ onClose, onCreated, token }: { onClose: () => void; onCreated: () => void; token: string }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.kanban.createColumn(token, { name: name.trim(), color });
      onCreated();
      onClose();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, width: 320, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Nueva columna</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la columna"
          autoFocus
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>Color:</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 32, border: 'none', cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={() => void submit()} disabled={saving || !name.trim()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const { accessToken } = useAuthStore();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [unassigned, setUnassigned] = useState<KanbanConversation[]>([]);
  const [convsByColumn, setConvsByColumn] = useState<Map<string, KanbanConversation[]>>(new Map());
  const [activeConv, setActiveConv] = useState<KanbanConversation | null>(null);
  const [showNewCol, setShowNewCol] = useState(false);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadBoard = useCallback(async () => {
    if (!accessToken) return;
    try {
      const board = await api.kanban.board(accessToken);
      setColumns(board.columns);
      setUnassigned(board.unassigned);
      const map = new Map<string, KanbanConversation[]>();
      for (const col of board.columns) {
        map.set(col.id, col.conversations ?? []);
      }
      setConvsByColumn(map);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    const all = [...unassigned, ...[...convsByColumn.values()].flat()];
    setActiveConv(all.find((c) => c.id === id) ?? null);
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveConv(null);
    if (!over || !accessToken) return;
    const convId = String(active.id);
    const targetColId = String(over.id);
    if (targetColId === 'unassigned') return; // can't drag back to unassigned for now

    try {
      await api.kanban.move(accessToken, { conversationId: convId, columnId: targetColId });
      await loadBoard();
    } catch { /* ignore */ }
  };

  const allConvs = [...unassigned, ...[...convsByColumn.values()].flat()];

  return (
    <div style={{ padding: 24, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Kanban</h1>
        <button
          onClick={() => setShowNewCol(true)}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
        >
          + Nueva columna
        </button>
      </div>

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Cargando tablero...</p>}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={(e) => void onDragEnd(e)}>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', flex: 1, paddingBottom: 16, alignItems: 'flex-start' }}>
          <UnassignedColumn convs={unassigned} activeId={activeConv?.id ?? null} />
          {columns.map((col) => (
            <KanbanColumnUI
              key={col.id}
              col={col}
              convs={convsByColumn.get(col.id) ?? []}
              activeId={activeConv?.id ?? null}
            />
          ))}
        </div>

        <DragOverlay>
          {activeConv && (
            <div style={{
              background: 'var(--background)', border: '1px solid var(--primary)',
              borderRadius: 8, padding: '10px 12px', width: 196, boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            }}>
              <span style={{ fontSize: 18 }}>{CHANNEL_ICONS[activeConv.channel] ?? '💬'}</span>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
                {activeConv.lastMessageAt ? new Date(activeConv.lastMessageAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showNewCol && accessToken && (
        <NewColumnModal
          token={accessToken}
          onClose={() => setShowNewCol(false)}
          onCreated={() => void loadBoard()}
        />
      )}
    </div>
  );
}

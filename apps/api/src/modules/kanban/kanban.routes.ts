import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, kanbanColumns, conversations, eq, and, asc } from '@saas/db';

const createColumnSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
  isFinal: z.boolean().optional(),
});

const patchColumnSchema = createColumnSchema.partial();

const moveConversationSchema = z.object({
  conversationId: z.string().uuid(),
  columnId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
});

const kanbanRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Columns ──────────────────────────────────────────────────────────────

  fastify.get('/columns', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    return db
      .select()
      .from(kanbanColumns)
      .where(eq(kanbanColumns.tenantId, tenantId))
      .orderBy(asc(kanbanColumns.sortOrder));
  });

  fastify.post('/columns', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = createColumnSchema.parse(request.body);

    const [col] = await db.insert(kanbanColumns).values({
      tenantId,
      name: data.name,
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isFinal !== undefined ? { isFinal: data.isFinal } : {}),
    }).returning();

    return reply.status(201).send(col);
  });

  fastify.patch('/columns/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchColumnSchema.parse(request.body);

    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set['name'] = data.name;
    if (data.color !== undefined) set['color'] = data.color;
    if (data.sortOrder !== undefined) set['sortOrder'] = data.sortOrder;
    if (data.isFinal !== undefined) set['isFinal'] = data.isFinal;

    const [updated] = await db
      .update(kanbanColumns)
      .set(set)
      .where(and(eq(kanbanColumns.id, id), eq(kanbanColumns.tenantId, tenantId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Columna no encontrada', code: 'NOT_FOUND' });
    return updated;
  });

  fastify.delete('/columns/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };

    const [deleted] = await db
      .delete(kanbanColumns)
      .where(and(eq(kanbanColumns.id, id), eq(kanbanColumns.tenantId, tenantId)))
      .returning({ id: kanbanColumns.id });

    if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Columna no encontrada', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });

  // ── Board state ───────────────────────────────────────────────────────────

  fastify.get('/board', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;

    const [cols, convs] = await Promise.all([
      db.select().from(kanbanColumns).where(eq(kanbanColumns.tenantId, tenantId)).orderBy(asc(kanbanColumns.sortOrder)),
      db.select({
        id: conversations.id,
        customerId: conversations.customerId,
        channel: conversations.channel,
        status: conversations.status,
        assignedUserId: conversations.assignedUserId,
        kanbanColumnId: conversations.kanbanColumnId,
        unreadCount: conversations.unreadCount,
        lastMessageAt: conversations.lastMessageAt,
      }).from(conversations).where(and(eq(conversations.tenantId, tenantId), eq(conversations.status, 'open'))),
    ]);

    return {
      columns: cols.map((col) => ({
        ...col,
        conversations: convs.filter((c) => c.kanbanColumnId === col.id),
      })),
      unassigned: convs.filter((c) => !c.kanbanColumnId),
    };
  });

  // ── Move conversation ─────────────────────────────────────────────────────

  fastify.post('/move', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = moveConversationSchema.parse(request.body);

    const set: Record<string, unknown> = {
      kanbanColumnId: data.columnId,
      kanbanMovedAt: new Date(),
      updatedAt: new Date(),
    };
    if (data.assignedUserId !== undefined) set['assignedUserId'] = data.assignedUserId;

    const [updated] = await db
      .update(conversations)
      .set(set)
      .where(and(eq(conversations.id, data.conversationId), eq(conversations.tenantId, tenantId)))
      .returning({ id: conversations.id, kanbanColumnId: conversations.kanbanColumnId });

    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Conversación no encontrada', code: 'NOT_FOUND' });
    return updated;
  });
};

export default kanbanRoutes;

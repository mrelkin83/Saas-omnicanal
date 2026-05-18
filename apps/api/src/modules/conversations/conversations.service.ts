import { db, conversations, messages, conversationState, customers, eq, and, desc } from '@saas/db';
import type { PatchConversationInput, CreateMessageInput } from './conversations.schemas.js';

export async function listConversations(tenantId: string, opts: { status?: string; limit?: number } = {}) {
  const conditions = [eq(conversations.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(conversations.status, opts.status));

  return db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(opts.limit ?? 50);
}

export async function getConversationById(tenantId: string, id: string) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
  if (!conv) return null;

  const msgs = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, id), eq(messages.tenantId, tenantId)))
    .orderBy(messages.createdAt)
    .limit(100);

  return { ...conv, messages: msgs };
}

export async function updateConversation(tenantId: string, id: string, data: PatchConversationInput) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.status !== undefined) set['status'] = data.status;
  if (data.assignedUserId !== undefined) set['assignedUserId'] = data.assignedUserId;
  if (data.departmentId !== undefined) set['departmentId'] = data.departmentId;
  if (data.kanbanColumnId !== undefined) set['kanbanColumnId'] = data.kanbanColumnId;
  if (data.potentialValue !== undefined) set['potentialValue'] = String(data.potentialValue);

  const [conv] = await db
    .update(conversations)
    .set(set)
    .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)))
    .returning();
  return conv ?? null;
}

export async function addMessage(tenantId: string, conversationId: string, userId: string, data: CreateMessageInput) {
  const [conv] = await db
    .select({ customerId: conversations.customerId })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));

  if (!conv) return null;

  const [msg] = await db
    .insert(messages)
    .values({
      tenantId,
      conversationId,
      customerId: conv.customerId,
      direction: 'outbound',
      senderType: 'agent',
      senderUserId: userId,
      type: data.type,
      content: data.content,
      mediaUrl: data.mediaUrl,
    })
    .returning();

  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return msg!;
}

export async function setAIState(tenantId: string, conversationId: string, state: 'IA_ACTIVA' | 'AGENTE_ACTIVO') {
  const [conv] = await db
    .select({ customerId: conversations.customerId, channel: conversations.channel })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));

  if (!conv) return null;

  await db
    .insert(conversationState)
    .values({ tenantId, customerId: conv.customerId, channel: conv.channel, state })
    .onConflictDoUpdate({
      target: [conversationState.tenantId, conversationState.customerId, conversationState.channel],
      set: { state, updatedAt: new Date() },
    });

  return { state };
}

export async function getAIState(tenantId: string, conversationId: string) {
  const [conv] = await db
    .select({ customerId: conversations.customerId, channel: conversations.channel })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));

  if (!conv) return null;

  const [row] = await db
    .select({ state: conversationState.state })
    .from(conversationState)
    .where(and(
      eq(conversationState.tenantId, tenantId),
      eq(conversationState.customerId, conv.customerId),
      eq(conversationState.channel, conv.channel),
    ));

  return { state: row?.state ?? 'IA_ACTIVA' };
}

export async function listConversationsWithCustomer(tenantId: string, opts: { status?: string; channel?: string; limit?: number } = {}) {
  const conditions = [eq(conversations.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(conversations.status, opts.status));
  if (opts.channel) conditions.push(eq(conversations.channel, opts.channel));

  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      status: conversations.status,
      unreadCount: conversations.unreadCount,
      lastMessageAt: conversations.lastMessageAt,
      customerId: conversations.customerId,
      customerName: customers.displayName,
      customerPhone: customers.phone,
    })
    .from(conversations)
    .leftJoin(customers, eq(customers.id, conversations.customerId))
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(opts.limit ?? 50);

  return rows;
}

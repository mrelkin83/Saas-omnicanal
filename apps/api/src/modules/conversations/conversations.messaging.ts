import { db, conversations, messages, customers, channelSessions, eq, and, ilike, sql } from '@saas/db';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('57') && digits.length === 12) return digits;
  if (digits.startsWith('3') && digits.length === 10) return '57' + digits;
  return phone;
}

export async function findOrCreateCustomer(tenantId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const [existing] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), ilike(customers.phone, normalizedPhone)));

  if (existing) return existing;

  const [created] = await db
    .insert(customers)
    .values({ tenantId, phone: normalizedPhone, displayName: normalizedPhone })
    .returning();
  return created!;
}

export async function findOrCreateConversation(
  tenantId: string,
  customerId: string,
  channel: string,
  channelSessionId: string | null,
) {
  const conditions = [
    eq(conversations.tenantId, tenantId),
    eq(conversations.customerId, customerId),
    eq(conversations.channel, channel),
  ];

  const sessionConditions = [eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, channel)];
  let resolvedSessionId = channelSessionId;
  if (!resolvedSessionId) {
    const [session] = await db.select({ id: channelSessions.id }).from(channelSessions).where(and(...sessionConditions));
    resolvedSessionId = session?.id ?? null;
  }

  const [created] = await db
    .insert(conversations)
    .values({
      tenantId,
      customerId,
      channel,
      channelSessionId: resolvedSessionId,
      status: 'open',
      lastMessageAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .limit(1);
  return existing!;
}

export async function saveInboundMessage(
  tenantId: string,
  conversationId: string,
  customerId: string,
  text: string,
  externalId?: string,
) {
  const [msg] = await db
    .insert(messages)
    .values({
      tenantId,
      conversationId,
      customerId,
      direction: 'inbound',
      senderType: 'customer',
      type: 'text',
      content: text,
      externalId,
    })
    .returning();

  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), unreadCount: sql`${conversations.unreadCount} + 1`, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return msg!;
}

export async function saveOutboundMessage(
  tenantId: string,
  conversationId: string,
  customerId: string,
  text: string,
  externalId?: string,
) {
  const [msg] = await db
    .insert(messages)
    .values({
      tenantId,
      conversationId,
      customerId,
      direction: 'outbound',
      senderType: 'ai',
      type: 'text',
      content: text,
      externalId,
    })
    .returning();

  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return msg!;
}

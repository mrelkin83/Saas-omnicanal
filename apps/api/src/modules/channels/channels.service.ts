import { db, channelSessions, eq, and } from '@saas/db';

export async function getActiveSession(tenantId: string, channel: string) {
  const [session] = await db
    .select()
    .from(channelSessions)
    .where(and(eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, channel)));
  return session ?? null;
}

export async function upsertSession(tenantId: string, channel: string, externalId: string, status: string, displayName?: string) {
  const existing = await getActiveSession(tenantId, channel);
  if (existing) {
    const [updated] = await db
      .update(channelSessions)
      .set({
        externalId,
        status,
        ...(displayName !== undefined ? { displayName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(channelSessions.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(channelSessions)
    .values({ tenantId, channel, externalId, status, displayName })
    .returning();
  return created!;
}

export async function updateSessionStatus(tenantId: string, channel: string, status: string, displayName?: string) {
  const set: Record<string, unknown> = { status, updatedAt: new Date() };
  if (displayName !== undefined) set['displayName'] = displayName;
  if (status === 'connected') set['lastSeenAt'] = new Date();

  const [updated] = await db
    .update(channelSessions)
    .set(set)
    .where(and(eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, channel)))
    .returning();
  return updated ?? null;
}

export async function deleteSession(tenantId: string, sessionId: string) {
  const [deleted] = await db
    .delete(channelSessions)
    .where(and(eq(channelSessions.id, sessionId), eq(channelSessions.tenantId, tenantId)))
    .returning({ id: channelSessions.id });
  return deleted ?? null;
}

import { db, conversationState, eq, and } from '@saas/db';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const WINDOW = 10;

export async function getHistory(tenantId: string, customerId: string, channel: string): Promise<HistoryMessage[]> {
  const [row] = await db
    .select({ historial: conversationState.historial })
    .from(conversationState)
    .where(and(eq(conversationState.tenantId, tenantId), eq(conversationState.customerId, customerId), eq(conversationState.channel, channel)));

  if (!row) return [];
  return (row.historial as HistoryMessage[]).slice(-WINDOW);
}

export async function appendHistory(
  tenantId: string,
  customerId: string,
  channel: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  const existing = await getHistory(tenantId, customerId, channel);
  const entry: HistoryMessage = { role, content, timestamp: new Date().toISOString() };
  const updated = [...existing, entry].slice(-WINDOW);

  await db
    .insert(conversationState)
    .values({ tenantId, customerId, channel, historial: updated })
    .onConflictDoUpdate({
      target: [conversationState.tenantId, conversationState.customerId, conversationState.channel],
      set: { historial: updated, updatedAt: new Date() },
    });
}

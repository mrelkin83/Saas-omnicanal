import { db, conversationState, eq, and, sql } from '@saas/db';

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
  const entry: HistoryMessage = { role, content, timestamp: new Date().toISOString() };

  await db
    .insert(conversationState)
    .values({ tenantId, customerId, channel, historial: [entry] })
    .onConflictDoUpdate({
      target: [conversationState.tenantId, conversationState.customerId, conversationState.channel],
      set: {
        historial: sql`jsonb_path_query_array(
          coalesce(${conversationState.historial}, '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb,
          ${`$[-${WINDOW} to last]`}
        )`,
        updatedAt: new Date(),
      },
    });
}

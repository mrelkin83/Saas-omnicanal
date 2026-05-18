import { db, users, departmentMembers, conversations, eq, and, ne, count } from '@saas/db';

export async function assignRoundRobin(tenantId: string, departmentId?: string): Promise<string | null> {
  // Get available agents for this tenant (or department)
  let candidates: { userId: string }[] = [];

  if (departmentId) {
    candidates = await db
      .select({ userId: departmentMembers.userId })
      .from(departmentMembers)
      .innerJoin(users, eq(users.id, departmentMembers.userId))
      .where(
        and(
          eq(departmentMembers.departmentId, departmentId),
          eq(users.agentStatus, 'available'),
          eq(users.isActive, true),
          eq(users.tenantId, tenantId),
        ),
      );
  } else {
    const agentRows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.agentStatus, 'available'),
        eq(users.isActive, true),
        ne(users.role, 'owner'),
      ));
    candidates = agentRows.map((r) => ({ userId: r.id }));
  }

  if (candidates.length === 0) return null;

  // Pick agent with fewest open assigned conversations
  const openCounts = await db
    .select({
      assignedUserId: conversations.assignedUserId,
      total: count(),
    })
    .from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.status, 'open')))
    .groupBy(conversations.assignedUserId);

  const countMap = new Map<string, number>();
  for (const row of openCounts) {
    if (row.assignedUserId) countMap.set(row.assignedUserId, Number(row.total));
  }

  let bestAgent = candidates[0]!.userId;
  let bestCount = countMap.get(bestAgent) ?? 0;

  for (const { userId } of candidates.slice(1)) {
    const c = countMap.get(userId) ?? 0;
    if (c < bestCount) { bestAgent = userId; bestCount = c; }
  }

  // Also respect maxConcurrentChats
  const [agentUser] = await db
    .select({ maxConcurrentChats: users.maxConcurrentChats })
    .from(users)
    .where(eq(users.id, bestAgent));

  const max = agentUser?.maxConcurrentChats ?? 5;
  if (bestCount >= max) return null; // all agents at capacity

  return bestAgent;
}

import { db, saasAuditLogs } from '@saas/db';

export async function logAudit(
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, unknown>,
  ip?: string,
): Promise<void> {
  await db.insert(saasAuditLogs).values({
    adminId,
    action,
    targetType,
    targetId: targetId ?? undefined,
    details,
    ipAddress: ip ?? null,
  });
}

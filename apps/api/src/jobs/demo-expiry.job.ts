import { db, tenants, and, eq, lte, isNull, isNotNull } from '@saas/db';

let timer: ReturnType<typeof setInterval> | null = null;

async function checkExpiredDemos(): Promise<void> {
  try {
    const now = new Date();
    await db
      .update(tenants)
      .set({ suspendedAt: now, suspendedReason: 'Demo vencida', updatedAt: now })
      .where(
        and(
          eq(tenants.isDemo, true),
          isNotNull(tenants.demoExpiresAt),
          lte(tenants.demoExpiresAt, now),
          isNull(tenants.suspendedAt),
        ),
      );
  } catch {
    // DB tables may not exist yet (migrations pending) — retry on next interval
  }
}

export function startDemoExpiryJob(): void {
  if (timer) return;
  void checkExpiredDemos();
  timer = setInterval(() => { void checkExpiredDemos(); }, 60 * 60 * 1000);
}

export async function stopDemoExpiryJob(): Promise<void> {
  if (timer) { clearInterval(timer); timer = null; }
}

import { db, subscriptions, tenants, saasPlans, users, conversations, eq, and, sql, count } from '@saas/db';

interface PlanLimits {
  maxTeamMembers?: number;
  maxConversationsPerMonth?: number;
  maxAiMessagesPerMonth?: number;
  maxCampaignsPerMonth?: number;
  capabilities?: string[];
}

export async function getActiveSubscription(tenantId: string) {
  const [sub] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      planId: subscriptions.planId,
      amount: subscriptions.amount,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      planLimits: saasPlans.limits,
      planName: saasPlans.name,
    })
    .from(subscriptions)
    .innerJoin(saasPlans, eq(subscriptions.planId, saasPlans.id))
    .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')))
    .limit(1);
  return sub ?? null;
}

export async function enforceTeamMemberLimit(tenantId: string): Promise<boolean> {
  const sub = await getActiveSubscription(tenantId);
  if (!sub) return true;

  const limits = sub.planLimits as PlanLimits | null;
  const maxMembers = limits?.maxTeamMembers;
  if (!maxMembers) return true;

  const [row] = await db.select({ count: count() }).from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

  return (row?.count ?? 0) < maxMembers;
}

export async function enforceConversationLimit(tenantId: string): Promise<boolean> {
  const sub = await getActiveSubscription(tenantId);
  if (!sub) return true;

  const limits = sub.planLimits as PlanLimits | null;
  const maxConv = limits?.maxConversationsPerMonth;
  if (!maxConv) return true;

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const [row] = await db.select({ count: count() }).from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), sql`${conversations.createdAt} >= ${periodStart}`));

  return (row?.count ?? 0) < maxConv;
}

export async function getTenantCapabilities(tenantId: string): Promise<string[]> {
  const [tenant] = await db.select({ capabilities: tenants.capabilities }).from(tenants).where(eq(tenants.id, tenantId));
  const sub = await getActiveSubscription(tenantId);

  const tenantCaps = tenant?.capabilities ?? [];
  if (!sub) return tenantCaps;

  const limits = sub.planLimits as PlanLimits | null;
  const planCaps = limits?.capabilities;

  if (!planCaps || planCaps.length === 0) return tenantCaps;

  return tenantCaps.filter((cap) => planCaps.includes(cap));
}

export async function checkAndSuspendExpiredSubscriptions(): Promise<number> {
  const now = new Date();

  const expired = await db
    .select({ id: subscriptions.id, tenantId: subscriptions.tenantId })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'active'), sql`${subscriptions.currentPeriodEnd} < ${now}`));

  for (const sub of expired) {
    await db.update(subscriptions).set({ status: 'past_due', updatedAt: now }).where(eq(subscriptions.id, sub.id));

    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);
    const [subData] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    if (subData && new Date(subData.currentPeriodEnd) < new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)) {
      await db.update(tenants).set({ suspendedAt: now, suspendedReason: 'Suscripción vencida', updatedAt: now }).where(eq(tenants.id, sub.tenantId));
    }
  }

  return expired.length;
}

export async function createSubscriptionOnRegistration(tenantId: string, planSlug: string): Promise<void> {
  const [plan] = await db.select().from(saasPlans).where(and(eq(saasPlans.slug, planSlug), eq(saasPlans.isActive, true))).limit(1);
  if (!plan) return;

  const now = new Date();
  const periodEnd = new Date(now);
  if (plan.billingCycle === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  await db.insert(subscriptions).values({
    tenantId,
    planId: plan.id,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    amount: plan.priceCop,
    currency: 'COP',
    billingCycle: plan.billingCycle ?? 'monthly',
  });

  await db.update(tenants).set({ planId: plan.id, mrr: plan.priceCop }).where(eq(tenants.id, tenantId));
}

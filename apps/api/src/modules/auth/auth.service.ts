import bcrypt from 'bcryptjs';
import { db, users, tenants, saasPlans, subscriptions, eq, or } from '@saas/db';
import type { RegisterTenantInput } from './auth.schemas.js';

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email),
    with: { tenant: false },
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function registerTenant(input: RegisterTenantInput) {
  const slug = input.tenantName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const plan = await db.query.saasPlans.findFirst({
    where: or(eq(saasPlans.id, input.plan), eq(saasPlans.slug, input.plan)),
  });

  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.tenantName,
        slug: `${slug}-${Date.now()}`,
        businessType: input.businessType,
        capabilities: [],
        planId: plan?.id,
        aiModel: 'gpt-4o-mini',
      })
      .returning();

    if (!tenant) throw new Error('Failed to create tenant');

    const passwordHash = await hashPassword(input.ownerPassword);
    const [user] = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: input.ownerEmail,
        passwordHash,
        fullName: input.ownerName,
        role: 'owner',
        isActive: true,
      })
      .returning();

    if (!user) throw new Error('Failed to create owner user');

    if (plan) {
      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      await tx.insert(subscriptions).values({
        tenantId: tenant.id,
        planId: plan.id,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        amount: plan.priceCop,
        currency: 'COP',
        billingCycle: plan.billingCycle ?? 'monthly',
      });
    }

    return { tenant, user };
  });
}

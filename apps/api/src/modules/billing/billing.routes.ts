import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, subscriptions, saasPlans, eq, and, desc } from '@saas/db';

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/current', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;

    const [sub] = await db
      .select({
        id: subscriptions.id,
        status: subscriptions.status,
        planId: subscriptions.planId,
        amount: subscriptions.amount,
        currency: subscriptions.currency,
        billingCycle: subscriptions.billingCycle,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        trialEnd: subscriptions.trialEnd,
        planName: saasPlans.name,
        planLimits: saasPlans.limits,
      })
      .from(subscriptions)
      .innerJoin(saasPlans, eq(subscriptions.planId, saasPlans.id))
      .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return sub ?? { status: 'none' };
  });
};

export default billingRoutes;

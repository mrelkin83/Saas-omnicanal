import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, conversations, messages, orders, appointments, payments, eq, and, gte, count, sum } from '@saas/db';

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const start = todayStart();

    const [
      convsToday,
      ordersToday,
      apptToday,
      revenueToday,
      pendingOrders,
      channelRows,
      totalConvs,
      escalatedConvs,
    ] = await Promise.all([
      // Conversations created today
      db.select({ n: count() }).from(conversations)
        .where(and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, start)))
        .then((r) => r[0]?.n ?? 0),

      // Orders created today
      db.select({ n: count() }).from(orders)
        .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, start)))
        .then((r) => r[0]?.n ?? 0),

      // Appointments today
      db.select({ n: count() }).from(appointments)
        .where(and(eq(appointments.tenantId, tenantId), gte(appointments.createdAt, start)))
        .then((r) => r[0]?.n ?? 0),

      // Revenue today (paid payments)
      db.select({ total: sum(payments.amount) }).from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.status, 'paid'), gte(payments.paidAt, start)))
        .then((r) => Number(r[0]?.total ?? 0)),

      // Pending orders (need action)
      db.select({ n: count() }).from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.status, 'pending')))
        .then((r) => r[0]?.n ?? 0),

      // Channel breakdown today
      db.select({ channel: conversations.channel, n: count() }).from(conversations)
        .where(and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, start)))
        .groupBy(conversations.channel)
        .then((rows) => {
          const breakdown: Record<string, number> = {};
          for (const r of rows) breakdown[r.channel] = Number(r.n);
          return breakdown;
        }),

      // Total conversations for AI% calc (last 7 days)
      db.select({ n: count() }).from(messages)
        .where(and(
          eq(messages.tenantId, tenantId),
          eq(messages.senderType, 'ai'),
          gte(messages.createdAt, new Date(Date.now() - 7 * 86400_000)),
        ))
        .then((r) => Number(r[0]?.n ?? 0)),

      // Escalated (agent messages last 7 days)
      db.select({ n: count() }).from(messages)
        .where(and(
          eq(messages.tenantId, tenantId),
          eq(messages.senderType, 'agent'),
          gte(messages.createdAt, new Date(Date.now() - 7 * 86400_000)),
        ))
        .then((r) => Number(r[0]?.n ?? 0)),
    ]);

    const totalHandled = totalConvs + escalatedConvs;
    const aiHandledPct = totalHandled > 0 ? Math.round((totalConvs / totalHandled) * 100) : 100;

    return {
      conversationsToday: Number(convsToday),
      aiHandledPct,
      ordersToday: Number(ordersToday),
      revenueToday: Math.round(revenueToday),
      appointmentsToday: Number(apptToday),
      pendingOrders: Number(pendingOrders),
      channelBreakdown: channelRows,
    };
  });
};

export default analyticsRoutes;

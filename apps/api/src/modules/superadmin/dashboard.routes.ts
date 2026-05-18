import type { FastifyPluginAsync } from 'fastify';
import { requireSuperAdmin } from '../../middleware/require-superadmin.js';
import { db, tenants, users, saasResellers, eq, count, sum, isNull, isNotNull } from '@saas/db';

const superadminDashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async () => {
    const [totalTenantsRow] = await db.select({ count: count() }).from(tenants);
    const [activeDemosRow] = await db.select({ count: count() })
      .from(tenants)
      .where(eq(tenants.isDemo, true));
    const [suspendedRow] = await db.select({ count: count() })
      .from(tenants)
      .where(isNotNull(tenants.suspendedAt));
    const [mrrRow] = await db.select({ total: sum(tenants.mrr) }).from(tenants).where(isNull(tenants.suspendedAt));
    const [totalUsersRow] = await db.select({ count: count() }).from(users);
    const [totalResellersRow] = await db.select({ count: count() }).from(saasResellers);

    return {
      totalTenants: Number(totalTenantsRow?.count ?? 0),
      activeDemos: Number(activeDemosRow?.count ?? 0),
      suspended: Number(suspendedRow?.count ?? 0),
      mrr: parseFloat(String(mrrRow?.total ?? '0')),
      totalUsers: Number(totalUsersRow?.count ?? 0),
      totalResellers: Number(totalResellersRow?.count ?? 0),
    };
  });
};

export default superadminDashboardRoutes;

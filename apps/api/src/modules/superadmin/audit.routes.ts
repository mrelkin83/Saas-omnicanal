import type { FastifyPluginAsync } from 'fastify';
import { requireSuperAdmin } from '../../middleware/require-superadmin.js';
import { db, saasAuditLogs, superadminUsers, eq, desc } from '@saas/db';

const superadminAuditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async (request) => {
    const { limit = '50', offset = '0', action } = request.query as Record<string, string | undefined>;

    const rows = await db
      .select({
        id: saasAuditLogs.id,
        action: saasAuditLogs.action,
        targetType: saasAuditLogs.targetType,
        targetId: saasAuditLogs.targetId,
        details: saasAuditLogs.details,
        ipAddress: saasAuditLogs.ipAddress,
        createdAt: saasAuditLogs.createdAt,
        adminId: saasAuditLogs.adminId,
        adminEmail: superadminUsers.email,
        adminName: superadminUsers.fullName,
      })
      .from(saasAuditLogs)
      .leftJoin(superadminUsers, eq(saasAuditLogs.adminId, superadminUsers.id))
      .where(action ? eq(saasAuditLogs.action, action) : undefined)
      .orderBy(desc(saasAuditLogs.createdAt))
      .limit(parseInt(limit, 10))
      .offset(parseInt(offset, 10));

    return rows;
  });
};

export default superadminAuditRoutes;

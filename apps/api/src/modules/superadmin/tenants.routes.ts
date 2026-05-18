import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireSuperAdmin } from '../../middleware/require-superadmin.js';
import { db, tenants, users, eq, desc } from '@saas/db';
import { logAudit } from './audit-helper.js';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  planId: z.string().uuid().optional(),
  resellerId: z.string().uuid().optional(),
  billingEmail: z.string().email().optional(),
  isDemo: z.boolean().optional(),
  demoExpiresAt: z.string().datetime().optional(),
  mrr: z.number().nonnegative().optional(),
}).strict();

const superadminTenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async (request) => {
    const { search } = request.query as { search?: string };
    const all = await db
      .select({
        id: tenants.id, name: tenants.name, slug: tenants.slug,
        businessType: tenants.businessType, planId: tenants.planId,
        isDemo: tenants.isDemo, demoExpiresAt: tenants.demoExpiresAt,
        suspendedAt: tenants.suspendedAt, mrr: tenants.mrr,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    if (search) {
      const q = search.toLowerCase();
      return all.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return all;
  });

  fastify.get('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!tenant) return reply.status(404).send({ error: 'Not Found', message: 'Tenant no encontrado', code: 'NOT_FOUND' });
    const tenantUsers = await db.select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role }).from(users).where(eq(users.tenantId, id));
    return { ...tenant, users: tenantUsers };
  });

  fastify.patch('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;
    const data = patchSchema.parse(request.body);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) set['name'] = data.name;
    if (data.planId !== undefined) set['planId'] = data.planId;
    if (data.resellerId !== undefined) set['resellerId'] = data.resellerId;
    if (data.billingEmail !== undefined) set['billingEmail'] = data.billingEmail;
    if (data.isDemo !== undefined) set['isDemo'] = data.isDemo;
    if (data.demoExpiresAt !== undefined) set['demoExpiresAt'] = new Date(data.demoExpiresAt);
    if (data.mrr !== undefined) set['mrr'] = String(data.mrr);

    const [updated] = await db.update(tenants).set(set).where(eq(tenants.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Tenant no encontrado', code: 'NOT_FOUND' });

    await logAudit(adminId, 'PATCH_TENANT', 'tenant', id, data, request.ip);
    return updated;
  });

  fastify.post('/:id/suspend', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;
    const { reason } = (request.body ?? {}) as { reason?: string };

    const [updated] = await db.update(tenants)
      .set({ suspendedAt: new Date(), suspendedReason: reason ?? 'Suspendido por superadmin', updatedAt: new Date() })
      .where(eq(tenants.id, id)).returning({ id: tenants.id });
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Tenant no encontrado', code: 'NOT_FOUND' });

    await logAudit(adminId, 'SUSPEND_TENANT', 'tenant', id, { reason }, request.ip);
    return { ok: true };
  });

  fastify.post('/:id/unsuspend', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;

    const [updated] = await db.update(tenants)
      .set({ suspendedAt: null, suspendedReason: null, updatedAt: new Date() })
      .where(eq(tenants.id, id)).returning({ id: tenants.id });
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Tenant no encontrado', code: 'NOT_FOUND' });

    await logAudit(adminId, 'UNSUSPEND_TENANT', 'tenant', id, {}, request.ip);
    return { ok: true };
  });

  fastify.post('/:id/impersonate', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;

    const [owner] = await db.select().from(users)
      .where(eq(users.tenantId, id))
      .orderBy(users.createdAt)
      .limit(1);

    if (!owner) return reply.status(404).send({ error: 'Not Found', message: 'No hay usuarios en este tenant', code: 'NOT_FOUND' });

    const tokens = await fastify.signTokens({
      sub: owner.id,
      tenantId: id,
      role: owner.role as 'owner' | 'admin' | 'agent',
      email: owner.email,
    });

    await logAudit(adminId, 'IMPERSONATE_TENANT', 'tenant', id, { ownerId: owner.id, email: owner.email }, request.ip);
    return tokens;
  });
};

export default superadminTenantsRoutes;

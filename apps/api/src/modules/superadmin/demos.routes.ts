import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireSuperAdmin } from '../../middleware/require-superadmin.js';
import { db, tenants, users, eq } from '@saas/db';
import { logAudit } from './audit-helper.js';

const createDemoSchema = z.object({
  tenantName: z.string().min(2).max(100),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  ownerName: z.string().min(2),
  businessType: z.string().min(1),
  durationDays: z.number().int().min(1).max(365).default(14),
});

const superadminDemosRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async () => {
    return db.select({
      id: tenants.id, name: tenants.name, slug: tenants.slug,
      businessType: tenants.businessType, isDemo: tenants.isDemo,
      demoExpiresAt: tenants.demoExpiresAt, suspendedAt: tenants.suspendedAt,
      createdAt: tenants.createdAt,
    }).from(tenants).where(eq(tenants.isDemo, true));
  });

  fastify.post('/', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const data = createDemoSchema.parse(request.body);
    const adminId = request.user!.sub;

    const slug = data.tenantName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const demoExpiresAt = new Date();
    demoExpiresAt.setDate(demoExpiresAt.getDate() + data.durationDays);

    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({
        name: data.tenantName,
        slug: `${slug}-demo-${Date.now()}`,
        businessType: data.businessType,
        capabilities: [],
        isDemo: true,
        demoExpiresAt,
        aiModel: 'gpt-4o-mini',
      }).returning();

      if (!tenant) throw new Error('Failed to create demo tenant');

      const passwordHash = await bcrypt.hash(data.ownerPassword, 12);
      const [user] = await tx.insert(users).values({
        tenantId: tenant.id,
        email: data.ownerEmail,
        passwordHash,
        fullName: data.ownerName,
        role: 'owner',
        isActive: true,
      }).returning();

      if (!user) throw new Error('Failed to create demo owner');
      return { tenant, user };
    });

    await logAudit(adminId, 'CREATE_DEMO', 'tenant', result.tenant.id, { tenantName: data.tenantName, durationDays: data.durationDays }, request.ip);
    return reply.status(201).send({ tenantId: result.tenant.id, userId: result.user.id, demoExpiresAt });
  });

  fastify.delete('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;

    const [existing] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, id));
    if (!existing) return reply.status(404).send({ error: 'Not Found', message: 'Demo no encontrada', code: 'NOT_FOUND' });

    await db.update(tenants).set({
      suspendedAt: new Date(),
      suspendedReason: 'Demo eliminada por superadmin',
    }).where(eq(tenants.id, id));

    await logAudit(adminId, 'SUSPEND_DEMO', 'tenant', id, {}, request.ip);
    return reply.status(204).send();
  });
};

export default superadminDemosRoutes;

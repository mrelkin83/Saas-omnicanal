import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireSuperAdmin } from '../../middleware/require-superadmin.js';
import { db, saasPlans, eq } from '@saas/db';
import { logAudit } from './audit-helper.js';

const planSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  priceCop: z.number().nonnegative(),
  billingCycle: z.enum(['monthly', 'annual', 'one_time']).optional(),
  limits: z.record(z.unknown()),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const superadminPlansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async () => {
    return db.select().from(saasPlans).orderBy(saasPlans.sortOrder);
  });

  fastify.get('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [plan] = await db.select().from(saasPlans).where(eq(saasPlans.id, id));
    if (!plan) return reply.status(404).send({ error: 'Not Found', message: 'Plan no encontrado', code: 'NOT_FOUND' });
    return plan;
  });

  fastify.post('/', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const data = planSchema.parse(request.body);
    const adminId = request.user!.sub;

    const [plan] = await db.insert(saasPlans).values({
      name: data.name,
      slug: data.slug,
      priceCop: String(data.priceCop),
      billingCycle: data.billingCycle,
      limits: data.limits,
      features: data.features ?? [],
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    }).returning();

    await logAudit(adminId, 'CREATE_PLAN', 'plan', plan!.id, { name: data.name }, request.ip);
    return reply.status(201).send(plan);
  });

  fastify.patch('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;
    const data = planSchema.partial().parse(request.body);

    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set['name'] = data.name;
    if (data.priceCop !== undefined) set['priceCop'] = String(data.priceCop);
    if (data.billingCycle !== undefined) set['billingCycle'] = data.billingCycle;
    if (data.limits !== undefined) set['limits'] = data.limits;
    if (data.features !== undefined) set['features'] = data.features;
    if (data.isActive !== undefined) set['isActive'] = data.isActive;
    if (data.sortOrder !== undefined) set['sortOrder'] = data.sortOrder;

    const [updated] = await db.update(saasPlans).set(set).where(eq(saasPlans.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Plan no encontrado', code: 'NOT_FOUND' });

    await logAudit(adminId, 'PATCH_PLAN', 'plan', id, data as Record<string, unknown>, request.ip);
    return updated;
  });

  fastify.delete('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;

    const [deleted] = await db.delete(saasPlans).where(eq(saasPlans.id, id)).returning({ id: saasPlans.id });
    if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Plan no encontrado', code: 'NOT_FOUND' });

    await logAudit(adminId, 'DELETE_PLAN', 'plan', id, {}, request.ip);
    return reply.status(204).send();
  });
};

export default superadminPlansRoutes;

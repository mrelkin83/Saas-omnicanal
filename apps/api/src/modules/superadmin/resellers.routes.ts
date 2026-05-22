import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireSuperAdmin } from '../../middleware/require-superadmin.js';
import { db, saasResellers, eq } from '@saas/db';
import { logAudit } from './audit-helper.js';
import { randomBytes } from 'node:crypto';

const resellerSchema = z.object({
  name: z.string().min(2).max(255),
  company: z.string().max(255).optional(),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

function generateReferralCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

const superadminResellersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async () => {
    return db.select().from(saasResellers).orderBy(saasResellers.createdAt);
  });

  fastify.post('/', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const data = resellerSchema.parse(request.body);
    const adminId = request.user!.sub;

    const [reseller] = await db.insert(saasResellers).values({
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      commissionPct: data.commissionPct !== undefined ? String(data.commissionPct) : undefined,
      referralCode: generateReferralCode(),
      isActive: data.isActive ?? true,
    }).returning();

    await logAudit(adminId, 'CREATE_RESELLER', 'reseller', reseller!.id, { name: data.name, email: data.email }, request.ip);
    return reply.status(201).send(reseller);
  });

  fastify.patch('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;
    const data = resellerSchema.partial().parse(request.body);

    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set['name'] = data.name;
    if (data.company !== undefined) set['company'] = data.company;
    if (data.email !== undefined) set['email'] = data.email;
    if (data.phone !== undefined) set['phone'] = data.phone;
    if (data.commissionPct !== undefined) set['commissionPct'] = String(data.commissionPct);
    if (data.isActive !== undefined) set['isActive'] = data.isActive;

    const [updated] = await db.update(saasResellers).set(set).where(eq(saasResellers.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Reseller no encontrado', code: 'NOT_FOUND' });

    await logAudit(adminId, 'PATCH_RESELLER', 'reseller', id, data as Record<string, unknown>, request.ip);
    return updated;
  });

  fastify.delete('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user!.sub;

    const [updated] = await db.update(saasResellers).set({ isActive: false }).where(eq(saasResellers.id, id)).returning({ id: saasResellers.id });
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Reseller no encontrado', code: 'NOT_FOUND' });

    await logAudit(adminId, 'ARCHIVE_RESELLER', 'reseller', id, {}, request.ip);
    return reply.status(204).send();
  });
};

export default superadminResellersRoutes;

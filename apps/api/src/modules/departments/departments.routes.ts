import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, departments, departmentMembers, users, eq, and } from '@saas/db';

const createDeptSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  autoAssign: z.boolean().optional(),
  queueOrder: z.number().int().optional(),
});

const patchDeptSchema = createDeptSchema.extend({ isActive: z.boolean().optional() }).partial();

const memberSchema = z.object({ userId: z.string().uuid(), role: z.enum(['agent', 'supervisor']).optional() });

const departmentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const depts = await db.select().from(departments).where(eq(departments.tenantId, tenantId));

    const members = await db
      .select({
        departmentId: departmentMembers.departmentId,
        userId: departmentMembers.userId,
        role: departmentMembers.role,
        fullName: users.fullName,
        email: users.email,
        agentStatus: users.agentStatus,
      })
      .from(departmentMembers)
      .innerJoin(users, eq(users.id, departmentMembers.userId))
      .where(eq(users.tenantId, tenantId));

    return depts.map((d) => ({
      ...d,
      members: members.filter((m) => m.departmentId === d.id),
    }));
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = createDeptSchema.parse(request.body);

    const values: { tenantId: string; name: string; description?: string; autoAssign?: boolean; queueOrder?: number } = { tenantId, name: data.name };
    if (data.description !== undefined) values.description = data.description;
    if (data.autoAssign !== undefined) values.autoAssign = data.autoAssign;
    if (data.queueOrder !== undefined) values.queueOrder = data.queueOrder;

    const [dept] = await db.insert(departments).values(values).returning();
    return reply.status(201).send(dept);
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchDeptSchema.parse(request.body);

    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set['name'] = data.name;
    if (data.description !== undefined) set['description'] = data.description;
    if (data.autoAssign !== undefined) set['autoAssign'] = data.autoAssign;
    if (data.isActive !== undefined) set['isActive'] = data.isActive;

    const [updated] = await db
      .update(departments)
      .set(set)
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Departamento no encontrado', code: 'NOT_FOUND' });
    return updated;
  });

  fastify.delete('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(departments).where(and(eq(departments.id, id), eq(departments.tenantId, tenantId))).returning({ id: departments.id });
    if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Departamento no encontrado', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });

  // ── Members ───────────────────────────────────────────────────────────────

  fastify.post('/:id/members', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const { userId, role } = memberSchema.parse(request.body);

    const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
    if (!user) return reply.status(404).send({ error: 'Not Found', message: 'Usuario no encontrado', code: 'NOT_FOUND' });

    const [member] = await db
      .insert(departmentMembers)
      .values({ departmentId: id, userId, ...(role ? { role } : {}) })
      .onConflictDoUpdate({ target: [departmentMembers.departmentId, departmentMembers.userId], set: { role: role ?? 'agent' } })
      .returning();

    return reply.status(201).send(member);
  });

  fastify.delete('/:id/members/:userId', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    await db.delete(departmentMembers).where(and(eq(departmentMembers.departmentId, id), eq(departmentMembers.userId, userId)));
    return reply.status(204).send();
  });
};

export default departmentsRoutes;

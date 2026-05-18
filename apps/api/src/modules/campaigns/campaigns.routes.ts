import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, campaigns, campaignLogs, contactLists, eq, and, desc } from '@saas/db';
import { scheduleCampaign } from '../../jobs/campaign-sender.job.js';

const messageSchema = z.object({ text: z.string().min(1) });

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  listId: z.string().uuid(),
  messages: z.array(messageSchema).min(1).max(5),
  scheduledAt: z.string().datetime().optional(),
  channelSessionId: z.string().uuid().optional(),
});

const patchCampaignSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'paused', 'done', 'cancelled']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

const campaignsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    return db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId)).orderBy(desc(campaigns.createdAt));
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
    if (!campaign) return reply.status(404).send({ error: 'Not Found', message: 'Campaña no encontrada', code: 'NOT_FOUND' });
    return campaign;
  });

  fastify.get('/:id/logs', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [campaign] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
    if (!campaign) return reply.status(404).send({ error: 'Not Found', message: 'Campaña no encontrada', code: 'NOT_FOUND' });
    return db.select().from(campaignLogs).where(eq(campaignLogs.campaignId, id)).limit(500);
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = createCampaignSchema.parse(request.body);

    const [list] = await db.select({ id: contactLists.id, contactCount: contactLists.contactCount }).from(contactLists).where(and(eq(contactLists.id, data.listId), eq(contactLists.tenantId, tenantId)));
    if (!list) return reply.status(404).send({ error: 'Not Found', message: 'Lista de contactos no encontrada', code: 'NOT_FOUND' });

    const values: {
      tenantId: string; name: string; listId: string; messages: { text: string }[];
      totalContacts: number; status: string; scheduledAt?: Date; channelSessionId?: string;
    } = {
      tenantId,
      name: data.name,
      listId: data.listId,
      messages: data.messages,
      totalContacts: list.contactCount ?? 0,
      status: data.scheduledAt ? 'scheduled' : 'draft',
    };

    if (data.scheduledAt) values.scheduledAt = new Date(data.scheduledAt);
    if (data.channelSessionId) values.channelSessionId = data.channelSessionId;

    const [campaign] = await db.insert(campaigns).values(values).returning();
    if (!campaign) return reply.status(500).send({ error: 'Internal Server Error', message: 'Error creando campaña', code: 'CREATE_ERROR' });

    if (data.scheduledAt) {
      const delay = new Date(data.scheduledAt).getTime() - Date.now();
      if (delay > 0) {
        await scheduleCampaign(campaign.id, tenantId, delay);
      }
    }

    return reply.status(201).send(campaign);
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = patchCampaignSchema.parse(request.body);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) set['name'] = data.name;
    if (data.status !== undefined) set['status'] = data.status;
    if (data.scheduledAt !== undefined) {
      set['scheduledAt'] = new Date(data.scheduledAt);
      const delay = new Date(data.scheduledAt).getTime() - Date.now();
      if (delay > 0) await scheduleCampaign(id, tenantId, delay);
    }

    const [updated] = await db.update(campaigns).set(set).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId))).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Campaña no encontrada', code: 'NOT_FOUND' });
    return updated;
  });

  fastify.delete('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId))).returning({ id: campaigns.id });
    if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Campaña no encontrada', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });
};

export default campaignsRoutes;

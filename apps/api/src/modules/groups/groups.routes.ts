import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, channelSessions, eq, and } from '@saas/db';
import * as evo from '../../lib/evolution-api.client.js';

const createGroupSchema = z.object({
  subject: z.string().min(1).max(100),
  participants: z.array(z.string()).min(1),
});

const addParticipantsSchema = z.object({
  participants: z.array(z.string()).min(1),
});

async function getWaSession(tenantId: string): Promise<string | null> {
  const [session] = await db
    .select({ externalId: channelSessions.externalId })
    .from(channelSessions)
    .where(and(eq(channelSessions.tenantId, tenantId), eq(channelSessions.channel, 'whatsapp'), eq(channelSessions.status, 'connected')));
  return session?.externalId ?? null;
}

const groupsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const instanceName = await getWaSession(tenantId);
    if (!instanceName) return reply.status(503).send({ error: 'Service Unavailable', message: 'WhatsApp no está conectado', code: 'WA_NOT_CONNECTED' });

    try {
      const groups = await evo.fetchGroups(instanceName);
      return groups;
    } catch {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'No se pudieron obtener los grupos', code: 'EVO_ERROR' });
    }
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const instanceName = await getWaSession(tenantId);
    if (!instanceName) return reply.status(503).send({ error: 'Service Unavailable', message: 'WhatsApp no está conectado', code: 'WA_NOT_CONNECTED' });

    const data = createGroupSchema.parse(request.body);
    const participants = data.participants.map((p) => p.includes('@') ? p : `${p}@s.whatsapp.net`);

    try {
      const result = await evo.createGroup(instanceName, data.subject, participants);
      return reply.status(201).send(result);
    } catch {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Error creando grupo', code: 'EVO_ERROR' });
    }
  });

  fastify.post('/:groupId/message', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { groupId } = request.params as { groupId: string };
    const { text } = z.object({ text: z.string().min(1) }).parse(request.body);
    const instanceName = await getWaSession(tenantId);
    if (!instanceName) return reply.status(503).send({ error: 'Service Unavailable', message: 'WhatsApp no está conectado', code: 'WA_NOT_CONNECTED' });
    try {
      await evo.sendText(instanceName, groupId, text);
      return { ok: true };
    } catch {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Error enviando mensaje', code: 'EVO_ERROR' });
    }
  });

  fastify.post('/:groupId/participants', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { groupId } = request.params as { groupId: string };
    const instanceName = await getWaSession(tenantId);
    if (!instanceName) return reply.status(503).send({ error: 'Service Unavailable', message: 'WhatsApp no está conectado', code: 'WA_NOT_CONNECTED' });

    const data = addParticipantsSchema.parse(request.body);
    const participants = data.participants.map((p) => p.includes('@') ? p : `${p}@s.whatsapp.net`);

    try {
      const result = await evo.addGroupParticipants(instanceName, groupId, participants);
      return result;
    } catch {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Error agregando participantes', code: 'EVO_ERROR' });
    }
  });
};

export default groupsRoutes;

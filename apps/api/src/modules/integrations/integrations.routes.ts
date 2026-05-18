import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, integrations, eq, and } from '@saas/db';
import { encrypt, decrypt } from '../../lib/crypto.js';

const SENSITIVE_FIELDS = ['apiKey', 'apiSecret', 'privateKey', 'accessToken', 'password', 'secret'];

const createIntegrationSchema = z.object({
  provider: z.string().min(1).max(50),
  category: z.enum(['llm', 'payment', 'shipping', 'crm', 'erp', 'analytics', 'other']),
  config: z.record(z.unknown()),
  isActive: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
});

function encryptSensitive(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (SENSITIVE_FIELDS.includes(k) && typeof v === 'string' && v) {
      result[k] = `enc:${encrypt(v)}`;
    } else {
      result[k] = v;
    }
  }
  return result;
}

function decryptSensitive(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string' && v.startsWith('enc:')) {
      try {
        result[k] = decrypt(v.slice(4));
      } catch {
        result[k] = '[decryption error]';
      }
    } else {
      result[k] = v;
    }
  }
  return result;
}

function maskSensitive(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (SENSITIVE_FIELDS.includes(k) && typeof v === 'string') {
      result[k] = '••••••••';
    } else {
      result[k] = v;
    }
  }
  return result;
}

const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth('admin')] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(integrations).where(eq(integrations.tenantId, tenantId));
    return rows.map((r) => ({ ...r, config: maskSensitive(r.config as Record<string, unknown>) }));
  });

  fastify.get('/:id/config', { preHandler: [requireAuth('owner')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [row] = await db.select().from(integrations).where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)));
    if (!row) return reply.status(404).send({ error: 'Not Found', message: 'Integración no encontrada', code: 'NOT_FOUND' });
    return { ...row, config: decryptSensitive(row.config as Record<string, unknown>) };
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = createIntegrationSchema.parse(request.body);
    const encryptedConfig = encryptSensitive(data.config as Record<string, unknown>);

    const values: { tenantId: string; provider: string; category: string; config: Record<string, unknown>; isActive?: boolean; isPrimary?: boolean } = {
      tenantId,
      provider: data.provider,
      category: data.category,
      config: encryptedConfig,
    };
    if (data.isActive !== undefined) values.isActive = data.isActive;
    if (data.isPrimary !== undefined) values.isPrimary = data.isPrimary;

    const [integration] = await db
      .insert(integrations)
      .values(values)
      .onConflictDoUpdate({
        target: [integrations.tenantId, integrations.provider],
        set: { config: encryptedConfig, updatedAt: new Date(), ...(data.isActive !== undefined ? { isActive: data.isActive } : {}) },
      })
      .returning();

    return reply.status(201).send({ ...integration, config: maskSensitive(integration!.config as Record<string, unknown>) });
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const data = createIntegrationSchema.partial().parse(request.body);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.config) set['config'] = encryptSensitive(data.config as Record<string, unknown>);
    if (data.isActive !== undefined) set['isActive'] = data.isActive;
    if (data.isPrimary !== undefined) set['isPrimary'] = data.isPrimary;

    const [updated] = await db.update(integrations).set(set).where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId))).returning();
    if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Integración no encontrada', code: 'NOT_FOUND' });
    return { ...updated, config: maskSensitive(updated.config as Record<string, unknown>) };
  });

  fastify.delete('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(integrations).where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId))).returning({ id: integrations.id });
    if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Integración no encontrada', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });
};

export default integrationsRoutes;

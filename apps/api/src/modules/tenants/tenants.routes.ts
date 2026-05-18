import type { FastifyPluginAsync } from 'fastify';
import { patchTenantSchema, setConfigSchema } from './tenants.schemas.js';
import { getTenantById, updateTenant, getConfig, setConfig, getAllConfig } from './tenants.service.js';
import { requireAuth } from '../../middleware/require-auth.js';

const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/tenants/me
  fastify.get('/me', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenant = await getTenantById(request.user!.tenantId);
    if (!tenant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tenant no encontrado', code: 'NOT_FOUND' });
    }
    return reply.send(tenant);
  });

  // PATCH /api/tenants/me
  fastify.patch('/me', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const input = patchTenantSchema.parse(request.body);
    const updated = await updateTenant(request.user!.tenantId, input);
    return reply.send(updated);
  });

  // GET /api/tenants/me/config
  fastify.get('/me/config', { preHandler: [requireAuth()] }, async (request) => {
    return getAllConfig(request.user!.tenantId);
  });

  // GET /api/tenants/me/config/:key
  fastify.get('/me/config/:key', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const config = await getConfig(request.user!.tenantId, key);
    if (!config) return reply.status(404).send({ error: 'Not Found', message: 'Configuración no encontrada', code: 'NOT_FOUND' });
    return config;
  });

  // PATCH /api/tenants/me/config
  fastify.patch('/me/config', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { key, value } = setConfigSchema.parse(request.body);
    const result = await setConfig(request.user!.tenantId, key, value);
    return reply.send(result);
  });
};

export default tenantsRoutes;

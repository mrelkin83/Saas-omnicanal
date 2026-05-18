import type { FastifyPluginAsync } from 'fastify';
import { patchTenantSchema } from './tenants.schemas.js';
import { getTenantById, updateTenant } from './tenants.service.js';
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
};

export default tenantsRoutes;

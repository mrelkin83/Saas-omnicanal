import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { createCustomerSchema, patchCustomerSchema } from './customers.schemas.js';
import { listCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } from './customers.service.js';

const customersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const { search } = request.query as { search?: string };
    return listCustomers(request.user!.tenantId, search);
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const customer = await getCustomerById(request.user!.tenantId, id);
    if (!customer) return reply.status(404).send({ error: 'Not Found', message: 'Cliente no encontrado', code: 'NOT_FOUND' });
    return customer;
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const data = createCustomerSchema.parse(request.body);
    const customer = await createCustomer(request.user!.tenantId, data);
    return reply.status(201).send(customer);
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = patchCustomerSchema.parse(request.body);
    const customer = await updateCustomer(request.user!.tenantId, id, data);
    if (!customer) return reply.status(404).send({ error: 'Not Found', message: 'Cliente no encontrado', code: 'NOT_FOUND' });
    return customer;
  });

  fastify.delete('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const customer = await deleteCustomer(request.user!.tenantId, id);
    if (!customer) return reply.status(404).send({ error: 'Not Found', message: 'Cliente no encontrado', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });
};

export default customersRoutes;

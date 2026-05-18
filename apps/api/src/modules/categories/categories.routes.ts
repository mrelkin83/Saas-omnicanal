import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { createCategorySchema, patchCategorySchema } from './categories.schemas.js';
import { listCategories, createCategory, updateCategory, deleteCategory } from './categories.service.js';

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    return listCategories(request.user!.tenantId);
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const data = createCategorySchema.parse(request.body);
    const cat = await createCategory(request.user!.tenantId, data);
    return reply.status(201).send(cat);
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = patchCategorySchema.parse(request.body);
    const cat = await updateCategory(request.user!.tenantId, id, data);
    if (!cat) return reply.status(404).send({ error: 'Not Found', message: 'Categoría no encontrada', code: 'NOT_FOUND' });
    return cat;
  });

  fastify.delete('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cat = await deleteCategory(request.user!.tenantId, id);
    if (!cat) return reply.status(404).send({ error: 'Not Found', message: 'Categoría no encontrada', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });
};

export default categoriesRoutes;

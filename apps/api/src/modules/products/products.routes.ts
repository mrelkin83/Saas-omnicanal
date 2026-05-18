import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { createProductSchema, patchProductSchema, createVariantSchema, patchVariantSchema } from './products.schemas.js';
import {
  listProducts, getProductById, createProduct, updateProduct, deleteProduct,
  createVariant, updateVariant, deleteVariant,
} from './products.service.js';

const productsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const opts: { search?: string; type?: string; categoryId?: string } = {};
    if (q['search']) opts.search = q['search'];
    if (q['type']) opts.type = q['type'];
    if (q['categoryId']) opts.categoryId = q['categoryId'];
    return listProducts(request.user!.tenantId, opts);
  });

  fastify.get('/:id', { preHandler: [requireAuth()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await getProductById(request.user!.tenantId, id);
    if (!product) return reply.status(404).send({ error: 'Not Found', message: 'Producto no encontrado', code: 'NOT_FOUND' });
    return product;
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const data = createProductSchema.parse(request.body);
    const product = await createProduct(request.user!.tenantId, data);
    return reply.status(201).send(product);
  });

  fastify.patch('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = patchProductSchema.parse(request.body);
    const product = await updateProduct(request.user!.tenantId, id, data);
    if (!product) return reply.status(404).send({ error: 'Not Found', message: 'Producto no encontrado', code: 'NOT_FOUND' });
    return product;
  });

  fastify.delete('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await deleteProduct(request.user!.tenantId, id);
    if (!product) return reply.status(404).send({ error: 'Not Found', message: 'Producto no encontrado', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });

  // Variants
  fastify.post('/:id/variants', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createVariantSchema.parse(request.body);
    const variant = await createVariant(request.user!.tenantId, id, data);
    return reply.status(201).send(variant);
  });

  fastify.patch('/:id/variants/:variantId', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id, variantId } = request.params as { id: string; variantId: string };
    const data = patchVariantSchema.parse(request.body);
    const variant = await updateVariant(request.user!.tenantId, id, variantId, data);
    if (!variant) return reply.status(404).send({ error: 'Not Found', message: 'Variante no encontrada', code: 'NOT_FOUND' });
    return variant;
  });

  fastify.delete('/:id/variants/:variantId', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const { id, variantId } = request.params as { id: string; variantId: string };
    const v = await deleteVariant(request.user!.tenantId, id, variantId);
    if (!v) return reply.status(404).send({ error: 'Not Found', message: 'Variante no encontrada', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });
};

export default productsRoutes;

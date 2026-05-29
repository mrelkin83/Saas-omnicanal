import { z } from 'zod';
import { db, products, categories, eq, and } from '@saas/db';
import type { MCPServer } from '../core/mcp-server.interface.js';

export const catalogMCPServer: MCPServer = {
  name: 'catalog',
  description: 'Gestiona el catálogo de productos y servicios del negocio',
  capabilities: ['catalog'],
  tools: [
    {
      name: 'listProducts',
      description: 'Lista productos/servicios activos del negocio. Opcionalmente filtra por categoría.',
      parameters: z.object({
        categoryName: z.string().optional().describe('Nombre de categoría para filtrar'),
        type: z.enum(['product', 'service']).optional().describe('Filtrar por tipo: product o service'),
      }),
      execute: async (params, ctx) => {
        const type = params.type as 'product' | 'service' | undefined;

        const conditions = [
          eq(products.tenantId, ctx.tenantId),
          eq(products.isActive, true),
        ];
        if (type) conditions.push(eq(products.type, type));

        const rows = await db.select().from(products).where(and(...conditions)).orderBy(products.name);

        if (rows.length === 0) return 'No hay productos disponibles en este momento.';

        const lines = rows.map((p) => {
          const price = p.price ? `$${Number(p.price).toLocaleString('es-CO')}` : 'Consultar precio';
          const duration = p.durationMinutes ? ` (${p.durationMinutes} min)` : '';
          return `• ${p.name}${duration} — ${price}`;
        });
        return `Nuestros productos/servicios disponibles:\n\n${lines.join('\n')}`;
      },
    },
    {
      name: 'listCategories',
      description: 'Lista las categorías del catálogo',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const rows = await db
          .select()
          .from(categories)
          .where(eq(categories.tenantId, ctx.tenantId))
          .orderBy(categories.sortOrder);

        if (rows.length === 0) return 'No hay categorías definidas.';
        return `Categorías:\n${rows.map((c) => `• ${c.name}`).join('\n')}`;
      },
    },
    {
      name: 'getProductDetails',
      description: 'Obtiene detalles de un producto/servicio por nombre',
      parameters: z.object({
        query: z.string().describe('Nombre del producto o servicio'),
      }),
      execute: async (params, ctx) => {
        const query = (params.query as string | undefined) ?? '';

        const all = await db
          .select()
          .from(products)
          .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)))
          .limit(50);

        const found = all.find((p) => p.name.toLowerCase().includes(query.toLowerCase()));

        if (!found) return `No encontré "${query}" en nuestro catálogo.`;

        const price = found.price ? `$${Number(found.price).toLocaleString('es-CO')}` : 'Consultar';
        const duration = found.durationMinutes ? `\n⏱️ Duración: ${found.durationMinutes} minutos` : '';
        const description = found.description ? `\n📝 ${found.description}` : '';

        return `*${found.name}*\n💰 Precio: ${price}${duration}${description}`;
      },
    },
    {
      name: 'checkStock',
      description: 'Verifica stock disponible de un producto',
      parameters: z.object({
        productName: z.string().describe('Nombre del producto'),
      }),
      execute: async (params, ctx) => {
        const productName = (params.productName as string | undefined) ?? '';
        const all = await db
          .select()
          .from(products)
          .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)))
          .limit(50);

        const product = all.find((p) => p.name.toLowerCase().includes(productName.toLowerCase()));

        if (!product) return `No encontré "${productName}".`;
        if (product.stock === null) return `${product.name}: Stock no aplica (servicio).`;
        if (product.stock <= 0) return `${product.name}: Agotado temporalmente.`;
        return `${product.name}: ${product.stock} unidades disponibles.`;
      },
    },
  ],
};

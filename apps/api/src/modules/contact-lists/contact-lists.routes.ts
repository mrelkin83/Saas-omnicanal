import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import Papa from 'papaparse';
import { requireAuth } from '../../middleware/require-auth.js';
import { db, contactLists, contactListEntries, customers, eq, and, sql } from '@saas/db';

const createListSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const contactListsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    return db.select().from(contactLists).where(eq(contactLists.tenantId, tenantId));
  });

  fastify.post('/', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = createListSchema.parse(request.body);
    const [list] = await db.insert(contactLists).values({ tenantId, name: data.name, ...(data.description ? { description: data.description } : {}) }).returning();
    return reply.status(201).send(list);
  });

  fastify.delete('/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(contactLists).where(and(eq(contactLists.id, id), eq(contactLists.tenantId, tenantId))).returning({ id: contactLists.id });
    if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Lista no encontrada', code: 'NOT_FOUND' });
    return reply.status(204).send();
  });

  fastify.get('/:id/entries', { preHandler: [requireAuth()] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const [list] = await db.select({ id: contactLists.id }).from(contactLists).where(and(eq(contactLists.id, id), eq(contactLists.tenantId, tenantId)));
    if (!list) return reply.status(404).send({ error: 'Not Found', message: 'Lista no encontrada', code: 'NOT_FOUND' });
    return db.select().from(contactListEntries).where(eq(contactListEntries.listId, id)).limit(200);
  });

  // POST /:id/import-csv — multipart CSV upload
  fastify.post('/:id/import-csv', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };

    const [list] = await db.select({ id: contactLists.id }).from(contactLists).where(and(eq(contactLists.id, id), eq(contactLists.tenantId, tenantId)));
    if (!list) return reply.status(404).send({ error: 'Not Found', message: 'Lista no encontrada', code: 'NOT_FOUND' });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Bad Request', message: 'No se encontró archivo CSV', code: 'NO_FILE' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    const csvText = Buffer.concat(chunks).toString('utf8');

    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'CSV inválido', code: 'INVALID_CSV' });
    }

    const rows = parsed.data;
    let imported = 0;

    for (const row of rows) {
      const phone = (row['phone'] ?? row['telefono'] ?? row['Phone'] ?? '').trim();
      if (!phone) continue;

      const name = (row['name'] ?? row['nombre'] ?? row['Name'] ?? '').trim() || undefined;
      const variables: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!['phone', 'telefono', 'Phone', 'name', 'nombre', 'Name'].includes(k) && v) {
          variables[k] = String(v);
        }
      }

      // Upsert customer
      const [existing] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.tenantId, tenantId), eq(customers.phone, phone)));
      let customerId = existing?.id;
      if (!customerId) {
        const [newCustomer] = await db.insert(customers).values({ tenantId, phone, displayName: name ?? phone }).returning({ id: customers.id });
        customerId = newCustomer!.id;
      }

      await db.insert(contactListEntries).values({
        listId: id,
        customerId,
        phone,
        name,
        variables,
      }).onConflictDoNothing();

      imported++;
    }

    // Update contact count
    await db.update(contactLists).set({ contactCount: sql`(SELECT COUNT(*) FROM contact_list_entries WHERE list_id = ${id})` }).where(eq(contactLists.id, id));

    return { imported, total: rows.length };
  });
};

export default contactListsRoutes;

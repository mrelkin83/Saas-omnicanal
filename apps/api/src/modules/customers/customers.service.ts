import { db, customers, eq, and, ilike, or, desc } from '@saas/db';
import type { CreateCustomerInput, PatchCustomerInput } from './customers.schemas.js';

export async function listCustomers(tenantId: string, search?: string) {
  const base = eq(customers.tenantId, tenantId);
  const where = search
    ? and(base, or(ilike(customers.fullName, `%${search}%`), ilike(customers.phone, `%${search}%`), ilike(customers.email, `%${search}%`)))
    : base;

  return db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(100);
}

export async function getCustomerById(tenantId: string, id: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
  return customer ?? null;
}

export async function createCustomer(tenantId: string, data: CreateCustomerInput) {
  const [customer] = await db
    .insert(customers)
    .values({
      tenantId,
      phone: data.phone,
      fullName: data.fullName,
      displayName: data.displayName ?? data.fullName,
      email: data.email,
      cedula: data.cedula,
      address: data.address,
      tags: data.tags ?? [],
      customAttributes: data.customAttributes ?? {},
    })
    .returning();
  return customer!;
}

export async function updateCustomer(tenantId: string, id: string, data: PatchCustomerInput) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.phone !== undefined) set['phone'] = data.phone;
  if (data.fullName !== undefined) set['fullName'] = data.fullName;
  if (data.displayName !== undefined) set['displayName'] = data.displayName;
  if (data.email !== undefined) set['email'] = data.email;
  if (data.cedula !== undefined) set['cedula'] = data.cedula;
  if (data.address !== undefined) set['address'] = data.address;
  if (data.tags !== undefined) set['tags'] = data.tags;
  if (data.customAttributes !== undefined) set['customAttributes'] = data.customAttributes;

  const [customer] = await db
    .update(customers)
    .set(set)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
    .returning();
  return customer ?? null;
}

export async function deleteCustomer(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
    .returning({ id: customers.id });
  return deleted ?? null;
}

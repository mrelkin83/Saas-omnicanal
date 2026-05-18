import { db, categories, eq, and, asc } from '@saas/db';
import type { CreateCategoryInput, PatchCategoryInput } from './categories.schemas.js';

export async function listCategories(tenantId: string) {
  return db.select().from(categories).where(eq(categories.tenantId, tenantId)).orderBy(asc(categories.sortOrder));
}

export async function getCategoryById(tenantId: string, id: string) {
  const [cat] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));
  return cat ?? null;
}

export async function createCategory(tenantId: string, data: CreateCategoryInput) {
  const [cat] = await db
    .insert(categories)
    .values({ tenantId, name: data.name, parentId: data.parentId, sortOrder: data.sortOrder ?? 0 })
    .returning();
  return cat!;
}

export async function updateCategory(tenantId: string, id: string, data: PatchCategoryInput) {
  const [cat] = await db
    .update(categories)
    .set({ ...(data.name !== undefined && { name: data.name }), ...(data.parentId !== undefined && { parentId: data.parentId }), ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }) })
    .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
    .returning();
  return cat ?? null;
}

export async function deleteCategory(tenantId: string, id: string) {
  const [cat] = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
    .returning({ id: categories.id });
  return cat ?? null;
}

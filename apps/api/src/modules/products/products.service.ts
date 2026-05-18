import { db, products, productVariants, eq, and, ilike, desc } from '@saas/db';
import type { CreateProductInput, PatchProductInput, CreateVariantInput, PatchVariantInput } from './products.schemas.js';

export async function listProducts(
  tenantId: string,
  opts: { search?: string; type?: string; categoryId?: string; activeOnly?: boolean } = {},
) {
  const conditions = [eq(products.tenantId, tenantId)];
  if (opts.type) conditions.push(eq(products.type, opts.type));
  if (opts.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts.search) conditions.push(ilike(products.name, `%${opts.search}%`));
  if (opts.activeOnly) conditions.push(eq(products.isActive, true));

  return db.select().from(products).where(and(...conditions)).orderBy(desc(products.createdAt));
}

export async function getProductById(tenantId: string, id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
  if (!product) return null;

  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, id), eq(productVariants.tenantId, tenantId)));

  return { ...product, variants };
}

export async function createProduct(tenantId: string, data: CreateProductInput) {
  const [product] = await db
    .insert(products)
    .values({
      tenantId,
      categoryId: data.categoryId,
      type: data.type,
      name: data.name,
      description: data.description,
      sku: data.sku,
      price: data.price != null ? String(data.price) : null,
      cost: data.cost != null ? String(data.cost) : null,
      durationMinutes: data.durationMinutes,
      hasVariants: data.hasVariants,
      stock: data.stock,
      images: data.images ?? [],
      customAttributes: data.customAttributes ?? {},
      isActive: data.isActive ?? true,
    })
    .returning();
  return product!;
}

export async function updateProduct(tenantId: string, id: string, data: PatchProductInput) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.categoryId !== undefined) set['categoryId'] = data.categoryId;
  if (data.type !== undefined) set['type'] = data.type;
  if (data.name !== undefined) set['name'] = data.name;
  if (data.description !== undefined) set['description'] = data.description;
  if (data.sku !== undefined) set['sku'] = data.sku;
  if (data.price !== undefined) set['price'] = data.price != null ? String(data.price) : null;
  if (data.cost !== undefined) set['cost'] = data.cost != null ? String(data.cost) : null;
  if (data.durationMinutes !== undefined) set['durationMinutes'] = data.durationMinutes;
  if (data.hasVariants !== undefined) set['hasVariants'] = data.hasVariants;
  if (data.stock !== undefined) set['stock'] = data.stock;
  if (data.images !== undefined) set['images'] = data.images;
  if (data.customAttributes !== undefined) set['customAttributes'] = data.customAttributes;
  if (data.isActive !== undefined) set['isActive'] = data.isActive;

  const [updated] = await db
    .update(products)
    .set(set)
    .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
    .returning();
  return updated ?? null;
}

export async function deleteProduct(tenantId: string, id: string) {
  const [deleted] = await db
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
    .returning({ id: products.id });
  return deleted ?? null;
}

export async function createVariant(tenantId: string, productId: string, data: CreateVariantInput) {
  const [variant] = await db
    .insert(productVariants)
    .values({
      tenantId,
      productId,
      sku: data.sku,
      attributes: data.attributes,
      price: data.price != null ? String(data.price) : null,
      stock: data.stock,
      isActive: data.isActive ?? true,
    })
    .returning();
  return variant!;
}

export async function updateVariant(tenantId: string, productId: string, variantId: string, data: PatchVariantInput) {
  const set: Record<string, unknown> = {};
  if (data.sku !== undefined) set['sku'] = data.sku;
  if (data.attributes !== undefined) set['attributes'] = data.attributes;
  if (data.price !== undefined) set['price'] = data.price != null ? String(data.price) : null;
  if (data.stock !== undefined) set['stock'] = data.stock;
  if (data.isActive !== undefined) set['isActive'] = data.isActive;

  const [variant] = await db
    .update(productVariants)
    .set(set)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId), eq(productVariants.tenantId, tenantId)))
    .returning();
  return variant ?? null;
}

export async function deleteVariant(tenantId: string, productId: string, variantId: string) {
  const [deleted] = await db
    .delete(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId), eq(productVariants.tenantId, tenantId)))
    .returning({ id: productVariants.id });
  return deleted ?? null;
}

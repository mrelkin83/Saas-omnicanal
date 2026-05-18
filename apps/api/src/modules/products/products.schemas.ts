import { z } from 'zod';

function normSnake(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  const map: Record<string, string> = {
    duration_minutes: 'durationMinutes',
    category_id: 'categoryId',
    has_variants: 'hasVariants',
    is_active: 'isActive',
    custom_attributes: 'customAttributes',
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

const productBase = z.object({
  categoryId: z.string().uuid().optional(),
  type: z.enum(['product', 'service', 'combo']).default('product'),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sku: z.string().max(100).optional(),
  price: z.coerce.number().positive().optional().nullable(),
  cost: z.coerce.number().positive().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  hasVariants: z.boolean().optional(),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  images: z.array(z.string()).optional(),
  customAttributes: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const createProductSchema = z.preprocess(normSnake, productBase);
export const patchProductSchema = z.preprocess(normSnake, productBase.partial());

export const createVariantSchema = z.object({
  sku: z.string().max(100).optional(),
  attributes: z.record(z.unknown()),
  price: z.coerce.number().positive().optional().nullable(),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const patchVariantSchema = createVariantSchema.partial();

const _patchProduct = productBase.partial();
const _patchVariant = createVariantSchema.partial();

export type CreateProductInput = z.infer<typeof productBase>;
export type PatchProductInput = z.infer<typeof _patchProduct>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type PatchVariantInput = z.infer<typeof _patchVariant>;

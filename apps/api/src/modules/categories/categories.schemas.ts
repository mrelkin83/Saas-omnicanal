import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const patchCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type PatchCategoryInput = z.infer<typeof patchCategorySchema>;

import { z } from 'zod';

export const createCustomerSchema = z.object({
  phone: z.string().max(20).optional(),
  fullName: z.string().max(255).optional(),
  displayName: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
  cedula: z.string().max(20).optional(),
  address: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customAttributes: z.record(z.unknown()).optional(),
});

export const patchCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type PatchCustomerInput = z.infer<typeof patchCustomerSchema>;

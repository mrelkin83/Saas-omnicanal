import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().uuid(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().uuid(),
});

export const registerTenantSchema = z.object({
  tenantName: z.string().min(2).max(255),
  businessType: z.string().min(2).max(50),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerName: z.string().min(2).max(255),
  plan: z.string().min(1).default('free'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;

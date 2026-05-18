import { z } from 'zod';

export const patchTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  aiModel: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']).optional(),
  aiTemperature: z.number().min(0).max(1).optional(),
  aiMaxTokens: z.number().int().min(100).max(4000).optional(),
  aiAgentName: z.string().max(100).optional(),
  aiTone: z.enum(['amigable', 'profesional', 'formal', 'casual']).optional(),
  billingEmail: z.string().email().optional(),
});

export type PatchTenantInput = z.infer<typeof patchTenantSchema>;

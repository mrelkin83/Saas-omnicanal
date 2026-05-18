import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(255),
  role: z.enum(['admin', 'agent']),
  agentStatus: z.enum(['available', 'busy', 'offline']).default('available'),
  maxConcurrentChats: z.number().int().min(1).max(50).default(5),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  role: z.enum(['admin', 'agent']).optional(),
  agentStatus: z.enum(['available', 'busy', 'offline']).optional(),
  maxConcurrentChats: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

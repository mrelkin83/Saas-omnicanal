import { z } from 'zod';

export const patchConversationSchema = z.object({
  status: z.enum(['open', 'resolved', 'pending', 'spam']).optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  kanbanColumnId: z.string().uuid().optional().nullable(),
  potentialValue: z.coerce.number().min(0).optional(),
});

export const createMessageSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['text', 'image', 'audio', 'document']).default('text'),
  mediaUrl: z.string().url().optional(),
});

export type PatchConversationInput = z.infer<typeof patchConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

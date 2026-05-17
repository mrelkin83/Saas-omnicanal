import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Número de teléfono inválido');

export const emailSchema = z.string().email('Correo electrónico inválido');

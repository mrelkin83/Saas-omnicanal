import { z } from 'zod';
import { db, products, ilike, eq, and } from '@saas/db';
import { findAlternativeSlots, formatSlot } from '../scheduling.engine.js';

const paramsSchema = z.object({
  servicio: z.string().optional(),
  fecha: z.string().optional(),
});

export async function verSlotsProcessor(
  tenantId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = paramsSchema.parse(params);

  let duration = 60;
  if (parsed.servicio) {
    const [service] = await db
      .select({ durationMinutes: products.durationMinutes, name: products.name })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), ilike(products.name, `%${parsed.servicio}%`), eq(products.isActive, true)))
      .limit(1);
    if (service?.durationMinutes) duration = service.durationMinutes;
  }

  const from = parsed.fecha ? new Date(parsed.fecha) : new Date();
  from.setHours(8, 0, 0, 0);

  const slots = await findAlternativeSlots(tenantId, from, duration, 5);
  if (slots.length === 0) {
    return 'No encontramos horarios disponibles en los próximos días. Por favor contáctanos directamente.';
  }

  const lines = slots.map((s, i) => `${i + 1}. ${formatSlot(s)}`);
  return `Horarios disponibles:\n\n${lines.join('\n')}\n\n¿Cuál prefieres?`;
}

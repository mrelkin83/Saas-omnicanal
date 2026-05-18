import { z } from 'zod';
import { db, quotes, eq, and } from '@saas/db';

const cotizarSchema = z.object({
  descripcion: z.string().min(1),
});

const verCotizacionSchema = z.object({
  cotizacion_id: z.string().uuid().optional(),
});

export async function cotizarProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = cotizarSchema.safeParse(params);
  if (!parsed.success) {
    return 'No entendí qué deseas cotizar. ¿Puedes describir el producto o servicio?';
  }

  const { descripcion } = parsed.data;
  const quoteNumber = `COT-${Date.now().toString(36).toUpperCase()}`;

  const [quote] = await db.insert(quotes).values({
    tenantId,
    customerId,
    quoteNumber,
    status: 'pending',
    items: [{ descripcion, cantidad: 1 }],
    subtotal: '0',
    total: '0',
    notes: descripcion,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }).returning();

  if (!quote) return 'Ocurrió un error al registrar tu cotización. Por favor intenta de nuevo.';

  return `📋 *Solicitud de cotización registrada*\n\nN° ${quoteNumber}\nDescripción: ${descripcion}\n\nUno de nuestros asesores revisará tu solicitud y te enviará los precios en breve. ¡Gracias por tu interés! 🙏`;
}

export async function verCotizacionProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = verCotizacionSchema.safeParse(params);

  let cotizaciones;
  if (parsed.success && parsed.data.cotizacion_id) {
    cotizaciones = await db.select().from(quotes).where(and(eq(quotes.id, parsed.data.cotizacion_id), eq(quotes.tenantId, tenantId)));
  } else {
    cotizaciones = await db.select().from(quotes).where(and(eq(quotes.tenantId, tenantId), eq(quotes.customerId, customerId))).limit(3);
  }

  if (cotizaciones.length === 0) return 'No tienes cotizaciones registradas.';

  const STATUS_MAP: Record<string, string> = {
    pending: 'Pendiente revisión', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada',
  };

  const lines = cotizaciones.map((q) => {
    const validStr = q.validUntil
      ? q.validUntil.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
      : '—';
    const totalFmt = Number(q.total) > 0
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(q.total))
      : 'Por definir';
    return `📋 ${q.quoteNumber} — ${totalFmt}\nEstado: ${STATUS_MAP[q.status ?? ''] ?? q.status} | Válida hasta: ${validStr}`;
  });

  return lines.join('\n\n');
}

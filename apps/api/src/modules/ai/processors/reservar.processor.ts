import { z } from 'zod';
import { db, reservations, eq, and, desc } from '@saas/db';

const crearReservaSchema = z.object({
  fecha_hora: z.string().min(1),
  personas: z.coerce.number().int().positive().default(1),
  notas: z.string().optional(),
});

const cancelarReservaSchema = z.object({
  reserva_id: z.string().uuid(),
});

export async function crearReservaProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = crearReservaSchema.safeParse(params);
  if (!parsed.success) {
    return 'No pude entender los detalles de tu reserva. ¿Puedes indicarme la fecha, hora y número de personas?';
  }

  const { fecha_hora, personas, notas } = parsed.data;

  let dt: Date;
  try {
    dt = new Date(fecha_hora);
    if (isNaN(dt.getTime())) throw new Error('invalid');
  } catch {
    return 'La fecha indicada no es válida. Por favor dime la fecha y hora de tu reserva de forma clara.';
  }

  const reservedDate = dt.toISOString().slice(0, 10);
  const reservedTime = dt.toISOString().slice(11, 16);

  const [reservation] = await db.insert(reservations).values({
    tenantId,
    customerId,
    status: 'pending',
    reservedDate,
    reservedTime,
    partySize: personas,
    notes: notas,
  }).returning();

  if (!reservation) return 'Ocurrió un error al crear tu reserva. Por favor intenta de nuevo.';

  const dateStr = dt.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `✅ *Reserva confirmada*\n\n📅 Fecha: ${dateStr}\n👥 Personas: ${personas}${notas ? `\n📝 Notas: ${notas}` : ''}\n\nTe esperamos. Si necesitas cancelar, escríbenos con anticipación.`;
}

export async function verReservasProcessor(tenantId: string, customerId: string): Promise<string> {
  const reservas = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.tenantId, tenantId), eq(reservations.customerId, customerId)))
    .orderBy(desc(reservations.createdAt))
    .limit(5);

  if (reservas.length === 0) return 'No tienes reservas registradas con nosotros.';

  const STATUS_MAP: Record<string, string> = {
    pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada',
  };

  const lines = reservas.map((r) => {
    return `• ${r.reservedDate} ${r.reservedTime} — ${r.partySize} persona(s) (${STATUS_MAP[r.status ?? ''] ?? r.status})`;
  });

  return `Tus reservas:\n\n${lines.join('\n')}`;
}

export async function cancelarReservaProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = cancelarReservaSchema.safeParse(params);
  if (!parsed.success) {
    return 'No pude identificar cuál reserva deseas cancelar. Por favor indícame el número de la reserva.';
  }

  const { reserva_id } = parsed.data;

  const [reservation] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, reserva_id), eq(reservations.tenantId, tenantId), eq(reservations.customerId, customerId)));

  if (!reservation) return 'No encontré esa reserva. Escribe "ver reservas" para ver tus reservas activas.';
  if (reservation.status === 'cancelled') return 'Esa reserva ya fue cancelada anteriormente.';

  await db.update(reservations).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(reservations.id, reserva_id));

  return `✅ Tu reserva del ${reservation.reservedDate} a las ${reservation.reservedTime} ha sido cancelada. Si deseas hacer una nueva reserva, con gusto te ayudo.`;
}

import { z } from 'zod';
import { db, appointments, products, ilike, eq, and, desc } from '@saas/db';
import { checkSlotAvailable, findAlternativeSlots, formatSlot } from '../scheduling.engine.js';

const paramsSchema = z.object({
  servicio: z.string().min(1),
  fecha_hora: z.string().min(1),
  duracion_minutos: z.coerce.number().int().positive().optional(),
});

export async function crearCitaProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return 'No pude entender los detalles de tu cita. ¿Puedes indicarme el servicio y el horario que deseas?';
  }

  const { servicio, fecha_hora, duracion_minutos } = parsed.data;

  // Find service by name (fuzzy)
  const [service] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), ilike(products.name, `%${servicio}%`), eq(products.isActive, true)))
    .limit(1);

  if (!service) {
    return `No encontré el servicio "${servicio}". ¿Puedes indicarme el nombre exacto? Escribe "ver catálogo" para ver los disponibles.`;
  }

  let scheduledAt: Date;
  try {
    scheduledAt = new Date(fecha_hora);
    if (isNaN(scheduledAt.getTime())) throw new Error('invalid date');
  } catch {
    return 'La fecha indicada no es válida. Por favor indícame la fecha y hora en formato claro (ej: "lunes 19 de mayo a las 3pm").';
  }

  const duration = duracion_minutos ?? service.durationMinutes ?? 60;
  const available = await checkSlotAvailable(tenantId, scheduledAt, duration);

  if (!available) {
    const alternatives = await findAlternativeSlots(tenantId, scheduledAt, duration, 3);
    if (alternatives.length === 0) {
      return `Lo siento, el horario solicitado no está disponible y no encontré alternativas próximas. Por favor contáctanos directamente.`;
    }
    const altText = alternatives.map((d, i) => `${i + 1}. ${formatSlot(d)}`).join('\n');
    return `Lo siento, ese horario no está disponible. Estos son los próximos disponibles:\n\n${altText}\n\n¿Te gustaría alguno de estos?`;
  }

  // Create appointment
  const [appointment] = await db
    .insert(appointments)
    .values({
      tenantId,
      customerId,
      serviceId: service.id,
      serviceName: service.name,
      status: 'confirmed',
      scheduledAt,
      durationMinutes: duration,
    })
    .returning();

  if (!appointment) {
    return 'Ocurrió un error al crear tu cita. Por favor intenta de nuevo.';
  }

  const dateStr = scheduledAt.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `✅ ¡Tu cita está confirmada!\n\n📋 Servicio: ${service.name}\n📅 Fecha: ${dateStr}\n⏱️ Duración: ${duration} minutos\n\nTe esperamos. Si necesitas cancelar o reagendar, escríbenos con anticipación.`;
}

export async function verCitasProcessor(tenantId: string, customerId: string): Promise<string> {
  const citas = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.customerId, customerId)))
    .orderBy(desc(appointments.scheduledAt))
    .limit(5);

  if (citas.length === 0) {
    return 'No tienes citas registradas con nosotros.';
  }

  const lines = citas.map((c) => {
    const dateStr = c.scheduledAt.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `• ${c.serviceName} — ${dateStr} (${c.status})`;
  });

  return `Tus citas:\n\n${lines.join('\n')}`;
}

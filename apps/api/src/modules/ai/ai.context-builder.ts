import { db, appointments, eq, and, gte } from '@saas/db';

export async function buildDynamicContext(tenantId: string, customerId: string): Promise<string> {
  const now = new Date();
  const upcoming = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.customerId, customerId),
        eq(appointments.status, 'confirmed'),
        gte(appointments.scheduledAt, now),
      ),
    )
    .limit(3);

  if (upcoming.length === 0) return '';

  const lines = upcoming.map((a) => {
    const dateStr = a.scheduledAt.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `- ${a.serviceName} — ${dateStr}`;
  });

  return `El cliente tiene ${upcoming.length} cita(s) próxima(s):\n${lines.join('\n')}`;
}

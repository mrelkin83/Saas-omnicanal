import { db, appointments, eq, and, sql } from '@saas/db';

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 19;
const SLOT_STEP_MINUTES = 30;

export async function checkSlotAvailable(
  tenantId: string,
  scheduledAt: Date,
  durationMinutes: number,
): Promise<boolean> {
  const endAt = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

  const [conflict] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        sql`${appointments.status} NOT IN ('cancelled')`,
        sql`${appointments.scheduledAt} < ${endAt.toISOString()}`,
        sql`(${appointments.scheduledAt} + ${appointments.durationMinutes} * interval '1 minute') > ${scheduledAt.toISOString()}`,
      ),
    )
    .limit(1);

  return !conflict;
}

export async function findAlternativeSlots(
  tenantId: string,
  requestedAt: Date,
  durationMinutes: number,
  count = 3,
): Promise<Date[]> {
  const alternatives: Date[] = [];
  const searchStart = new Date(requestedAt);

  for (let dayOffset = 0; dayOffset < 14 && alternatives.length < count; dayOffset++) {
    const day = new Date(searchStart);
    day.setDate(day.getDate() + dayOffset);

    const start = new Date(day);
    start.setHours(WORK_START_HOUR, 0, 0, 0);
    const end = new Date(day);
    end.setHours(WORK_END_HOUR, 0, 0, 0);

    // Skip Sundays (day 0)
    if (day.getDay() === 0) continue;

    const slotStart = dayOffset === 0 ? new Date(requestedAt.getTime() + SLOT_STEP_MINUTES * 60_000) : start;

    let cursor = new Date(slotStart);
    // Align to next slot boundary
    const mins = cursor.getMinutes();
    const roundedMins = Math.ceil(mins / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
    cursor.setMinutes(roundedMins, 0, 0);

    while (cursor < end && alternatives.length < count) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
      if (slotEnd <= end) {
        const available = await checkSlotAvailable(tenantId, cursor, durationMinutes);
        if (available) alternatives.push(new Date(cursor));
      }
      cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60_000);
    }
  }

  return alternatives;
}

export function formatSlot(date: Date): string {
  return date.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

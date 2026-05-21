import { db, appointments, customers, tenants, eq, and, gte, lte, isNull } from '@saas/db';
import { sendMessage } from '../modules/channels/core/channel-manager.js';

let timer: ReturnType<typeof setInterval> | null = null;

async function sendAppointmentReminders(): Promise<void> {
  try {
    const now = new Date();
    // Window: appointments starting between 23 and 25 hours from now
    const windowStart = new Date(now.getTime() + 23 * 3600_000);
    const windowEnd = new Date(now.getTime() + 25 * 3600_000);

    const rows = await db
      .select({
        id: appointments.id,
        tenantId: appointments.tenantId,
        serviceName: appointments.serviceName,
        scheduledAt: appointments.scheduledAt,
        customerPhone: customers.phone,
        customerName: customers.displayName,
        tenantName: tenants.name,
      })
      .from(appointments)
      .innerJoin(customers, eq(appointments.customerId, customers.id))
      .innerJoin(tenants, eq(appointments.tenantId, tenants.id))
      .where(
        and(
          eq(appointments.status, 'confirmed'),
          eq(appointments.reminderSent, false),
          gte(appointments.scheduledAt, windowStart),
          lte(appointments.scheduledAt, windowEnd),
          isNull(tenants.suspendedAt),
        ),
      );

    for (const row of rows) {
      if (!row.customerPhone) continue;

      const hora = new Date(row.scheduledAt).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
      });

      const nombre = row.customerName ?? row.customerPhone;
      const text =
        `¡Hola ${nombre}! 👋 Te recordamos que mañana tienes:\n` +
        `📅 ${row.serviceName}\n` +
        `🕐 ${hora} en ${row.tenantName}\n\n` +
        `¿Confirmas tu asistencia? Responde *SI* o *NO*`;

      try {
        await sendMessage(row.tenantId, 'whatsapp', row.customerPhone, { type: 'text', text });
        await db
          .update(appointments)
          .set({ reminderSent: true, updatedAt: new Date() })
          .where(eq(appointments.id, row.id));
      } catch {
        // Channel not connected or send failed — skip silently, retry next cycle
      }
    }
  } catch {
    // DB may not be ready — retry on next interval
  }
}

export function startReminderJob(): void {
  if (timer) return;
  void sendAppointmentReminders();
  timer = setInterval(() => { void sendAppointmentReminders(); }, 60 * 60 * 1000);
}

export async function stopReminderJob(): Promise<void> {
  if (timer) { clearInterval(timer); timer = null; }
}

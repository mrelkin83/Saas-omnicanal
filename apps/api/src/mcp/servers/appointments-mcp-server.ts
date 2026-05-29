import { z } from 'zod';
import { db, appointments, products, eq, and, desc } from '@saas/db';
import { checkSlotAvailable, findAlternativeSlots } from '../../modules/ai/scheduling.engine.js';
import type { MCPServer } from '../core/mcp-server.interface.js';

const fmtDate = (d: Date) =>
  d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

export const appointmentsMCPServer: MCPServer = {
  name: 'appointments',
  description: 'Gestiona citas, horarios y disponibilidad del negocio',
  capabilities: ['appointments'],
  tools: [
    {
      name: 'listServices',
      description: 'Lista los servicios disponibles para agendar',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const rows = await db
          .select()
          .from(products)
          .where(and(eq(products.tenantId, ctx.tenantId), eq(products.type, 'service'), eq(products.isActive, true)))
          .orderBy(products.name);

        if (rows.length === 0) return 'No hay servicios disponibles para agendar.';
        return `Servicios disponibles:\n${rows.map((s) => `• ${s.name} — ${s.durationMinutes ?? 60} min — $${Number(s.price ?? 0).toLocaleString('es-CO')}`).join('\n')}`;
      },
    },
    {
      name: 'getMyAppointments',
      description: 'Ver las citas del cliente',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const rows = await db
          .select()
          .from(appointments)
          .where(and(eq(appointments.tenantId, ctx.tenantId), eq(appointments.customerId, ctx.customerId)))
          .orderBy(desc(appointments.scheduledAt))
          .limit(5);

        if (rows.length === 0) return 'No tienes citas registradas.';
        return `Tus citas:\n${rows.map((a) => `• ${a.serviceName} — ${fmtDate(a.scheduledAt)} (${a.status})`).join('\n')}`;
      },
    },
    {
      name: 'checkAvailability',
      description: 'Verifica disponibilidad de un servicio en una fecha y hora',
      parameters: z.object({
        serviceName: z.string().describe('Nombre del servicio'),
        dateTime: z.string().describe('Fecha y hora en formato ISO8601 (ej: 2026-06-15T14:00:00)'),
      }),
      execute: async (params, ctx) => {
        const serviceName = (params.serviceName as string | undefined) ?? '';
        const dateTime = (params.dateTime as string | undefined) ?? '';

        const rows = await db
          .select()
          .from(products)
          .where(and(eq(products.tenantId, ctx.tenantId), eq(products.type, 'service')))
          .limit(50);

        const service = rows.find((s) => s.name.toLowerCase().includes(serviceName.toLowerCase()));

        if (!service) return `No encontré el servicio "${serviceName}".`;

        const scheduledAt = new Date(dateTime);
        if (isNaN(scheduledAt.getTime())) return 'La fecha/hora no es válida.';

        const duration = service.durationMinutes ?? 60;
        const available = await checkSlotAvailable(ctx.tenantId, scheduledAt, duration);

        if (available) {
          return `✅ El horario ${fmtDate(scheduledAt)} está disponible para ${service.name}.`;
        }

        const alternatives = await findAlternativeSlots(ctx.tenantId, scheduledAt, duration, 3);
        if (alternatives.length === 0) {
          return `❌ El horario no está disponible y no hay alternativas cercanas.`;
        }
        return `❌ Ese horario no está disponible. Alternativas:\n${alternatives.map((d, i) => `${i + 1}. ${fmtDate(d)}`).join('\n')}`;
      },
    },
    {
      name: 'createAppointment',
      description: 'Crea una nueva cita para el cliente',
      parameters: z.object({
        serviceName: z.string().describe('Nombre del servicio'),
        dateTime: z.string().describe('Fecha y hora en formato ISO8601'),
      }),
      execute: async (params, ctx) => {
        const serviceName = (params.serviceName as string | undefined) ?? '';
        const dateTime = (params.dateTime as string | undefined) ?? '';

        const rows = await db
          .select()
          .from(products)
          .where(and(eq(products.tenantId, ctx.tenantId), eq(products.type, 'service')))
          .limit(50);

        const service = rows.find((s) => s.name.toLowerCase().includes(serviceName.toLowerCase()));

        if (!service) return `No encontré el servicio "${serviceName}".`;

        const scheduledAt = new Date(dateTime);
        if (isNaN(scheduledAt.getTime())) return 'La fecha/hora no es válida.';

        const duration = service.durationMinutes ?? 60;
        const available = await checkSlotAvailable(ctx.tenantId, scheduledAt, duration);
        if (!available) {
          return 'Ese horario ya no está disponible. Por favor elige otro horario.';
        }

        const [appointment] = await db
          .insert(appointments)
          .values({
            tenantId: ctx.tenantId,
            customerId: ctx.customerId,
            serviceId: service.id,
            serviceName: service.name,
            status: 'confirmed',
            scheduledAt,
            durationMinutes: duration,
          } as never)
          .returning();

        if (!appointment) return 'Ocurrió un error al crear la cita. Intenta de nuevo.';

        return `✅ ¡Cita confirmada!\n\n📋 ${service.name}\n📅 ${fmtDate(scheduledAt)}\n⏱️ ${duration} minutos`;
      },
    },
    {
      name: 'cancelAppointment',
      description: 'Cancela una cita existente',
      parameters: z.object({
        serviceName: z.string().optional().describe('Nombre del servicio a cancelar (si tiene varias)'),
      }),
      execute: async (params, ctx) => {
        const serviceName = (params.serviceName as string | undefined) ?? undefined;
        const conditions = [eq(appointments.tenantId, ctx.tenantId), eq(appointments.customerId, ctx.customerId)];

        if (serviceName) {
          const rows = await db
            .select()
            .from(appointments)
            .where(and(...conditions, eq(appointments.status, 'confirmed')))
            .orderBy(desc(appointments.scheduledAt))
            .limit(5);

          const match = rows.find((a) => a.serviceName.toLowerCase().includes(serviceName.toLowerCase()));
          if (!match) return `No encontré una cita activa para "${serviceName}".`;

          await db.update(appointments).set({ status: 'cancelled' }).where(eq(appointments.id, match.id));
          return `✅ Cita cancelada: ${match.serviceName} — ${fmtDate(match.scheduledAt)}`;
        }

        // Cancel most recent
        const [recent] = await db
          .select()
          .from(appointments)
          .where(and(...conditions, eq(appointments.status, 'confirmed')))
          .orderBy(desc(appointments.scheduledAt))
          .limit(1);

        if (!recent) return 'No tienes citas activas para cancelar.';

        await db.update(appointments).set({ status: 'cancelled' }).where(eq(appointments.id, recent.id));
        return `✅ Cita cancelada: ${recent.serviceName} — ${fmtDate(recent.scheduledAt)}`;
      },
    },
  ],
};

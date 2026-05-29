import { z } from 'zod';
import { db, reservations, eq, and, desc } from '@saas/db';
import type { MCPServer } from '../core/mcp-server.interface.js';

export const reservationsMCPServer: MCPServer = {
  name: 'reservations',
  description: 'Gestiona reservas de mesas, habitaciones o espacios',
  capabilities: ['reservations'],
  tools: [
    {
      name: 'createReservation',
      description: 'Crea una nueva reserva',
      parameters: z.object({
        date: z.string().describe('Fecha en formato YYYY-MM-DD'),
        time: z.string().describe('Hora en formato HH:mm'),
        partySize: z.number().int().positive().default(1).describe('Número de personas'),
        notes: z.string().optional().describe('Notas especiales'),
        resourceType: z.string().optional().describe('Tipo de espacio: mesa, habitación, salón, etc.'),
        resourceName: z.string().optional().describe('Nombre específico del espacio'),
      }),
      execute: async (params, ctx) => {
        const values: Record<string, unknown> = {
          tenantId: ctx.tenantId,
          customerId: ctx.customerId,
          reservedDate: params.date,
          reservedTime: params.time,
          partySize: params.partySize,
          status: 'confirmed',
        };
        if (params.notes) values.notes = params.notes;
        if (params.resourceType) values.resourceType = params.resourceType;
        if (params.resourceName) values.resourceName = params.resourceName;

        const [reservation] = await db.insert(reservations).values(values as never).returning();

        if (!reservation) return 'Error creando la reserva.';

        return `✅ ¡Reserva confirmada!\n\n📅 ${params.date} a las ${params.time}\n👥 ${params.partySize} personas${params.resourceType ? `\n🏷️ ${params.resourceType}${params.resourceName ? `: ${params.resourceName}` : ''}` : ''}${params.notes ? `\n📝 ${params.notes}` : ''}`;
      },
    },
    {
      name: 'getMyReservations',
      description: 'Muestra las reservas del cliente',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const rows = await db
          .select()
          .from(reservations)
          .where(and(eq(reservations.tenantId, ctx.tenantId), eq(reservations.customerId, ctx.customerId)))
          .orderBy(desc(reservations.reservedDate), desc(reservations.reservedTime))
          .limit(5);

        if (rows.length === 0) return 'No tienes reservas registradas.';

        return rows.map((r) => `• ${r.reservedDate} ${r.reservedTime} — ${r.partySize} personas — ${r.status}${r.resourceType ? ` (${r.resourceType})` : ''}`).join('\n');
      },
    },
    {
      name: 'cancelReservation',
      description: 'Cancela una reserva',
      parameters: z.object({
        reservationId: z.string().optional().describe('ID de la reserva (opcional, cancela la más reciente si no se indica)'),
      }),
      execute: async (params, ctx) => {
        const reservationId = params.reservationId as string | undefined;
        if (reservationId) {
          await db.update(reservations).set({ status: 'cancelled' }).where(and(eq(reservations.id, reservationId), eq(reservations.tenantId, ctx.tenantId), eq(reservations.customerId, ctx.customerId)));
          return '✅ Reserva cancelada.';
        }

        const [recent] = await db
          .select()
          .from(reservations)
          .where(and(eq(reservations.tenantId, ctx.tenantId), eq(reservations.customerId, ctx.customerId), eq(reservations.status, 'confirmed')))
          .orderBy(desc(reservations.reservedDate), desc(reservations.reservedTime))
          .limit(1);

        if (!recent) return 'No tienes reservas activas para cancelar.';

        await db.update(reservations).set({ status: 'cancelled' }).where(eq(reservations.id, recent.id));
        return `✅ Reserva cancelada: ${recent.reservedDate} ${recent.reservedTime}`;
      },
    },
  ],
};

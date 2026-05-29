import { z } from 'zod';
import { db, customers, messages, conversations, eq, and, desc, inArray } from '@saas/db';
import type { MCPServer } from '../core/mcp-server.interface.js';

export const customerMCPServer: MCPServer = {
  name: 'customer',
  description: 'Gestiona información del perfil del cliente',
  capabilities: [], // always available
  tools: [
    {
      name: 'getProfile',
      description: 'Obtiene el perfil completo del cliente',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const [customer] = await db
          .select()
          .from(customers)
          .where(and(eq(customers.tenantId, ctx.tenantId), eq(customers.id, ctx.customerId)))
          .limit(1);

        if (!customer) return 'No encontré tu perfil.';

        const lines = [
          `👤 ${customer.fullName ?? customer.displayName ?? 'Cliente'}`,
          customer.phone && `📱 ${customer.phone}`,
          customer.email && `📧 ${customer.email}`,
          customer.address && `📍 ${customer.address}`,
          customer.tags && customer.tags.length > 0 && `🏷️ Etiquetas: ${customer.tags.join(', ')}`,
        ].filter(Boolean);

        return lines.join('\n');
      },
    },
    {
      name: 'updateProfile',
      description: 'Actualiza datos del perfil del cliente',
      parameters: z.object({
        fullName: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
      }),
      execute: async (params, ctx) => {
        const updates: Record<string, unknown> = {};
        if (params.fullName) updates.fullName = params.fullName;
        if (params.email) updates.email = params.email;
        if (params.address) updates.address = params.address;
        if (params.phone) updates.phone = params.phone;

        if (Object.keys(updates).length === 0) return 'No se indicaron datos para actualizar.';

        await db.update(customers).set(updates).where(and(eq(customers.id, ctx.customerId), eq(customers.tenantId, ctx.tenantId)));
        return '✅ Tu perfil ha sido actualizado.';
      },
    },
    {
      name: 'getConversationHistory',
      description: 'Obtiene el historial de conversaciones recientes del cliente',
      parameters: z.object({
        limit: z.number().int().positive().default(5).describe('Cantidad de mensajes recientes'),
      }),
      execute: async (params, ctx) => {
        const limit = (params.limit as number | undefined) ?? 5;

        const convs = await db
          .select()
          .from(conversations)
          .where(and(eq(conversations.tenantId, ctx.tenantId), eq(conversations.customerId, ctx.customerId)))
          .orderBy(desc(conversations.lastMessageAt))
          .limit(3);

        if (convs.length === 0) return 'No hay historial de conversaciones.';

        const msgs = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.tenantId, ctx.tenantId),
              inArray(messages.conversationId, convs.map((c) => c.id)),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(limit);

        if (msgs.length === 0) return 'No hay mensajes recientes.';

        return msgs
          .map((m) => {
            const content = m.content ?? '';
            return `${m.senderType === 'customer' ? '👤' : '🤖'} ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`;
          })
          .join('\n');
      },
    },
    {
      name: 'escalamiento',
      description: 'Transfiere la conversación a un agente humano cuando el cliente lo solicita',
      parameters: z.object({
        motivo: z.string().optional().describe('Motivo por el cual el cliente quiere hablar con un humano'),
      }),
      execute: async (_params, _ctx) => {
        return 'Escalamiento solicitado. Transferiendo con un agente humano...';
      },
    },
  ],
};

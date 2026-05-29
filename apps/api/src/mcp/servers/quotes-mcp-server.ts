import { z } from 'zod';
import { db, quotes, eq, and, desc } from '@saas/db';
import type { MCPServer } from '../core/mcp-server.interface.js';

const fmtCop = (n: number | string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));

export const quotesMCPServer: MCPServer = {
  name: 'quotes',
  description: 'Gestiona cotizaciones para el cliente',
  capabilities: ['quotes'],
  tools: [
    {
      name: 'createQuote',
      description: 'Crea una nueva cotización con items',
      parameters: z.object({
        notes: z.string().describe('Descripción general de lo que se cotiza'),
        items: z.array(
          z.object({
            description: z.string().describe('Descripción del item'),
            quantity: z.number().int().positive().default(1),
            unitPrice: z.number().positive().describe('Precio unitario'),
          }),
        ).describe('Items de la cotización'),
      }),
      execute: async (params, ctx) => {
        const items = params.items as Array<{ description: string; quantity: number; unitPrice: number }>;
        const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const quoteNumber = `COT-${Date.now().toString(36).toUpperCase()}`;

        const [quote] = await db
          .insert(quotes)
          .values({
            tenantId: ctx.tenantId,
            customerId: ctx.customerId,
            quoteNumber,
            items,
            subtotal: String(subtotal),
            total: String(subtotal),
            status: 'pending',
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
          .returning();

        if (!quote) return 'Error creando la cotización.';

        const lines = items.map((i) => `• ${i.quantity}x ${i.description} — ${fmtCop(i.unitPrice * i.quantity)}`);
        return `📄 Cotización ${quoteNumber}\n\n${params.notes}\n\n${lines.join('\n')}\n\n*Total: ${fmtCop(subtotal)}*\nVálida por 7 días.`;
      },
    },
    {
      name: 'getMyQuotes',
      description: 'Muestra las cotizaciones del cliente',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const rows = await db
          .select()
          .from(quotes)
          .where(and(eq(quotes.tenantId, ctx.tenantId), eq(quotes.customerId, ctx.customerId)))
          .orderBy(desc(quotes.createdAt))
          .limit(3);

        if (rows.length === 0) return 'No tienes cotizaciones registradas.';

        const STATUS: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', expired: 'Vencida' };
        return rows.map((q) => `📄 ${q.quoteNumber} — ${fmtCop(q.total)} — ${STATUS[q.status ?? ''] ?? q.status}`).join('\n');
      },
    },
  ],
};

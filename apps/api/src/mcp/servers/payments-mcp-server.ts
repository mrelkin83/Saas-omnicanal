import { z } from 'zod';
import { db, payments, orders, eq, and, desc } from '@saas/db';
import { createPaymentLink } from '../../lib/wompi-client.js';
import { getTenantWompiCredentials, WompiNotConfiguredError } from '../../lib/wompi-tenant.js';
import type { MCPServer } from '../core/mcp-server.interface.js';

const fmtCop = (n: number | string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));

export const paymentsMCPServer: MCPServer = {
  name: 'payments',
  description: 'Gestiona pagos mediante links Wompi',
  capabilities: ['payments'],
  tools: [
    {
      name: 'createPaymentLink',
      description: 'Genera un link de pago Wompi para un pedido existente o monto específico',
      parameters: z.object({
        orderNumber: z.string().optional().describe('Número de pedido para pagar'),
        amount: z.number().positive().optional().describe('Monto a pagar (si no hay pedido)'),
        description: z.string().optional().describe('Descripción del pago'),
      }),
      execute: async (params, ctx) => {
        const orderNumber = params.orderNumber as string | undefined;
        const amountInput = params.amount as number | undefined;
        let amount: number | undefined = amountInput;
        let orderId: string | undefined;

        if (orderNumber) {
          const [order] = await db
            .select()
            .from(orders)
            .where(and(eq(orders.tenantId, ctx.tenantId), eq(orders.orderNumber, orderNumber), eq(orders.customerId, ctx.customerId)))
            .limit(1);

          if (!order) return `No encontré el pedido ${orderNumber}.`;
          if (order.paymentStatus === 'paid') return `El pedido ${orderNumber} ya está pagado.`;
          amount = Number(order.total);
          orderId = order.id;
        }

        if (!amount) return 'Indica el monto o el número de pedido para generar el link de pago.';

        let creds;
        try {
          creds = await getTenantWompiCredentials(ctx.tenantId);
        } catch (err) {
          if (err instanceof WompiNotConfiguredError) return 'El pago online no está configurado. Por favor contáctanos directamente.';
          throw err;
        }

        const reference = `PAY-${Date.now().toString(36).toUpperCase()}`;
        const amountInCents = Math.round(amount * 100);

        const { id: linkId, url } = await createPaymentLink(creds, {
          reference,
          amountInCents,
          redirectUrl: `${process.env['WEB_BASE_URL'] ?? 'http://localhost:3000'}/payment/success`,
        });

        await db.insert(payments).values({
          tenantId: ctx.tenantId,
          customerId: ctx.customerId,
          orderId,
          provider: 'wompi',
          externalId: linkId,
          reference,
          amount: String(amount),
          currency: 'COP',
          status: 'pending',
          paymentLink: url,
        });

        return `💳 Link de pago generado: ${url}\n\nMonto: ${fmtCop(amount)}\nPuedes pagar con Nequi, Daviplata, tarjeta o PSE.`;
      },
    },
    {
      name: 'getPaymentStatus',
      description: 'Consulta estado de pagos del cliente',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const rows = await db
          .select()
          .from(payments)
          .where(and(eq(payments.tenantId, ctx.tenantId), eq(payments.customerId, ctx.customerId)))
          .orderBy(desc(payments.createdAt))
          .limit(5);

        if (rows.length === 0) return 'No tienes pagos registrados.';

        const STATUS: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobado', declined: 'Rechazado', voided: 'Anulado' };
        return rows.map((p) => `• ${fmtCop(p.amount)} — ${STATUS[p.status ?? ''] ?? p.status} — ${p.createdAt.toLocaleDateString('es-CO')}`).join('\n');
      },
    },
  ],
};

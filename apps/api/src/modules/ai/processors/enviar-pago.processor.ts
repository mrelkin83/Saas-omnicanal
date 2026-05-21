import { z } from 'zod';
import { db, payments, orders, customers, eq, and, desc } from '@saas/db';
import { createPaymentLink } from '../../../lib/wompi-client.js';
import { getTenantWompiCredentials, WompiNotConfiguredError } from '../../../lib/wompi-tenant.js';

const paramsSchema = z.object({
  monto: z.coerce.number().positive(),
  concepto: z.string().min(1),
});

export async function enviarPagoProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return 'No pude entender el monto o el concepto del pago. ¿Puedes indicarme cuánto es y por qué concepto?';
  }

  let creds: Awaited<ReturnType<typeof getTenantWompiCredentials>>;
  try {
    creds = await getTenantWompiCredentials(tenantId);
  } catch (err) {
    if (err instanceof WompiNotConfiguredError) {
      return 'Para recibir pagos debes configurar tu cuenta Wompi en *Configuración → Integraciones*. Una vez activa podremos generar links de pago directamente desde la conversación.';
    }
    return 'Hubo un problema accediendo a la configuración de pagos. Contacta al administrador.';
  }

  const { monto, concepto } = parsed.data;
  const amountInCents = Math.round(monto * 100);
  const reference = `${tenantId.slice(0, 8)}-${customerId.slice(0, 8)}-${Date.now()}`;

  const [customer] = await db
    .select({ email: customers.email })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)));

  const linkParams: Parameters<typeof createPaymentLink>[1] = { reference, amountInCents };
  if (customer?.email) linkParams.customerEmail = customer.email;

  let link: { id: string; url: string };
  try {
    link = await createPaymentLink(creds, linkParams);
  } catch {
    return 'Hubo un problema generando el link de pago. Por favor intenta de nuevo o contáctanos directamente.';
  }

  // Link to the customer's most recent pending order so the Wompi webhook
  // can update the order status when payment is confirmed.
  const [pendingOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId), eq(orders.paymentStatus, 'pending')))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  await db.insert(payments).values({
    tenantId,
    customerId,
    orderId: pendingOrder?.id ?? null,
    provider: 'wompi',
    externalId: link.id,
    amount: String(monto),
    currency: 'COP',
    status: 'pending',
    paymentLink: link.url,
    metadata: { concepto, reference },
  });

  const formattedAmount = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(monto);

  return `💳 *Link de pago generado*\n\nConcepto: ${concepto}\nMonto: ${formattedAmount}\n\n👉 ${link.url}\n\nEste link es de un solo uso. Una vez realices el pago te confirmaremos por aquí.`;
}

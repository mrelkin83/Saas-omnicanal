import { z } from 'zod';
import { db, payments, customers, eq, and } from '@saas/db';
import { createPaymentLink } from '../../../lib/wompi-client.js';

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

  const { monto, concepto } = parsed.data;
  const amountInCents = Math.round(monto * 100);
  const reference = `${tenantId.slice(0, 8)}-${customerId.slice(0, 8)}-${Date.now()}`;

  const [customer] = await db
    .select({ email: customers.email })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)));

  const linkParams: Parameters<typeof createPaymentLink>[0] = { reference, amountInCents };
  if (customer?.email) linkParams.customerEmail = customer.email;

  let link: { id: string; url: string };
  try {
    link = await createPaymentLink(linkParams);
  } catch {
    return 'Hubo un problema generando el link de pago. Por favor intenta de nuevo o contáctanos directamente.';
  }

  await db.insert(payments).values({
    tenantId,
    customerId,
    provider: 'wompi',
    externalId: link.id,
    amount: String(monto),
    currency: 'COP',
    status: 'pending',
    paymentLink: link.url,
    metadata: { concepto, reference },
  });

  const formattedAmount = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(monto);

  return `💳 *Link de pago generado*\n\nConcepto: ${concepto}\nMonto: ${formattedAmount}\n\n👉 ${link.url}\n\nEste link es de un solo uso. Una vez realices el pago te confirmaremos por aquí.`;
}

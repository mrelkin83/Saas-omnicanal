import { createHmac } from 'node:crypto';

const ENV = process.env['WOMPI_ENV'] ?? 'sandbox';
const PUBLIC_KEY = process.env['WOMPI_SANDBOX_PUBLIC_KEY'] ?? '';
const PRIVATE_KEY = process.env['WOMPI_SANDBOX_PRIVATE_KEY'] ?? '';
const EVENT_SECRET = process.env['WOMPI_EVENT_SECRET'] ?? '';

const BASE_URL = ENV === 'production'
  ? 'https://production.wompi.co/v1'
  : 'https://sandbox.wompi.co/v1';

const WIDGET_URL = ENV === 'production'
  ? 'https://checkout.wompi.co/p/'
  : 'https://checkout.wompi.co/p/';

interface WompiTransaction {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
  amount_in_cents: number;
  currency: string;
  reference: string;
  customer_email: string | null;
  payment_method_type: string | null;
}

async function wompiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PRIVATE_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wompi ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function createPaymentLink(params: {
  reference: string;
  amountInCents: number;
  currency?: string;
  expiresAt?: string;
  customerEmail?: string;
  redirectUrl?: string;
}): Promise<{ id: string; url: string }> {
  const payload = {
    name: params.reference,
    description: params.reference,
    single_use: true,
    collect_shipping: false,
    currency: params.currency ?? 'COP',
    amount_in_cents: params.amountInCents,
    expires_at: params.expiresAt,
    redirect_url: params.redirectUrl,
    customer_data: params.customerEmail ? { customer_email: params.customerEmail } : undefined,
  };

  const res = await wompiRequest<{ data: { id: string } }>('POST', '/payment_links', payload);
  const linkId = res.data.id;
  return { id: linkId, url: `${WIDGET_URL}?publicKey=${PUBLIC_KEY}&currency=${payload.currency}&amountInCents=${payload.amount_in_cents}&reference=${params.reference}` };
}

export async function getTransaction(transactionId: string): Promise<WompiTransaction> {
  const res = await wompiRequest<{ data: WompiTransaction }>('GET', `/transactions/${transactionId}`);
  return res.data;
}

export function verifyWompiSignature(payload: string, checksum: string, timestamp: string): boolean {
  if (!EVENT_SECRET) return true; // skip in dev if not configured
  const toSign = `${payload}${timestamp}${EVENT_SECRET}`;
  const expected = createHmac('sha256', EVENT_SECRET).update(toSign).digest('hex');
  return expected === checksum;
}

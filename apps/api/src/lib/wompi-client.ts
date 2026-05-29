import { createHmac } from 'node:crypto';

export interface WompiCredentials {
  publicKey: string;
  privateKey: string;
  eventSecret: string;
  environment: 'sandbox' | 'production';
}

interface WompiTransaction {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
  amount_in_cents: number;
  currency: string;
  reference: string;
  customer_email: string | null;
  payment_method_type: string | null;
}

const WIDGET_URL = 'https://checkout.wompi.co/p/';

function apiBaseUrl(environment: string): string {
  return environment === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';
}

async function wompiRequest<T>(
  creds: WompiCredentials,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${apiBaseUrl(creds.environment)}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.privateKey}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wompi ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function createPaymentLink(
  creds: WompiCredentials,
  params: {
    reference: string;
    amountInCents: number;
    currency?: string;
    expiresAt?: string;
    customerEmail?: string;
    redirectUrl?: string;
  },
): Promise<{ id: string; url: string }> {
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

  const res = await wompiRequest<{ data: { id: string } }>(creds, 'POST', '/payment_links', payload);
  const linkId = res.data.id;
  const url = `${WIDGET_URL}?publicKey=${creds.publicKey}&currency=${payload.currency}&amountInCents=${payload.amount_in_cents}&reference=${params.reference}`;
  return { id: linkId, url };
}

export async function getTransaction(
  creds: WompiCredentials,
  transactionId: string,
): Promise<WompiTransaction> {
  const res = await wompiRequest<{ data: WompiTransaction }>(creds, 'GET', `/transactions/${transactionId}`);
  return res.data;
}

export function verifyWompiSignature(
  payload: string,
  checksum: string,
  timestamp: string,
  eventSecret: string,
): boolean {
  if (!eventSecret) return false;
  const toSign = `${payload}${timestamp}${eventSecret}`;
  const expected = createHmac('sha256', eventSecret).update(toSign).digest('hex');
  return expected === checksum;
}

import { db, integrations, eq, and } from '@saas/db';
import { decrypt } from './crypto.js';
import type { WompiCredentials } from './wompi-client.js';

export class WompiNotConfiguredError extends Error {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} no tiene integración Wompi activa`);
    this.name = 'WompiNotConfiguredError';
  }
}

function decryptField(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  if (value.startsWith('enc:')) return decrypt(value.slice(4));
  return value;
}

export async function getTenantWompiCredentials(tenantId: string): Promise<WompiCredentials> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, 'wompi'),
        eq(integrations.isActive, true),
      ),
    )
    .limit(1);

  if (!row) throw new WompiNotConfiguredError(tenantId);

  const config = row.config as Record<string, unknown>;

  return {
    publicKey: String(config['publicKey'] ?? ''),
    privateKey: decryptField(config['privateKey']),
    eventSecret: decryptField(config['eventSecret']),
    environment: config['environment'] === 'production' ? 'production' : 'sandbox',
  };
}

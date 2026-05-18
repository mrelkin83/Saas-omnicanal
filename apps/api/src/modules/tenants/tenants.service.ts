import { db, tenants, tenantConfig, eq, and } from '@saas/db';
import { redis } from '../../lib/redis.js';
import type { PatchTenantInput } from './tenants.schemas.js';

export async function getTenantById(id: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });
}

export async function updateTenant(id: string, data: PatchTenantInput) {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData['name'] = data.name;
  if (data.phone !== undefined) updateData['phone'] = data.phone;
  if (data.address !== undefined) updateData['address'] = data.address;
  if (data.description !== undefined) updateData['description'] = data.description;
  if (data.logoUrl !== undefined) updateData['logoUrl'] = data.logoUrl;
  if (data.website !== undefined) updateData['website'] = data.website;
  if (data.aiModel !== undefined) updateData['aiModel'] = data.aiModel;
  if (data.aiTemperature !== undefined) updateData['aiTemperature'] = String(data.aiTemperature);
  if (data.aiMaxTokens !== undefined) updateData['aiMaxTokens'] = data.aiMaxTokens;
  if (data.aiAgentName !== undefined) updateData['aiAgentName'] = data.aiAgentName;
  if (data.aiTone !== undefined) updateData['aiTone'] = data.aiTone;
  if (data.billingEmail !== undefined) updateData['billingEmail'] = data.billingEmail;

  if (Object.keys(updateData).length === 0) {
    return getTenantById(id);
  }

  updateData['updatedAt'] = new Date();

  const [updated] = await db
    .update(tenants)
    .set(updateData)
    .where(eq(tenants.id, id))
    .returning();

  return updated;
}

const configCacheKey = (tenantId: string, key: string) => `config:${tenantId}:${key}`;

export async function getConfig(tenantId: string, key: string): Promise<{ key: string; value: unknown } | null> {
  const cacheKey = configCacheKey(tenantId, key);
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return { key, value: JSON.parse(cached) as unknown };
  }

  const [row] = await db
    .select()
    .from(tenantConfig)
    .where(and(eq(tenantConfig.tenantId, tenantId), eq(tenantConfig.key, key)));

  if (!row) return null;

  await redis.set(cacheKey, JSON.stringify(row.value), 'EX', 300);
  return { key: row.key, value: row.value };
}

export async function setConfig(tenantId: string, key: string, value: unknown): Promise<{ key: string; value: unknown }> {
  await db
    .insert(tenantConfig)
    .values({ tenantId, key, value })
    .onConflictDoUpdate({
      target: [tenantConfig.tenantId, tenantConfig.key],
      set: { value, updatedAt: new Date() },
    });

  await redis.del(configCacheKey(tenantId, key));
  return { key, value };
}

export async function getAllConfig(tenantId: string): Promise<Record<string, unknown>> {
  const rows = await db.select().from(tenantConfig).where(eq(tenantConfig.tenantId, tenantId));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

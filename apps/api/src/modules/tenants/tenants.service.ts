import { db, tenants, eq } from '@saas/db';
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

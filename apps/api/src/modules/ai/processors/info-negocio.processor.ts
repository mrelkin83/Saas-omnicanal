import type { Tenant } from '@saas/db';

export function infoNegocioProcessor(tenant: Tenant): string {
  const lines: string[] = [`📍 ${tenant.name}`];
  if (tenant.description) lines.push(tenant.description);
  if (tenant.phone) lines.push(`📞 Teléfono: ${tenant.phone}`);
  if (tenant.address) lines.push(`📌 Dirección: ${tenant.address}`);
  if (tenant.website) lines.push(`🌐 Web: ${tenant.website}`);
  return lines.join('\n');
}

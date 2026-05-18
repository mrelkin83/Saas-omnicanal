import { db, products, eq, and } from '@saas/db';

export async function verCatalogoProcessor(tenantId: string): Promise<string> {
  const items = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)));

  if (items.length === 0) {
    return 'Por el momento no tenemos servicios o productos disponibles.';
  }

  const byType: Record<string, typeof items> = {};
  for (const item of items) {
    const t = item.type ?? 'producto';
    byType[t] ??= [];
    byType[t]!.push(item);
  }

  const lines: string[] = ['Estos son nuestros servicios disponibles:\n'];
  for (const [type, list] of Object.entries(byType)) {
    const label = type === 'service' ? '🌟 Servicios' : type === 'combo' ? '🎁 Combos' : '📦 Productos';
    lines.push(`${label}:`);
    for (const item of list) {
      const price = item.price ? `$${Number(item.price).toLocaleString('es-CO')}` : '';
      const duration = item.durationMinutes ? ` (${item.durationMinutes} min)` : '';
      lines.push(`• ${item.name}${duration}${price ? ' — ' + price : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

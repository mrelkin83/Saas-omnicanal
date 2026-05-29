import { db, appointments, carts, cartItems, orders, reservations, quotes, customers, eq, and, gte, desc } from '@saas/db';
import type { ChannelType } from '../channels/core/channel-driver.interface.js';
import { adaptContextForChannel } from './channel-context-adapter.js';

const fmtDate = (d: Date) =>
  d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtCop = (n: number | string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));

export async function buildDynamicContext(tenantId: string, customerId: string, channel: ChannelType): Promise<string> {
  const now = new Date();
  const sections: string[] = [];

  // ── Perfil del cliente ───────────────────────────────────────────────────
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);

  if (customer) {
    const profile = [
      `Nombre: ${customer.fullName ?? customer.displayName ?? 'No registrado'}`,
      customer.phone && `Tel: ${customer.phone}`,
      customer.email && `Email: ${customer.email}`,
      customer.address && `Dirección: ${customer.address}`,
      customer.tags && customer.tags.length > 0 && `Etiquetas: ${customer.tags.join(', ')}`,
    ].filter(Boolean);
    sections.push(`PERFIL DEL CLIENTE:\n${profile.join('\n')}`);
  }

  // ── Carrito activo ───────────────────────────────────────────────────────
  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.tenantId, tenantId), eq(carts.customerId, customerId), eq(carts.status, 'active')))
    .limit(1);

  if (cart) {
    const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    if (items.length > 0) {
      let total = 0;
      const lines = items.map((i) => {
        const sub = Number(i.unitPrice) * i.quantity;
        total += sub;
        return `  • ${i.quantity}x ${i.productName} — ${fmtCop(sub)}`;
      });
      sections.push(`CARRITO ACTIVO:\n${lines.join('\n')}\n  Total: ${fmtCop(total)}`);
    }
  }

  // ── Citas próximas ───────────────────────────────────────────────────────
  const upcomingAppts = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.customerId, customerId), eq(appointments.status, 'confirmed'), gte(appointments.scheduledAt, now)))
    .orderBy(appointments.scheduledAt)
    .limit(3);

  if (upcomingAppts.length > 0) {
    sections.push(
      `CITAS PRÓXIMAS:\n${upcomingAppts.map((a) => `  • ${a.serviceName} — ${fmtDate(a.scheduledAt)} (${a.durationMinutes} min)`).join('\n')}`,
    );
  }

  // ── Pedidos recientes ────────────────────────────────────────────────────
  const recentOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.createdAt))
    .limit(3);

  if (recentOrders.length > 0) {
    const STATUS: Record<string, string> = { pending: 'Pendiente', confirmed: 'Confirmado', processing: 'En proceso', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
    const PAY: Record<string, string> = { pending: 'Pendiente', paid: 'Pagado', failed: 'Fallido' };
    sections.push(
      `PEDIDOS RECIENTES:\n${recentOrders.map((o) => `  • ${o.orderNumber} — ${fmtCop(o.total)} — ${STATUS[o.status ?? ''] ?? o.status} (pago: ${PAY[o.paymentStatus ?? ''] ?? o.paymentStatus})`).join('\n')}`,
    );
  }

  // ── Reservas activas ─────────────────────────────────────────────────────
  const activeReservations = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.tenantId, tenantId), eq(reservations.customerId, customerId), eq(reservations.status, 'confirmed')))
    .orderBy(desc(reservations.reservedDate), desc(reservations.reservedTime))
    .limit(3);

  if (activeReservations.length > 0) {
    sections.push(
      `RESERVAS ACTIVAS:\n${activeReservations.map((r) => `  • ${r.reservedDate} ${r.reservedTime} — ${r.partySize} personas${r.resourceType ? ` (${r.resourceType})` : ''}`).join('\n')}`,
    );
  }

  // ── Cotizaciones pendientes ──────────────────────────────────────────────
  const pendingQuotes = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.tenantId, tenantId), eq(quotes.customerId, customerId), eq(quotes.status, 'pending')))
    .orderBy(desc(quotes.createdAt))
    .limit(3);

  if (pendingQuotes.length > 0) {
    sections.push(
      `COTIZACIONES PENDIENTES:\n${pendingQuotes.map((q) => `  • ${q.quoteNumber} — ${fmtCop(q.total)} (válida hasta: ${q.validUntil ? fmtDate(q.validUntil) : 'sin fecha'})`).join('\n')}`,
    );
  }

  const rawContext = sections.join('\n\n');
  return adaptContextForChannel(rawContext, channel);
}

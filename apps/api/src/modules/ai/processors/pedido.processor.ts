import { z } from 'zod';
import { db, carts, cartItems, orders, orderItems, products, eq, and, desc } from '@saas/db';

const agregarCarritoSchema = z.object({
  producto: z.string().min(1),
  cantidad: z.coerce.number().int().positive().default(1),
});

const verEstadoPedidoSchema = z.object({
  pedido_id: z.string().uuid().optional(),
});

async function getOrCreateCart(tenantId: string, customerId: string): Promise<string> {
  const [existing] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.tenantId, tenantId), eq(carts.customerId, customerId), eq(carts.status, 'active')))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db.insert(carts).values({ tenantId, customerId, status: 'active' }).returning({ id: carts.id });
  return created!.id;
}

export async function agregarCarritoProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = agregarCarritoSchema.safeParse(params);
  if (!parsed.success) {
    return 'No entendí qué producto deseas agregar. ¿Puedes decirme el nombre del producto y la cantidad?';
  }

  const { producto, cantidad } = parsed.data;

  const allProducts = await db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)));
  const found = allProducts.find((p) => p.name.toLowerCase().includes(producto.toLowerCase()));

  if (!found || !found.price) {
    return `No encontré el producto "${producto}" en el catálogo. Escribe "ver catálogo" para ver los disponibles.`;
  }

  const cartId = await getOrCreateCart(tenantId, customerId);

  const [existingItem] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, found.id)));

  if (existingItem) {
    await db.update(cartItems).set({ quantity: existingItem.quantity + cantidad }).where(eq(cartItems.id, existingItem.id));
  } else {
    await db.insert(cartItems).values({
      cartId,
      productId: found.id,
      productName: found.name,
      quantity: cantidad,
      unitPrice: found.price,
    });
  }

  const price = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(found.price) * cantidad);
  return `✅ Agregado al carrito: ${cantidad}x ${found.name} — ${price}\n\nEscribe "ver carrito" para revisar tu pedido o "crear pedido" cuando estés listo.`;
}

export async function verCarritoProcessor(tenantId: string, customerId: string): Promise<string> {
  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.tenantId, tenantId), eq(carts.customerId, customerId), eq(carts.status, 'active')))
    .limit(1);

  if (!cart) return 'Tu carrito está vacío. Escribe "ver catálogo" para conocer nuestros productos.';

  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  if (items.length === 0) return 'Tu carrito está vacío.';

  let total = 0;
  const lines = items.map((item) => {
    const subtotal = Number(item.unitPrice) * item.quantity;
    total += subtotal;
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    return `• ${item.quantity}x ${item.productName} — ${fmt.format(subtotal)}`;
  });

  const totalFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total);
  return `🛒 *Tu carrito:*\n\n${lines.join('\n')}\n\n*Total: ${totalFmt}*\n\nEscribe "crear pedido" para confirmar o continúa agregando productos.`;
}

export async function crearPedidoProcessor(tenantId: string, customerId: string): Promise<string> {
  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.tenantId, tenantId), eq(carts.customerId, customerId), eq(carts.status, 'active')))
    .limit(1);

  if (!cart) return 'Tu carrito está vacío. Agrega productos antes de crear un pedido.';

  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  if (items.length === 0) return 'Tu carrito está vacío.';

  let subtotal = 0;
  items.forEach((item) => { subtotal += Number(item.unitPrice) * item.quantity; });

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

  const [order] = await db.insert(orders).values({
    tenantId,
    customerId,
    orderNumber,
    subtotal: String(subtotal),
    total: String(subtotal),
    status: 'pending',
    paymentStatus: 'pending',
  }).returning();

  if (!order) return 'Ocurrió un error al crear el pedido. Por favor intenta de nuevo.';

  await db.insert(orderItems).values(
    items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: String(Number(item.unitPrice) * item.quantity),
    })),
  );

  await db.update(carts).set({ status: 'converted' }).where(eq(carts.id, cart.id));

  const totalFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(subtotal);

  return `✅ *Pedido creado exitosamente*\n\n📋 N° ${orderNumber}\n💰 Total: ${totalFmt}\n\n¿Deseas pagar ahora? Escribe "pagar" para recibir el link de pago.`;
}

export async function verEstadoPedidoProcessor(
  tenantId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const parsed = verEstadoPedidoSchema.safeParse(params);

  let pedidos;
  if (parsed.success && parsed.data.pedido_id) {
    pedidos = await db.select().from(orders).where(and(eq(orders.id, parsed.data.pedido_id), eq(orders.tenantId, tenantId)));
  } else {
    pedidos = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
      .orderBy(desc(orders.createdAt))
      .limit(3);
  }

  if (pedidos.length === 0) return 'No encontré pedidos registrados.';

  const STATUS_MAP: Record<string, string> = {
    pending: 'Pendiente', confirmed: 'Confirmado', processing: 'En proceso',
    shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
  };
  const PAY_MAP: Record<string, string> = {
    pending: 'Pendiente', paid: 'Pagado', failed: 'Fallido', refunded: 'Reembolsado',
  };

  const lines = pedidos.map((o) => {
    const totalFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(o.total));
    return `📦 ${o.orderNumber} — ${totalFmt}\nEstado: ${STATUS_MAP[o.status ?? ''] ?? o.status} | Pago: ${PAY_MAP[o.paymentStatus ?? ''] ?? o.paymentStatus}`;
  });

  return lines.join('\n\n');
}

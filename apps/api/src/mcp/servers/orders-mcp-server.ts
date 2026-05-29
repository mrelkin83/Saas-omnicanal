import { z } from 'zod';
import { db, carts, cartItems, orders, orderItems, products, eq, and, desc } from '@saas/db';
import type { MCPServer } from '../core/mcp-server.interface.js';

const fmtCop = (n: number | string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));

async function getOrCreateCartId(tenantId: string, customerId: string): Promise<string> {
  const [existing] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.tenantId, tenantId), eq(carts.customerId, customerId), eq(carts.status, 'active')))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(carts).values({ tenantId, customerId, status: 'active' }).returning({ id: carts.id });
  return created!.id;
}

export const ordersMCPServer: MCPServer = {
  name: 'orders',
  description: 'Gestiona carrito de compras y pedidos',
  capabilities: ['cart_orders'],
  tools: [
    {
      name: 'addToCart',
      description: 'Agrega un producto al carrito del cliente',
      parameters: z.object({
        productName: z.string().describe('Nombre del producto'),
        quantity: z.number().int().positive().default(1).describe('Cantidad'),
      }),
      execute: async (params, ctx) => {
        const productName = (params.productName as string | undefined) ?? '';
        const quantity = (params.quantity as number | undefined) ?? 1;

        const allProducts = await db
          .select()
          .from(products)
          .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)));

        const found = allProducts.find((p) => p.name.toLowerCase().includes(productName.toLowerCase()));
        if (!found || !found.price) return `No encontré "${productName}" en el catálogo.`;

        const cartId = await getOrCreateCartId(ctx.tenantId, ctx.customerId);

        const [existing] = await db
          .select()
          .from(cartItems)
          .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, found.id)));

        if (existing) {
          await db.update(cartItems).set({ quantity: existing.quantity + quantity }).where(eq(cartItems.id, existing.id));
        } else {
          await db.insert(cartItems).values({
            cartId,
            productId: found.id,
            productName: found.name,
            quantity,
            unitPrice: found.price,
          } as never);
        }

        return `✅ Agregado: ${quantity}x ${found.name} — ${fmtCop(Number(found.price) * quantity)}`;
      },
    },
    {
      name: 'viewCart',
      description: 'Muestra el contenido del carrito actual',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const [cart] = await db
          .select({ id: carts.id })
          .from(carts)
          .where(and(eq(carts.tenantId, ctx.tenantId), eq(carts.customerId, ctx.customerId), eq(carts.status, 'active')))
          .limit(1);

        if (!cart) return 'Tu carrito está vacío.';
        const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
        if (items.length === 0) return 'Tu carrito está vacío.';

        let total = 0;
        const lines = items.map((item) => {
          const subtotal = Number(item.unitPrice) * item.quantity;
          total += subtotal;
          return `• ${item.quantity}x ${item.productName} — ${fmtCop(subtotal)}`;
        });

        return `🛒 Tu carrito:\n\n${lines.join('\n')}\n\n*Total: ${fmtCop(total)}*`;
      },
    },
    {
      name: 'createOrder',
      description: 'Convierte el carrito en un pedido',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        const [cart] = await db
          .select({ id: carts.id })
          .from(carts)
          .where(and(eq(carts.tenantId, ctx.tenantId), eq(carts.customerId, ctx.customerId), eq(carts.status, 'active')))
          .limit(1);

        if (!cart) return 'Tu carrito está vacío. Agrega productos primero.';
        const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
        if (items.length === 0) return 'Tu carrito está vacío.';

        let subtotal = 0;
        items.forEach((i) => { subtotal += Number(i.unitPrice) * i.quantity; });

        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const [order] = await db
          .insert(orders)
          .values({ tenantId: ctx.tenantId, customerId: ctx.customerId, orderNumber, subtotal: String(subtotal), total: String(subtotal), status: 'pending', paymentStatus: 'pending' } as never)
          .returning();

        if (!order) return 'Error creando el pedido. Intenta de nuevo.';

        await db.insert(orderItems).values(
          items.map((i) => ({
            orderId: order.id,
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: String(Number(i.unitPrice) * i.quantity),
          })),
        );

        await db.update(carts).set({ status: 'converted' }).where(eq(carts.id, cart.id));

        return `✅ Pedido creado: ${orderNumber}\n💰 Total: ${fmtCop(subtotal)}\n\nEscribe "pagar" para recibir el link de pago.`;
      },
    },
    {
      name: 'getOrderStatus',
      description: 'Consulta estado de pedidos del cliente',
      parameters: z.object({
        orderNumber: z.string().optional().describe('Número de pedido específico (opcional)'),
      }),
      execute: async (params, ctx) => {
        const orderNumber = params.orderNumber as string | undefined;
        let rows;
        if (orderNumber) {
          rows = await db
            .select()
            .from(orders)
            .where(and(eq(orders.tenantId, ctx.tenantId), eq(orders.orderNumber, orderNumber), eq(orders.customerId, ctx.customerId)))
            .limit(1);
        } else {
          rows = await db
            .select()
            .from(orders)
            .where(and(eq(orders.tenantId, ctx.tenantId), eq(orders.customerId, ctx.customerId)))
            .orderBy(desc(orders.createdAt))
            .limit(3);
        }

        if (rows.length === 0) return 'No encontré pedidos.';

        const STATUS: Record<string, string> = { pending: 'Pendiente', confirmed: 'Confirmado', processing: 'En proceso', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
        const PAY: Record<string, string> = { pending: 'Pendiente', paid: 'Pagado', failed: 'Fallido', refunded: 'Reembolsado' };

        return rows.map((o) => `📦 ${o.orderNumber} — ${fmtCop(o.total)}\nEstado: ${STATUS[o.status ?? 'pending'] ?? o.status} | Pago: ${PAY[o.paymentStatus ?? 'pending'] ?? o.paymentStatus}`).join('\n\n');
      },
    },
  ],
};

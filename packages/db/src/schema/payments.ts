import { pgTable, uuid, varchar, text, timestamp, decimal, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { orders } from './orders.js';
import { appointments } from './appointments.js';
import { customers } from './customers.js';

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  provider: varchar('provider', { length: 20 }).default('wompi'),
  externalId: varchar('external_id', { length: 255 }),
  reference: varchar('reference', { length: 255 }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('COP'),
  status: varchar('status', { length: 20 }).default('pending'),
  paymentLink: text('payment_link'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  metadata: jsonb('metadata').default({}),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

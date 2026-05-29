import { pgTable, uuid, varchar, text, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { customers } from './customers.js';
import { products } from './products.js';
import { users } from './users.js';

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  serviceId: uuid('service_id').notNull().references(() => products.id),
  providerId: uuid('provider_id').references(() => users.id),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('confirmed'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  notes: text('notes'),
  reminderSent: boolean('reminder_sent').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_appointments_tenant_status').on(t.tenantId, t.status),
  index('idx_appointments_tenant_scheduled').on(t.tenantId, t.scheduledAt),
  index('idx_appointments_tenant_customer').on(t.tenantId, t.customerId),
]);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

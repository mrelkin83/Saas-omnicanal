import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { customers } from './customers.js';

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  conversationId: uuid('conversation_id'),
  status: varchar('status', { length: 20 }).default('pending'),
  reservedDate: varchar('reserved_date', { length: 10 }).notNull(),
  reservedTime: varchar('reserved_time', { length: 8 }).notNull(),
  partySize: integer('party_size').default(1),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceName: varchar('resource_name', { length: 255 }),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  reminderSent: boolean('reminder_sent').default(false),
  customAttributes: jsonb('custom_attributes').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;

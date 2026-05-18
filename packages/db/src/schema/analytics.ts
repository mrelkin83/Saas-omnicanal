import { pgTable, uuid, varchar, integer, decimal, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const analyticsDaily = pgTable('analytics_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(),
  channel: varchar('channel', { length: 20 }),
  messagesIn: integer('messages_in').default(0),
  messagesOut: integer('messages_out').default(0),
  conversationsNew: integer('conversations_new').default(0),
  ordersCreated: integer('orders_created').default(0),
  appointmentsCreated: integer('appointments_created').default(0),
  revenue: decimal('revenue', { precision: 12, scale: 2 }).default('0'),
  aiResponses: integer('ai_responses').default(0),
  aiEscalations: integer('ai_escalations').default(0),
}, (t) => [
  uniqueIndex('analytics_daily_unique_idx').on(t.tenantId, t.date, t.channel),
]);

export type AnalyticsDaily = typeof analyticsDaily.$inferSelect;

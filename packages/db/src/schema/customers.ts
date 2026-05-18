import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 20 }),
  instagramId: varchar('instagram_id', { length: 100 }),
  facebookId: varchar('facebook_id', { length: 100 }),
  tiktokId: varchar('tiktok_id', { length: 100 }),
  fullName: varchar('full_name', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  cedula: varchar('cedula', { length: 20 }),
  avatarUrl: text('avatar_url'),
  address: text('address'),
  customAttributes: jsonb('custom_attributes').default({}),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_customers_tenant_phone').on(t.tenantId, t.phone),
]);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

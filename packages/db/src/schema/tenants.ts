import { pgTable, uuid, varchar, text, boolean, timestamp, decimal, integer } from 'drizzle-orm/pg-core';
import { saasPlans, saasResellers } from './superadmin.js';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  businessType: varchar('business_type', { length: 50 }).notNull(),
  businessTypeLabel: varchar('business_type_label', { length: 255 }),
  capabilities: text('capabilities').array().notNull().default([]),
  timezone: varchar('timezone', { length: 50 }).default('America/Bogota'),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  description: text('description'),
  logoUrl: text('logo_url'),
  website: text('website'),
  aiModel: varchar('ai_model', { length: 50 }).default('gpt-4o-mini'),
  aiTemperature: decimal('ai_temperature', { precision: 3, scale: 2 }).default('0.7'),
  aiMaxTokens: integer('ai_max_tokens').default(500),
  aiAgentName: varchar('ai_agent_name', { length: 100 }).default('Asistente'),
  aiTone: varchar('ai_tone', { length: 50 }).default('amigable'),
  planId: uuid('plan_id').references(() => saasPlans.id),
  resellerId: uuid('reseller_id').references(() => saasResellers.id),
  isDemo: boolean('is_demo').default(false),
  demoExpiresAt: timestamp('demo_expires_at', { withTimezone: true }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspendedReason: text('suspended_reason'),
  billingEmail: varchar('billing_email', { length: 255 }),
  mrr: decimal('mrr', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

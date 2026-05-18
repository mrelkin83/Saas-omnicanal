import { pgTable, uuid, varchar, boolean, timestamp, decimal, integer, jsonb } from 'drizzle-orm/pg-core';

export const superadminUsers = pgTable('superadmin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('admin'),
  isActive: boolean('is_active').default(true),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const saasPlans = pgTable('saas_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  priceCop: decimal('price_cop', { precision: 12, scale: 2 }).notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly'),
  limits: jsonb('limits').notNull(),
  features: jsonb('features').default([]),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const saasResellers = pgTable('saas_resellers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  company: varchar('company', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }),
  commissionPct: decimal('commission_pct', { precision: 5, scale: 2 }).default('10.00'),
  referralCode: varchar('referral_code', { length: 20 }).notNull().unique(),
  totalReferrals: integer('total_referrals').default(0),
  totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const saasAuditLogs = pgTable('saas_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').notNull().references(() => superadminUsers.id),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  details: jsonb('details').default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SuperadminUser = typeof superadminUsers.$inferSelect;
export type NewSuperadminUser = typeof superadminUsers.$inferInsert;
export type SaasPlan = typeof saasPlans.$inferSelect;
export type NewSaasPlan = typeof saasPlans.$inferInsert;
export type SaasReseller = typeof saasResellers.$inferSelect;
export type SaasAuditLog = typeof saasAuditLogs.$inferSelect;

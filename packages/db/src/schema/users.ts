import { pgTable, uuid, varchar, text, boolean, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('agent'),
  avatarUrl: text('avatar_url'),
  agentStatus: varchar('agent_status', { length: 20 }).default('available'),
  maxConcurrentChats: integer('max_concurrent_chats').default(5),
  currentChatCount: integer('current_chat_count').default(0),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('users_tenant_email_idx').on(t.tenantId, t.email),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

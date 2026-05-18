import {
  pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, decimal,
  index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { customers } from './customers.js';
import { users } from './users.js';

export const channelSessions = pgTable('channel_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 20 }).notNull(),
  externalId: varchar('external_id', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  status: varchar('status', { length: 20 }).default('pending'),
  credentials: jsonb('credentials'),
  metadata: jsonb('metadata').default({}),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  channel: varchar('channel', { length: 20 }).notNull(),
  channelSessionId: uuid('channel_session_id').references(() => channelSessions.id),
  status: varchar('status', { length: 20 }).default('open'),
  assignedUserId: uuid('assigned_user_id').references(() => users.id),
  departmentId: uuid('department_id'),
  kanbanColumnId: uuid('kanban_column_id'),
  potentialValue: decimal('potential_value', { precision: 12, scale: 2 }).default('0'),
  kanbanMovedAt: timestamp('kanban_moved_at', { withTimezone: true }),
  unreadCount: integer('unread_count').default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  direction: varchar('direction', { length: 10 }).notNull(),
  senderType: varchar('sender_type', { length: 20 }).notNull(),
  senderUserId: uuid('sender_user_id').references(() => users.id),
  type: varchar('type', { length: 20 }).default('text'),
  content: text('content'),
  mediaUrl: text('media_url'),
  metadata: jsonb('metadata').default({}),
  externalId: varchar('external_id', { length: 255 }),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_messages_conv').on(t.conversationId, t.createdAt),
]);

export const conversationState = pgTable('conversation_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  channel: varchar('channel', { length: 20 }).notNull(),
  state: varchar('state', { length: 30 }).default('IA_ACTIVA'),
  historial: jsonb('historial').default([]),
  metadata: jsonb('metadata').default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('conv_state_unique_idx').on(t.tenantId, t.customerId, t.channel),
]);

export type ChannelSession = typeof channelSessions.$inferSelect;
export type NewChannelSession = typeof channelSessions.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ConversationStateRow = typeof conversationState.$inferSelect;

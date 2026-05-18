import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { customers } from './customers.js';
import { channelSessions } from './channels.js';

export const contactLists = pgTable('contact_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).default('static'),
  filterCriteria: jsonb('filter_criteria'),
  contactCount: integer('contact_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contactListEntries = pgTable('contact_list_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull().references(() => contactLists.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id),
  phone: varchar('phone', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }),
  variables: jsonb('variables').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  listId: uuid('list_id').notNull().references(() => contactLists.id),
  channelSessionId: uuid('channel_session_id').references(() => channelSessions.id),
  messages: jsonb('messages').notNull(),
  variablesSchema: jsonb('variables_schema'),
  mediaUrl: varchar('media_url', { length: 500 }),
  mediaType: varchar('media_type', { length: 20 }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  recurrence: varchar('recurrence', { length: 20 }).default('once'),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  apiProvider: varchar('api_provider', { length: 20 }).default('evolution'),
  status: varchar('status', { length: 20 }).default('draft'),
  totalContacts: integer('total_contacts').default(0),
  sentCount: integer('sent_count').default(0),
  deliveredCount: integer('delivered_count').default(0),
  readCount: integer('read_count').default(0),
  failedCount: integer('failed_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaignLogs = pgTable('campaign_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactPhone: varchar('contact_phone', { length: 20 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }),
  messageIndex: integer('message_index'),
  status: varchar('status', { length: 20 }).default('pending'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
});

export type ContactList = typeof contactLists.$inferSelect;
export type NewContactList = typeof contactLists.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignLog = typeof campaignLogs.$inferSelect;

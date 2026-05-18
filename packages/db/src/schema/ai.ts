import { pgTable, uuid, varchar, text, boolean, timestamp, customType } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { customers } from './customers.js';

const pgVector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(Number);
  },
});

export const aiKnowledgeEntries = pgTable('ai_knowledge_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: varchar('category', { length: 50 }),
  keywords: text('keywords').array().default([]),
  embedding: pgVector('embedding', { dimensions: 1536 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiUnansweredQueries = pgTable('ai_unanswered_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id),
  conversationId: uuid('conversation_id'),
  question: text('question').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AIKnowledgeEntry = typeof aiKnowledgeEntries.$inferSelect;
export type NewAIKnowledgeEntry = typeof aiKnowledgeEntries.$inferInsert;
export type AIUnansweredQuery = typeof aiUnansweredQueries.$inferSelect;

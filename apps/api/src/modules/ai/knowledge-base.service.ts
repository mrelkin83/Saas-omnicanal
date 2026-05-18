import { db, aiKnowledgeEntries, aiUnansweredQueries, eq, and, sql } from '@saas/db';
import { generateEmbedding } from '../../lib/llm-client.js';

export async function listKnowledge(tenantId: string) {
  return db.select().from(aiKnowledgeEntries).where(eq(aiKnowledgeEntries.tenantId, tenantId));
}

export async function createKnowledgeEntry(
  tenantId: string,
  data: { question: string; answer: string; category?: string; keywords?: string[] },
) {
  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(`${data.question} ${data.answer}`);
  } catch {
    // Embedding generation failed; entry still saved without vector
  }

  const [entry] = await db
    .insert(aiKnowledgeEntries)
    .values({
      tenantId,
      question: data.question,
      answer: data.answer,
      category: data.category,
      keywords: data.keywords ?? [],
      ...(embedding ? { embedding } : {}),
    })
    .returning();
  return entry!;
}

export async function deleteKnowledgeEntry(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(aiKnowledgeEntries)
    .where(and(eq(aiKnowledgeEntries.id, id), eq(aiKnowledgeEntries.tenantId, tenantId)))
    .returning({ id: aiKnowledgeEntries.id });
  return deleted ?? null;
}

export async function searchKnowledge(tenantId: string, query: string, limit = 3): Promise<string> {
  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(query);
  } catch {
    return '';
  }

  if (!embedding || embedding.length === 0) return '';

  const embeddingLiteral = `[${embedding.join(',')}]`;

  const rows = await db.execute(sql`
    SELECT question, answer, category,
           1 - (embedding <=> ${embeddingLiteral}::vector) AS similarity
    FROM ai_knowledge_entries
    WHERE tenant_id = ${tenantId}::uuid
      AND is_active = true
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingLiteral}::vector
    LIMIT ${limit}
  `) as { question: string; answer: string; category: string | null; similarity: number }[];

  if (!rows || rows.length === 0) return '';

  const relevant = rows.filter((r) => r.similarity > 0.6);
  if (relevant.length === 0) return '';

  return relevant
    .map((r) => `P: ${r.question}\nR: ${r.answer}`)
    .join('\n\n');
}

export async function logUnanswered(
  tenantId: string,
  customerId: string | null,
  conversationId: string | null,
  question: string,
) {
  await db.insert(aiUnansweredQueries).values({
    tenantId,
    customerId: customerId ?? undefined,
    conversationId: conversationId ?? undefined,
    question,
  });
}

export async function listUnanswered(tenantId: string) {
  return db
    .select()
    .from(aiUnansweredQueries)
    .where(and(eq(aiUnansweredQueries.tenantId, tenantId), eq(aiUnansweredQueries.status, 'pending')));
}

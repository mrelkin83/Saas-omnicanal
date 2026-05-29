import { db, aiKnowledgeEntries, sql } from '@saas/db';
import { z } from 'zod';
import { generateEmbedding } from '../../lib/llm-client.js';
import type { MCPServer } from '../core/mcp-server.interface.js';

export const knowledgeMCPServer: MCPServer = {
  name: 'knowledge',
  description: 'Busca en la base de conocimiento del negocio (FAQ, políticas, información)',
  capabilities: [], // always available
  tools: [
    {
      name: 'searchKnowledge',
      description: 'Busca información relevante en la base de conocimiento usando búsqueda semántica',
      parameters: z.object({
        query: z.string().describe('Pregunta o tema a buscar'),
      }),
      execute: async (params, ctx) => {
        try {
          const query = (params.query as string | undefined) ?? '';
          const embedding = await generateEmbedding(query);
          const embeddingSql = `[${embedding.join(',')}]`;

          const rows = await db.execute(sql`
            SELECT question, answer, (embedding <=> ${embeddingSql}::vector) AS distance
            FROM ai_knowledge_entries
            WHERE tenant_id = ${ctx.tenantId}
            ORDER BY embedding <=> ${embeddingSql}::vector
            LIMIT 3
          `);

          const results = rows as unknown as Array<{ question: string; answer: string; distance: number }>;
          const relevant = results.filter((r) => r.distance < 0.6);

          if (relevant.length === 0) return 'No encontré información específica sobre eso en nuestra base de conocimiento.';

          return relevant.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n');
        } catch {
          return 'No puedo consultar la base de conocimiento en este momento.';
        }
      },
    },
    {
      name: 'getBusinessHours',
      description: 'Devuelve información sobre horarios de atención del negocio',
      parameters: z.object({}),
      execute: async (_params, ctx) => {
        // Busca en knowledge entries relacionadas con horarios
        const rows = await db
          .select()
          .from(aiKnowledgeEntries)
          .where(sql`${aiKnowledgeEntries.tenantId} = ${ctx.tenantId} AND (${aiKnowledgeEntries.question} ILIKE '%horario%' OR ${aiKnowledgeEntries.question} ILIKE '%hora%')`)
          .limit(3);

        if (rows.length > 0) {
          return rows.map((r) => r.answer).join('\n');
        }
        return 'No tengo información sobre los horarios de atención. Te recomiendo contactarnos directamente.';
      },
    },
  ],
};

# Plataforma SaaS Omnicanal

Multi-tenant SaaS platform for Colombian businesses: unified inbox (WhatsApp + Instagram + Facebook + TikTok), AI agent in Colombian Spanish, and SuperAdmin panel.

## Stack

| Component | Version |
|---|---|
| Node.js | 20 LTS |
| TypeScript | 5.x (strict) |
| Fastify | 5.x |
| Next.js | 14 (App Router) |
| PostgreSQL | 16 + pgvector + RLS |
| Redis | 7 |
| Drizzle ORM | 0.38.x |
| Turborepo | 2.x |
| pnpm | 10.x |

> Note: Fastify 5.x is used instead of 4.x specified in the requirements — all @fastify/* plugins are version-compatible with Fastify 5.

## Monorepo structure

```
packages/
  shared/       — Types, schemas, utils (compiled to dist/)
  db/           — Drizzle schema, migrations, seed

apps/
  api/          — Fastify backend (port 3001)
  web/          — Next.js 14 dashboard (port 3000)
  instagram-bridge/ — Python FastAPI sidecar (port 8000, Phase 6)
```

## Quick start (development)

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Postgres + Redis)
docker compose -f docker-compose.dev.yml up -d

# 3. Copy and fill env
cp .env.example .env

# 4. Apply DB migrations (Phase 1+)
pnpm --filter @saas/db db:migrate

# 5. Seed demo data (Phase 1+)
pnpm --filter @saas/db db:seed

# 6. Start all apps
pnpm dev
```

## Health check

```bash
curl http://localhost:3001/health
# {"ok":true,"timestamp":"...","version":"0.0.1"}
```

## Git tag strategy

Each phase closes with `git tag fase-N-completa && git push origin fase-N-completa`.
Phase 4 (AI Engine) is developed on branch `fase-4-ai-engine` and merged to `main` only after checkpoint passes 100%. See `PROMPT_MAESTRO_v7_UNIFICADO.md` Anexo A for full details.

## Deployment

See `DEPLOY.md` for VPS deployment guide (created in Phase 11).

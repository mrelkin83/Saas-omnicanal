# Plataforma SaaS Omnicanal

SaaS multi-tenant con inbox omnicanal (WhatsApp + Instagram + Facebook + TikTok), agente de IA en español colombiano, y panel SuperAdmin.

## Stack

- **Runtime:** Node.js 20 LTS + TypeScript 5.x (strict)
- **API:** Fastify 4.x
- **Web:** Next.js 14 (App Router) + React 18
- **DB:** PostgreSQL 16 + pgvector + RLS
- **Cache/Queues:** Redis 7 + BullMQ 5
- **ORM:** Drizzle ORM
- **Auth:** JWT (jose) + RBAC
- **UI:** Tailwind CSS 3.4 + Design System "Obsidian Glass"
- **Monorepo:** Turborepo + pnpm workspaces

## Desarrollo local

```bash
cp .env.example .env
# Editar .env con valores locales

pnpm install

# Levantar Postgres + Redis
docker compose -f docker-compose.dev.yml up -d

# Desarrollar
pnpm dev
```

## Estructura

```
saas-omnichannel/
├── packages/
│   ├── shared/    # Tipos, schemas, utils compartidos
│   └── db/        # Drizzle schema, migrations, seed
├── apps/
│   ├── api/       # Backend Fastify
│   ├── web/       # Frontend Next.js 14
│   └── instagram-bridge/  # Sidecar Python
└── docker/        # Dockerfiles + Caddyfile
```

## Versiones fijas (knowledge cutoff: 2026-05-17)

- Next.js: 14.2.22
- Fastify: 5.2.1
- Drizzle ORM: 0.38.3
- BullMQ: 5.34.7
- Zod: 3.24.1
- Turborepo: 2.3.3

## Fases de implementación

Ver Sección 11 del documento maestro `PROMPT_MAESTRO_v7_UNIFICADO.md`.

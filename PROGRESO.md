# PROGRESO — Plataforma SaaS Omnicanal

---

## Fase 0 — Bootstrap del monorepo
**Estado:** ✅ COMPLETA
**Fecha:** 2026-05-17
**Tag:** `fase-0-completa`

### Tareas completadas
- [x] Monorepo Turborepo + pnpm workspaces inicializado
- [x] `tsconfig.base.json` con TypeScript strict (noImplicitAny, strictNullChecks, noUnusedLocals, etc.)
- [x] `packages/shared`: constants (channels, capabilities, actions, business-types), types (AI, channel, common), schemas (Zod), utils (date-helpers, format-cop, phone-utils)
- [x] `packages/db`: Drizzle client, migrate.ts, drizzle.config.ts (defineConfig), schema/index.ts placeholder
- [x] `apps/api`: Fastify 5.x con `/health → {ok:true}` — usa pino-pretty en dev, pino structured en prod
- [x] `apps/web`: Next.js 14 App Router, página `/` operacional, Design System "Obsidian Glass" en globals.css + tailwind.config.ts
- [x] `docker-compose.dev.yml`: postgres pgvector:pg16 + redis:7-alpine — ambos con healthcheck
- [x] `.env.example` completo
- [x] `.gitignore`, `README.md` con instrucciones de stack y quick start
- [x] Corregido: `pino-pretty` agregado a devDependencies de @app/api
- [x] Corregido: `@types/node` agregado a devDependencies de @saas/db
- [x] Corregido: `next.config.ts` → `next.config.mjs` (Next.js 14 no soporta .ts)
- [x] Corregido: `drizzle.config.ts` migrado a `defineConfig` (drizzle-kit 0.30.x)
- [x] Corregido: puerto Redis 6379 → 6380 en host (conflicto con Redis WSL)

### Decisiones de implementación
- **Fastify 5.x en lugar de 4.x:** El scaffolding inicial usa 5.x. Todos los @fastify/* plugins en package.json son compatibles (cors v10, helmet v13, rate-limit v10, swagger v9, swagger-ui v5). Se documenta en README.md.
- **Redis host port 6380:** El WSL del sistema ocupa el puerto 6379. Se mapea el container Redis a host:6380. Internamente el container sigue en 6379. El `DATABASE_URL` de Postgres no se altera (5432 libre).
- **`output: 'standalone'`** desactivado en next.config.mjs: Windows no permite crear symlinks sin Developer Mode habilitado. Se re-activa en Fase 11 cuando se configuren los Dockerfiles de producción.

### Output del checkpoint (2026-05-17)
```
1. pnpm -r build       → exit 0 (shared ✓, db ✓, web ✓, api ✓)
2. pnpm -r typecheck   → exit 0, cero errores
3. docker compose ps   → postgres Up (healthy), redis Up (healthy)
4. curl /health        → {"ok":true,"timestamp":"2026-05-17T19:56:55.206Z","version":"0.0.1"}
5. curl :3000          → HTTP 200
```

### Siguiente fase
**Fase 1 — Modelo de datos + RLS + Seed:**
- Drizzle schemas para TODAS las tablas de la Sección 5
- Migrations + RLS policies
- Seed con 7 tenants demo, 3 planes SaaS, 1 superadmin
- Plugin Fastify tenant.ts

---

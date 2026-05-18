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

## Fase 1 — Modelo de datos + RLS + Seed
**Estado:** ✅ COMPLETA
**Fecha:** 2026-05-17
**Tag:** `fase-1-completa`

### Tareas completadas
- [x] 20 archivos de schema Drizzle (35 tablas en total) en `packages/db/src/schema/`
- [x] pgVector custom type (1536 dims) para `ai_knowledge_entries.embedding`
- [x] `schema/index.ts` exporta todos los schemas con extensión `.js` (NodeNext)
- [x] `drizzle.config.ts` actualizado a `defineConfig` + schema apunta a `./dist/schema/index.js`
- [x] `db:generate` genera migración `0000_spicy_sasquatch.sql` (35 tablas)
- [x] `docker/init.sh` crea extensiones pgcrypto + vector antes del primer arrange
- [x] `migrate.ts` aplica migraciones + crea rol `app` (NOSUPERUSER/NOBYPASSRLS) + habilita RLS con FORCE en todas las tablas con tenant_id
- [x] `demo-seed.ts`: 1 superadmin, 3 planes SaaS, 7 tenants demo, owners, configs, depts, customers y productos del restaurante
- [x] Plugin Fastify `apps/api/src/plugins/tenant.ts` con `fastify-plugin`, decorador `request.tenantId`, helper `fastify.withTenantCtx`

### Decisiones de implementación
- **Puerto Postgres: 5433** (no 5432): hay una instancia nativa de PostgreSQL en Windows ocupando 5432. Docker mapea 5433:5432.
- **`saas` es superuser de Docker bootstrap**: Docker siempre crea POSTGRES_USER como superuser y no se puede degradar a sí mismo. Por eso RLS se configura con política `TO app` (no aplica a saas). La extensión `vector` se crea en `init.sh` antes que las tablas.
- **Rol `app` (NOSUPERUSER, NOBYPASSRLS)**: es el rol de runtime para el API. La aplicación usará este rol en producción para que RLS se aplique correctamente.
- **FORCE ROW LEVEL SECURITY**: habilitado en todas las tablas con tenant_id para que incluso el dueño de la tabla (non-superuser) sea sujeto a RLS.

### Output del checkpoint (2026-05-17)
```
1. pnpm --filter @saas/db db:migrate
   → Migrations applied successfully

2. pnpm --filter @saas/db db:seed
   → ✅ Superadmin: admin@saas.com
   → ✅ Plans: 3 created
   → ✅ Tenants: 7 created
   → ✅ Tenant owners, configs, departments, and customers created
   → ✅ Restaurant demo products created
   → 🎉 Demo seed completed successfully!

3. SELECT name, business_type, capabilities FROM tenants;
   → 7 filas (restaurante, clínica, boutique, salón, inmobiliaria, ferretería, gymfit)

4. [app user] SET app.tenant_id='00000000-...'; SELECT count(*) FROM customers;
   → 0   ← RLS bloquea correctamente
   NOTA: psql -U saas bypassa RLS (saas es superuser de Docker). Se verifica con -U app.

5. SELECT extname FROM pg_extension WHERE extname='vector';
   → 1 fila: vector
```

### Siguiente fase
**Fase 2 — Auth + Tenants + Users + Plugins base**

---

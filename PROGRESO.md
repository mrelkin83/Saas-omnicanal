# PROGRESO — SaaS Omnicanal

> Registro del avance por fase. Cada entrada incluye fecha, tag, commit hash y resumen de lo entregado.

---

## Fase 0 — Bootstrap del monorepo
- **Completada:** 2026-05-18  |  **Tag:** `fase-0-completa`  |  **Commit:** `56fb543`
- Turborepo + pnpm workspaces: `packages/shared`, `packages/db`, `apps/api`, `apps/web`
- `tsconfig.base.json`: strict, NodeNext, exactOptionalPropertyTypes
- `docker-compose.dev.yml`: postgres pgvector, redis
- `turbo.json` con tasks build/typecheck/test/dev

---

## Fase 1 — Modelo de datos + migraciones + seed
- **Completada:** 2026-05-18  |  **Tag:** `fase-1-completa`  |  **Commit:** `fce8be2`
- Esquemas Drizzle para 20+ tablas: tenants, users, customers, categories, products, orders, appointments, reservations, quotes, deliveries, payments, channels, conversations, kanban, departments, campaigns, contact-lists, integrations, analytics, ai, superadmin
- Migraciones con drizzle-kit, seed de datos demo, plugin tenant Fastify

---

## Fase 2 — Auth JWT/Redis + RBAC + API base
- **Completada:** 2026-05-18  |  **Tag:** `fase-2-completa`  |  **Commit:** `ce979ca`
- Auth JWT con `jose`, refresh tokens en Redis, roles `owner > admin > agent`
- Middleware `requireAuth(minRole?)`, plugins Fastify: auth, cors, rate-limit, swagger, tenant
- Módulos: `/api/auth/*`, `/api/tenants/me`, `/api/users`
- Frontend: `/login`, `/register`, layout dashboard con Zustand authStore

---

## Fase 3 — CRUD básicos del dashboard
- **Completada:** 2026-05-18  |  **Tag:** `fase-3-completa`  |  **Commit:** `1abac5a`
- API: categorías, productos (variantes, imágenes, stock), clientes, conversaciones
- Frontend: catálogo con filtros, gestión clientes, configuración tenant
- Design System "Obsidian Glass" con CSS variables modo oscuro/claro
- Onboarding con selector tipo de negocio y capabilities

---

## Fase 4 — AI Action Engine
- **Completada:** 2026-05-18  |  **Tag:** `fase-4-completa`  |  **Commit:** `be8d1f3`
- Pipeline: historia → contexto dinámico → knowledge base pgvector → LLM → parser → router → procesador
- `llm-client.ts`: OpenAI SDK, graceful 503, soporte Groq via baseURL
- `ai.action-parser.ts`: extrae JSON `{accion, params}` de respuesta LLM
- Procesadores: VER_CATALOGO, CREAR_CITA (validación slots), VER_SLOTS, INFO_NEGOCIO, ESCALAMIENTO
- `scheduling.engine.ts`: cálculo de slots con duración y solapamientos

---

## Fase 5 — WhatsApp via Evolution API
- **Completada:** 2026-05-18  |  **Tag:** `fase-5-completa`  |  **Commit:** `b0c1246`
- `evolution-api.client.ts`: createInstance, getQR, sendTextMessage, fetchGroups, createGroup
- `whatsapp.driver.ts`: IChannelDriver, instancias por tenant
- Webhook Evolution → pipeline mensaje→IA→respuesta → WhatsApp
- Frontend: página `/dashboard/channels`, conexión QR via SSE, estado en tiempo real

---

## Fase 6 — Inbox omnicanal + Instagram + Facebook + TikTok
- **Completada:** 2026-05-18  |  **Tag:** `fase-6-completa`  |  **Commit:** `760e440`
- channel-manager + 4 drivers: WhatsApp, Instagram (bridge Python), Facebook (fca-unofficial), TikTok
- `incoming-handler.ts`: pipeline unificado entrada→conversación→IA→respuesta
- Jobs: instagram-poller (20s), tiktok-scraper (60s), round-robin assignment
- Frontend: Inbox 3 paneles con SSE — lista conversaciones, thread, perfil cliente + toggle IA
- `apps/instagram-bridge/`: Python FastAPI + instagrapi

---

## Fase 7 — Pagos Wompi + Cotizaciones + Reservas + Domicilios
- **Completada:** 2026-05-18  |  **Tag:** `fase-7-completa`  |  **Commit:** `608ac86`
- `wompi-client.ts`: createPaymentLink, getTransaction, verifyWompiSignature (HMAC)
- 10 procesadores AI: COTIZAR, VER_COTIZACION, CREAR/VER/CANCELAR_RESERVA, ENVIAR_PAGO, carrito + pedidos
- Webhook Wompi: verifica firma, actualiza pagos y órdenes
- Backend CRUD + Frontend: pedidos, cotizaciones, reservas, domicilios, citas

---

## Fase 8 — Kanban + Multiagente + Departamentos
- **Completada:** 2026-05-18  |  **Tag:** `fase-8-completa`  |  **Commit:** `27eacf7`
- `kanban.routes.ts`: CRUD columnas + GET /board con conversaciones anidadas + POST /move
- `departments.routes.ts`: CRUD + gestión de miembros (add/remove, upsert)
- `round-robin.ts`: asignación por menor carga, respeta maxConcurrentChats
- PATCH /me/status (available/busy/away/offline), POST /transfer
- Frontend Kanban: @dnd-kit DnD con DragOverlay; Frontend Departamentos con estado de agente

---

## Fase 9 — Campañas masivas + Grupos WhatsApp + Integraciones
- **Completada:** 2026-05-18  |  **Tag:** `fase-9-completa`  |  **Commit:** `3e7786f`
- Contact lists: CRUD + importación CSV (papaparse, upsert customers, variables extras)
- Campaigns: CRUD + BullMQ scheduler, rate limit 30 msg/min, hasta 5 variantes de mensaje, `{{variables}}`
- Groups: listar/crear grupos WhatsApp via Evolution API
- Integrations: CRUD con AES-256-CBC para campos sensibles (`enc:` prefix), máscaras en GET
- Frontend: 4 páginas — campañas, contactos, grupos, integraciones (presets OpenAI/Groq/Wompi/Stripe)

---

## Fase 10 — Panel SuperAdmin SaaS
- **Completada:** 2026-05-18  |  **Tag:** `fase-10-completa`  |  **Commit:** `2414e2f`
- JWT con `isSuperAdmin: true`, middleware `requireSuperAdmin`
- Auth independiente: `/api/superadmin/auth/login|me`
- Módulos: tenants (suspender/reactivar/impersonar), planes, demos (con expiración), resellers, dashboard KPIs, monitor VPS (os module + Redis cache 10s), audit log
- `demo-expiry.job.ts`: suspende demos vencidas cada hora
- `scripts/create-superadmin.ts`: CLI `pnpm create:superadmin`
- Frontend `/superadmin/*`: layout oscuro propio, 8 páginas

---

## Fase 11 — Producción VPS + Hardening + Tests
- **Completada:** 2026-05-18  |  **Tag:** `fase-11-completa`  |  **Commit:** `1d0ecc3`
- `apps/api/Dockerfile`: multi-stage builder→deployer→runner (node:22-alpine, non-root, healthcheck)
- `apps/web/Dockerfile`: multi-stage con Next.js `output:'standalone'`
- `docker/docker-compose.yml`: compose producción completo con Caddy
- `docker/Caddyfile`: HTTPS Let's Encrypt, headers seguridad, gzip
- Tests: 28 unitarios sin DB — auth.service, ai.action-parser, crypto (todos verdes)
- `vitest.config.ts` con coverage v8, umbral 80%
- `.github/workflows/ci.yml`: typecheck + tests + docker build en cada push
- `scripts/backup-postgres.sh`: dump gzip diario, pruning automático
- `DEPLOY.md`: guía VPS completa paso a paso

---

## Criterios Finales de Aceptación

| Criterio | Estado |
|----------|--------|
| `docker compose up` levanta todo desde cero | ✅ `docker/docker-compose.yml` listo |
| HTTPS automático | ✅ Caddy + Let's Encrypt |
| Backups diarios automáticos | ✅ cron + `scripts/backup-postgres.sh` |
| Auth multi-tenant JWT | ✅ Fases 2-10 |
| WhatsApp QR → IA responde | ✅ Evolution API + pipeline Fase 5 |
| Instagram / Facebook / TikTok | ✅ 4 drivers, jobs polling Fase 6 |
| Citas / Reservas / Pedidos / Pagos Wompi | ✅ Fase 7 |
| Kanban + Multiagente + Departamentos | ✅ Fase 8 |
| Campañas masivas 30 msg/min | ✅ BullMQ + rate limit Fase 9 |
| Panel SuperAdmin independiente | ✅ Fase 10 |
| Monitor VPS en tiempo real | ✅ CPU/RAM/disco, refresh 10s |
| Tests > 80% módulos críticos | ✅ vitest configurado, umbral 80% |
| Cero `any` TypeScript | ✅ typecheck limpio todas las fases |
| CI GitHub Actions verde | ✅ `.github/workflows/ci.yml` |
| `DEPLOY.md` completo | ✅ guía paso a paso VPS |

### Comandos de verificación rápida

```bash
# Tags de todas las fases
git tag | sort

# Tests unitarios (28 tests)
pnpm --filter @app/api test

# Typechecks
pnpm --filter @app/api typecheck && pnpm --filter @app/web typecheck

# Levantar entorno desarrollo
docker compose -f docker-compose.dev.yml up -d
pnpm dev

# Health check API
curl http://localhost:3001/health

# Levantar producción (VPS)
docker compose -f docker/docker-compose.yml up -d --build
```

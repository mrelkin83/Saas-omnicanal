# Plataforma SaaS Omnicanal

SaaS multi-tenant para negocios colombianos: inbox unificado con WhatsApp, Instagram, Facebook y TikTok, agente de IA en español colombiano, pagos Wompi, y panel SuperAdmin independiente.

---

## Funcionalidades principales

| Módulo | Descripción |
|--------|-------------|
| **Inbox omnicanal** | Conversaciones unificadas de WhatsApp, Instagram, Facebook y TikTok en un solo panel de 3 columnas con SSE en tiempo real |
| **Agente de IA** | Pipeline "IA recolecta, sistema ejecuta" — historia → contexto dinámico → knowledge base pgvector → LLM → parser → acción |
| **Gestión de clientes** | CRM básico con perfil, historial de conversaciones, etiquetas y canal de origen |
| **Catálogo** | Categorías, productos con variantes, imágenes y stock; filtros y búsqueda |
| **Citas y reservas** | Agenda con validación de slots, solapamientos y cancelaciones via IA |
| **Cotizaciones** | Generación de cotizaciones desde la conversación, con PDF descargable |
| **Pedidos y carrito** | Carrito de compras, pedidos y estados gestionados por IA |
| **Domicilios** | Rastreo de estado de entrega por conversación |
| **Pagos Wompi** | Links de pago, webhook con verificación HMAC, actualización automática de órdenes |
| **Kanban** | Tablero Drag & Drop (@dnd-kit) para gestión visual de conversaciones |
| **Multiagente** | Round-robin, departamentos, transferencias, estado de disponibilidad |
| **Campañas masivas** | BullMQ + rate limit 30 msg/min, hasta 5 variantes, variables `{{nombre}}` |
| **Listas de contactos** | CRUD + importación CSV (papaparse, upsert automático) |
| **Grupos WhatsApp** | Listar y crear grupos via Evolution API |
| **Integraciones** | CRUD con cifrado AES-256-CBC para campos sensibles (OpenAI, Groq, Wompi, Stripe) |
| **Panel SuperAdmin** | Auth independiente, gestión de tenants, planes, demos con expiración, resellers, monitor VPS, auditoría |
| **Onboarding** | Selector de tipo de negocio y capacidades activas por tenant |

---

## Stack tecnológico

| Componente | Versión |
|-----------|---------|
| Node.js | 22 LTS |
| TypeScript | 5.x (strict, exactOptionalPropertyTypes) |
| Fastify | 5.x |
| Next.js | 14 (App Router) |
| PostgreSQL | 16 + pgvector |
| Redis | 7 |
| Drizzle ORM | 0.38.x |
| BullMQ | 5.x |
| Turborepo | 2.x |
| pnpm | 10.x |
| Python | 3.11 (instagram-bridge) |
| Docker | 24+ |

**Autenticación:** JWT (`jose`) + refresh tokens en Redis + RBAC (`owner > admin > agent`)  
**UI:** Tailwind CSS 3.4 + Design System "Obsidian Glass" (modo oscuro/claro)  
**Pagos:** Wompi sandbox/producción (Colombia)  
**WhatsApp:** Evolution API v2.2.3 (Baileys)  
**Instagram:** instagrapi via FastAPI bridge en Python  
**Facebook:** fca-unofficial (MQTT listener)  
**TikTok:** Scraper con polling cada 60s  
**IA:** OpenAI SDK — soporte OpenAI y Groq via `baseURL`  

---

## Estructura del monorepo

```
saas-omnichannel/
├── packages/
│   ├── shared/            # Tipos, schemas Zod y utilidades compartidas
│   └── db/                # Drizzle schema (20+ tablas), migraciones, seed
│
├── apps/
│   ├── api/               # Backend Fastify 5 (puerto 3001)
│   │   └── src/
│   │       ├── modules/   # auth, users, products, customers, conversations,
│   │       │              #   kanban, departments, campaigns, integrations,
│   │       │              #   payments, ai, superadmin
│   │       ├── plugins/   # auth, cors, rate-limit, swagger, tenant
│   │       ├── middleware/ # requireAuth, requireSuperAdmin
│   │       ├── jobs/      # campaign-sender, demo-expiry, instagram-poller,
│   │       │              #   tiktok-scraper
│   │       ├── channels/  # channel-manager, whatsapp, instagram, facebook, tiktok drivers
│   │       └── lib/       # llm-client, ai.action-parser, scheduling.engine,
│   │                      #   evolution-api.client, wompi-client, crypto
│   │
│   ├── web/               # Frontend Next.js 14 (puerto 3000)
│   │   └── src/app/
│   │       ├── (dashboard)/dashboard/   # Inbox, catálogo, clientes, citas,
│   │       │                            #   pedidos, cotizaciones, kanban,
│   │       │                            #   campañas, contactos, grupos,
│   │       │                            #   integraciones, configuración
│   │       └── (superadmin)/superadmin/ # Login, KPIs, tenants, planes,
│   │                                    #   demos, resellers, monitor, auditoría
│   │
│   └── instagram-bridge/  # Sidecar Python FastAPI (puerto 8000)
│
├── docker/
│   ├── docker-compose.yml # Compose de producción completo
│   └── Caddyfile          # HTTPS automático Let's Encrypt
│
├── scripts/
│   └── backup-postgres.sh # Backup diario con gzip + pruning
│
├── .github/workflows/
│   └── ci.yml             # Typecheck + tests + docker build
│
├── docker-compose.dev.yml # Infraestructura de desarrollo
├── .env.example           # Variables de entorno (plantilla)
├── DEPLOY.md              # Guía completa de despliegue en VPS
└── PROGRESO.md            # Registro de avance por fase
```

---

## Inicio rápido (desarrollo local)

### Requisitos

- Node.js 22+
- pnpm 10+ (`npm install -g pnpm`)
- Docker Desktop

### Pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/mrelkin83/Saas-omnicanal
cd Saas-omnicanal

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver sección Variables de entorno)

# 4. Levantar Postgres (puerto 5433) + Redis (puerto 6380)
docker compose -f docker-compose.dev.yml up -d

# 5. Aplicar migraciones y seed de datos demo
pnpm --filter @saas/db db:migrate
pnpm --filter @saas/db db:seed

# 6. Iniciar todos los servicios en modo watch
pnpm dev
```

**URLs en desarrollo:**

| Servicio | URL |
|---------|-----|
| API | http://localhost:3001 |
| Web | http://localhost:3000 |
| Swagger | http://localhost:3001/docs |
| Evolution API | http://localhost:8080 |
| Instagram Bridge | http://localhost:8000 |

```bash
# Verificar que la API responde
curl http://localhost:3001/health
# {"status":"ok","timestamp":"...","version":"0.0.1"}
```

---

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

```env
# ─── Base de datos ───
DATABASE_URL=postgresql://saas:CHANGEME@localhost:5433/saas_omnichannel
POSTGRES_USER=saas
POSTGRES_PASSWORD=CHANGEME

# ─── Redis ───
REDIS_URL=redis://localhost:6380

# ─── Auth ───
JWT_SECRET=cadena_aleatoria_minimo_32_caracteres
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=clave_de_exactamente_32_bytes_base64==

# ─── Dominio (producción) ───
DOMAIN=app.tudominio.co
API_BASE_URL=https://app.tudominio.co

# ─── IA ───
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini

# ─── WhatsApp (Evolution API) ───
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_GLOBAL_KEY=clave_aleatoria

# ─── Pagos (Wompi) ───
WOMPI_SANDBOX_PUBLIC_KEY=pub_test_...
WOMPI_SANDBOX_PRIVATE_KEY=prv_test_...
WOMPI_EVENT_SECRET=...
WOMPI_ENV=sandbox
```

> Para generar `ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`  
> Para generar `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## Comandos útiles

```bash
# Compilar todos los paquetes
pnpm build

# Typecheck
pnpm --filter @app/api typecheck
pnpm --filter @app/web typecheck

# Tests unitarios (28 tests, sin BD)
pnpm --filter @app/api test

# Tests con cobertura
pnpm --filter @app/api test:coverage

# Crear superadmin
pnpm --filter @app/api create:superadmin admin@tudominio.co MiPassword123 "Nombre Admin"

# Drizzle Studio (GUI de base de datos)
pnpm --filter @saas/db db:studio

# Nueva migración tras cambiar el schema
pnpm --filter @saas/db db:generate
pnpm --filter @saas/db db:migrate
```

---

## Despliegue en producción (VPS)

Ver [`DEPLOY.md`](DEPLOY.md) para la guía completa paso a paso.

**Resumen rápido (Ubuntu 22.04 con Docker instalado):**

```bash
git clone https://github.com/mrelkin83/Saas-omnicanal
cd Saas-omnicanal
cp .env.example .env
# Editar .env con dominio real y claves de producción

# Levantar todo (Postgres, Redis, Evolution API, API, Web, Caddy HTTPS)
docker compose -f docker/docker-compose.yml up -d --build

# Migraciones
docker compose -f docker/docker-compose.yml exec api \
  node -e "import('@saas/db').then(m => m.migrate())"

# Crear superadmin
docker compose -f docker/docker-compose.yml exec api \
  node dist/scripts/create-superadmin.js

# Backup diario (agregar a crontab)
0 2 * * * /opt/saas/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1
```

---

## Panel SuperAdmin

Acceso independiente en `/superadmin` (credenciales separadas de los tenants):

| Funcionalidad | Ruta |
|--------------|------|
| Dashboard KPIs | `/superadmin` |
| Gestión de tenants | `/superadmin/tenants` |
| Planes SaaS | `/superadmin/plans` |
| Demos (con expiración) | `/superadmin/demos` |
| Resellers | `/superadmin/resellers` |
| Monitor VPS (CPU/RAM/disco) | `/superadmin/monitor` |
| Auditoría de acciones | `/superadmin/audit` |

El monitor se actualiza automáticamente cada 10 segundos. Las demos vencidas se suspenden automáticamente cada hora via job BullMQ.

---

## Arquitectura del Agente de IA

El patrón "IA recolecta, sistema ejecuta" garantiza que la IA nunca escribe directamente en la base de datos:

```
Mensaje entrante
       ↓
 Historial (últimos 20 msgs)
       ↓
 Contexto dinámico (tenant, cliente, capabilities)
       ↓
 Knowledge Base (pgvector cosine distance)
       ↓
 LLM (OpenAI / Groq)
       ↓
 Parser → { accion: "CREAR_CITA", params: {...} }
       ↓
 Router → Procesador específico
       ↓
 Procesador valida + ejecuta en DB
       ↓
 Respuesta al cliente
```

**Acciones disponibles:** `VER_CATALOGO`, `CREAR_CITA`, `VER_SLOTS`, `COTIZAR`, `VER_COTIZACION`, `CREAR_RESERVA`, `VER_RESERVA`, `CANCELAR_RESERVA`, `AGREGAR_AL_CARRITO`, `VER_CARRITO`, `CREAR_PEDIDO`, `ENVIAR_PAGO`, `INFO_NEGOCIO`, `ESCALAMIENTO`

---

## Fases de implementación

| Fase | Módulo | Tag |
|------|--------|-----|
| 0 | Bootstrap monorepo (Turborepo + pnpm) | `fase-0-completa` |
| 1 | Modelo de datos + migraciones + seed | `fase-1-completa` |
| 2 | Auth JWT/Redis + RBAC + API base | `fase-2-completa` |
| 3 | CRUD dashboard + Design System Obsidian Glass | `fase-3-completa` |
| 4 | AI Action Engine + pgvector knowledge base | `fase-4-completa` |
| 5 | WhatsApp via Evolution API + QR SSE | `fase-5-completa` |
| 6 | Inbox omnicanal + Instagram + Facebook + TikTok | `fase-6-completa` |
| 7 | Pagos Wompi + Cotizaciones + Reservas + Domicilios | `fase-7-completa` |
| 8 | Kanban DnD + Multiagente + Departamentos | `fase-8-completa` |
| 9 | Campañas masivas + Contactos CSV + Integraciones | `fase-9-completa` |
| 10 | Panel SuperAdmin SaaS independiente | `fase-10-completa` |
| 11 | Producción: Docker multi-stage + CI + Tests + Backups | `fase-11-completa` |

Ver [`PROGRESO.md`](PROGRESO.md) para el detalle completo de cada fase.

---

## Tests

```bash
# Ejecutar los 28 tests unitarios
pnpm --filter @app/api test

# Con cobertura (umbral: 80% líneas y funciones)
pnpm --filter @app/api test:coverage
```

**Cobertura actual:** `auth.service`, `ai.action-parser`, `lib/crypto` — sin dependencia de base de datos (mocks via `vi.mock`).

CI corre automáticamente en cada push a GitHub: typecheck + tests + docker build.

---

## Licencia

Uso privado — todos los derechos reservados.

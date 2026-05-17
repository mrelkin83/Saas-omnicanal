# PROMPT MAESTRO v7 — PLATAFORMA SAAS OMNICANAL DESDE CERO
# Documento ÚNICO y AUTOSUFICIENTE. Reemplaza todos los anteriores.

> **Destino:** Claude Code (VS Code, Windows nativo)
> **Versión:** 7.0 — Consolidada
> **Fecha:** 2026-05-17
> **Estado:** No existe código. Todo se construye desde cero.
> **Despliegue final:** VPS propio (Hetzner / DigitalOcean / Contabo) con Docker Compose.

---

## 🛑 REGLAS DE ORO (LEE ESTO PRIMERO Y NO LO OLVIDES)

Estas reglas tienen prioridad sobre TODO lo demás del documento. Si encuentras un conflicto, las reglas de oro mandan.

1. **CHECKPOINTS BLOQUEANTES.** Cada fase termina con un bloque "✅ CHECKPOINT" con comandos exactos. **NO AVANZAS a la siguiente fase hasta que TODOS los comandos del checkpoint devuelvan el resultado esperado.** Si algo falla, debes arreglarlo en la fase actual, no en la siguiente.

2. **CERO STUBS, CERO `// TODO`, CERO `throw new Error("not implemented")`.** Cada archivo que crees es funcional y listo para producción. Si una pieza necesita otra que aún no existe, créala primero o reordena las tareas dentro de la fase.

3. **TYPESCRIPT STRICT. NUNCA `any`.** Si necesitas un tipo dinámico, usa `unknown` + type guards o Zod schemas. El proyecto debe compilar con `tsc --noEmit` sin errores en cada checkpoint.

4. **EL PATRÓN "IA RECOLECTA, SISTEMA EJECUTA" ES SAGRADO.** La IA responde texto conversacional O un JSON de acción. NUNCA confirma, NUNCA ejecuta. El backend parsea el JSON, valida, ejecuta, y responde al cliente. Este patrón se detalla en la Sección 6.

5. **DOCKER COMPOSE DEBE FUNCIONAR EN CADA FASE.** No esperes a la fase final para "containerizar". El `docker compose up` debe levantar todo lo construido hasta el momento desde la Fase 1.

6. **CÓDIGO EN INGLÉS. UI Y MENSAJES AL USUARIO EN ESPAÑOL COLOMBIANO.** Nombres de variables, funciones, archivos, tablas en inglés. Strings visibles, system prompts de IA, copy del dashboard en español.

7. **CADA PROCESADOR DE ACCIÓN ENVÍA SU RESPUESTA VÍA `channelManager.sendMessage()`**, nunca directamente por un canal específico. Así el mismo procesador funciona para WhatsApp, Instagram, Facebook y TikTok sin cambios.

8. **NO INSTALES NADA QUE NO ESTÉ EN LA LISTA DE STACK (Sección 2).** Si crees que necesitas una dependencia nueva, justifícala en un comentario y agrégala explícitamente. Cero dependencias accidentales.

9. **LAS FECHAS EN DB SON UTC. LAS FECHAS QUE VE EL USUARIO SON `America/Bogota`.** Toda conversión se hace en `packages/shared/src/utils/date-helpers.ts`.

10. **MULTI-TENANT CON RLS DESDE LA FASE 1.** Cada query a una tabla con `tenant_id` debe pasar por el plugin tenant resolver. RLS en PostgreSQL es la defensa final.

11. **TAG DE GIT OBLIGATORIO AL CERRAR CADA FASE.** Cuando el checkpoint de una fase pase al 100%, ANTES de empezar la siguiente fase debes crear un tag de Git `fase-N-completa` y empujarlo a `origin`. Esto crea un punto de retorno permanente al que volver si una fase posterior rompe algo. La estrategia completa de tags y ramas está en el **Anexo A** al final de este documento. Es OBLIGATORIO, no opcional.

---

## 📋 ÍNDICE

1. Producto y alcance
2. Stack tecnológico cerrado
3. Arquitectura general
4. Estructura del monorepo
5. Modelo de datos completo
6. AI Action Engine (el corazón)
7. Capacidades modulares por tipo de negocio
8. Drivers de canales (WhatsApp, Instagram, Facebook, TikTok)
9. Design System "Obsidian Glass"
10. Docker Compose y despliegue en VPS
11. **FASES DE IMPLEMENTACIÓN CON CHECKPOINTS**
12. Criterios finales de aceptación
13. **Anexo A — Estrategia de Tags y Ramas de Git** (red de seguridad obligatoria)

---

## 1. PRODUCTO Y ALCANCE

### 1.1 Qué es

Plataforma SaaS multi-tenant que da a cada negocio colombiano:
- Un **inbox omnicanal unificado** (WhatsApp + Instagram + Facebook + TikTok).
- Un **agente de IA en español colombiano** que entiende el catálogo del negocio, cierra ventas, agenda citas, cobra vía Wompi.
- **Panel SuperAdmin SaaS** para vender el producto, gestionar planes, demos, resellers y facturación.
- **Sin costo por mensaje.**

### 1.2 Roles del sistema

| Rol | Dónde | Qué hace |
|---|---|---|
| **SuperAdmin** | `/superadmin/*` | Opera el SaaS: tenants, planes, demos, resellers, monitor VPS |
| **Owner** (dueño tenant) | `/dashboard/*` | Configura su negocio, agentes, canales, IA |
| **Admin** (tenant) | `/dashboard/*` | Todo menos billing y eliminar tenant |
| **Agent** (tenant) | `/dashboard/inbox`, `/dashboard/kanban` | Atiende conversaciones asignadas |
| **Customer final** | WhatsApp/IG/FB/TikTok | Interactúa con la IA del negocio |

### 1.3 Capacidades modulares por tipo de negocio

El sistema NO usa "verticales fijas". Cada tenant elige su **actividad económica** del catálogo y el sistema activa las **capabilities** correspondientes. Detalles en Sección 7.

Capabilities: `catalog`, `cart_orders`, `appointments`, `delivery`, `payments`, `quotes`, `reservations`.

### 1.4 Módulos del producto final

```
DASHBOARD TENANT (apps/web/src/app/(dashboard)/)
├── inbox/               # Inbox omnicanal unificado
├── kanban/              # Board tipo Trello por estado
├── orders/              # Pedidos
├── appointments/        # Citas
├── reservations/        # Reservas
├── quotes/              # Cotizaciones
├── catalog/             # Catálogo productos/servicios
├── deliveries/          # Domicilios
├── channels/            # Conectar WhatsApp/IG/FB/TikTok
├── campaigns/           # Campañas masivas
├── contacts/            # Listas de contactos
├── groups/              # Grupos WhatsApp
├── team/                # Agentes + departamentos
├── ai-config/           # Knowledge base + training + flujos
├── analytics/           # KPIs y métricas
└── settings/            # Negocio, horarios, pagos, integraciones, apariencia

SUPERADMIN SAAS (apps/web/src/app/(superadmin)/)
├── tenants/             # Gestión de tenants
├── plans/               # Planes y límites
├── demos/               # Demos con caducidad
├── resellers/           # Resellers y comisiones
├── billing/             # Facturación
├── monitor/             # CPU, RAM, disco, servicios
├── logs/                # Auditoría
└── settings/            # Config global del SaaS
```

---

## 2. STACK TECNOLÓGICO (CERRADO — NO AGREGUES NI QUITES)

```
Runtime              Node.js 20 LTS + TypeScript 5.x (strict)
Framework API        Fastify 4.x
Framework Web        Next.js 14 (App Router) + React 18
WhatsApp engine      Evolution API v2 (Docker)
Instagram engine     instagrapi (Python FastAPI sidecar en Docker)
Facebook engine      @anbuinfosec/fca-unofficial (Node.js, MQTT)
TikTok engine        Custom scraper de comentarios públicos
LLM (default)        OpenAI gpt-4o-mini (configurable por tenant)
DB                   PostgreSQL 16 con pgvector + RLS + JSONB
Cache / Queues       Redis 7 + BullMQ 5
ORM                  Drizzle ORM + drizzle-kit
Validación           Zod 3
Auth                 JWT (jose) + RBAC + bcrypt
Realtime             Server-Sent Events (SSE) + WebSocket (ws)
UI                   Tailwind CSS 3.4 + shadcn/ui customizado + Framer Motion 11 + lucide-react
Forms                react-hook-form + zod resolver
State (web)          Zustand 4 + TanStack Query 5
Testing              Vitest + Supertest + Playwright
Monorepo             Turborepo + pnpm workspaces
Containers           Docker + Docker Compose
Pagos                Wompi (sandbox + producción)
Logging              Pino structured
Reverse proxy        Caddy (en producción VPS, auto-HTTPS)
```

**Versiones fijas (NO cambies):** Las versiones exactas viven en los `package.json` de cada workspace. Si Claude Code no sabe la última versión estable, debe usar la mayor estable que conozca a la fecha del knowledge cutoff y registrarla en el `README.md`.

---

## 3. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENTES FINALES                              │
│  WhatsApp Cliente A   Instagram Cliente B   Facebook Cliente C   TikTok │
└─────────┬──────────────────┬─────────────────┬─────────────────┬────────┘
          │                  │                 │                 │
┌─────────▼───────┐ ┌────────▼────────┐ ┌──────▼───────┐ ┌──────▼────────┐
│ Evolution API   │ │ Instagram       │ │ Facebook     │ │ TikTok        │
│ (Docker :8080)  │ │ Bridge Python   │ │ fca (MQTT)   │ │ Scraper       │
│ webhook→API     │ │ (Docker :8000)  │ │ in-process   │ │ in-process    │
└─────────┬───────┘ └────────┬────────┘ └──────┬───────┘ └──────┬────────┘
          │                  │                 │                 │
          └────────────┬─────┴─────────┬───────┴─────────────────┘
                       │               │
              ┌────────▼───────────────▼────────┐
              │   CHANNEL ABSTRACTION LAYER     │
              │   IChannelDriver + Normalizer   │
              │   + Router + RateLimiter        │
              └────────────────┬─────────────────┘
                               │ NormalizedMessage
              ┌────────────────▼─────────────────┐
              │   AI ACTION ENGINE               │
              │  ┌─────────────────────────────┐ │
              │  │ 1. ContextBuilder (tenant)  │ │
              │  │ 2. PromptBuilder (caps)     │ │
              │  │ 3. LLM call (OpenAI/Groq)   │ │
              │  │ 4. ActionParser (JSON)      │ │
              │  │ 5. ActionRouter → procesador│ │
              │  │ 6. ChannelManager.send()    │ │
              │  └─────────────────────────────┘ │
              └────────────────┬─────────────────┘
                               │
        ┌──────────────┬───────┴────────┬──────────────────┐
        ▼              ▼                ▼                  ▼
   ┌────────┐    ┌──────────┐    ┌──────────────┐   ┌──────────┐
   │Orders &│    │Appointm. │    │ Quotes /     │   │Wompi     │
   │Carts   │    │Scheduling│    │ Reservations │   │Payments  │
   └────┬───┘    └────┬─────┘    └──────┬───────┘   └────┬─────┘
        │             │                  │                │
        └─────────────┴──────────────────┴────────────────┘
                               │
              ┌────────────────▼─────────────────┐
              │  PostgreSQL 16   │  Redis 7      │
              │  (RLS+pgvector)  │  (cache+queue)│
              └──────────────────┴────────────────┘

       ┌─────────────────────────────────────────────────────┐
       │  Dashboard Next.js (tenant)     SuperAdmin Panel    │
       │  apps/web/(dashboard)/          apps/web/(superadmin)/│
       └─────────────────────────────────────────────────────┘
```

---

## 4. ESTRUCTURA DEL MONOREPO

```
saas-omnichannel/
├── docker/
│   ├── Dockerfile.api              # Multi-stage: deps → build → runtime
│   ├── Dockerfile.web              # Multi-stage Next.js standalone
│   ├── Dockerfile.instagram-bridge # Python 3.11 slim
│   ├── Caddyfile                   # Reverse proxy + auto-HTTPS
│   └── docker-compose.yml          # Orquestación completa
├── docker-compose.dev.yml          # Solo Postgres + Redis + Evolution para dev local
├── docker-compose.prod.yml         # Producción VPS (incluye Caddy)
│
├── packages/
│   ├── shared/                     # Tipos, schemas, utils compartidos
│   │   └── src/
│   │       ├── schemas/            # Zod schemas
│   │       ├── types/              # Channel, AI actions, common
│   │       ├── constants/          # business-types, channels, capabilities, actions
│   │       └── utils/              # format-cop, date-helpers, phone-utils
│   └── db/                         # Drizzle schema, migrations, seed
│       └── src/
│           ├── schema/             # Una tabla por archivo
│           ├── migrations/         # Generadas por drizzle-kit
│           ├── seed/               # demo-seed.ts (7 tenants demo)
│           └── client.ts           # Pooled connection
│
├── apps/
│   ├── api/                        # Backend Fastify
│   │   └── src/
│   │       ├── server.ts
│   │       ├── plugins/            # auth, tenant, rate-limit, error, swagger, cors
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── tenants/
│   │       │   ├── users/
│   │       │   ├── customers/
│   │       │   ├── products/
│   │       │   ├── categories/
│   │       │   ├── orders/
│   │       │   ├── carts/
│   │       │   ├── appointments/
│   │       │   ├── reservations/
│   │       │   ├── quotes/
│   │       │   ├── deliveries/
│   │       │   ├── payments/         # Wompi
│   │       │   ├── conversations/
│   │       │   ├── messages/
│   │       │   ├── channels/
│   │       │   │   ├── core/         # IChannelDriver, manager, router, normalizer
│   │       │   │   ├── drivers/
│   │       │   │   │   ├── whatsapp/   # Evolution API client + webhook + driver
│   │       │   │   │   ├── instagram/  # Bridge client + poller + driver
│   │       │   │   │   ├── facebook/   # fca listener + driver
│   │       │   │   │   └── tiktok/     # Scraper + driver
│   │       │   │   ├── channels.routes.ts
│   │       │   │   └── channels.service.ts
│   │       │   ├── ai/               # ★ AI ACTION ENGINE
│   │       │   │   ├── ai.engine.ts
│   │       │   │   ├── ai.prompt-builder.ts
│   │       │   │   ├── ai.action-parser.ts
│   │       │   │   ├── ai.context-builder.ts
│   │       │   │   ├── ai.action-router.ts
│   │       │   │   ├── processors/
│   │       │   │   ├── scheduling/   # Slot engine para appointments
│   │       │   │   ├── knowledge/    # Base de conocimiento + pgvector
│   │       │   │   └── learning/     # Aprendizaje continuo
│   │       │   ├── kanban/
│   │       │   ├── campaigns/
│   │       │   ├── contact-lists/
│   │       │   ├── groups/           # Grupos WhatsApp
│   │       │   ├── departments/
│   │       │   ├── integrations/
│   │       │   ├── analytics/
│   │       │   ├── webhooks/         # Receptores: evolution, wompi
│   │       │   └── superadmin/       # ★ Módulo SuperAdmin
│   │       │       ├── tenants/
│   │       │       ├── plans/
│   │       │       ├── demos/
│   │       │       ├── resellers/
│   │       │       ├── billing/
│   │       │       ├── monitor/
│   │       │       └── audit/
│   │       ├── jobs/                 # BullMQ workers
│   │       │   ├── instagram-poller.job.ts
│   │       │   ├── tiktok-scraper.job.ts
│   │       │   ├── payment-checker.job.ts
│   │       │   ├── campaign-sender.job.ts
│   │       │   ├── reminder.job.ts
│   │       │   ├── ai-learning.job.ts
│   │       │   ├── demo-expiry.job.ts
│   │       │   └── analytics-aggregator.job.ts
│   │       └── lib/
│   │           ├── llm-client.ts     # Multi-provider (OpenAI/Groq/Anthropic)
│   │           ├── wompi-client.ts
│   │           ├── redis.ts
│   │           ├── db.ts
│   │           ├── encryption.ts     # AES-256-GCM para secrets
│   │           ├── tenant-config.ts  # getConfig() con cache Redis
│   │           ├── sse.ts            # Server-Sent Events helper
│   │           └── logger.ts
│   │
│   ├── instagram-bridge/           # Sidecar Python
│   │   ├── main.py
│   │   ├── instagram_service.py
│   │   ├── session_manager.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── web/                        # Next.js 14
│       └── src/
│           ├── app/
│           │   ├── (auth)/         # Login, register
│           │   ├── (dashboard)/    # Tenant dashboard
│           │   ├── (superadmin)/   # SuperAdmin panel
│           │   └── api/            # Route handlers proxy a Fastify
│           ├── components/
│           │   ├── ui/             # GlassCard, Button, Input, Modal...
│           │   ├── dashboard/      # Sidebar, Navbar, ChannelBadge
│           │   ├── inbox/          # ConversationList, MessageThread
│           │   ├── kanban/         # Board, Column, Card
│           │   └── superadmin/     # TenantTable, PlanCard...
│           ├── lib/
│           │   ├── api-client.ts
│           │   ├── auth.ts
│           │   └── utils.ts
│           └── styles/
│               └── globals.css     # Design tokens "Obsidian Glass"
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── DEPLOY.md                       # Guía despliegue VPS paso a paso
```

---

## 5. MODELO DE DATOS COMPLETO

> Todas las tablas con `tenant_id` tienen RLS activo. Política: `tenant_id = current_setting('app.tenant_id')::uuid`.
> Excepción: tablas SuperAdmin (`saas_plans`, `saas_resellers`, `saas_audit_logs`, `superadmin_users`) NO tienen `tenant_id`.

```sql
-- ═════════════════════════════════════════════
-- EXTENSIONES
-- ═════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ═════════════════════════════════════════════
-- TENANCY Y AUTH
-- ═════════════════════════════════════════════
CREATE TABLE tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    business_type       VARCHAR(50) NOT NULL,
    business_type_label VARCHAR(255),
    capabilities        TEXT[] NOT NULL DEFAULT '{}',
    timezone            VARCHAR(50) DEFAULT 'America/Bogota',
    -- Info negocio extendida
    phone               VARCHAR(20),
    address             TEXT,
    description         TEXT,
    logo_url            TEXT,
    website             TEXT,
    -- IA config
    ai_model            VARCHAR(50) DEFAULT 'gpt-4o-mini',
    ai_temperature      DECIMAL(3,2) DEFAULT 0.7,
    ai_max_tokens       INTEGER DEFAULT 500,
    ai_agent_name       VARCHAR(100) DEFAULT 'Asistente',
    ai_tone             VARCHAR(50) DEFAULT 'amigable',
    -- SaaS
    plan_id             UUID,
    reseller_id         UUID,
    is_demo             BOOLEAN DEFAULT false,
    demo_expires_at     TIMESTAMPTZ,
    suspended_at        TIMESTAMPTZ,
    suspended_reason    TEXT,
    billing_email       VARCHAR(255),
    mrr                 DECIMAL(12,2) DEFAULT 0,
    -- Audit
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email                VARCHAR(255) NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    full_name            VARCHAR(255) NOT NULL,
    role                 VARCHAR(20) NOT NULL DEFAULT 'agent', -- owner|admin|agent
    avatar_url           TEXT,
    agent_status         VARCHAR(20) DEFAULT 'available',      -- available|busy|away|offline
    max_concurrent_chats INTEGER DEFAULT 5,
    current_chat_count   INTEGER DEFAULT 0,
    last_login           TIMESTAMPTZ,
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- ═════════════════════════════════════════════
-- SUPERADMIN (sin tenant_id)
-- ═════════════════════════════════════════════
CREATE TABLE superadmin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(20) DEFAULT 'admin',   -- superadmin|admin|support
    is_active     BOOLEAN DEFAULT true,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saas_plans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(50) UNIQUE NOT NULL,
    price_cop     DECIMAL(12,2) NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly',  -- monthly|annual
    limits        JSONB NOT NULL,                  -- {max_messages_month, max_agents, max_channels, ...}
    features      JSONB DEFAULT '[]',
    is_active     BOOLEAN DEFAULT true,
    sort_order    INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saas_resellers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    company         VARCHAR(255),
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    commission_pct  DECIMAL(5,2) DEFAULT 10.00,
    referral_code   VARCHAR(20) UNIQUE NOT NULL,
    total_referrals INTEGER DEFAULT 0,
    total_earnings  DECIMAL(12,2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saas_audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id     UUID NOT NULL REFERENCES superadmin_users(id),
    action       VARCHAR(100) NOT NULL,
    target_type  VARCHAR(50),
    target_id    UUID,
    details      JSONB DEFAULT '{}',
    ip_address   VARCHAR(45),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═════════════════════════════════════════════
-- CUSTOMERS, CATÁLOGO, ÓRDENES
-- ═════════════════════════════════════════════
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone           VARCHAR(20),
    instagram_id    VARCHAR(100),
    facebook_id     VARCHAR(100),
    tiktok_id       VARCHAR(100),
    full_name       VARCHAR(255),
    display_name    VARCHAR(255),
    email           VARCHAR(255),
    cedula          VARCHAR(20),
    avatar_url      TEXT,
    address         TEXT,
    custom_attributes JSONB DEFAULT '{}',
    tags            TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone);

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    parent_id  UUID REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id      UUID REFERENCES categories(id),
    type             VARCHAR(20) DEFAULT 'product', -- product|service
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    sku              VARCHAR(100),
    price            DECIMAL(12,2),
    cost             DECIMAL(12,2),
    duration_minutes INTEGER,                       -- Para services
    has_variants     BOOLEAN DEFAULT false,
    stock            INTEGER,
    images           TEXT[] DEFAULT '{}',
    custom_attributes JSONB DEFAULT '{}',           -- specs, talla, color, etc.
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_variants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku          VARCHAR(100),
    attributes   JSONB NOT NULL,    -- {"talla":"M","color":"rojo"}
    price        DECIMAL(12,2),
    stock        INTEGER,
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE carts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    conversation_id UUID,
    status          VARCHAR(20) DEFAULT 'active',  -- active|converted|expired
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cart_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id      UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id),
    variant_id   UUID REFERENCES product_variants(id),
    product_name VARCHAR(255) NOT NULL,
    variant_info JSONB,
    quantity     INTEGER NOT NULL DEFAULT 1,
    unit_price   DECIMAL(12,2) NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    conversation_id UUID,
    order_number    VARCHAR(20) NOT NULL,
    status          VARCHAR(30) DEFAULT 'pending', -- pending|confirmed|preparing|shipped|delivered|cancelled
    payment_status  VARCHAR(20) DEFAULT 'pending', -- pending|paid|failed|refunded
    subtotal        DECIMAL(12,2) NOT NULL,
    tax             DECIMAL(12,2) DEFAULT 0,
    shipping        DECIMAL(12,2) DEFAULT 0,
    discount        DECIMAL(12,2) DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL,
    shipping_address TEXT,
    notes           TEXT,
    custom_attributes JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, order_number)
);

CREATE TABLE order_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id),
    variant_id   UUID REFERENCES product_variants(id),
    product_name VARCHAR(255) NOT NULL,
    variant_info JSONB,
    quantity     INTEGER NOT NULL,
    unit_price   DECIMAL(12,2) NOT NULL,
    subtotal     DECIMAL(12,2) NOT NULL
);

-- ═════════════════════════════════════════════
-- CITAS, RESERVAS, COTIZACIONES
-- ═════════════════════════════════════════════
CREATE TABLE appointments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id      UUID NOT NULL REFERENCES customers(id),
    service_id       UUID NOT NULL REFERENCES products(id),
    provider_id      UUID REFERENCES users(id),
    service_name     VARCHAR(255) NOT NULL,
    status           VARCHAR(20) DEFAULT 'confirmed', -- confirmed|cancelled|completed|no_show
    scheduled_at     TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    notes            TEXT,
    reminder_sent    BOOLEAN DEFAULT false,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reservations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    conversation_id   UUID,
    status            VARCHAR(20) DEFAULT 'pending',  -- pending|confirmed|cancelled|completed|no_show
    reserved_date     DATE NOT NULL,
    reserved_time     TIME NOT NULL,
    party_size        INTEGER DEFAULT 1,
    resource_type     VARCHAR(50),   -- mesa|habitacion|sala|espacio
    resource_name     VARCHAR(255),
    duration_minutes  INTEGER,
    notes             TEXT,
    reminder_sent     BOOLEAN DEFAULT false,
    custom_attributes JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    conversation_id UUID,
    quote_number    VARCHAR(20) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending|sent|accepted|rejected|expired
    items           JSONB NOT NULL,
    subtotal        DECIMAL(12,2) NOT NULL,
    discount        DECIMAL(12,2) DEFAULT 0,
    tax             DECIMAL(12,2) DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL,
    notes           TEXT,
    valid_until     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, quote_number)
);

-- ═════════════════════════════════════════════
-- CANALES, CONVERSACIONES, MENSAJES
-- ═════════════════════════════════════════════
CREATE TABLE channel_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel       VARCHAR(20) NOT NULL,  -- whatsapp|instagram|facebook|tiktok
    external_id   VARCHAR(255),          -- instanceName Evolution, ig user_id, etc.
    display_name  VARCHAR(255),
    status        VARCHAR(20) DEFAULT 'pending',  -- pending|connected|disconnected|failed
    credentials   JSONB,                 -- ENCRYPTED en encryption.ts
    metadata      JSONB DEFAULT '{}',
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    channel           VARCHAR(20) NOT NULL,
    channel_session_id UUID REFERENCES channel_sessions(id),
    status            VARCHAR(20) DEFAULT 'open',  -- open|closed|archived
    assigned_user_id  UUID REFERENCES users(id),
    department_id     UUID,
    kanban_column_id  UUID,
    potential_value   DECIMAL(12,2) DEFAULT 0,
    kanban_moved_at   TIMESTAMPTZ,
    unread_count      INTEGER DEFAULT 0,
    last_message_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    direction       VARCHAR(10) NOT NULL,  -- inbound|outbound
    sender_type     VARCHAR(20) NOT NULL,  -- customer|ai|agent|system
    sender_user_id  UUID REFERENCES users(id),
    type            VARCHAR(20) DEFAULT 'text', -- text|image|audio|video|file|location
    content         TEXT,
    media_url       TEXT,
    metadata        JSONB DEFAULT '{}',
    external_id     VARCHAR(255),
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);

CREATE TABLE conversation_state (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    channel     VARCHAR(20) NOT NULL,
    state       VARCHAR(30) DEFAULT 'IA_ACTIVA',  -- IA_ACTIVA|AGENTE_HUMANO|PAUSADA
    historial   JSONB DEFAULT '[]',                -- Últimos 10 mensajes [{role,content}]
    metadata    JSONB DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, customer_id, channel)
);

-- ═════════════════════════════════════════════
-- CONFIG, IA, KANBAN, CAMPAÑAS, DEPARTAMENTOS
-- ═════════════════════════════════════════════
CREATE TABLE tenant_config (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key        VARCHAR(100) NOT NULL,
    value      JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, key)
);

CREATE TABLE ai_knowledge_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    category    VARCHAR(50),
    keywords    TEXT[] DEFAULT '{}',
    embedding   vector(1536),         -- OpenAI text-embedding-3-small
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_knowledge_embedding ON ai_knowledge_entries
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE ai_unanswered_queries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    question        TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending|resolved|ignored
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    queue_order     INTEGER DEFAULT 0,
    auto_assign     BOOLEAN DEFAULT true,
    business_hours  JSONB DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE department_members (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          VARCHAR(20) DEFAULT 'agent',  -- lead|agent
    UNIQUE(department_id, user_id)
);

CREATE TABLE kanban_columns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7) DEFAULT '#6366F1',
    sort_order  INTEGER DEFAULT 0,
    is_final    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    type            VARCHAR(20) DEFAULT 'static',  -- static|dynamic
    filter_criteria JSONB,
    contact_count   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_list_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id     UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    phone       VARCHAR(20) NOT NULL,
    name        VARCHAR(255),
    variables   JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    list_id             UUID NOT NULL REFERENCES contact_lists(id),
    channel_session_id  UUID REFERENCES channel_sessions(id),
    messages            JSONB NOT NULL,                       -- [{text, media_url, active}]
    variables_schema    JSONB,
    media_url           VARCHAR(500),
    media_type          VARCHAR(20),
    scheduled_at        TIMESTAMPTZ,
    recurrence          VARCHAR(20) DEFAULT 'once',
    next_run_at         TIMESTAMPTZ,
    api_provider        VARCHAR(20) DEFAULT 'evolution',
    status              VARCHAR(20) DEFAULT 'draft',
    total_contacts      INTEGER DEFAULT 0,
    sent_count          INTEGER DEFAULT 0,
    delivered_count     INTEGER DEFAULT 0,
    read_count          INTEGER DEFAULT 0,
    failed_count        INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaign_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_phone VARCHAR(20) NOT NULL,
    contact_name  VARCHAR(255),
    message_index INTEGER,
    status        VARCHAR(20) DEFAULT 'pending',  -- pending|sent|delivered|read|failed
    error_message TEXT,
    sent_at       TIMESTAMPTZ,
    delivered_at  TIMESTAMPTZ,
    read_at       TIMESTAMPTZ
);

CREATE TABLE integrations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider    VARCHAR(50) NOT NULL,  -- openai|groq|anthropic|n8n|typebot|dify|chatwoot
    category    VARCHAR(20) NOT NULL,  -- llm|automation|crm
    config      JSONB NOT NULL,        -- {api_key encrypted, base_url, model}
    is_active   BOOLEAN DEFAULT false,
    is_primary  BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);

CREATE TABLE deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES orders(id),
    courier_name    VARCHAR(100),
    tracking_number VARCHAR(100),
    status          VARCHAR(30) DEFAULT 'pending',
    address         TEXT NOT NULL,
    notes           TEXT,
    estimated_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id          UUID REFERENCES orders(id),
    appointment_id    UUID REFERENCES appointments(id),
    customer_id       UUID NOT NULL REFERENCES customers(id),
    provider          VARCHAR(20) DEFAULT 'wompi',
    external_id       VARCHAR(255),
    amount            DECIMAL(12,2) NOT NULL,
    currency          VARCHAR(3) DEFAULT 'COP',
    status            VARCHAR(20) DEFAULT 'pending',  -- pending|approved|declined|refunded
    payment_link      TEXT,
    payment_method    VARCHAR(50),
    metadata          JSONB DEFAULT '{}',
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analytics_daily (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    channel             VARCHAR(20),
    messages_in         INTEGER DEFAULT 0,
    messages_out        INTEGER DEFAULT 0,
    conversations_new   INTEGER DEFAULT 0,
    orders_created      INTEGER DEFAULT 0,
    appointments_created INTEGER DEFAULT 0,
    revenue             DECIMAL(12,2) DEFAULT 0,
    ai_responses        INTEGER DEFAULT 0,
    ai_escalations      INTEGER DEFAULT 0,
    UNIQUE(tenant_id, date, channel)
);

-- ═════════════════════════════════════════════
-- RLS POLICIES (aplicar a TODAS las tablas con tenant_id)
-- ═════════════════════════════════════════════
-- Template (repetir para cada tabla con tenant_id):
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenants ON tenants
    USING (id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- ... (repetir para customers, products, orders, appointments, etc.)
```

---

## 6. AI ACTION ENGINE — EL CORAZÓN DEL SISTEMA

**Esto es lo más importante del sistema. Léelo dos veces antes de implementarlo.**

### 6.1 Principio "IA recolecta, Sistema ejecuta"

```
Cliente: "Quiero una cita de manicure el martes a las 3pm"
   │
   ▼
┌────────────────────────────────────┐
│ AI Engine                          │
│ 1. ContextBuilder.build()          │ ← carga citas activas, carrito, etc.
│ 2. PromptBuilder.build(caps)       │ ← arma prompt según capabilities
│ 3. LLMClient.chat()                │ ← llama a OpenAI/Groq
│ 4. ActionParser.parse(respuesta)   │ ← detecta JSON o texto libre
└────────────┬───────────────────────┘
             │
   ┌─────────┴──────────┐
   │ Texto libre?       │
   │  → enviar al user  │
   │ JSON acción?       │
   │  → ActionRouter    │
   └─────────┬──────────┘
             │ accion="CREAR_CITA"
             ▼
┌────────────────────────────────────┐
│ crear-cita.processor.ts            │
│ 1. Validar servicio existe         │
│ 2. Validar slot disponible         │
│ 3. Validar no-solapamiento         │
│ 4. Validar límite citas activas    │
│ 5. Crear cita en DB                │
│ 6. channelManager.sendMessage(     │
│      confirmación al cliente)      │
│ 7. Notificar al dueño              │
└────────────────────────────────────┘
```

**Regla absoluta:** la IA NUNCA dice "confirmado". El sistema lo dice después de validar.

### 6.2 ai.engine.ts — Función principal

```typescript
// apps/api/src/modules/ai/ai.engine.ts
//
// process() se invoca cada vez que llega un mensaje normalizado del Channel Router.
//
// Pseudo-código (implementa con TypeScript estricto):
//
// async function process(input: AIEngineInput): Promise<void> {
//   const tenant = await tenantService.getById(input.tenantId);
//   const state = await conversationStateService.get(tenant.id, input.customerId, input.channel);
//   const historial = state?.historial ?? [];
//   historial.push({ role: 'user', content: input.message });
//
//   const contextoCliente = await contextBuilder.build({
//     tenantId: tenant.id,
//     capabilities: tenant.capabilities,
//     customerId: input.customerId
//   });
//
//   const systemPrompt = await promptBuilder.build({
//     tenant,
//     capabilities: tenant.capabilities,
//     channel: input.channel,
//     contextoCliente
//   });
//
//   const respuestaIA = await llmClient.chat({
//     model: tenant.ai_model,
//     systemPrompt,
//     messages: historial,
//     temperature: Number(tenant.ai_temperature),
//     maxTokens: tenant.ai_max_tokens
//   });
//
//   const accion = actionParser.parse(respuestaIA, tenant.capabilities);
//
//   historial.push({ role: 'assistant', content: respuestaIA });
//   await conversationStateService.upsert(tenant.id, input.customerId, input.channel, {
//     historial: historial.slice(-10)
//   });
//
//   if (!accion) {
//     const textoLimpio = respuestaIA.replace(/\{[^{}]*"accion"[^{}]*\}/g, '').trim();
//     await channelManager.sendMessage(tenant.id, input.channel, input.customerPhone, {
//       type: 'text', text: textoLimpio
//     });
//     return;
//   }
//
//   await actionRouter.execute({ ...input, accion, tenant, contextoCliente });
// }
```

### 6.3 Action parser

```typescript
// Parsea respuesta del LLM. Valida que la acción esté permitida por las capabilities del tenant.
//
// Mapa acción → capability requerida:
const ACTION_CAPABILITY: Record<string, Capability | null> = {
  VER_CATALOGO: 'catalog',
  AGREGAR_CARRITO: 'cart_orders',
  VER_CARRITO: 'cart_orders',
  CREAR_PEDIDO: 'cart_orders',
  VER_ESTADO_PEDIDO: 'cart_orders',
  CREAR_CITA: 'appointments',
  CANCELAR_CITA: 'appointments',
  REAGENDAR_CITA: 'appointments',
  VER_SLOTS: 'appointments',
  VER_CITAS: 'appointments',
  CREAR_RESERVA: 'reservations',
  CANCELAR_RESERVA: 'reservations',
  VER_RESERVAS: 'reservations',
  COTIZAR: 'quotes',
  VER_COTIZACION: 'quotes',
  ENVIAR_PAGO: 'payments',
  ESCALAMIENTO: null,   // siempre disponible
  INFO_NEGOCIO: null    // siempre disponible
};

// parse(): regex para extraer JSON, JSON.parse, validar contra el mapa.
// Si la acción no corresponde a una capability activa → return null (la IA "alucinó")
```

### 6.4 Procesadores (uno por acción)

Cada procesador en su propio archivo `apps/api/src/modules/ai/processors/<accion>.processor.ts`.
Estructura común:
1. **Validar inputs** (Zod schema por acción).
2. **Cargar entidades** referenciadas (servicio, producto, cita).
3. **Validar reglas de negocio** (slot disponible, stock, límites).
4. **Ejecutar** (crear/actualizar/eliminar en DB).
5. **Enviar confirmación al cliente** vía `channelManager.sendMessage()`.
6. **Notificar al dueño** (vía notificación en dashboard + opcionalmente email/WhatsApp).

Procesadores requeridos:
- `crear-cita`, `cancelar-cita`, `reagendar-cita`, `ver-slots`, `ver-citas`
- `ver-catalogo`, `agregar-carrito`, `ver-carrito`, `crear-pedido`, `ver-estado-pedido`
- `cotizar`, `ver-cotizacion`
- `crear-reserva`, `cancelar-reserva`, `ver-reservas`
- `enviar-pago`
- `escalamiento`, `info-negocio`

### 6.5 LLM Client multi-proveedor

```typescript
// apps/api/src/lib/llm-client.ts
// Lee la integración activa del tenant (tabla integrations, is_primary=true, category='llm')
// Soporta: openai, groq, anthropic, openrouter.
// Default si no hay integración: OPENAI_API_KEY del .env con gpt-4o-mini.
```

### 6.6 Tenant Config

```typescript
// apps/api/src/lib/tenant-config.ts
// getConfig<T>(tenantId, key, default): consulta tenant_config con cache Redis TTL 300s.
// setConfig(tenantId, key, value): invalida cache.
//
// Keys estándar:
// - max_citas_activas_por_cliente (default 5)
// - dias_max_adelanto (default 30)
// - max_items_carrito (default 20)
// - carrito_expiracion_horas (default 24)
// - envio_gratis_desde (default 100000)
// - costo_envio_default (default 10000)
// - impuesto_porcentaje (default 19)
// - horario_atencion (default {lun-vie: 8-18, sab: 9-13})
// - mensaje_fuera_horario (default "Estamos cerrados...")
// - max_mensajes_por_minuto (default 30)
```

---

## 7. CAPACIDADES MODULARES POR TIPO DE NEGOCIO

```typescript
// packages/shared/src/constants/business-types.ts

export type Capability =
  | 'catalog' | 'cart_orders' | 'appointments'
  | 'delivery' | 'payments' | 'quotes' | 'reservations';

export const BUSINESS_TYPES = {
  // Comercio
  ferreteria_construccion:    { label: 'Ferretería y construcción',    icon: '🔧', capabilities: ['catalog','cart_orders','payments','delivery'] },
  papeleria_libros:           { label: 'Papelería y libros',           icon: '📝', capabilities: ['catalog','cart_orders','payments','delivery'] },
  licoreria:                  { label: 'Licorería',                    icon: '🍷', capabilities: ['catalog','cart_orders','payments','delivery'] },
  ropa_calzado:               { label: 'Ropa y calzado',               icon: '👗', capabilities: ['catalog','cart_orders','payments','delivery'] },
  articulos_belleza:          { label: 'Artículos de belleza',         icon: '💄', capabilities: ['catalog','cart_orders','payments','delivery'] },
  tienda_barrio:              { label: 'Tienda de barrio',             icon: '🏪', capabilities: ['catalog','cart_orders','delivery'] },
  minimercado:                { label: 'Minimercado',                  icon: '🛒', capabilities: ['catalog','cart_orders','payments','delivery'] },
  electronica_informatica:    { label: 'Electrónica e informática',    icon: '💻', capabilities: ['catalog','cart_orders','payments','delivery','quotes'] },
  articulos_hogar:            { label: 'Artículos para el hogar',      icon: '🏠', capabilities: ['catalog','cart_orders','payments','delivery'] },
  articulos_deportivos:       { label: 'Artículos deportivos',         icon: '⚽', capabilities: ['catalog','cart_orders','payments','delivery'] },
  tienda_mascotas_vet:        { label: 'Tienda de mascotas/vet',       icon: '🐾', capabilities: ['catalog','cart_orders','payments','delivery','appointments'] },
  farmacia_drogueria:         { label: 'Farmacia y droguería',         icon: '💊', capabilities: ['catalog','cart_orders','payments','delivery'] },
  tienda_naturista:           { label: 'Tienda naturista',             icon: '🌿', capabilities: ['catalog','cart_orders','payments','delivery'] },
  carniceria:                 { label: 'Carnicería',                   icon: '🥩', capabilities: ['catalog','cart_orders','payments','delivery'] },
  salsamentaria:              { label: 'Salsamentaria',                icon: '🧀', capabilities: ['catalog','cart_orders','payments','delivery'] },
  accesorios_bisuteria:       { label: 'Accesorios y bisutería',       icon: '💍', capabilities: ['catalog','cart_orders','payments','delivery'] },
  tienda_regalos:             { label: 'Tienda de regalos',            icon: '🎁', capabilities: ['catalog','cart_orders','payments','delivery'] },
  distribuidora_mayorista:    { label: 'Distribuidora / Mayorista',    icon: '📦', capabilities: ['catalog','cart_orders','payments','delivery','quotes'] },
  insumos_agropecuarios:      { label: 'Insumos agropecuarios',        icon: '🌾', capabilities: ['catalog','cart_orders','payments','delivery','quotes'] },
  articulos_automotrices:     { label: 'Artículos automotrices',       icon: '🔩', capabilities: ['catalog','cart_orders','payments','quotes'] },
  venta_automoviles:          { label: 'Venta de automóviles',         icon: '🚗', capabilities: ['catalog','quotes','appointments','payments'] },
  // Gastronomía
  restaurante_comida_rapida:  { label: 'Restaurante / comida rápida',  icon: '🍔', capabilities: ['catalog','cart_orders','payments','delivery','reservations'] },
  cafeteria:                  { label: 'Cafetería',                    icon: '☕', capabilities: ['catalog','cart_orders','payments'] },
  bar:                        { label: 'Bar',                          icon: '🍸', capabilities: ['catalog','reservations','payments'] },
  panaderia_reposteria:       { label: 'Panadería y repostería',       icon: '🥐', capabilities: ['catalog','cart_orders','payments','delivery'] },
  // Servicios con cita
  estetica_salud:             { label: 'Estética y salud',             icon: '💆', capabilities: ['catalog','appointments','payments'] },
  tatuajes_piercings:         { label: 'Tatuajes y piercings',         icon: '🎨', capabilities: ['catalog','appointments','payments'] },
  reparaciones_mantenimiento: { label: 'Reparaciones y mantenimiento', icon: '🔧', capabilities: ['appointments','quotes','payments'] },
  taller_automotriz:          { label: 'Taller automotriz',            icon: '🔧', capabilities: ['appointments','quotes','payments'] },
  salon_belleza_barberia:     { label: 'Salón de belleza / Barbería',  icon: '💇', capabilities: ['catalog','appointments','payments'] },
  spa_bienestar:              { label: 'Spa y bienestar',              icon: '🧖', capabilities: ['catalog','appointments','reservations','payments'] },
  // Profesionales
  abogado_juridico:           { label: 'Abogado / Servicios jurídicos', icon: '⚖️', capabilities: ['catalog','appointments','quotes','payments'] },
  arquitecto:                 { label: 'Arquitecto',                    icon: '📐', capabilities: ['catalog','appointments','quotes','payments'] },
  ingeniero_civil:            { label: 'Ingeniero civil',               icon: '🏗️', capabilities: ['appointments','quotes','payments'] },
  ingeniero_sistemas:         { label: 'Ingeniero de sistemas',         icon: '💻', capabilities: ['catalog','appointments','quotes','payments'] },
  contador_contabilidad:      { label: 'Contador / Auditoría',          icon: '📊', capabilities: ['catalog','appointments','quotes','payments'] },
  consultoria_empresarial:    { label: 'Consultoría empresarial',       icon: '💼', capabilities: ['catalog','appointments','quotes','payments'] },
  medico_general:             { label: 'Médico general',                icon: '🩺', capabilities: ['catalog','appointments','payments'] },
  odontologo:                 { label: 'Odontólogo / Clínica dental',   icon: '🦷', capabilities: ['catalog','appointments','payments'] },
  psicologo:                  { label: 'Psicólogo',                     icon: '🧠', capabilities: ['appointments','payments'] },
  fisioterapeuta:             { label: 'Fisioterapeuta',                icon: '🏥', capabilities: ['catalog','appointments','payments'] },
  nutricionista:              { label: 'Nutricionista',                 icon: '🥗', capabilities: ['catalog','appointments','payments'] },
  veterinario:                { label: 'Veterinario',                   icon: '🐾', capabilities: ['catalog','appointments','payments','cart_orders'] },
  optometra:                  { label: 'Optómetra / Óptica',            icon: '👓', capabilities: ['catalog','appointments','payments','cart_orders'] },
  laboratorio_clinico:        { label: 'Laboratorio clínico',           icon: '🔬', capabilities: ['catalog','appointments','payments'] },
  agente_inmobiliario:        { label: 'Bienes raíces',                 icon: '🏡', capabilities: ['catalog','appointments','quotes','payments'] },
  agente_seguros:             { label: 'Agente de seguros',             icon: '🛡️', capabilities: ['catalog','appointments','quotes','payments'] },
  notaria:                    { label: 'Notaría',                       icon: '📜', capabilities: ['catalog','appointments','quotes','payments'] },
  diseno_grafico:             { label: 'Diseño gráfico',                icon: '🎨', capabilities: ['catalog','quotes','payments'] },
  fotografia_video:           { label: 'Fotografía y video',            icon: '📸', capabilities: ['catalog','appointments','quotes','payments'] },
  coaching_mentoria:          { label: 'Coaching / Mentoría',           icon: '🎯', capabilities: ['catalog','appointments','payments'] },
  traductor_interprete:       { label: 'Traductor / Intérprete',        icon: '🌐', capabilities: ['catalog','quotes','payments'] },
  cerrajeria:                 { label: 'Cerrajería',                    icon: '🔑', capabilities: ['catalog','appointments','quotes','payments'] },
  fumigacion_plagas:          { label: 'Fumigación / Plagas',           icon: '🐛', capabilities: ['catalog','appointments','quotes','payments'] },
  aseo_limpieza:              { label: 'Aseo y limpieza',               icon: '🧹', capabilities: ['catalog','appointments','quotes','payments'] },
  plomeria:                   { label: 'Plomería',                      icon: '🔧', capabilities: ['appointments','quotes','payments'] },
  mudanzas_trasteos:          { label: 'Mudanzas y trasteos',           icon: '📦', capabilities: ['quotes','payments'] },
  marketing_publicidad:       { label: 'Marketing y publicidad',        icon: '📢', capabilities: ['catalog','quotes','appointments','payments'] },
  servicios_educativos:       { label: 'Servicios educativos',          icon: '📚', capabilities: ['catalog','appointments','payments'] },
  academia_idiomas:           { label: 'Academia de idiomas',           icon: '🗣️', capabilities: ['catalog','appointments','payments'] },
  tutor_clases_particulares:  { label: 'Tutor / Clases particulares',   icon: '📖', capabilities: ['catalog','appointments','payments'] },
  // Hospitalidad
  hoteles_turismo:            { label: 'Hoteles y turismo',             icon: '🏨', capabilities: ['catalog','reservations','payments'] },
  organizacion_eventos:       { label: 'Organización de eventos',       icon: '🎉', capabilities: ['catalog','quotes','reservations','payments'] },
  // Fitness y entretenimiento
  gimnasio:                   { label: 'Gimnasio',                      icon: '🏋️', capabilities: ['catalog','appointments','payments'] },
  entretenimiento_ocio:       { label: 'Entretenimiento y ocio',        icon: '🎮', capabilities: ['catalog','reservations','payments'] },
  escuela_danza:              { label: 'Escuela de danza',              icon: '💃', capabilities: ['catalog','appointments','payments'] },
  escuela_musica:             { label: 'Escuela de música',             icon: '🎵', capabilities: ['catalog','appointments','payments'] },
  // Otros
  industria_manufactura:      { label: 'Industria / manufactura',       icon: '🏭', capabilities: ['catalog','quotes','payments'] },
  transporte_logistica:       { label: 'Transporte y logística',        icon: '🚚', capabilities: ['quotes','payments'] },
  prestamos_financiamiento:   { label: 'Préstamos y financiamiento',    icon: '💰', capabilities: ['appointments','quotes'] },
  otro:                       { label: 'Otro',                          icon: '🏢', capabilities: ['catalog','payments'] }
} as const;

export type BusinessType = keyof typeof BUSINESS_TYPES;
```

---

## 8. DRIVERS DE CANALES

### 8.1 IChannelDriver interface

```typescript
// apps/api/src/modules/channels/core/channel-driver.interface.ts
//
// export interface IChannelDriver {
//   readonly channel: ChannelType;
//   connect(tenantId: string, credentials: unknown): Promise<ConnectResult>;
//   disconnect(sessionId: string): Promise<void>;
//   getStatus(sessionId: string): Promise<ChannelStatus>;
//   sendMessage(sessionId: string, to: string, message: OutgoingMessage): Promise<SendResult>;
//   onIncoming(handler: (msg: NormalizedMessage) => Promise<void>): void;
// }
```

### 8.2 WhatsApp driver (Evolution API)

```
Crear instancia:    POST {EVOLUTION_API_URL}/instance/create
                    Body: {
                      instanceName: "tenant-{tenantId}",
                      integration: "WHATSAPP-BAILEYS",
                      qrcode: true,
                      webhook: {
                        url: "{API_BASE_URL}/api/webhooks/evolution",
                        events: ["QRCODE_UPDATED","MESSAGES_UPSERT","CONNECTION_UPDATE","MESSAGES_UPDATE"]
                      }
                    }
                    Header: apikey: {EVOLUTION_API_GLOBAL_KEY}

QR:                 GET {EVOLUTION_API_URL}/instance/connect/{instanceName}
Estado:             GET {EVOLUTION_API_URL}/instance/connectionState/{instanceName}
Enviar texto:       POST {EVOLUTION_API_URL}/message/sendText/{instanceName}
                    Body: { number, text }
Enviar imagen:      POST {EVOLUTION_API_URL}/message/sendMedia/{instanceName}
Crear grupo:        POST {EVOLUTION_API_URL}/group/create/{instanceName}
Listar grupos:      GET {EVOLUTION_API_URL}/group/fetchAllGroups/{instanceName}
Desconectar:        DELETE {EVOLUTION_API_URL}/instance/logout/{instanceName}
```

### 8.3 Instagram driver (Bridge Python instagrapi)

```python
# apps/instagram-bridge/main.py — FastAPI app exponiendo:
# POST /sessions/create  body: {tenant_id, username, password, two_factor_code?}
# POST /sessions/{id}/logout
# GET  /sessions/{id}/status
# GET  /sessions/{id}/inbox?since=...
# POST /sessions/{id}/messages/send  body: {thread_id, text}
```

Node llama al bridge via HTTP. Polling cada `IG_POLL_INTERVAL_SECONDS` (20s) en BullMQ.

### 8.4 Facebook driver (fca-unofficial)

In-process Node.js. Recibe `appState` (cookies JSON), inicializa `api.listenMqtt()`. Eventos enviados al ChannelRouter via callback.

### 8.5 TikTok driver

Scraper de comentarios públicos. Polling cada 60s sobre los últimos 5 videos. Recibe `cookies` para autenticación opcional.

---

## 9. DESIGN SYSTEM "OBSIDIAN GLASS"

### 9.1 Tokens CSS (apps/web/src/styles/globals.css)

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --font-primary: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Paleta base (modo oscuro por defecto) */
  --bg-root:        #08090E;
  --bg-surface-1:   #0F1117;
  --bg-surface-2:   #161821;
  --bg-surface-3:   #1C1E2A;
  --bg-surface-glass: rgba(22, 24, 33, 0.72);

  --border-subtle:  rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.10);
  --border-strong:  rgba(255,255,255,0.16);
  --border-glow:    rgba(99,102,241,0.40);

  --text-primary:   #F0F0F5;
  --text-secondary: #8B8D9E;
  --text-tertiary:  #5C5E6E;

  /* Acentos */
  --accent-primary:        #6366F1;
  --accent-primary-hover:  #818CF8;
  --accent-primary-glow:   rgba(99,102,241,0.25);
  --accent-primary-subtle: rgba(99,102,241,0.12);

  --accent-success: #10B981;
  --accent-warning: #F59E0B;
  --accent-danger:  #EF4444;
  --accent-info:    #3B82F6;

  /* Canales */
  --channel-whatsapp:  #25D366;
  --channel-instagram: #E1306C;
  --channel-facebook:  #1877F2;
  --channel-tiktok:    #FE2C55;

  /* Gradientes */
  --gradient-primary: linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A855F7 100%);
  --gradient-mesh:    radial-gradient(at 20% 80%, rgba(99,102,241,0.08) 0%, transparent 50%),
                      radial-gradient(at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 50%),
                      radial-gradient(at 50% 50%, rgba(16,185,129,0.04) 0%, transparent 70%);

  /* Sombras */
  --shadow-sm:           0 1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.15);
  --shadow-md:           0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);
  --shadow-lg:           0 10px 25px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.25);
  --shadow-glow-primary: 0 0 20px var(--accent-primary-glow), 0 0 40px rgba(99,102,241,0.10);

  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  20px;
  --radius-2xl: 24px;

  --glass-blur:     blur(20px);
  --glass-saturate: saturate(180%);

  --transition-fast:    150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-default: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring:  500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

[data-theme="light"] {
  --bg-root:      #F5F6FA;
  --bg-surface-1: #FFFFFF;
  --bg-surface-2: #F0F1F5;
  --bg-surface-3: #E8E9F0;
  --bg-surface-glass: rgba(255,255,255,0.78);
  --border-subtle:  rgba(0,0,0,0.05);
  --border-default: rgba(0,0,0,0.08);
  --border-strong:  rgba(0,0,0,0.14);
  --text-primary:   #111827;
  --text-secondary: #6B7280;
  --text-tertiary:  #9CA3AF;
}

body {
  background-color: var(--bg-root);
  background-image: var(--gradient-mesh);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: var(--font-primary);
  -webkit-font-smoothing: antialiased;
}
```

### 9.2 Componentes core

Implementa estos componentes en `apps/web/src/components/ui/`:
- `GlassCard` (variant: depth 1/2/3, glow, hover)
- `Button` (primary gradient, secondary, ghost, danger)
- `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`
- `Modal` con backdrop blur
- `Dropdown`, `Tooltip`, `Tabs`
- `Badge`, `Avatar`, `ChannelBadge` (con color del canal)
- `Table` (zebra, hover row, sortable)
- `Sidebar` (collapsable 72px ↔ 260px)
- `Navbar` (sticky con glassmorphism)
- `KanbanCard`, `KanbanColumn`
- `Toast` (notificaciones)

**Principio:** ningún componente shadcn/ui se usa sin customizar con los tokens. El producto debe verse premium, no template.

---

## 10. DOCKER COMPOSE Y DESPLIEGUE EN VPS

### 10.1 docker-compose.yml (producción)

```yaml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: saas_omnichannel
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [internal]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redisdata:/data
    networks: [internal]

  evolution-api:
    image: atendai/evolution-api:latest
    restart: unless-stopped
    environment:
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_GLOBAL_KEY}
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/saas_omnichannel
      DATABASE_CONNECTION_CLIENT_NAME: evolution
      CACHE_REDIS_ENABLED: 'true'
      CACHE_REDIS_URI: redis://redis:6379/1
      CACHE_REDIS_PREFIX_KEY: evo
      SERVER_URL: http://evolution-api:8080
      WEBHOOK_GLOBAL_URL: ${API_BASE_URL}/api/webhooks/evolution
      WEBHOOK_GLOBAL_ENABLED: 'true'
      WEBHOOK_EVENTS_QRCODE_UPDATED: 'true'
      WEBHOOK_EVENTS_MESSAGES_UPSERT: 'true'
      WEBHOOK_EVENTS_CONNECTION_UPDATE: 'true'
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_started }
    networks: [internal]

  instagram-bridge:
    build:
      context: ./apps/instagram-bridge
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    networks: [internal]

  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_started }
    networks: [internal]

  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    restart: unless-stopped
    env_file: .env
    depends_on: [api]
    networks: [internal]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [api, web]
    networks: [internal]

volumes:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:

networks:
  internal:
    driver: bridge
```

### 10.2 Caddyfile

```
{$DOMAIN} {
    encode gzip zstd

    handle /api/* {
        reverse_proxy api:3001
    }

    handle /superadmin* {
        reverse_proxy web:3000
    }

    handle {
        reverse_proxy web:3000
    }
}
```

Caddy obtiene HTTPS automático con Let's Encrypt si `$DOMAIN` resuelve.

### 10.3 Variables de entorno (.env.example)

```env
# ─── Database ───
DATABASE_URL=postgresql://saas:CHANGEME@postgres:5432/saas_omnichannel
POSTGRES_USER=saas
POSTGRES_PASSWORD=CHANGEME

# ─── Redis ───
REDIS_URL=redis://redis:6379

# ─── Auth ───
JWT_SECRET=CHANGEME_min_32_chars_random
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=CHANGEME_exactly_32_bytes_base64

# ─── Domains ───
DOMAIN=app.tudominio.co
API_BASE_URL=https://app.tudominio.co
WEB_BASE_URL=https://app.tudominio.co

# ─── LLM ───
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini

# ─── Evolution API ───
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_GLOBAL_KEY=CHANGEME_random_string

# ─── Instagram Bridge ───
INSTAGRAM_BRIDGE_URL=http://instagram-bridge:8000
IG_POLL_INTERVAL_SECONDS=20

# ─── Facebook / TikTok ───
FB_RATE_LIMIT_PER_MINUTE=15
TT_POLL_INTERVAL_SECONDS=60

# ─── Wompi ───
WOMPI_SANDBOX_PUBLIC_KEY=pub_test_...
WOMPI_SANDBOX_PRIVATE_KEY=prv_test_...
WOMPI_EVENT_SECRET=...

# ─── Ports ───
API_PORT=3001
WEB_PORT=3000

# ─── Logs ───
LOG_LEVEL=info
NODE_ENV=production
```

### 10.4 DEPLOY.md (guía VPS)

Crear archivo `DEPLOY.md` que documente paso a paso:
1. `apt update && apt install docker.io docker-compose-plugin -y`
2. `git clone ...`
3. `cp .env.example .env && nano .env` (rellenar valores reales)
4. `docker compose --profile prod up -d --build`
5. `docker compose exec api pnpm db:migrate`
6. `docker compose exec api pnpm db:seed` (opcional)
7. Configurar DNS A → IP del VPS
8. Caddy levanta HTTPS automáticamente
9. Crear primer superadmin con script: `docker compose exec api pnpm create:superadmin`

---

## 11. FASES DE IMPLEMENTACIÓN CON CHECKPOINTS

> **REGLA DE ORO #1 RECORDATORIO:** No avanzas a la siguiente fase hasta que TODOS los comandos del checkpoint devuelvan el resultado esperado.

---

### 🏗️ FASE 0 — Bootstrap del monorepo (1 día)

**Objetivo:** Tener el esqueleto funcional con Turborepo, pnpm, Docker base.

**Tareas:**
1. Inicializar monorepo: `pnpm init`, `pnpm-workspace.yaml`, `turbo.json`.
2. Crear estructura de carpetas exactamente como Sección 4.
3. `packages/shared`: `package.json`, `tsconfig.json`, archivo placeholder `index.ts` que exporta una constante.
4. `packages/db`: igual.
5. `apps/api`: Fastify mínimo que expone `GET /health → { ok: true }`.
6. `apps/web`: Next.js 14 con una página `/` que diga "OK".
7. `docker-compose.dev.yml`: solo Postgres + Redis.
8. `.env.example` completo.
9. `.gitignore`, `README.md` mínimo.
10. Configurar TypeScript strict en todos los workspaces.

**✅ CHECKPOINT FASE 0:**
```bash
# 1. Compila sin errores
pnpm -r build
# Esperado: exit 0

# 2. Type check
pnpm -r typecheck
# Esperado: exit 0, cero errores

# 3. Levantar servicios base
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
# Esperado: postgres + redis "Up" y healthy

# 4. API responde
pnpm --filter @app/api dev &
sleep 5
curl http://localhost:3001/health
# Esperado: {"ok":true}
kill %1

# 5. Web responde
pnpm --filter @app/web dev &
sleep 8
curl -I http://localhost:3000
# Esperado: HTTP/1.1 200 OK
kill %1
```

Si CUALQUIER comando falla, NO avanzas.

---

### 🗄️ FASE 1 — Modelo de datos + RLS + Seed (2 días)

**Objetivo:** Toda la DB creada, migrada, con RLS funcional y datos de prueba.

**Tareas:**
1. `packages/db/src/schema/*.ts`: Drizzle schemas para TODAS las tablas de Sección 5.
2. `packages/db/drizzle.config.ts` y scripts `db:generate`, `db:migrate`, `db:seed`.
3. Generar migrations.
4. Activar RLS en todas las tablas con `tenant_id` + policies.
5. `packages/db/src/seed/demo-seed.ts`: crea
   - 1 superadmin user (`admin@saas.com` / `Admin123!`)
   - 3 saas_plans (Free, Starter $50k, Pro $150k)
   - 7 tenants demo (estética, electrónica, restaurante, taller, abogado, odontólogo, hotel) con users owner + 5-10 productos/servicios cada uno + algunos customers y mensajes.
6. Plugin Fastify `tenant.ts` que setea `app.tenant_id` en cada conexión PG.

**✅ CHECKPOINT FASE 1:**
```bash
# 1. Aplica migrations
docker compose -f docker-compose.dev.yml up -d
pnpm --filter @app/db db:migrate
# Esperado: sin errores

# 2. Ejecuta seed
pnpm --filter @app/db db:seed
# Esperado: "Created 7 tenants, 7 owners, 50+ products, ..."

# 3. Verificar tenants
docker exec -it $(docker ps -qf "name=postgres") psql -U saas saas_omnichannel -c "SELECT name, business_type, capabilities FROM tenants;"
# Esperado: 7 filas con los tenants demo

# 4. Verificar RLS bloquea cross-tenant
docker exec -it $(docker ps -qf "name=postgres") psql -U saas saas_omnichannel -c "
  SET app.tenant_id = '00000000-0000-0000-0000-000000000000';
  SELECT count(*) FROM customers;
"
# Esperado: 0 (RLS bloquea porque el tenant no existe)

# 5. pgvector activo
docker exec -it $(docker ps -qf "name=postgres") psql -U saas saas_omnichannel -c "
  SELECT extname FROM pg_extension WHERE extname='vector';
"
# Esperado: 1 fila con 'vector'
```

---

### 🔐 FASE 2 — Auth + Tenants + Users + Plugins base (2 días)

**Objetivo:** Login funcional con JWT, RBAC, tenant resolver, error handler, Swagger.

**Tareas:**
1. Plugin `auth.ts`: JWT con `jose`, refresh tokens en Redis, middleware verifica role.
2. Plugin `tenant.ts`: extrae `tenant_id` del JWT y setea en PG session.
3. Plugin `error-handler.ts`: respuestas uniformes `{error, message, code}`.
4. Plugin `swagger.ts`: OpenAPI 3.1 en `/api/docs`.
5. Plugin `rate-limit.ts`: por IP + por tenant.
6. Plugin `cors.ts`.
7. Módulo `auth`: rutas `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/register-tenant` (crear tenant nuevo desde landing).
8. Módulo `tenants`: GET (self) y PATCH (settings).
9. Módulo `users`: CRUD con role checks (owner > admin > agent).
10. Frontend: páginas `/login`, `/register`, redirect a `/dashboard`.

**✅ CHECKPOINT FASE 2:**
```bash
# 1. Login con seed user
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@glamournails.co","password":"Owner123!"}' \
  | jq -r '.accessToken')
echo $TOKEN
# Esperado: un JWT (string largo)

# 2. Obtener tenant propio
curl -s http://localhost:3001/api/tenants/me \
  -H "Authorization: Bearer $TOKEN" | jq .name
# Esperado: "Glamour Nails"

# 3. Login con password inválido
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@glamournails.co","password":"wrong"}' | jq .error
# Esperado: "Invalid credentials"

# 4. RBAC: un agent NO puede borrar otro user
AGENT_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"agent1@glamournails.co","password":"Agent123!"}' | jq -r '.accessToken')
curl -s -X DELETE http://localhost:3001/api/users/some-id \
  -H "Authorization: Bearer $AGENT_TOKEN" -o /dev/null -w "%{http_code}"
# Esperado: 403

# 5. Swagger accesible
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/docs
# Esperado: 200

# 6. Frontend login
# Abrir http://localhost:3000/login, ingresar credenciales, debe redirigir a /dashboard
```

---

### 📦 FASE 3 — Módulos CRUD básicos del dashboard (3 días)

**Objetivo:** CRUD funcional de catálogo, customers, conversations (sin canal aún), settings, equipo.

**Tareas:**
1. Módulo `categories`, `products`, `product_variants`: CRUD completo con permisos.
2. Módulo `customers`: CRUD + búsqueda.
3. Módulo `conversations` + `messages`: CRUD (todavía sin canales reales, pero schema y endpoints listos).
4. Módulo `tenants/settings`: GET y PATCH de TODOS los campos de settings (info negocio, horarios, IA agente, pagos Wompi keys, notificaciones, apariencia).
5. Módulo `tenant_config` con `getConfig()` cacheado en Redis.
6. Frontend dashboard:
   - Layout con Sidebar + Navbar (Design System Obsidian Glass)
   - Página `/dashboard` (KPIs placeholder con datos de la DB)
   - `/dashboard/catalog` (CRUD productos con atributos JSONB dinámicos)
   - `/dashboard/customers` (tabla)
   - `/dashboard/team` (CRUD users)
   - `/dashboard/settings/*` (todas las secciones del mockup HTML original: negocio, actividad económica, horarios, pagos, IA, apariencia)

**✅ CHECKPOINT FASE 3:**
```bash
# 1. CRUD producto
PROD_ID=$(curl -s -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Manicure","type":"service","price":50000,"duration_minutes":45}' \
  | jq -r '.id')
[ -n "$PROD_ID" ] && echo "OK $PROD_ID"

# 2. Listar productos
curl -s http://localhost:3001/api/products \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'
# Esperado: número >= 6

# 3. Settings: PATCH info negocio
curl -s -X PATCH http://localhost:3001/api/tenants/me \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+573001234567","address":"Cra 7 # 50-20","description":"Salon premium"}' \
  | jq .phone
# Esperado: "+573001234567"

# 4. getConfig() cacheado
curl -s -X PATCH http://localhost:3001/api/tenants/me/config \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"max_citas_activas_por_cliente","value":3}'
curl -s http://localhost:3001/api/tenants/me/config/max_citas_activas_por_cliente \
  -H "Authorization: Bearer $TOKEN" | jq .value
# Esperado: 3

# 5. Frontend
# /dashboard/catalog debe mostrar productos, permitir crear, editar, borrar
# /dashboard/settings debe tener TODAS las secciones del mockup
```

---

### 🤖 FASE 4 — AI Action Engine (4 días) ★ FASE CRÍTICA ★

**Objetivo:** La IA procesa mensajes, responde texto o JSON, los procesadores ejecutan acciones reales en DB.

**Tareas:**
1. `lib/llm-client.ts`: adaptador OpenAI / Groq / Anthropic / OpenRouter. Lee integración activa del tenant; si no hay, usa OPENAI_API_KEY del env.
2. `ai.context-builder.ts`: composición por capabilities (citas activas, carrito, reservas, cotizaciones).
3. `ai.prompt-builder.ts`: prompt base + secciones condicionales según capabilities + adaptación por canal.
4. `ai.action-parser.ts`: regex JSON + Zod validation + validación capability.
5. `ai.action-router.ts`: rutea acción → procesador correspondiente.
6. Procesadores (todos los listados en 6.4): cada uno valida, ejecuta, envía respuesta vía channelManager (que en esta fase usa un "stub channel" que escribe a la tabla `messages` y notifica vía SSE al frontend).
7. `scheduling/scheduling.engine.ts`: motor de slots disponibles para appointments.
8. `conversation_state` service: historial ventana 10 mensajes.
9. Endpoint dev: `POST /api/dev/simulate-message` que recibe `{tenantId, customerPhone, message}` y ejecuta el flujo completo (útil para testing sin canal).
10. `knowledge-base.service.ts`: CRUD + embedding al guardar + búsqueda semántica con pgvector. Integrar en prompt-builder.
11. `ai_unanswered_queries`: cuando la IA escala o no responde con confianza, registrar.
12. Frontend `/dashboard/ai-config`: editar agente (nombre, tono), CRUD knowledge base, ver preguntas sin respuesta con botón "Resolver".

**✅ CHECKPOINT FASE 4:**
```bash
# 1. Simular mensaje → IA responde
curl -s -X POST http://localhost:3001/api/dev/simulate-message \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"customerPhone":"+573009999999","message":"hola, qué servicios tienen?"}' \
  | jq '.aiResponse'
# Esperado: texto coherente listando los servicios de Glamour Nails

# 2. Simular flujo CREAR_CITA
curl -s -X POST http://localhost:3001/api/dev/simulate-message \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"customerPhone":"+573009999999","message":"quiero agendar manicure el martes a las 3pm"}'
# Esperado: cita creada en DB, mensaje de confirmación

curl -s "http://localhost:3001/api/appointments?phone=+573009999999" \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'
# Esperado: >= 1

# 3. Validación: la IA NO confirma
# Verificar en logs que la respuesta de la IA cuando ejecuta acción es SOLO JSON, no texto

# 4. Slot no disponible → alternativas
# Repetir el agendamiento al mismo slot, debe responder con alternativas, no error

# 5. Knowledge base: agregar entrada y consultar
ENTRY_ID=$(curl -s -X POST http://localhost:3001/api/ai/knowledge \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"question":"Aceptan tarjeta de crédito?","answer":"Sí, aceptamos Visa, Mastercard y Nequi","category":"Pagos"}' \
  | jq -r '.id')
sleep 1
curl -s -X POST http://localhost:3001/api/dev/simulate-message \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"customerPhone":"+573008888888","message":"aceptan tarjetas?"}' \
  | jq .aiResponse
# Esperado: respuesta que incluye Visa/Mastercard/Nequi

# 6. Capability check: tenant solo con 'catalog'+'appointments' NO ejecuta CREAR_PEDIDO
# (Verificar manualmente cambiando capabilities del tenant y simulando mensaje "quiero pedir un producto")
```

---

### 📱 FASE 5 — Canal WhatsApp via Evolution API (3 días)

**Objetivo:** Conectar WhatsApp, recibir y enviar mensajes reales, el AI Engine procesa.

**Tareas:**
1. Agregar Evolution API al docker-compose (ver Sección 10.1).
2. `lib/evolution-api.client.ts`: cliente HTTP tipado.
3. `drivers/whatsapp/whatsapp.driver.ts`: implementa IChannelDriver.
4. `drivers/whatsapp/evolution.webhook.ts`: handler webhook que procesa QRCODE_UPDATED, MESSAGES_UPSERT, CONNECTION_UPDATE.
5. `channels.routes.ts`: `POST /channels/whatsapp/connect`, `DELETE /channels/whatsapp/:id`, `GET /channels/whatsapp/stream` (SSE para QR).
6. Frontend `/dashboard/channels`:
   - 4 tarjetas (WA, IG, FB, TT)
   - Click "Conectar WhatsApp" → modal con QR (qrcode.react)
   - SSE escucha eventos: 'qr' actualiza imagen, 'connected' cierra modal con ✅
   - Estado conectado: muestra número + botón "Desconectar"

**✅ CHECKPOINT FASE 5:**
```bash
# 1. Evolution API responde
curl -s http://localhost:8080/instance/fetchInstances \
  -H "apikey: $EVOLUTION_API_GLOBAL_KEY"
# Esperado: array (puede ser vacío al inicio)

# 2. Conectar WhatsApp
curl -s -X POST http://localhost:3001/api/channels/whatsapp/connect \
  -H "Authorization: Bearer $TOKEN"
# Esperado: { qrCode: "data:image/png;base64,..." }

# 3. UI muestra QR
# Abrir /dashboard/channels, click Conectar WhatsApp, ver QR

# 4. Escanear QR con WhatsApp real
# Después: el modal muestra "✅ Conectado" y el número aparece

# 5. Recibir mensaje real
# Enviar "hola" al número conectado desde otro WhatsApp
# Verificar:
docker compose logs api | grep MESSAGES_UPSERT
# Esperado: log del mensaje recibido
# La IA debe responder al cliente real en su WhatsApp con saludo de Glamour Nails

# 6. Inbox del dashboard muestra la conversación
# /dashboard/inbox debe mostrar la conversación nueva con el mensaje del cliente y la respuesta de la IA
```

---

### 📸 FASE 6 — Inbox omnicanal + Instagram + Facebook + TikTok (4 días)

**Objetivo:** Inbox unificado completo y los 3 canales restantes funcionando.

**Tareas:**
1. `apps/instagram-bridge/`: FastAPI app completa con instagrapi.
2. `drivers/instagram/instagram.driver.ts` + `instagram.bridge-client.ts` + BullMQ poller cada 20s.
3. `drivers/facebook/facebook.driver.ts` + listener MQTT con fca-unofficial.
4. `drivers/tiktok/tiktok.driver.ts` + scraper de comentarios cada 60s.
5. Frontend `/dashboard/inbox`:
   - Lista de conversaciones a la izquierda (filtros: por canal, por estado, asignadas)
   - Thread de mensajes en el centro (burbujas, badges por canal)
   - Panel de info del cliente a la derecha (perfil, historial pedidos/citas)
   - Toggle "IA activa / Tomar control" (cuando un agente toma, se pausa la IA)
   - Real-time vía SSE
6. Endpoints conexión IG/FB/TT con sus respectivos modales (credentials, cookies, etc).

**✅ CHECKPOINT FASE 6:**
```bash
# 1. Bridge Python responde
curl -s http://localhost:8000/health
# Esperado: {"ok":true}

# 2. Conectar Instagram (con credenciales reales de test)
curl -s -X POST http://localhost:3001/api/channels/instagram/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"username":"...","password":"..."}'
# Esperado: { ok: true } o { requires2FA: true }

# 3. Enviar DM a IG conectado desde otra cuenta
# Verificar que en 20s el mensaje aparece en /dashboard/inbox

# 4. Facebook: pegar appState, debe conectar y aparecer mensajes
# 5. TikTok: pegar cookies, comentar en un video del cuenta, debe aparecer en 60s

# 6. Inbox unificado: las 4 conversaciones (una por canal) visibles en la misma lista
# Cada conversación con su badge de canal correspondiente
```

---

### 💰 FASE 7 — Pagos Wompi + Domicilios + Cotizaciones + Reservas (3 días)

**Objetivo:** Flujo completo de pago, domicilio, cotización y reserva.

**Tareas:**
1. `lib/wompi-client.ts`: crear link, consultar transacción.
2. Webhook `/api/webhooks/wompi`: procesar eventos `transaction.updated`.
3. Procesador `enviar-pago.processor.ts`: genera link, envía por el canal.
4. Procesadores `cotizar`, `ver-cotizacion`, `crear-reserva`, `cancelar-reserva`, `ver-reservas`.
5. CRUD domicilios.
6. Frontend `/dashboard/orders`, `/dashboard/appointments`, `/dashboard/reservations`, `/dashboard/quotes`, `/dashboard/deliveries`.

**✅ CHECKPOINT FASE 7:**
```bash
# 1. Simular flujo pedido completo
curl -s -X POST http://localhost:3001/api/dev/simulate-message \
  -d '{"customerPhone":"+573007777777","message":"quiero comprar el producto X"}'
# Sigue conversación hasta "quiero pagar"
# Esperado: mensaje del cliente con link Wompi

# 2. Wompi sandbox: simular pago aprobado
curl -s -X POST http://localhost:3001/api/webhooks/wompi \
  -d '{"event":"transaction.updated","data":{"transaction":{"id":"...","status":"APPROVED"}}}'

# 3. Estado del pedido cambió
curl -s http://localhost:3001/api/orders/{order_id} \
  -H "Authorization: Bearer $TOKEN" | jq .payment_status
# Esperado: "paid"
```

---

### 🎯 FASE 8 — Kanban + Multiagente + Departamentos (3 días)

**Objetivo:** Board Kanban funcional + asignación automática + estados de agente.

**Tareas:**
1. Módulos `kanban_columns`, `departments`, `department_members`.
2. Endpoint para mover conversación entre columnas (drag & drop).
3. Round-robin assigner.
4. Estados agente: available/busy/away/offline.
5. Transferencia entre agentes.
6. Frontend `/dashboard/kanban`: board con DnD (dnd-kit).
7. Frontend `/dashboard/team`: CRUD departamentos + miembros + estado agente.

**✅ CHECKPOINT FASE 8:**
```bash
# 1. CRUD columnas Kanban
# 2. Mover conversación de columna A a B (drag & drop en UI)
# 3. Asignación automática round-robin cuando un nuevo cliente escribe
# 4. Cambiar estado de agente a "busy" → no recibe nuevas asignaciones
```

---

### 📢 FASE 9 — Campañas masivas + Grupos WhatsApp + Integraciones (4 días)

**Objetivo:** Envío masivo de mensajes con variables, programación, rotación de mensajes; gestión de grupos WhatsApp; CRUD de integraciones.

**Tareas:**
1. Módulo `contact-lists`: CRUD + importar CSV (papaparse).
2. Módulo `campaigns`: CRUD + scheduling.
3. BullMQ job `campaign-sender.job.ts` con rate limit 30 msg/min, rotación entre 1-5 mensajes, resolución de variables.
4. Módulo `groups`: listar/crear/agregar participantes vía Evolution API.
5. Módulo `integrations`: CRUD por provider (encryption en config).
6. Frontend `/dashboard/campaigns`, `/dashboard/contacts`, `/dashboard/groups`, `/dashboard/settings/integrations`.

**✅ CHECKPOINT FASE 9:**
```bash
# 1. Importar CSV 50 contactos
# 2. Crear campaña con 3 mensajes y variables {{nombre}}
# 3. Programar para 2 minutos en el futuro
# 4. Esperar y verificar:
curl -s http://localhost:3001/api/campaigns/{id}/logs \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'
# Esperado: 50 (uno por contacto)

# 5. Tasa: no más de 30/min
# 6. Listar grupos WA: GET /api/groups
# 7. Crear integración Groq + cambiar tenant.ai_model → IA responde con Groq
```

---

### 👑 FASE 10 — Panel SuperAdmin SaaS (4 días)

**Objetivo:** Panel separado en `/superadmin/*` con auth propia, gestión tenants, planes, demos, resellers, monitor VPS.

**Tareas:**
1. Auth separada para superadmin (tabla `superadmin_users`, JWT con claim `is_superadmin: true`).
2. Middleware `requireSuperAdmin` en backend.
3. Módulos backend: `superadmin/tenants`, `superadmin/plans`, `superadmin/demos`, `superadmin/resellers`, `superadmin/billing`, `superadmin/monitor`, `superadmin/audit`.
4. Endpoint monitor: usa `os` Node + `docker stats` para CPU/RAM/disco; Redis cache TTL 10s.
5. Job `demo-expiry.job.ts`: revisa demos vencidas cada hora, suspende.
6. Frontend `apps/web/src/app/(superadmin)/*` con layout propio, KPIs, tablas, wizards.
7. Acción "Impersonate tenant" (login como owner de un tenant).
8. Audit log de todas las acciones del superadmin.

**✅ CHECKPOINT FASE 10:**
```bash
# 1. Login superadmin
SA_TOKEN=$(curl -s -X POST http://localhost:3001/api/superadmin/auth/login \
  -d '{"email":"admin@saas.com","password":"Admin123!"}' | jq -r '.accessToken')

# 2. Listar tenants
curl -s http://localhost:3001/api/superadmin/tenants \
  -H "Authorization: Bearer $SA_TOKEN" | jq '. | length'
# Esperado: 7

# 3. KPIs SaaS
curl -s http://localhost:3001/api/superadmin/dashboard \
  -H "Authorization: Bearer $SA_TOKEN" | jq '.mrr, .totalTenants, .activeDemos'

# 4. Monitor VPS
curl -s http://localhost:3001/api/superadmin/monitor/health \
  -H "Authorization: Bearer $SA_TOKEN" | jq '.cpu, .ram, .disk'

# 5. UI: /superadmin debe mostrar todo
# 6. Auditoría: cada acción en saas_audit_logs
```

---

### 🚀 FASE 11 — Producción VPS + Hardening + Tests (3 días)

**Objetivo:** Desplegar en VPS real con HTTPS, tests, monitoreo básico.

**Tareas:**
1. Dockerfile multi-stage para api y web.
2. Caddyfile + HTTPS automático.
3. Tests Vitest + Supertest para módulos críticos (auth, AI engine, procesadores, channels).
4. Tests E2E Playwright para flujos críticos (login, conectar WA, crear cita end-to-end).
5. CI GitHub Actions: lint + typecheck + tests.
6. Script `create:superadmin` para inicializar el primer superadmin.
7. Configurar logs JSON estructurados.
8. Backups Postgres: cron diario que dumpea a `/var/backups`.
9. `DEPLOY.md` completo paso a paso.

**✅ CHECKPOINT FASE 11:**
```bash
# 1. Build local sin errores
docker compose -f docker/docker-compose.yml build
# Esperado: todas las imágenes construyen

# 2. Tests
pnpm test
# Esperado: >= 80% coverage en módulos críticos

# 3. Deploy VPS:
#    a) ssh root@vps
#    b) git clone <repo>
#    c) cp .env.example .env && nano .env
#    d) docker compose up -d
#    e) abrir https://app.tudominio.co → debe cargar con HTTPS válido
#    f) login owner → dashboard funcional
#    g) conectar WhatsApp → recibir mensaje → IA responde

# 4. CI verde en GitHub Actions
```

---

## 12. CRITERIOS FINALES DE ACEPTACIÓN

El proyecto se considera **terminado** cuando TODOS estos criterios pasan:

### Infraestructura
- [ ] `docker compose up` levanta todo desde cero en menos de 3 minutos.
- [ ] Despliegue VPS: `git pull && docker compose up -d --build` funciona.
- [ ] HTTPS automático funciona.
- [ ] Backups diarios automáticos.

### Funcionalidad
- [ ] Tenant nuevo: registro → onboarding → selector actividad económica → capabilities activadas.
- [ ] Owner crea su primer servicio/producto desde el dashboard.
- [ ] Conecta WhatsApp con QR.
- [ ] Cliente real envía mensaje → IA responde con catálogo correcto.
- [ ] Cliente agenda cita → sistema valida slot → confirma.
- [ ] Cliente compra producto → checkout → Wompi → confirmación.
- [ ] Agente toma control de una conversación → IA se pausa.
- [ ] Campaña masiva envía a 100 contactos con rate limit.

### Calidad
- [ ] Cero `any` en TypeScript.
- [ ] Cero `// TODO` o stubs.
- [ ] Tests > 80% coverage en `modules/ai`, `modules/auth`, `modules/channels`.
- [ ] Build production sin warnings.

### SuperAdmin
- [ ] Login independiente.
- [ ] Lista todos los tenants con MRR.
- [ ] Crea cuenta demo con caducidad.
- [ ] Monitor VPS muestra métricas en vivo.

### Diseño
- [ ] Cada página aplica el Design System "Obsidian Glass".
- [ ] Modo claro/oscuro funcional.
- [ ] Responsive en mobile (sidebar colapsa).

---

## 🚦 INSTRUCCIONES FINALES PARA CLAUDE CODE

1. **Lee este documento COMPLETO antes de empezar.** No empieces a codear hasta entender todas las secciones, **incluido el Anexo A sobre tags Git**.
2. **Empieza por la Fase 0 y NO avances** hasta que el checkpoint pase 100%.
3. **Si algo del documento es ambiguo**, pregúntame antes de inventar. NO improvises arquitectura.
4. **Mantén un archivo `PROGRESO.md` en la raíz** que actualices al final de cada fase con: qué se hizo, comandos del checkpoint que pasaron, próximos pasos.
5. **Commits frecuentes** con mensajes descriptivos. Un commit por sub-tarea relevante, no uno gigante por fase.
6. **Si vas a agregar una dependencia**, justifícalo en el commit message.
7. **Si encuentras un error en este documento**, indícalo explícitamente y propon la corrección antes de avanzar.
8. **Al cerrar cada fase**, crea el tag `fase-N-completa` y empújalo (ver Anexo A). NO empieces la siguiente fase sin haberlo hecho.
9. **Antes de iniciar la Fase 4 (AI Engine)**, crea la rama `fase-4-ai-engine` y trabaja TODA esa fase en la rama (no en `main`). Solo fusionas a `main` cuando el checkpoint pase 100%. (Ver Anexo A, sección "Estrategia especial Fase 4").

**El éxito se mide por una sola cosa: que `docker compose up` en un VPS limpio levante un sistema 100% funcional siguiendo `DEPLOY.md`.**

Si en algún momento ese criterio deja de cumplirse, detente, vuelve al último tag verde, y arregla antes de seguir.

---

## 📌 ANEXO A — ESTRATEGIA DE TAGS Y RAMAS DE GIT (RED DE SEGURIDAD OBLIGATORIA)

> Este anexo es de cumplimiento obligatorio, no es opcional. Las fases son densas, especialmente la Fase 4. Sin esta red de seguridad, un error en una fase tardía puede destruir días de trabajo correcto.

### A.1 Por qué existe esta estrategia

El proyecto se construye en 12 fases. Cada fase modifica decenas de archivos. Sin puntos de retorno, este escenario es inevitable:

```
Lunes:    Terminas Fase 3 (dashboard CRUD). Todo funciona. ✅
Martes:   Empiezas Fase 4 (AI Engine). Modificas 30+ archivos.
Miércoles: A media Fase 4, algo se rompe. El dashboard que funcionaba ahora no compila.
Jueves:   Llevas 2 días buscando qué cambió. No sabes a qué estado volver.
Viernes:  Empiezas de cero. Has perdido una semana.
```

**Esta estrategia evita ese escenario.** La idea: cada vez que cierras una fase con checkpoint verde, congelas ese estado con un tag de Git. Si algo se rompe después, puedes volver exactamente a ese punto.

### A.2 Conceptos básicos de Git (rápido recordatorio)

- **Commit**: una "foto" de los archivos en un momento. Crece cada vez que ejecutas `git commit`.
- **Tag**: una etiqueta permanente sobre un commit específico. Como ponerle un nombre fácil de recordar a una foto. Los tags NO se mueven, son inmutables.
- **Rama (branch)**: una línea de trabajo paralela. Permite experimentar sin afectar `main`.
- **Reset**: regresar `main` a un estado anterior (puede destruir trabajo, usar con cuidado).
- **Checkout**: cambiar a otra rama o ver el código en un punto del tiempo (no destructivo).

### A.3 Convención de nombres

```
Tags:
  fase-0-completa   → Bootstrap del monorepo
  fase-1-completa   → Modelo de datos + RLS + seed
  fase-2-completa   → Auth + tenants + users
  fase-3-completa   → CRUD básicos del dashboard
  fase-4-completa   → AI Action Engine ★
  fase-5-completa   → WhatsApp via Evolution API
  fase-6-completa   → Inbox omnicanal + IG + FB + TT
  fase-7-completa   → Pagos Wompi + cotizaciones + reservas
  fase-8-completa   → Kanban + multiagente + departamentos
  fase-9-completa   → Campañas + grupos + integraciones
  fase-10-completa  → Panel SuperAdmin SaaS
  fase-11-completa  → Producción VPS + hardening + tests

Ramas (solo cuando aplica):
  main                       → línea principal estable
  fase-4-ai-engine          → trabajo de Fase 4 antes de fusionar
  fix/<descripcion-corta>    → para correcciones aisladas
  experimento/<descripcion>  → para experimentos descartables
```

### A.4 Protocolo OBLIGATORIO al cerrar una fase

Cada vez que termines una fase y el checkpoint pase 100%, ejecuta EXACTAMENTE esta secuencia:

```bash
# Paso 1: asegurarse que no hay cambios sin commitear
git status
# Esperado: "nothing to commit, working tree clean"
# Si hay cambios, commitearlos primero:
#   git add .
#   git commit -m "feat: complete Phase N - <descripción corta>"

# Paso 2: subir a remoto
git push origin main

# Paso 3: crear el tag
git tag fase-N-completa
# Ejemplo: git tag fase-3-completa

# Paso 4: empujar el tag a remoto
git push origin fase-N-completa

# Paso 5: verificar
git tag --list
# Esperado: ver el tag recién creado en la lista
```

**Después de esto, actualizar `PROGRESO.md`** con una línea como:

```markdown
## Fase 3 — CRUD básicos del dashboard
- Completada: 2026-05-20
- Tag: fase-3-completa
- Checkpoint: todos los comandos pasaron (ver log abajo)
- Commit hash: a1b2c3d
```

### A.5 Estrategia especial para Fase 4 (AI Action Engine)

La Fase 4 es la más peligrosa del proyecto porque:
- Crea 15+ procesadores (uno por acción) que comparten interfaces.
- Modifica varias veces el mismo archivo central (`ai.engine.ts`).
- Requiere coherencia entre prompt builder, parser, router y procesadores.
- Un cambio menor puede romper todo el flujo IA.

**Por eso, Fase 4 se trabaja en una RAMA separada, no directamente en `main`.**

#### Flujo obligatorio Fase 4

```bash
# ─── ANTES de empezar Fase 4 ───
# Estás en main, con Fase 3 cerrada y tag fase-3-completa empujado

# Paso 1: crear rama dedicada
git checkout -b fase-4-ai-engine

# Paso 2: confirmar que estás en la rama nueva
git branch --show-current
# Esperado: fase-4-ai-engine

# ─── DURANTE Fase 4 ───
# Trabajas normalmente. Cada sub-tarea es un commit. Pushes periódicos:
git add .
git commit -m "feat(ai): implement context builder for capabilities"
git push origin fase-4-ai-engine

git add .
git commit -m "feat(ai): implement crear-cita processor with slot validation"
git push origin fase-4-ai-engine
# (y así sucesivamente)

# ─── AL CERRAR Fase 4 (checkpoint 100% verde) ───
# Paso 3: volver a main
git checkout main

# Paso 4: fusionar la rama
git merge fase-4-ai-engine

# Paso 5: empujar main actualizado
git push origin main

# Paso 6: tag de fase completa
git tag fase-4-completa
git push origin fase-4-completa

# Paso 7: borrar la rama (ya no se necesita, todo está en main)
git branch -d fase-4-ai-engine
git push origin --delete fase-4-ai-engine
```

**Beneficio:** durante toda la Fase 4, `main` sigue siendo el estado funcional de Fase 3. Si la rama `fase-4-ai-engine` explota, `main` está intacto y puedes empezar la Fase 4 de nuevo sin haber roto nada.

### A.6 Qué hacer cuando algo se rompe

Hay tres escenarios típicos. Identifica cuál es el tuyo y aplica la receta correspondiente.

#### Escenario 1 — "Quiero investigar cómo estaba el código antes de romperse, sin perder mi trabajo actual"

```bash
# Guarda primero cualquier cambio sin commitear (por si acaso)
git stash

# Ve al estado de la fase anterior solo para mirar
git checkout fase-3-completa

# Ahora todos los archivos en tu carpeta son EXACTAMENTE como cuando Fase 3 cerró
# Puedes abrir VS Code, ver archivos, comparar, copiar piezas
# Pero NO commitees aquí — estás en "modo detached HEAD"

# Cuando termines de investigar, vuelves a tu trabajo:
git checkout main
git stash pop   # recupera los cambios que habías guardado
```

#### Escenario 2 — "Esta fase se rompió sin remedio, quiero volver al último estado funcional"

⚠️ **Esta operación destruye trabajo. Asegúrate antes de hacerla.**

```bash
# Caso A: estás trabajando en una rama de fase (ej. fase-4-ai-engine)
# La rama main NO se ha tocado, así que es fácil:
git checkout main
git branch -D fase-4-ai-engine   # borra la rama rota
git push origin --delete fase-4-ai-engine
# Ahora estás en main intacto. Empiezas Fase 4 de nuevo:
git checkout -b fase-4-ai-engine

# Caso B: estás en main y main está roto (no seguiste la regla de ramas)
# Hay que forzar el reseteo:
git reset --hard fase-3-completa
git push --force origin main
# Tu main ahora está EXACTAMENTE como cuando Fase 3 cerró.
# Todo el trabajo posterior se borró. Empiezas de nuevo.
```

#### Escenario 3 — "Quiero probar algo arriesgado sin tocar mi trabajo bueno"

```bash
# Crea una rama experimental desde donde estés
git checkout -b experimento/probar-otro-llm

# Haces lo que quieras: prueba librerías, cambios grandes, etc.
git add .
git commit -m "experiment: try Groq instead of OpenAI"

# Si funciona y quieres conservarlo, fusionas a la rama de trabajo:
git checkout fase-4-ai-engine
git merge experimento/probar-otro-llm

# Si NO funciona, simplemente abandonas la rama:
git checkout fase-4-ai-engine
git branch -D experimento/probar-otro-llm
# El experimento desaparece. Tu trabajo principal está intacto.
```

### A.7 Tabla de referencia rápida

| Situación | Comando |
|---|---|
| Cerré una fase exitosamente | `git tag fase-N-completa && git push origin fase-N-completa` |
| Voy a empezar Fase 4 | `git checkout -b fase-4-ai-engine` |
| Quiero ver código de fase anterior | `git checkout fase-N-completa` (no destructivo) |
| Vuelvo a mi trabajo después de investigar | `git checkout main` |
| La rama de fase se rompió, descarto todo | `git checkout main && git branch -D fase-N-...` |
| Main se rompió, vuelvo al último tag verde | `git reset --hard fase-N-completa && git push --force origin main` |
| Quiero experimentar sin riesgo | `git checkout -b experimento/<nombre>` |
| Listar todos mis tags | `git tag --list` |
| Ver qué hay en cada tag | `git show fase-N-completa --stat` |

### A.8 Reglas duras

1. **Cero excepciones al tag al cerrar fase.** Si terminas una fase y NO creaste el tag, no has terminado la fase.
2. **Fase 4 SIEMPRE en rama dedicada.** No negociable.
3. **`git push --force` solo sobre `main` cuando estás restaurando desde un tag.** Nunca uses force push para "limpiar historia" o motivos cosméticos.
4. **Los tags `fase-N-completa` nunca se borran, nunca se mueven.** Son puntos históricos inmutables. Si necesitas marcar un nuevo estado funcional, usa `fase-N-completa-v2`.
5. **Antes de cualquier operación destructiva (`reset --hard`, `branch -D`, `push --force`), confirma con el usuario.** Si Claude Code va a ejecutar uno de esos comandos, debe pedir confirmación explícita primero.

### A.9 Verificación periódica

Cada vez que cierres una fase, ejecuta este comando para confirmar el estado:

```bash
git log --oneline --decorate --all -20
```

Deberías ver algo así (ejemplo después de Fase 3):

```
* a1b2c3d (HEAD -> main, tag: fase-3-completa, origin/main) feat: complete Phase 3
* 9f8e7d6 feat: implement settings page with all sections
* 5d4c3b2 feat: catalog CRUD with dynamic JSONB attributes
* 8a7b6c5 (tag: fase-2-completa) feat: complete Phase 2 - auth and RBAC
* 4e3d2c1 (tag: fase-1-completa) feat: complete Phase 1 - DB schema
* 7g6f5e4 (tag: fase-0-completa) feat: complete Phase 0 - bootstrap
```

Cada `(tag: fase-N-completa)` es un punto al que puedes volver con seguridad. **Si no ves los tags ahí, algo se hizo mal y hay que arreglarlo antes de continuar.**

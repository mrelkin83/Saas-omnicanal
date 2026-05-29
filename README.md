# Plataforma SaaS Omnicanal

SaaS multi-tenant para negocios colombianos: inbox unificado con WhatsApp, Instagram, Facebook y TikTok, agente de IA en español colombiano, pagos Wompi, y panel SuperAdmin independiente.

---

## Funcionalidades principales

| Módulo | Descripción |
|--------|-------------|
| **Inbox omnicanal** | Conversaciones unificadas de WhatsApp, Instagram, Facebook y TikTok en un solo panel de 3 columnas con SSE en tiempo real |
| **Agente de IA** | Motor MCP (Model Context Protocol) con 8 servidores especializados: catálogo, citas, pedidos, pagos, cotizaciones, reservas, conocimiento y cliente |
| **MCP AI Engine** | Arquitectura modular donde cada capability tiene su propio servidor MCP interno con Zod validation |
| **Gestión de clientes** | CRM con perfil, historial de conversaciones, etiquetas, canal de origen y normalización de teléfonos colombianos |
| **Catálogo** | Categorías, productos con variantes, imágenes y stock; filtros por categoría y búsqueda limitada |
| **Citas y reservas** | Agenda con validación de slots, solapamientos, cancelaciones via IA y recordatorios automáticos |
| **Cotizaciones** | Generación de cotizaciones desde la conversación, con seguimiento de estado |
| **Pedidos y carrito** | Carrito de compras, pedidos con validación de stock, estados gestionados por IA |
| **Domicilios** | Rastreo de estado de entrega por conversación |
| **Pagos Wompi** | Links de pago, webhook con verificación HMAC SHA-256, actualización automática de órdenes por `reference` |
| **Kanban** | Tablero Drag & Drop (@dnd-kit) para gestión visual de conversaciones |
| **Multiagente** | Round-robin, departamentos, transferencias, estado de disponibilidad |
| **Campañas masivas** | BullMQ + rate limit 30 msg/min, checkpoints cada 10 mensajes, variables `{{nombre}}` |
| **Listas de contactos** | CRUD + importación CSV (papaparse, upsert automático) |
| **Grupos WhatsApp** | Listar y crear grupos via Evolution API |
| **Integraciones** | CRUD con cifrado AES-256-CBC para campos sensibles (OpenAI, Groq, Wompi, Stripe) |
| **Panel SuperAdmin** | Auth independiente, gestión de tenants, planes, demos con expiración, resellers, monitor VPS, auditoría |
| **Onboarding** | Selector de tipo de negocio y capacidades activas por tenant |

---

## Stack tecnológico

| Componente | Versión |
|-----------|---------|
| Node.js | 26.2.0 |
| TypeScript | 5.x (strict, exactOptionalPropertyTypes) |
| Fastify | 4.x |
| Next.js | 14 (App Router) |
| PostgreSQL | 16 + pgvector |
| Redis | 7 |
| Drizzle ORM | 0.38.x |
| BullMQ | 5.x |
| Turborepo | 2.x |
| pnpm | 10.26.1 |
| Python | 3.11 (instagram-bridge) |
| Docker | 29.5.2 |

**Autenticación:** JWT (`jose`) + refresh tokens en Redis + RBAC (`owner > admin > agent`) + Zod validation de payload  
**Seguridad:** @fastify/helmet (CSP), CORS restringido en producción, rate limiting por tenant/IP, Zod error sanitization  
**UI:** Tailwind CSS 3.4 + Design System "Obsidian Glass" (modo oscuro/claro) + Lucide React icons  
**Pagos:** Wompi sandbox/producción (Colombia)  
**WhatsApp:** Evolution API v2.2.3 (Baileys)  
**Instagram:** instagrapi via FastAPI bridge en Python  
**Facebook:** fca-unofficial (MQTT listener)  
**TikTok:** Scraper con polling cada 60s  
**IA:** OpenAI SDK — soporte OpenAI y Groq via `baseURL`, timeout 15s  

---

## Estado del proyecto

✅ **Auditoría forense completa realizada** — 171 issues identificados y corregidos:

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| CRITICAL | 13 | ✅ Todos corregidos |
| HIGH | 55 | ✅ Todos corregidos |
| MEDIUM | 57 | ✅ Todos corregidos |
| LOW | 29 | ✅ Todos corregidos |

**Correcciones principales:**
- Race conditions atómicas (Redis multi/exec, `onConflictDoUpdate`, `onConflictDoNothing`)
- Seguridad: JWT payload validado con Zod, Helmet + CSP, CORS restringido en producción
- Wompi: firma HMAC verificada, lookup por `reference`, 404 para pagos inexistentes
- Auth: eliminado token logging, error 23505 en vez de string matching, query acotada en reset-password
- MCP: productos gratis aceptados, stock validado, fechas futuras obligatorias, JSON extractor robusto
- Frontend: SSE sin leaks, modal con focus trap, toast errors en todos los catches
- DB: índices faltantes añadidos en products, orders, appointments, campaigns

---

## Estructura del monorepo

```
saas-omnichannel/
├── packages/
│   ├── shared/            # Tipos, schemas Zod y utilidades compartidas
│   └── db/                # Drizzle schema (20+ tablas), migraciones, seed
│
├── apps/
│   ├── api/               # Backend Fastify 4 (puerto 3001)
│   │   └── src/
│   │       ├── modules/   # auth, users, products, customers, conversations,
│   │       │              #   kanban, departments, campaigns, integrations,
│   │       │              #   payments, ai, superadmin
│   │       ├── mcp/       # 8 MCP servers: catalog, appointments, orders,
│   │       │              #   payments, quotes, reservations, knowledge, customer
│   │       ├── plugins/   # auth, cors, helmet, rate-limit, swagger, tenant
│   │       ├── middleware/ # requireAuth, requireSuperAdmin
│   │       ├── jobs/      # campaign-sender, reminder, demo-expiry,
│   │       │              #   instagram-poller, tiktok-scraper, billing-enforcement
│   │       ├── channels/  # channel-manager, whatsapp, instagram, facebook, tiktok drivers
│   │       └── lib/       # llm-client (timeout 15s), evolution-api.client (timeout 10s),
│   │                      #   wompi-client, crypto, redis
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
│   └── install.sh         # Autoinstalador VPS Ubuntu 22.04
│   └── backup-postgres.sh # Backup diario con gzip + pruning
│
├── .github/workflows/
│   └── ci.yml             # Typecheck + tests + docker build
│
├── docker-compose.dev.yml # Infraestructura de desarrollo
├── .env.example           # Variables de entorno (plantilla)
├── DEPLOY.md              # Guía completa de despliegue en VPS
├── README.md              # Este archivo
└── PROGRESO.md            # Registro de avance por fase
```

---

## Inicio rápido (desarrollo local)

### Requisitos

- Node.js 26+
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
# {"ok":true,"timestamp":"...","version":"0.0.1","checks":{"db":{"ok":true},"redis":{"ok":true}}}
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
REDIS_PASSWORD=CHANGEME_redis_password
REDIS_URL=redis://:CHANGEME_redis_password@localhost:6380/0

# ─── Auth ───
JWT_SECRET=cadena_aleatoria_minimo_32_caracteres
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=clave_de_exactamente_32_bytes_base64==

# ─── Dominio (producción) ───
DOMAIN=app.tudominio.co
API_BASE_URL=https://app.tudominio.co
WEB_BASE_URL=https://app.tudominio.co

# ─── CORS (producción) ───
# Coma-separado, sin espacios. Ej: https://app.tudominio.co,https://admin.tudominio.co
CORS_ALLOWED_ORIGINS=https://app.tudominio.co

# ─── IA ───
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini

# ─── WhatsApp (Evolution API) ───
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_GLOBAL_KEY=clave_aleatoria

# ─── Instagram Bridge ───
INSTAGRAM_BRIDGE_URL=http://instagram-bridge:8000
IG_POLL_INTERVAL_SECONDS=20

# ─── Facebook / TikTok ───
FB_RATE_LIMIT_PER_MINUTE=15
TT_POLL_INTERVAL_SECONDS=60

# ─── API ───
API_PORT=3001
API_HOST=0.0.0.0
WEB_PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

> Para generar `ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`  
> Para generar `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`  
> Para generar `EVOLUTION_API_GLOBAL_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Comandos útiles

```bash
# Compilar todos los paquetes
pnpm build

# Typecheck
pnpm --filter @app/api typecheck
pnpm --filter @app/web typecheck

# Tests unitarios (13 tests, sin BD)
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

### Opción A — Autoinstalador (recomendado)

Un solo comando instala y configura todo desde cero en una **VPS Ubuntu 22.04 limpia**.

```bash
ssh root@<IP_DEL_VPS>
curl -fsSL https://raw.githubusercontent.com/mrelkin83/Saas-omnicanal/main/scripts/install.sh | bash
```

**El script realiza automáticamente:**

| Paso | Acción |
|------|--------|
| 1 | Solicita: dominio, email/contraseña del superadmin, OpenAI API Key |
| 2 | Instala Docker + Docker Compose plugin |
| 3 | Configura firewall `ufw` (SSH + 80 + 443) |
| 4 | Clona el repositorio en `/opt/saas` |
| 5 | Genera `.env` con claves seguras automáticas (JWT, ENCRYPTION_KEY, PostgreSQL password, Redis password) |
| 6 | Construye e inicia todos los servicios Docker |
| 7 | Espera que PostgreSQL y la API estén listos (health checks) |
| 8 | Ejecuta las migraciones de base de datos |
| 9 | Crea la cuenta SuperAdmin |
| 10 | Programa backup automático diario en crontab (2:00 AM) |
| 11 | Muestra resumen con URLs, credenciales y comandos útiles |

**Requisitos previos:**
- VPS Ubuntu 22.04 LTS con acceso root
- DNS apuntando al servidor (`A app.tudominio.co → IP_DEL_VPS`)
- Puertos 80 y 443 accesibles desde internet

**Después de la instalación**, cada tenant configura sus propias credenciales desde el dashboard:
- **WhatsApp:** `Dashboard → Canales → Conectar WhatsApp` (escanear QR)
- **Pagos Wompi:** `Dashboard → Integraciones → Wompi` (publicKey, privateKey, eventSecret)
- **IA (OpenAI/Groq):** `Dashboard → Integraciones → OpenAI o Groq`

> Las credenciales Wompi son **por tenant** — cada negocio usa su propia cuenta Wompi.  
> La URL del webhook para configurar en Wompi se muestra automáticamente en la página de integraciones.

**Comandos útiles post-instalación:**

```bash
# Ver estado de todos los servicios
docker compose -f /opt/saas/docker/docker-compose.yml --env-file /opt/saas/.env ps

# Ver logs en tiempo real
docker compose -f /opt/saas/docker/docker-compose.yml --env-file /opt/saas/.env logs -f

# Actualizar a la última versión
cd /opt/saas && git pull && docker compose -f docker/docker-compose.yml --env-file .env up -d --build api web

# Verificar API
curl https://app.tudominio.co/api/health
```

### Opción B — Manual paso a paso

Ver [`DEPLOY.md`](DEPLOY.md) para la guía completa con cada comando explicado.

---

## Documentación técnica

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Referencia técnica completa: multi-tenancy, motor de canales, motor de IA, base de datos, jobs, SSE, pagos, módulos API, variables de entorno.
- [`DEPLOY.md`](DEPLOY.md) — Guía de despliegue en VPS paso a paso.
- [`PROGRESO.md`](PROGRESO.md) — Registro de avance por fase y auditoría de bugs.

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

## Arquitectura del Agente de IA (MCP)

El motor de IA usa 8 servidores MCP (Model Context Protocol) internos, cada uno especializado en una capability:

```
Mensaje entrante
       ↓
 Historial (últimos 10 msgs, append atómico)
       ↓
 Contexto dinámico (tenant, cliente, capabilities, canal)
       ↓
 Knowledge Base (pgvector cosine distance < 0.6)
       ↓
 LLM (OpenAI / Groq, timeout 15s)
       ↓
 Parser MCP → { tool: "createAppointment", params: {...} }
       ↓
 MCP Server específico valida + ejecuta en DB
       ↓
 Respuesta natural al cliente
```

**Servidores MCP disponibles:**

| Servidor | Tools | Capability |
|----------|-------|------------|
| `catalog` | listProducts, getProduct | `catalog` |
| `appointments` | createAppointment, listAppointments, cancelAppointment | `appointments` |
| `orders` | addToCart, viewCart, createOrder | `cart_orders` |
| `payments` | createPaymentLink | `payments` |
| `quotes` | createQuote, getMyQuotes | `quotes` |
| `reservations` | createReservation, listReservations | `reservations` |
| `knowledge` | searchKnowledge, getBusinessHours | (siempre disponible) |
| `customer` | getCustomerInfo, updateCustomer | (siempre disponible) |

---

## Jobs en background

| Job | Frecuencia | Función |
|-----|-----------|---------|
| `campaign-sender` | On-demand (BullMQ) | Envío masivo con rate limit 30 msg/min, checkpoints cada 10 msgs |
| `reminder` | Cada hora | Recordatorios WhatsApp 24h antes de citas confirmadas |
| `demo-expiry` | Cada hora | Suspende tenants demo cuya fecha de expiración ya pasó |
| `billing-enforcement` | Cada hora | Suspende tenants con suscripción vencida (grace period 3 días) |
| `instagram-poller` | Cada 20s | Poll de DMs de Instagram via bridge Python |
| `tiktok-scraper` | Cada 60s | Scraping de comentarios/DMs de TikTok |
| `channel-send` (BullMQ) | On-demand | Cola de mensajes diferidos cuando WhatsApp supera 30 msg/min |

---

## Tests

```bash
# Ejecutar los tests unitarios
pnpm --filter @app/api test

# Con cobertura
pnpm --filter @app/api test:coverage
```

**Cobertura actual:** `auth.service`, `ai.action-parser`, `lib/crypto` — sin dependencia de base de datos (mocks via `vi.mock`).

CI corre automáticamente en cada push a GitHub: typecheck + tests + docker build.

---

## Changelog reciente

### 2026-05-29 — Auditoría forense y hardening completo
- 171 bugs corregidos (13 CRITICAL + 55 HIGH + 57 MEDIUM + 29 LOW)
- MCP AI Engine con 8 servidores especializados
- Rate limiting atómico, race conditions eliminadas
- Seguridad: Helmet, CORS restringido, JWT Zod validation
- Frontend: SSE sin leaks, modal a11y, toast errors universal
- DB: índices estratégicos añadidos

---

## Licencia

Uso privado — todos los derechos reservados.

# Arquitectura Técnica — SaaS Omnicanal

> Referencia interna para desarrolladores. Cubre el modelo de multi-tenancy, los flujos de datos, el motor de canales, el motor de IA y todos los subsistemas.

---

## Índice

1. [Vista general](#1-vista-general)
2. [Multi-tenancy](#2-multi-tenancy)
3. [Autenticación y autorización](#3-autenticación-y-autorización)
4. [Motor de canales](#4-motor-de-canales)
5. [Motor de IA](#5-motor-de-ia)
6. [Base de datos](#6-base-de-datos)
7. [Jobs en background (BullMQ)](#7-jobs-en-background-bullmq)
8. [SSE — tiempo real en el inbox](#8-sse--tiempo-real-en-el-inbox)
9. [Pagos (Wompi)](#9-pagos-wompi)
10. [Módulos API](#10-módulos-api)
11. [Frontend](#11-frontend)
12. [Variables de entorno — referencia completa](#12-variables-de-entorno--referencia-completa)

---

## 1. Vista general

```
Cliente WhatsApp / IG / FB / TikTok
           │
           ▼
   [ Evolution API / Instagram Bridge / FB MQTT / TikTok Scraper ]
           │  webhook / poll
           ▼
   [ Fastify API — incoming-handler.ts ]
           │
    ┌──────┴───────┐
    │              │
    ▼              ▼
  Guardar      RunAIEngine
  mensaje        │
  inbound        │ LLM → parser → router → procesador
                 │
                 ▼
            channelSend ──→ Redis rate-limit ──→ [BullMQ queue si supera 30/min]
                 │
                 ▼
        Guardar mensaje outbound
                 │
                 ▼
           SSE → Inbox dashboard
```

**Filosofía central:** la IA vende, agenda, cobra y atiende. El humano solo configura y supervisa.

---

## 2. Multi-tenancy

Cada tenant (negocio) tiene su propia fila en la tabla `tenants`. Toda tabla de datos del negocio tiene una columna `tenant_id uuid NOT NULL REFERENCES tenants(id)`.

### Aislamiento

- **A nivel de aplicación:** el middleware `requireAuth` extrae `tenantId` del JWT y lo adjunta a `request.user`. Todos los queries de servicio reciben `tenantId` como primer argumento.
- **A nivel de base de datos:** Row Level Security (RLS) de PostgreSQL. El `migrate.ts` habilita RLS en todas las tablas de datos y crea políticas `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. La conexión de pool siempre ejecuta `SET LOCAL app.tenant_id = '...'` antes de cada transacción.

### `capabilities[]`

El array `tenants.capabilities` controla qué acciones de IA están habilitadas para cada tenant. Se usa en `buildSystemPrompt` para construir el prompt dinámico y en los procesadores para validar que la acción es permitida.

Valores definidos:

| Capability | Activa |
|-----------|--------|
| `catalog` | VER_CATALOGO, INFO_NEGOCIO |
| `appointments` | CREAR_CITA, VER_SLOTS |
| `cart_orders` | AGREGAR_CARRITO, VER_CARRITO, CREAR_PEDIDO |
| `payments` | ENVIAR_PAGO |
| `quotes` | COTIZAR |
| `reservations` | CREAR_RESERVA |
| `delivery` | CONFIRMAR_ENTREGA |

El onboarding wizard configura estas capabilities al crear el tenant.

---

## 3. Autenticación y autorización

### Tenant auth

```
POST /api/auth/login
  → bcrypt.compare(password, hash)
  → JWT access token (15min, payload: { sub: userId, tenantId, role })
  → JWT refresh token (7d, almacenado en Redis con TTL)

POST /api/auth/refresh
  → Verifica refresh token en Redis
  → Emite nuevo par de tokens
  → Invalida el refresh token anterior (rotación)
```

El plugin `auth.ts` registra un decorador `fastify.authenticate` que verifica el JWT con `jose`. El middleware `requireAuth(roles?)` compone autenticación + RBAC:

```typescript
// roles opcionales: 'owner' | 'admin' | 'agent'
fastify.get('/ruta', { preHandler: [requireAuth(['owner', 'admin'])] }, handler)
```

### SuperAdmin auth

Path independiente: `POST /api/superadmin/auth/login`. Los JWT superadmin tienen `{ sub: saId, role: 'superadmin' }` sin `tenantId`. El middleware `requireSuperAdmin` los valida por separado.

### Cifrado de credenciales de integraciones

Las claves API de terceros (OpenAI, Wompi, Stripe) se almacenan cifradas con AES-256-CBC. `lib/crypto.ts` expone `encrypt(text)` / `decrypt(text)` usando `ENCRYPTION_KEY`. El campo en DB es `config jsonb` — se cifra el objeto completo serializado antes de guardar y se descifra al leer.

---

## 4. Motor de canales

### Driver pattern

```
apps/api/src/modules/channels/
├── core/
│   ├── channel-driver.interface.ts   # IChannelDriver, tipos
│   ├── channel-manager.ts            # registro, sendMessage, rate limiting
│   ├── incoming-handler.ts           # pipeline completo de mensaje entrante
│   ├── inbox.sse.ts                  # push de eventos SSE al dashboard
│   └── round-robin.ts               # asignación de agente
└── drivers/
    ├── whatsapp/                     # Evolution API v2 (Baileys)
    ├── instagram/                    # HTTP poll → instagram-bridge (Python/instagrapi)
    ├── facebook/                     # fca-unofficial MQTT listener
    └── tiktok/                       # scraper con polling
```

Cada driver implementa `IChannelDriver`:

```typescript
interface IChannelDriver {
  readonly channel: ChannelType                                   // 'whatsapp' | 'instagram' | 'facebook' | 'tiktok'
  connect(tenantId: string, credentials: unknown): Promise<ConnectResult>
  disconnect(sessionId: string): Promise<void>
  getStatus(sessionId: string): Promise<ChannelStatus>
  sendMessage(sessionId: string, to: string, msg: OutgoingMessage): Promise<SendResult>
  onIncoming(handler: (msg: NormalizedMessage) => Promise<void>): void
}
```

Los drivers se registran en `server.ts` con `registerDriver(driver)`. `channel-manager.ts` mantiene un `Map<ChannelType, IChannelDriver>`.

### `sendMessage` con rate limiting

```typescript
// channel-manager.ts — flujo de sendMessage()
async function sendMessage(tenantId, channel, to, message):
  1. Busca session activa en DB (channelSessions donde tenantId + channel + status='connected')
  2. Si channel === 'whatsapp':
       INCR Redis key rl:wa:{instanceId}
       Si count === 1 → EXPIRE 60s
       Si count > 30 → encola en BullMQ 'channel-send' con delay = TTL * 1000 + 500ms → return
  3. driver.sendMessage(instanceId, to, message)
```

El worker `channel-send` llama `driver.sendMessage()` directamente, sin pasar por el rate check, para evitar loops.

### Pipeline de mensaje entrante

`incoming-handler.ts` ejecuta en orden:

```
1. Buscar tenant en DB
2. findOrCreateCustomer(tenantId, from)         → tabla customers
3. findOrCreateConversation(...)                → tabla conversations
4. assignRoundRobin(tenantId)                   → asigna agente si no tiene uno
5. saveInboundMessage(...)                      → tabla messages, incrementa unreadCount
6. pushInboxEvent(tenantId, 'message', {...})   → SSE al dashboard
7. Chequear conversationState → si AGENTE_ACTIVO, terminar
8. runAIEngine(tenant, customerId, text, ...)   → respuesta + acción
9. sendMessage(tenantId, channel, from, resp)   → entrega al cliente (best-effort)
10. saveOutboundMessage(...)                    → tabla messages
11. pushInboxEvent(tenantId, 'message', {...})  → SSE de la respuesta IA
12. Si llmFailed + tenant.phone + whatsapp → alerta al dueño (fire-and-forget)
```

---

## 5. Motor de IA

### Pipeline completo

```
runAIEngine(tenant, customerId, message, channel, conversationId)
      │
      ├─ getHistory(tenantId, customerId, channel)        → últimos N msgs de Redis
      ├─ buildDynamicContext(tenantId, customerId)        → tenant config, carrito, citas pendientes
      └─ searchKnowledge(tenantId, message)               → pgvector cosine similarity (threshold 0.6)
      │
      ▼
buildSystemPrompt({ tenant, capabilities, knowledgeContext, dynamicContext, currentDateTime })
      │
      ▼
callLLM(messages, { tenantId, model, temperature, maxTokens })
      │  — usa integración LLM del tenant si existe, sino OPENAI_API_KEY del env
      │  — soporta cualquier API compatible OpenAI (Groq via baseURL)
      │
      ├─ Error LLM → logUnanswered() + respuesta fallback + alerta owner
      │
      ▼
parseAction(llmResponse)   → extrae JSON { accion, params } si existe en la respuesta
      │
      ├─ Sin acción → appendHistory() → return response
      │
      ▼
routeAction(accion, params, tenant, customerId, capabilities)
      │
      └─ Procesadores en apps/api/src/modules/ai/processors/
```

### Acciones y procesadores

| Acción | Procesador | Qué hace |
|--------|-----------|---------|
| `VER_CATALOGO` | `ver-catalogo.processor` | Lista productos activos del tenant con precios |
| `CREAR_CITA` | `crear-cita.processor` | Valida slot, crea appointment en DB, notifica |
| `VER_SLOTS` | `ver-slots.processor` | Consulta disponibilidad via scheduling engine |
| `COTIZAR` | `cotizar.processor` | Crea Quote en DB con items y precios |
| `CREAR_RESERVA` | `crear-reserva.processor` | Crea Reservation (mesa, habitación, etc.) |
| `AGREGAR_CARRITO` | `agregar-carrito.processor` | findOrCreate cart, agrega item |
| `VER_CARRITO` | `ver-carrito.processor` | Resume contenido del carrito activo |
| `CREAR_PEDIDO` | `crear-pedido.processor` | Convierte carrito en Order, pregunta método de pago |
| `ENVIAR_PAGO` | `enviar-pago.processor` | Crea link de pago Wompi, guarda Payment |
| `INFO_NEGOCIO` | `info-negocio.processor` | Responde preguntas sobre el negocio |
| `ESCALAMIENTO` | `escalamiento.processor` | Cambia conversationState a AGENTE_ACTIVO, asigna agente |

### Knowledge base (pgvector)

La tabla `ai_knowledge_entries` almacena pares pregunta/respuesta con un embedding `vector(1536)` generado con `text-embedding-3-small`. En cada turno de IA, `searchKnowledge` genera el embedding del mensaje del usuario y hace búsqueda por cosine distance (`<=>` operator de pgvector), filtrando entradas con similitud > 0.6. Las entradas relevantes se inyectan en el system prompt.

### Historial de conversación

El historial no se almacena en la tabla `messages` sino en Redis como lista JSON (clave `history:{tenantId}:{customerId}:{channel}`). Esto evita leer la DB en cada turno. Se persiste en `messages` por separado para el inbox.

### Manejo de errores LLM

```
callLLM lanza →
  1. logUnanswered(tenantId, customerId, conversationId, message)
     → Aparece en AI Training → "Sin respuesta" para que el dueño entrene al bot
  2. return { response: 'Lo siento...', llmFailed: true }
  3. incoming-handler: si llmFailed + tenant.phone + canal whatsapp
     → sendMessage(tenantId, 'whatsapp', tenant.phone, alerta)  [fire-and-forget]
```

---

## 6. Base de datos

### PostgreSQL 16 + pgvector

Conexión vía Drizzle ORM (`packages/db`). Pool gestionado por `pg` nativo con configuración de RLS.

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `tenants` | Negocios. Tiene `capabilities[]`, configuración IA, plan, estado demo/suspensión |
| `users` | Agentes/owners de un tenant (RBAC: owner > admin > agent) |
| `customers` | Clientes detectados automáticamente por canal y teléfono |
| `conversations` | Una por cliente × canal. Tiene `assignedUserId`, `unreadCount`, `lastMessageAt` |
| `messages` | Historial de mensajes (inbound/outbound, senderType: ai/agent/customer) |
| `conversation_state` | Estado IA por (tenantId, customerId, channel): `IA_ACTIVA` o `AGENTE_ACTIVO` |
| `channel_sessions` | Sesiones de canal activas (WhatsApp QR, IG, FB). Tiene `externalId` (nombre instancia Evolution) |
| `products` | Catálogo del tenant. Tipo `product` o `service`. Tiene `durationMinutes` para servicios |
| `categories` | Árbol de categorías. `parentId` nullable para subcategorías |
| `appointments` | Citas. Tiene `reminderSent boolean` para evitar recordatorios duplicados |
| `orders` | Pedidos creados por IA o manualmente. Estados: pending→confirmed→preparing→shipped→delivered |
| `order_items` | Ítems de cada orden con snapshot de precio |
| `carts` | Carritos activos por (tenantId, customerId, conversationId). Estado: active/converted/expired |
| `cart_items` | Ítems del carrito |
| `payments` | Pagos Wompi. `externalId` = referencia de Wompi. Estado: pending/approved/declined/voided |
| `quotes` | Cotizaciones con ítems y fecha de vencimiento |
| `reservations` | Reservas de mesas/habitaciones/espacios |
| `deliveries` | Domicilios con estado de entrega |
| `contact_lists` | Listas de contactos para campañas |
| `contact_list_entries` | Contactos individuales. `variables jsonb` almacena columnas extra del CSV |
| `campaigns` | Campañas masivas. `messages jsonb[]`, `recurrence`, `status`, `sentCount` |
| `campaign_logs` | Log por contacto por campaña: sent/failed/delivered |
| `integrations` | Credenciales de terceros cifradas (LLM, Wompi, Stripe). `config jsonb` cifrado AES-256 |
| `ai_knowledge_entries` | Base de conocimiento con `embedding vector(1536)` |
| `ai_unanswered_queries` | Preguntas que la IA no supo responder. Estado: pending/resolved/ignored |
| `kanban_columns` | Columnas del tablero Kanban por tenant |
| `kanban_cards` | Tarjetas asociadas a conversaciones |
| `departments` | Departamentos del negocio (para enrutamiento) |
| `superadmin_users` | Cuentas del panel SuperAdmin (tabla independiente) |
| `plans` | Planes SaaS con límites y precio |
| `resellers` | Resellers con comisión |
| `audit_logs` | Auditoría de acciones del SuperAdmin |

### Migraciones

Las migraciones viven en `packages/db/migrations/`. Se aplican automáticamente al arrancar la API (`runMigrations()` en `server.ts` antes de `app.listen()`). Para generar nuevas migraciones tras cambiar el schema de Drizzle:

```bash
pnpm --filter @saas/db db:generate   # genera SQL en migrations/
pnpm --filter @saas/db db:migrate    # aplica pendientes
```

---

## 7. Jobs en background (BullMQ)

Todos los workers usan `makeBullMQConnection()` de `lib/redis.ts` que crea una conexión con `maxRetriesPerRequest: null` (requerido por BullMQ para comandos bloqueantes).

### `campaign-sender` (BullMQ Worker)

- **Disparado por:** `POST /api/campaigns/:id/launch` o al programar una campaña
- **Lógica:**
  - Por cada contacto de la lista: resuelve variables `{{campo}}` del JSONB, envía via Evolution API
  - Delay aleatorio 2–8s entre envíos (anti-ban WhatsApp)
  - Actualiza `campaign_logs` con estado (sent/failed)
  - Al terminar, si `recurrence !== 'once'` → reprograma el job con el próximo timestamp
- **Nota:** El campaign-sender llama a Evolution API directamente (no a `channel-manager.sendMessage`) para evitar el rate limiter de canales — las campañas ya tienen su propio control de velocidad

### `channel-send` (BullMQ Worker)

- **Disparado por:** `channel-manager.sendMessage()` cuando WhatsApp supera 30 msg/min
- **Payload:** `{ channel, sessionExternalId, to, message }`
- **Lógica:** llama `driver.sendMessage(sessionExternalId, to, message)` directamente
- **Concurrencia:** 5 workers paralelos

### `reminder` (setInterval, cada hora)

- Busca citas con `status='confirmed'`, `reminderSent=false`, `scheduledAt` entre 23h y 25h desde ahora
- Envía recordatorio WhatsApp via `sendMessage(tenantId, 'whatsapp', customerPhone, ...)`
- Marca `reminderSent=true` si el envío es exitoso
- Si el canal no está conectado, falla silenciosamente y reintentará en la próxima hora

### `demo-expiry` (setInterval, cada hora)

- Busca tenants con `isDemo=true`, `demoExpiresAt < NOW()`, `suspendedAt IS NULL`
- Setea `suspendedAt = NOW()` y `suspendedReason = 'demo_expired'`

### `instagram-poller` (setInterval, cada 20s por defecto)

- Poll al instagram-bridge (Python/FastAPI en puerto 8000)
- Por cada mensaje nuevo: dispara `handleIncomingMessage`

### `tiktok-scraper` (setInterval, cada 60s)

- Scraping de comentarios/DMs de TikTok
- Por cada mensaje nuevo: dispara `handleIncomingMessage`

---

## 8. SSE — tiempo real en el inbox

El inbox del dashboard usa Server-Sent Events para recibir actualizaciones sin polling.

### Backend

```
GET /api/conversations/stream
  → requireAuth()
  → Registra la conexión en sseRegistry (Map<tenantId, Set<ServerResponse>>)
  → Mantiene viva con keepalive cada 30s
  → Al cerrar conexión: limpia del registry
```

`pushInboxEvent(tenantId, type, data)` itera el `Set` de conexiones del tenant y escribe el evento SSE. Los tipos de evento son: `message` (nuevo mensaje), `conversation` (nueva conversación), `ai-state` (cambio IA/Agente).

### Frontend

```typescript
const es = new EventSource(`${API_BASE}/api/conversations/stream`, {
  headers: { Authorization: `Bearer ${token}` },
});
es.onmessage = ({ data }) => {
  const { type, payload } = JSON.parse(data);
  // actualizar state de React según type
};
```

### WhatsApp QR (SSE separado)

```
GET /api/channels/whatsapp/stream
  → SSE dedicado para el flujo de conexión QR
  → Eventos: { type: 'qr', data: 'data:image/png;base64,...' }
              { type: 'connected', data: { phone: '+57...' } }
```

---

## 9. Pagos (Wompi)

### Credenciales por tenant

Cada tenant almacena sus propias llaves Wompi en la tabla `integrations` con `provider='wompi'`, `category='payment'`. Se configuran desde `Dashboard → Configuración → Pagos`.

Para leer las credenciales en el backend:

```typescript
// lib/wompi-tenant.ts
async function getWompiCredentials(tenantId: string): Promise<WompiCredentials>
// Busca integrations donde provider='wompi', isActive=true, isPrimary=true
// Descifra config con lib/crypto.ts
// Retorna { publicKey, privateKey, eventSecret }
```

### Flujo de pago

```
1. Procesador ENVIAR_PAGO →
   POST /api/payments/create-link
   { orderId, amount, description, reference }

2. payments.service.ts →
   Llama Wompi API con las credenciales del tenant
   Crea payment en DB con status='pending'
   Retorna { paymentLink }

3. IA envía link al cliente via WhatsApp

4. Cliente paga (elige Nequi/Daviplata/tarjeta dentro del checkout Wompi)

5. Wompi → POST /api/webhooks/wompi/{tenantId}
   wompi.webhook.ts verifica firma HMAC con eventSecret
   Si APPROVED → update payment status + update order status
```

### Verificación HMAC

```typescript
// wompi.webhook.ts
const signature = req.headers['x-event-checksum'];
const payload = req.rawBody + eventSecret;
const expected = sha256(payload);
if (signature !== expected) return 401;
```

---

## 10. Módulos API

Prefijo base: `/api`. Todos los endpoints de tenant requieren JWT válido con `tenantId`. Los de superadmin están bajo `/api/superadmin` con JWT de superadmin.

| Prefijo | Módulo | Descripción |
|---------|--------|-------------|
| `/api/auth` | auth | Login, registro, refresh, logout |
| `/api/tenants` | tenants | CRUD del tenant propio (GET /me, PATCH /me) |
| `/api/users` | users | Agentes del tenant |
| `/api/categories` | categories | Categorías del catálogo |
| `/api/products` | products | Productos y servicios del catálogo |
| `/api/customers` | customers | Clientes (con filtros, historial) |
| `/api/conversations` | conversations | Inbox (lista, mensajes, ai-state, SSE stream) |
| `/api/messages` | messages | Mensajes (list, mark-read) |
| `/api/appointments` | appointments | Citas (CRUD, filtros por customerId) |
| `/api/orders` | orders | Pedidos (lista, detalle, cambio de estado) |
| `/api/quotes` | quotes | Cotizaciones |
| `/api/reservations` | reservations | Reservas |
| `/api/deliveries` | deliveries | Domicilios |
| `/api/kanban` | kanban | Columnas y tarjetas (drag & drop) |
| `/api/departments` | departments | Departamentos |
| `/api/contact-lists` | contact-lists | Listas de contactos + importar CSV |
| `/api/campaigns` | campaigns | Campañas masivas (CRUD, launch, pause) |
| `/api/groups` | groups | Grupos WhatsApp (list, sync, message) |
| `/api/integrations` | integrations | Credenciales de terceros (cifradas) |
| `/api/payments` | payments | Links de pago, estado |
| `/api/analytics` | analytics | KPIs del dashboard en tiempo real |
| `/api/ai` | ai | Knowledge base, queries sin respuesta, test AI |
| `/api/channels` | channels | Conexión de canales, QR SSE, estado |
| `/api/webhooks` | webhooks | Wompi webhook, Evolution API webhook |
| `/api/dev` | dev | Simulate-message (solo non-production) |
| `/api/superadmin/auth` | sa.auth | Login superadmin |
| `/api/superadmin/tenants` | sa.tenants | CRUD tenants + impersonar |
| `/api/superadmin/plans` | sa.plans | Planes SaaS |
| `/api/superadmin/demos` | sa.demos | Tenants demo con expiración |
| `/api/superadmin/resellers` | sa.resellers | Resellers y comisiones |
| `/api/superadmin/dashboard` | sa.dashboard | KPIs SaaS globales |
| `/api/superadmin/monitor` | sa.monitor | CPU/RAM/disco/servicios en vivo |
| `/api/superadmin/audit` | sa.audit | Log de acciones del superadmin |

### Convención de respuestas de error

```json
{
  "error": "Not Found",
  "message": "Conversación no encontrada",
  "code": "NOT_FOUND"
}
```

El plugin `error-handler.ts` captura errores Zod (400), `AppError` personalizado, y cualquier error no manejado (500).

---

## 11. Frontend

### Estructura de rutas (Next.js 14 App Router)

```
apps/web/src/app/
├── (auth)/
│   └── login/page.tsx               # Login tenant
├── (dashboard)/
│   └── dashboard/
│       ├── layout.tsx               # Sidebar + auth guard
│       ├── page.tsx                 # Dashboard principal (KPIs)
│       ├── inbox/page.tsx           # Inbox 3 columnas + SSE
│       ├── ai-config/page.tsx       # Configuración IA + panel de prueba
│       ├── ai-training/page.tsx     # Knowledge base + sin respuesta
│       ├── catalog/page.tsx         # Catálogo de productos
│       ├── customers/page.tsx       # Clientes (con historial expandible)
│       ├── appointments/page.tsx    # Citas (lista + botones inline)
│       ├── orders/page.tsx          # Pedidos (lista + botones inline)
│       ├── quotes/page.tsx          # Cotizaciones
│       ├── reservations/page.tsx    # Reservas
│       ├── deliveries/page.tsx      # Domicilios
│       ├── kanban/page.tsx          # Kanban drag & drop
│       ├── campaigns/page.tsx       # Campañas (3 tabs: campañas/listas/grupos)
│       ├── channels/page.tsx        # Conexión de canales (QR SSE)
│       ├── team/page.tsx            # Equipo y departamentos
│       ├── analytics/page.tsx       # Analíticas
│       ├── integrations/page.tsx    # Integraciones de terceros
│       └── settings/
│           ├── page.tsx             # Configuración (Negocio/IA/Pagos/Apariencia)
│           └── integrations/page.tsx
└── (superadmin)/
    └── superadmin/
        ├── layout.tsx               # SuperAdmin layout + guard separado
        ├── page.tsx                 # Dashboard KPIs SaaS
        ├── tenants/page.tsx
        ├── plans/page.tsx
        ├── demos/page.tsx
        ├── resellers/page.tsx
        ├── monitor/page.tsx
        └── audit/page.tsx
```

### Estado global (Zustand)

| Store | Archivo | Contenido |
|-------|---------|---------|
| `useAuthStore` | `store/auth.ts` | `accessToken`, `user`, `login()`, `logout()` |
| `useSuperAdminStore` | `store/superadmin.ts` | Token y datos del superadmin |

### Cliente API (`lib/api.ts`)

Un objeto `api` con namespaces tipados. Todas las funciones son `async` y lanzan `ApiError` si el servidor retorna un error HTTP.

```typescript
api.auth.login(email, password)
api.tenants.me(token)
api.tenants.patch(token, data)
api.conversations.list(token, opts)
api.conversations.sendMessage(token, conversationId, content)
api.conversations.setAIState(token, conversationId, state)
api.ai.simulateMessage(token, phone, message)
api.integrations.list(token)
api.integrations.create(token, data)
api.integrations.patch(token, id, data)
// ... (28+ métodos)
```

### Design System "Obsidian Glass"

Variables CSS definidas en `globals.css`. Todos los componentes usan variables como `var(--bg-surface)`, `var(--accent-primary)`, `var(--text-secondary)`. El tema oscuro es el predeterminado.

---

## 12. Variables de entorno — referencia completa

| Variable | Requerida | Descripción | Valor por defecto |
|----------|----------|-------------|------------------|
| `DATABASE_URL` | Sí | URL completa de PostgreSQL | — |
| `POSTGRES_USER` | Sí | Usuario PostgreSQL | — |
| `POSTGRES_PASSWORD` | Sí | Contraseña PostgreSQL | — |
| `REDIS_URL` | Sí | URL de Redis | — |
| `JWT_SECRET` | Sí | Secreto para firmar JWT (mín. 32 chars) | — |
| `JWT_EXPIRY` | No | TTL del access token | `15m` |
| `JWT_REFRESH_EXPIRY` | No | TTL del refresh token | `7d` |
| `ENCRYPTION_KEY` | Sí | Clave AES-256 en base64 (32 bytes) | — |
| `DOMAIN` | Producción | Dominio principal (sin protocolo) | — |
| `API_BASE_URL` | Producción | URL base de la API | — |
| `WEB_BASE_URL` | Producción | URL base del frontend | — |
| `OPENAI_API_KEY` | Sí | API key de OpenAI (o compatible) | — |
| `OPENAI_DEFAULT_MODEL` | No | Modelo LLM por defecto | `gpt-4o-mini` |
| `EVOLUTION_API_URL` | Sí | URL de Evolution API | `http://evolution-api:8080` |
| `EVOLUTION_API_GLOBAL_KEY` | Sí | Clave global de Evolution API | — |
| `INSTAGRAM_BRIDGE_URL` | No | URL del bridge Python | `http://instagram-bridge:8000` |
| `IG_POLL_INTERVAL_SECONDS` | No | Intervalo de poll Instagram | `20` |
| `FB_RATE_LIMIT_PER_MINUTE` | No | Límite de mensajes FB por minuto | `15` |
| `TT_POLL_INTERVAL_SECONDS` | No | Intervalo de poll TikTok | `60` |
| `API_PORT` | No | Puerto de la API | `3001` |
| `API_HOST` | No | Host de escucha | `0.0.0.0` |
| `LOG_LEVEL` | No | Nivel de logs pino | `info` |
| `NODE_ENV` | No | Entorno | `development` |

### Generar valores seguros

```bash
# JWT_SECRET (64 chars hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (32 bytes base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# EVOLUTION_API_GLOBAL_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

*Última actualización: 2026-05-21*

# CHANGELOG — Motor MCP Multi-Canal Adaptive Engine

> Fecha: 2026-05-29
> Estado: ✅ 5 Fases Completas | API compila limpio (`tsc` 0 errores)

---

## Resumen Ejecutivo

Se transformó el motor de IA de un sistema basado en **action-router JSON legacy** a una arquitectura **MCP (Model Context Protocol)** con 8 servidores especializados, mensajes ricos adaptados por canal, y contexto del cliente filtrado según WhatsApp/Instagram/Facebook/TikTok.

**Líneas modificadas/creadas:** ~3.500  
**Archivos nuevos:** 14  
**Archivos borrados (legacy):** 12  
**Errores TypeScript:** 0 (desde ~35 errores iniciales)

---

## FASE 1 — Mensajes Ricos (`channel-driver.interface.ts`)

### Objetivo
Definir un sistema de tipos unificado para mensajes salientes que funcione en los 4 canales (WhatsApp, Instagram, Facebook, TikTok).

### Cambios
- **Nuevos tipos de mensaje saliente (`OutgoingMessage`):**
  - `TextMessage` — texto plano con opción de preview URL
  - `ButtonMessage` — hasta 3 botones (WhatsApp nativo)
  - `ListMessage` — hasta 10 opciones en lista desplegable (WhatsApp nativo)
  - `QuickReplyMessage` — hasta 11 quick replies (Facebook nativo)
  - `TemplateMessage` — templates aprobados por Meta
  - `MediaMessage` — imagen, video, audio, documento
  - `LocationMessage` — latitud/longitud con nombre/dirección

- **`NormalizedMessage` (entrante):** enriquecido con campos de mensajes ricos:
  - `media`, `location`, `buttonPayload`, `buttonTitle`, `listReplyId`, `listReplyTitle`

- **`BaseOutgoingMessage.channel` eliminado:** el canal se infiere del driver en `sendMessage()`, simplificando la API.

### Archivos afectados
| Archivo | Acción |
|---------|--------|
| `apps/api/src/modules/channels/core/channel-driver.interface.ts` | Editado |
| `apps/api/src/modules/channels/core/channel-message-formatter.ts` | Editado (quitar `channel` de objetos) |
| `apps/api/src/modules/channels/core/incoming-handler.ts` | Editado (quitar `channel` de objetos) |
| `apps/api/src/modules/conversations/conversations.routes.ts` | Editado (quitar `channel` de objetos) |
| `apps/api/src/jobs/reminder.job.ts` | Editado (quitar `channel` de objetos) |

---

## FASE 2 — Contexto Enriquecido + Adaptador por Canal

### Objetivo
Cargar el perfil completo del cliente y adaptar qué información se envía al LLM según las limitaciones de cada canal.

### Cambios

#### 2A — Contexto Dinámico (`ai.context-builder.ts`)
El builder ahora carga 6 dimensiones del cliente desde la DB:
1. **Perfil** — nombre, tel, email, dirección, etiquetas
2. **Carrito activo** — items + total
3. **Citas próximas** — servicio, fecha, duración
4. **Pedidos recientes** — número, total, estado, pago
5. **Reservas activas** — fecha, hora, personas, tipo de espacio
6. **Cotizaciones pendientes** — número, total, fecha de vencimiento

#### 2B — Adaptador por Canal (`channel-context-adapter.ts`) — **NUEVO**
Filtra y resume el contexto según reglas por canal:

| Canal | Secciones máx | Omitidas | Líneas máx/sección | Resumen |
|-------|--------------|----------|-------------------|---------|
| WhatsApp | 10 | ninguna | 10 | No |
| Facebook | 8 | ninguna | 6 | Sí |
| Instagram | 5 | Cotizaciones | 4 | Sí |
| TikTok | 3 | Citas, Reservas, Cotizaciones | 3 | Sí |

**Razón:** TikTok tiene límite de 200 chars por mensaje; Instagram no soporta botones ni listas interactivas. Enviar contexto completo a estos canales desperdicia tokens y confunde al LLM.

### Archivos afectados
| Archivo | Acción |
|---------|--------|
| `apps/api/src/modules/ai/ai.context-builder.ts` | Editado (acepta `channel`, aplica adapter) |
| `apps/api/src/modules/ai/channel-context-adapter.ts` | **Creado** |
| `apps/api/src/modules/ai/ai.engine.ts` | Editado (pasa `channel` a `buildDynamicContext`) |

---

## FASE 3 — 8 Servidores MCP

### Objetivo
Reemplazar los 8 procesadores monolíticos legacy con servidores MCP independientes, cada uno con herramientas Zod-tipadas.

### Servidores creados

| Servidor | Capability | Herramientas |
|----------|-----------|--------------|
| `catalog-mcp-server.ts` | `catalog` | `listProducts`, `listCategories`, `getProductDetails`, `checkStock` |
| `appointments-mcp-server.ts` | `appointments` | `listServices`, `getMyAppointments`, `checkAvailability`, `createAppointment`, `cancelAppointment` |
| `orders-mcp-server.ts` | `cart_orders` | `addToCart`, `viewCart`, `createOrder`, `getOrderStatus` |
| `payments-mcp-server.ts` | `payments` | `createPaymentLink` (Wompi), `getPaymentStatus` |
| `quotes-mcp-server.ts` | `quotes` | `createQuote`, `getMyQuotes` |
| `reservations-mcp-server.ts` | `reservations` | `createReservation`, `getMyReservations`, `cancelReservation` |
| `knowledge-mcp-server.ts` | — (siempre disponible) | `searchKnowledge` (pgvector), `getBusinessHours` |
| `customer-mcp-server.ts` | — (siempre disponible) | `getProfile`, `updateProfile`, `getConversationHistory`, `escalamiento` |

### Registro
Todos los servidores se registran en `apps/api/src/mcp/index.ts` vía `registerMCPServer()`.

### Compatibilidad TypeScript Strict
Todos los `execute` reciben `params: Record<string, unknown>` (limitación de la interfaz MCP). Dentro de cada herramienta se hace cast explícito:
```typescript
const orderNumber = params.orderNumber as string | undefined;
```
Para campos opcionales en `db.insert().values()`, se usa conditional spread para evitar violar `exactOptionalPropertyTypes`:
```typescript
const values: Record<string, unknown> = { tenantId, customerId, ... };
if (params.notes) values.notes = params.notes;
await db.insert(table).values(values as never);
```

### Archivos nuevos
| Archivo | Descripción |
|---------|-------------|
| `apps/api/src/mcp/core/mcp-server.interface.ts` | Tipos `MCPServer`, `MCPTool`, `MCPToolContext` |
| `apps/api/src/mcp/core/mcp-registry.ts` | Registro global de servidores, filtrado por capabilities |
| `apps/api/src/mcp/core/mcp-client.ts` | `parseToolInvocation`, `executeToolFromResponse`, `executeToolChain` |
| `apps/api/src/mcp/servers/catalog-mcp-server.ts` | Servidor catálogo |
| `apps/api/src/mcp/servers/appointments-mcp-server.ts` | Servidor citas |
| `apps/api/src/mcp/servers/orders-mcp-server.ts` | Servidor carrito + pedidos |
| `apps/api/src/mcp/servers/payments-mcp-server.ts` | Servidor pagos Wompi |
| `apps/api/src/mcp/servers/quotes-mcp-server.ts` | Servidor cotizaciones |
| `apps/api/src/mcp/servers/reservations-mcp-server.ts` | Servidor reservas |
| `apps/api/src/mcp/servers/knowledge-mcp-server.ts` | Servidor base de conocimiento |
| `apps/api/src/mcp/servers/customer-mcp-server.ts` | Servidor perfil cliente + escalamiento |
| `apps/api/src/mcp/index.ts` | Barrel export + registro de los 8 servidores |

---

## FASE 4 — Motor de IA con MCP (Reemplazo del Action Router)

### Objetivo
El motor de IA ya no parsea JSONs de acción legacy. Ahora invoca herramientas MCP, recibe el resultado, y re-promptea al LLM para formatear una respuesta natural.

### Flujo nuevo (`ai.engine.ts`)
```
1. Cargar historial + contexto dinámico (adaptado por canal) + knowledge base
2. Construir system prompt con lista de herramientas MCP disponibles
3. Llamar LLM
4. parseToolInvocation() → ¿el LLM devolvió {"tool":"...", "params":{...}}?
   SÍ → validar con Zod → ejecutar herramienta → re-promptear LLM con resultado
   NO → usar respuesta directa del LLM
5. Guardar mensaje outbound en DB
```

### Escalamiento a humano
La herramienta `escalamiento` del `customer-mcp-server`:
1. El LLM invoca `{"tool":"escalamiento","params":{"motivo":"..."}}`
2. `executeToolFromResponse` la ejecuta
3. `ai.engine.ts` detecta `toolName === 'escalamiento'`
4. Inserta/actualiza `conversation_state` → `AGENTE_ACTIVO`
5. Responde al cliente: "Voy a transferirte con un agente humano..."

### Borrado de código legacy
Se eliminaron 12 archivos que ya no tienen referencias:

| Archivo | Razón de eliminación |
|---------|---------------------|
| `ai.action-router.ts` | Reemplazado por MCP registry + client |
| `ai.action-parser.ts` | Reemplazado por `parseToolInvocation()` en `mcp-client.ts` |
| `ai.action-parser.test.ts` | Tests del parser legacy |
| `processors/stub.processor.ts` | Reemplazado por tool `escalamiento` en MCP |
| `processors/ver-catalogo.processor.ts` | Reemplazado por `catalog-mcp-server` |
| `processors/crear-cita.processor.ts` | Reemplazado por `appointments-mcp-server` |
| `processors/ver-slots.processor.ts` | Reemplazado por `appointments-mcp-server` |
| `processors/info-negocio.processor.ts` | Reemplazado por `knowledge-mcp-server` |
| `processors/enviar-pago.processor.ts` | Reemplazado por `payments-mcp-server` |
| `processors/pedido.processor.ts` | Reemplazado por `orders-mcp-server` |
| `processors/cotizar.processor.ts` | Reemplazado por `quotes-mcp-server` |
| `processors/reservar.processor.ts` | Reemplazado por `reservations-mcp-server` |

**Verificación:** `grep` confirmó que ningún archivo en `apps/api/src/` importaba `ai.action-router.ts` ni los procesadores individuales.

### Archivos afectados
| Archivo | Acción |
|---------|--------|
| `apps/api/src/modules/ai/ai.engine.ts` | Editado (pipeline MCP completo) |
| `apps/api/src/modules/ai/ai.prompt-builder.ts` | Editado (lista herramientas MCP en system prompt) |

---

## FASE 5 — Adaptación por Canal (Prompts + Formatter)

### Objetivo
El LLM y el formateador de mensajes deben conocer las reglas del canal para no generar contenido que no se pueda enviar.

### 5A — Channel Prompt Adapter (`channel-prompt-adapter.ts`)
Genera una sección de reglas que se inyecta en el system prompt del LLM:

| Canal | Características inyectadas al prompt |
|-------|-------------------------------------|
| WhatsApp | Botones ≤3, Listas ≤10, Media, Templates, 4096 chars, tono claro |
| Instagram | Solo texto + emojis, opciones numeradas con emoji, 1000 chars, tono visual |
| Facebook | Quick replies ≤11, Botones ≤3, Templates, 2000 chars, llamados a la acción |
| TikTok | Solo texto, ≤200 chars, tono casual, jerga joven, sin listas largas |

### 5B — Channel Message Formatter (`channel-message-formatter.ts`)
Detecta automáticamente si un texto contiene opciones listadas (patrones `1.`, `2)`, `- bullet`) y las convierte al formato interactivo nativo del canal:

- **WhatsApp** + ≤3 opciones → `ButtonMessage`
- **WhatsApp** + >3 opciones → `ListMessage`
- **Facebook** + ≤11 opciones → `QuickReplyMessage`
- **Instagram/TikTok** → texto plano con emojis numerados

También provee helpers explícitos: `textMessage()`, `buttonMessage()`, `listMessage()`.

### Archivos
| Archivo | Acción |
|---------|--------|
| `apps/api/src/modules/channels/core/channel-prompt-adapter.ts` | **Creado** |
| `apps/api/src/modules/channels/core/channel-message-formatter.ts` | Editado (quitar `channel` de tipos) |

---

## Fixes Técnicos Adicionales

### TypeScript Strict (`exactOptionalPropertyTypes`)
- **Problema:** `db.insert().values({ optionalField: undefined })` falla con TS strict.
- **Solución:** Conditional spread `...(x ? { field: x } : {})` + cast `as never` para los inserts.
- **Archivos:** todos los MCP servers (`orders`, `payments`, `reservations`, `appointments`).

### Cast de parámetros MCP
- **Problema:** `params` es `Record<string, unknown>` en la interfaz `MCPTool`.
- **Solución:** Cast explícito dentro de cada `execute`:
  ```typescript
  const productName = (params.productName as string | undefined) ?? '';
  ```

### Web Build en Windows
- **Problema:** `next.config.mjs` con `output: 'standalone'` genera symlinks en build, lo cual falla en Windows con `EPERM`.
- **Solución:** `output: process.env.NODE_ENV === 'production' && process.platform !== 'win32' ? 'standalone' : undefined`
- **Archivo:** `apps/web/next.config.mjs`

### Instagram Bridge
- **Problema:** `apps/instagram-bridge/requirements.txt` no incluía `pillow>=10.0.0`, necesario para `instagrapi`.
- **Solución:** Agregada dependencia + rebuild de imagen Docker.

---

## Estado de Compilación

```bash
$ pnpm --filter @app/api build
> tsc
# 0 errores, 0 warnings

$ pnpm --filter @app/web build
# Build completa, 0 errores TypeScript
# (standalone omitido en Windows por symlink EPERM)
```

---

## Próximos Pasos Recomendados

1. **Endpoint de prueba end-to-end:** `POST /api/dev/simulate-message` para probar el flujo completo sin WhatsApp real.
2. **Tests unitarios MCP:** Agregar tests para `parseToolInvocation`, validación Zod de cada herramienta, y mocks de DB.
3. **Observabilidad:** Logging estructurado de invocaciones MCP (tool, params, latency, success/fail).
4. **Fallback de herramientas:** Si una herramienta MCP falla, el motor debe intentar una alternativa o degradar gracefully.
5. **Rate limiting por tenant:** Limitar llamadas LLM y MCP por tenant para controlar costos.

---

## Referencias

- MCP Spec: https://modelcontextprotocol.io
- Evolution API v2.2.3: https://github.com/EvolutionAPI/evolution-api
- Wompi Docs: https://docs.wompi.co
- Drizzle ORM Strict Mode: https://orm.drizzle.team/docs/goodies#strict-mode

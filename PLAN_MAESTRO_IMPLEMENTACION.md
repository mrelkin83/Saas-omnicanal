# PLAN MAESTRO DE IMPLEMENTACIÓN — SaaS Omnicanal AI-First
## Versión: 2.0 | Fecha: 2026-05-19 | Estado: AUTORIZADO

---

## FILOSOFÍA CENTRAL: LA PLATAFORMA ES UN VENDEDOR AUTÓNOMO

> "El humano configura. La IA vende, agenda, cobra y atiende. El humano solo supervisa."

Este sistema NO es un CRM de atención al cliente donde humanos responden chats.
Es un **vendedor autónomo con IA** que opera 24/7 sin intervención humana.

### El flujo perfecto (restaurante como ejemplo):

```
Cliente WhatsApp: "Hola, quiero un choriburguer para domicilio"
          ↓
   [ AI ENGINE ]
   Carga catálogo del negocio desde DB
   Arma el prompt con menú, precios, reglas del negocio
   Llama a OpenAI/Groq
   Recibe respuesta: texto con menú
          ↓
   Envía menú al cliente (via Evolution API)
          ↓
Cliente: "La especial, sin cebolla, + huevo frito extra"
          ↓
   AI parsea → {"accion":"AGREGAR_CARRITO","items":[...]}
   Procesador crea/actualiza carrito en DB
   AI pregunta por bebida
          ↓
          ... (flujo continúa)
          ↓
Cliente: "Nequi"
          ↓
   AI → {"accion":"ENVIAR_PAGO","metodo":"wompi","monto":18000}
   Procesador genera link de pago Wompi
   Cliente elige su método dentro del checkout de Wompi (Nequi, Daviplata, tarjeta, etc.)
   Envía link al cliente
          ↓
   [ BullMQ JOB: payment-checker ] → poll cada 5s
   Wompi webhook confirma pago
          ↓
   Sistema crea Order en DB (status: paid)
   AI envía: "✅ PAGO CONFIRMADO. ¿A qué dirección enviamos?"
          ↓
Cliente: "Carrera 25 #45-67, apto 302"
          ↓
   AI → {"accion":"CONFIRMAR_ENTREGA","direccion":"..."}
   Order actualizado con dirección
   Notificación al dueño en dashboard
          ↓
DASHBOARD (humano): Ve el pedido nuevo, lo marca como "En preparación", lo asigna al domiciliario
```

**Intervención humana total en este flujo: 0 pasos.**
El humano solo ve el pedido ya creado y listo para preparar.

---

## ESTADO ACTUAL DEL CODEBASE (auditoría honesta)

### ✅ Existe y tiene estructura real:
- Motor de IA: `apps/api/src/modules/ai/` — engine, context-builder, prompt-builder, action-parser, 8 procesadores
- Canales: `apps/api/src/modules/channels/` — 4 drivers, channel-manager, webhook handler
- Schema DB: `packages/db/src/schema/` — 21 tablas definidas con Drizzle
- Módulos API: 27 módulos registrados en server.ts
- Frontend: 19 páginas dashboard + 8 páginas superadmin
- Cliente API: `apps/web/src/lib/api.ts` — existe

### ❌ Roto / Incompleto / Sin conectar:
1. **`api.ts` Content-Type bug** — POST sin body lleva `Content-Type: application/json` → Fastify rechaza. Rompe WhatsApp connect y otros POSTs vacíos.
2. **Módulo `messages`** — directorio vacío. Sin mensajes no hay inbox, no hay historial, no hay nada.
3. **Módulo `payments`** — directorio vacío. Sin pagos la IA no puede cobrar.
4. **Migraciones DB** — 0 archivos generados. Las tablas existen en producción (install.sh las aplica) pero el flujo de desarrollo local está roto.
5. **Canales IG/FB/TikTok** — UI muestra "Próximamente". Los drivers existen en backend pero el frontend no los conecta.
6. **Dashboard KPIs** — hardcodeados a 0. No leen datos reales.
7. **Catálogo sin categorías** — UI no permite crear/ver categorías.
8. **SuperAdmin sin "Crear Tenant"** — el panel existe pero falta el formulario de creación.
9. **AI engine no conectado al webhook real** — el motor existe pero no está siendo invocado cuando llega un mensaje de WhatsApp.
10. **Sin endpoint de prueba del motor IA** — no hay forma de probar la IA sin WhatsApp real.

---

## ORDEN DE EJECUCIÓN: 6 SPRINTS

Los sprints están ordenados por **impacto en el flujo AI-First**. No avanzamos al siguiente sprint sin que el actual funcione.

---

## SPRINT 1: CIRUGÍA DE EMERGENCIA (Bugs críticos + módulos vacíos)
**Duración estimada: 2-3 días | Prioridad: BLOQUEANTE**

Todo lo que está roto impide que cualquier otra cosa funcione.

### 1.1 Fix `api.ts` — Content-Type condicional

**Archivo:** `apps/web/src/lib/api.ts`

**Problema:** La función `request()` agrega `Content-Type: application/json` en TODOS los requests, incluso en `POST` sin body. Fastify 4.x rechaza requests con ese header pero sin body.

**Fix exacto:**
```typescript
// ANTES (líneas ~19-20):
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...
};

// DESPUÉS:
const headers: Record<string, string> = {
  ...(rest.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(rest.headers as Record<string, string> | undefined),
};
```

**Afecta:** WhatsApp connect, y cualquier otro POST sin body que se agregue en el futuro.

---

### 1.2 Implementar módulo `messages` completo

**Ruta:** `apps/api/src/modules/messages/`

El módulo de mensajes es la columna vertebral del inbox. Sin él, no hay historial, no hay UI de conversación, no hay nada.

**Archivos a crear:**
- `messages.schema.ts` — Zod schemas para validación
- `messages.service.ts` — CRUD de mensajes
- `messages.routes.ts` — endpoints REST

**Endpoints:**
```
GET  /api/conversations/:conversationId/messages
     → Lista mensajes paginados (desc por created_at)
     → Marca mensajes como leídos (is_read=true)

POST /api/conversations/:conversationId/messages
     → Enviar mensaje desde el dashboard (sender_type='agent')
     → Llama a channelManager.sendMessage() con el mensaje
     → Guarda en DB con direction='outbound'
```

**Servicio `messages.service.ts` — operaciones clave:**
```typescript
// Guardar mensaje entrante (llamado por el webhook de canales)
async saveInbound(data: {
  tenantId: string;
  conversationId: string;
  customerId: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  externalId?: string;
  channel: string;
}): Promise<Message>

// Guardar mensaje saliente (IA o agente)
async saveOutbound(data: {
  tenantId: string;
  conversationId: string;
  customerId: string;
  content: string;
  senderType: 'ai' | 'agent' | 'system';
  senderUserId?: string;
}): Promise<Message>

// Obtener historial de conversación
async getByConversation(conversationId: string, limit = 50, before?: string): Promise<Message[]>

// Marcar como leídos
async markAsRead(conversationId: string, userId: string): Promise<void>
```

---

### 1.3 Implementar módulo `payments` completo

**Ruta:** `apps/api/src/modules/payments/`

Sin pagos, el flujo de venta se rompe justo antes del cierre. El módulo maneja Wompi como pasarela única — Wompi procesa internamente Nequi, Daviplata, tarjetas débito/crédito, transferencias, llaves Breve, PSE y más.

**Archivos a crear:**
- `payments.schema.ts`
- `payments.service.ts`
- `payments.routes.ts`
- `wompi.webhook.ts` (handler del webhook de Wompi)

**Endpoints:**
```
POST /api/payments/create-link
     → Crea link de pago Wompi (el cliente elige su método dentro: Nequi, Daviplata, tarjeta, etc.)
     → Requiere: orderId | appointmentId, amount, customerId
     → Retorna: { paymentLink, paymentId, expiresAt }

GET  /api/payments/:id
     → Estado del pago

GET  /api/payments
     → Lista pagos del tenant (con filtros)

POST /api/webhooks/wompi
     → Recibe eventos de Wompi (transaction.updated)
     → Valida firma HMAC con WOMPI_EVENT_SECRET
     → Actualiza payment_status en la orden/cita
     → Si status='APPROVED': dispara acción post-pago (notifica IA, actualiza orden)
```

**Servicio payments.service.ts:**
```typescript
// Crear link de pago
async createPaymentLink(params: {
  tenantId: string;
  orderId?: string;
  appointmentId?: string;
  customerId: string;
  amount: number; // en COP
  description: string;
  reference: string; // order_number o appointment_id
}): Promise<{ paymentLink: string; paymentId: string }>

// Procesar webhook de Wompi
async processWompiEvent(event: WompiWebhookEvent): Promise<void>
// Si APPROVED → updateOrderStatus(orderId, 'confirmed') + notifyAI()

// Verificar estado de pago (para polling)
async checkPaymentStatus(paymentId: string): Promise<PaymentStatus>
```

---

### 1.4 Generar migraciones DB para desarrollo local

**El problema:** `packages/db/src/migrations/` está vacío. En producción funciona porque `install.sh` aplica las tablas, pero en desarrollo local no hay forma de tener la DB.

**Solución:**
```bash
# Generar las migraciones desde los schemas de Drizzle
cd packages/db
pnpm db:generate
# Esto crea los archivos SQL en src/migrations/

# Commitear las migraciones
git add src/migrations/
git commit -m "feat(db): generate initial migrations from drizzle schemas"
```

**Nota:** Verificar que `drizzle.config.ts` apunta al directorio correcto y que todos los schemas están importados en el barrel export.

---

### 1.5 Conectar el AI Engine al webhook de WhatsApp

**El problema:** El motor de IA existe (`ai.engine.ts`) y el webhook de Evolution API existe, pero el webhook NO invoca al motor de IA. El mensaje llega, se guarda (parcialmente), pero la IA no procesa.

**Archivo a modificar:** `apps/api/src/modules/channels/drivers/whatsapp/evolution.webhook.ts`

**Flujo correcto:**
```typescript
// En el handler de MESSAGES_UPSERT:
async function handleIncomingMessage(payload: EvolutionWebhookPayload) {
  // 1. Normalizar el mensaje
  const normalized = normalizer.normalize(payload);
  
  // 2. findOrCreate customer
  const customer = await customerService.findOrCreate(tenantId, normalized.from);
  
  // 3. findOrCreate conversation
  const conversation = await conversationService.findOrCreate({
    tenantId, customerId: customer.id, channel: 'whatsapp',
    channelSessionId: session.id
  });
  
  // 4. Guardar mensaje en DB (messages table)
  await messageService.saveInbound({
    tenantId, conversationId: conversation.id,
    customerId: customer.id, content: normalized.text,
    type: normalized.type, externalId: normalized.id
  });
  
  // 5. Verificar estado de la conversación
  const state = await conversationStateService.get(tenantId, customer.id, 'whatsapp');
  
  // 6. Si IA está activa → invocar el motor
  if (!state || state.state === 'IA_ACTIVA') {
    await aiEngine.process({
      tenantId, customerId: customer.id,
      customerPhone: customer.phone,
      conversationId: conversation.id,
      channel: 'whatsapp',
      message: normalized.text
    });
  }
  // Si AGENTE_HUMANO → solo guardar, notificar al agente vía SSE
  
  // 7. Emitir evento SSE al dashboard
  sseRegistry.emit(tenantId, 'message:new', {
    conversationId: conversation.id,
    message: { content: normalized.text, direction: 'inbound', senderType: 'customer' }
  });
}
```

---

### 1.6 Hacer que el AI Engine guarde mensajes outbound

**Archivo:** `apps/api/src/modules/ai/ai.engine.ts`

Cuando la IA genera una respuesta y la envía via `channelManager.sendMessage()`, debe también guardar el mensaje outbound en la tabla `messages`.

```typescript
// Agregar después de channelManager.sendMessage():
await messageService.saveOutbound({
  tenantId,
  conversationId: input.conversationId,
  customerId: input.customerId,
  content: textoLimpio,
  senderType: 'ai'
});
```

---

### CHECKPOINT SPRINT 1

```bash
# 1. WhatsApp connect no da error de Content-Type
curl -X POST http://localhost:3001/api/channels/whatsapp/connect \
  -H "Authorization: Bearer $TOKEN"
# Esperado: { qrCode: "data:image/png;base64,..." } sin error de body

# 2. Mensajes se guardan
curl -X POST http://localhost:3001/api/dev/simulate-message \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"customerPhone":"+573001234567","message":"hola que servicios tienen"}'
# Esperado: { aiResponse: "texto coherente con servicios" }

# Verificar que el mensaje quedó guardado:
curl http://localhost:3001/api/conversations \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].id'
# Tomar ese ID y:
curl http://localhost:3001/api/conversations/{ID}/messages \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'
# Esperado: >= 2 (mensaje del cliente + respuesta IA)

# 3. Pago: crear link
curl -X POST http://localhost:3001/api/payments/create-link \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount":18000,"description":"Test pedido","reference":"TEST-001","customerId":"..."}'
# Esperado: { paymentLink: "https://checkout.wompi.co/l/..." }
```

---

## SPRINT 2: EL CORAZÓN — MOTOR DE IA COMPLETO Y PROBADO
**Duración estimada: 3-4 días | Prioridad: MÁXIMA**

### 2.1 Completar todos los procesadores de IA

El motor tiene 8 procesadores. Necesitan completarse y conectarse end-to-end.

#### Procesador: `crear-cita.processor.ts`

Replica exacta del patrón del `index.js` que ya tienes probado:

```
Recibe: { nombre, servicioNombre, servicioId, fecha, horaInicio, empleadoId? }

Flujo:
1. Buscar servicio en DB (products donde type='service')
2. Si tiene employees/prestadores y no se especificó → pedir al cliente
3. Validar días máximo de adelanto (tenant_config 'dias_max_adelanto', default 30)
4. Llamar schedulingEngine.getAvailableSlots()
5. Si el slot pedido está disponible → crear appointment en DB
6. Si no disponible → identificar motivo (hora pasada, fuera horario, ocupado)
   → Ofrecer alternativas del mismo día
7. channelManager.sendMessage() con confirmación
8. Notificar al dueño (SSE + opcionalmente WhatsApp propio del negocio)
```

**Scheduling Engine (`scheduling.engine.ts`):**
```typescript
async getAvailableSlots(params: {
  tenantId: string;
  serviceId: string;        // para saber la duración
  date: string;             // YYYY-MM-DD
  timezone: string;
  providerId?: string;      // filtrar por prestador específico
}): Promise<{ hora: string; display: string }[]>

// Lógica:
// 1. Cargar horario del negocio para ese día (tenant_config 'horario_atencion')
// 2. Cargar appointments existentes ese día (no cancelados)
// 3. Cargar blocks/bloqueos si existen
// 4. Generar slots cada N minutos (N = duración del servicio)
// 5. Filtrar slots ya ocupados
// 6. Retornar lista de slots libres
```

#### Procesador: `agregar-carrito.processor.ts`

```
Recibe: { productoId, productoNombre, cantidad, modificadores?, varianteId? }

Flujo:
1. Buscar producto en DB
2. findOrCreate carrito activo para (tenantId, customerId, conversationId)
3. Si carrito expirado → crear nuevo
4. Validar stock si aplica
5. Agregar item al carrito (cart_items)
6. Calcular subtotal
7. channelManager.sendMessage() confirmando item agregado
   ej: "✅ Choriburguer Especial sin cebolla agregado"
   "¿Algo más? Escribe 'ver carrito' para continuar"
```

#### Procesador: `ver-carrito.processor.ts`

```
Recibe: {} (no necesita parámetros)

Flujo:
1. Cargar carrito activo del cliente
2. Si vacío → "Tu carrito está vacío"
3. Si tiene items → armar resumen:
   "📋 Tu pedido:
    🍔 Choriburguer Especial sin cebolla - $13.000
    🥤 Gaseosa 500ml - $4.000
    💰 Total: $17.000
    
    ¿Confirmas tu pedido? Responde SI para continuar"
```

#### Procesador: `crear-pedido.processor.ts`

```
Recibe: {} | { metodoPago: 'wompi' | 'efectivo' }

// Wompi procesa TODO el pago digital: Nequi, Daviplata, tarjetas débito/crédito,
// transferencias, llaves Breve, PSE, etc. El cliente elige el método dentro del
// checkout de Wompi. El sistema solo distingue: pago digital (Wompi) vs efectivo.

Flujo:
1. Cargar carrito activo
2. Crear Order en DB con items del carrito
3. Marcar carrito como 'converted'
4. Si metodoPago = 'wompi' (o no se especificó pero quiere pago digital):
   → paymentsService.createPaymentLink({ amount, reference: order.order_number, ... })
   → Wompi genera link de checkout donde el cliente elige Nequi/Daviplata/tarjeta/etc.
   → Enviar link al cliente: "💳 Paga aquí (Nequi, Daviplata, tarjeta y más): [link]"
5. Si metodoPago = 'efectivo':
   → Order status = 'confirmed', payment_status = 'pending'
   → "Perfecto, pagarás en efectivo al recibir 💵"
6. Si no se especificó método → la IA pregunta:
   "¿Cómo prefieres pagar?
    💳 Pago digital (Nequi, Daviplata, tarjeta y más)
    💵 Efectivo al recibir"
7. Notificar al dashboard (SSE)
```

#### Procesador: `enviar-pago.processor.ts`

```
Recibe: { orderId?, appointmentId?, monto, descripcion }

Flujo:
1. Crear link Wompi sandbox o producción
2. Guardar en tabla payments con status='pending'
3. Enviar link al cliente via canal
4. BullMQ job: payment-checker revisa cada 30s el estado
```

#### Procesador: `cotizar.processor.ts`

```
Recibe: { items: [{servicioNombre, cantidad, descripcion}], notas? }

Flujo:
1. Buscar precios en catálogo para cada item
2. Crear Quote en DB
3. Armar resumen de cotización con total
4. channelManager.sendMessage() con la cotización formateada
5. Notificar al dashboard
```

#### Procesador: `crear-reserva.processor.ts`

```
Recibe: { fecha, hora, personas, tipoRecurso?, notas? }

Flujo:
1. Validar disponibilidad del recurso (mesa, habitación, etc.)
2. Crear Reservation en DB
3. Confirmar al cliente
4. Notificar al dashboard
```

#### Procesador: `escalamiento.processor.ts`

```
Recibe: { motivo? }

Flujo:
1. Cambiar conversation_state a 'AGENTE_HUMANO'
2. Asignar al agente disponible con menor carga (round-robin)
3. Notificar al agente vía SSE
4. channelManager.sendMessage(): 
   "Te estamos conectando con un asesor. Un momento por favor 🙏"
5. Guardar en ai_unanswered_queries si hay motivo técnico
```

---

### 2.2 Agregar endpoint de prueba del motor IA

**Endpoint:** `POST /api/dev/simulate-message`

**Solo activo en `NODE_ENV !== 'production'`**

```typescript
// Permite probar el flujo completo sin necesitar WhatsApp real:
{
  "tenantId": "...",           // opcional, usa el del token si no se especifica
  "customerPhone": "+573001234567",
  "message": "hola quiero agendar manicure"
}

// Respuesta:
{
  "aiResponse": "¡Hola! ¿Para qué fecha te gustaría agendar?",
  "action": null,             // o { accion: "VER_SLOTS", ... }
  "conversationId": "...",
  "messages": [...]           // historial completo
}
```

---

### 2.3 Panel de prueba de IA en el dashboard

**Ruta:** `/dashboard/ai-config` (sección "Probar Agente")

Una interfaz de chat simulada donde el dueño puede escribirle a su propia IA para ver cómo responde, sin necesitar WhatsApp real.

```
[ Panel de prueba ]
┌─────────────────────────────────────────┐
│ 🤖 Probar mi Agente de IA               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [historial de mensajes aquí]        │ │
│ │                                     │ │
│ │ Bot: ¡Hola! ¿En qué puedo ayudarte? │ │
│ │ Tú: Quiero agendar manicure         │ │
│ │ Bot: ¿Para qué fecha?...            │ │
│ └─────────────────────────────────────┘ │
│ [Escribe un mensaje...]    [Enviar]     │
│                                         │
│ [🗑️ Limpiar historial]                  │
└─────────────────────────────────────────┘
```

Usa `POST /api/dev/simulate-message` internamente.

---

### 2.4 Prompt Builder dinámico por capabilities

El sistema de prompts debe adaptarse automáticamente según las capabilities del tenant:

**Para `restaurante_comida_rapida`** (capabilities: catalog, cart_orders, payments, delivery, reservations):
```
ERES: Asistente de {NombreNegocio}
CATÁLOGO: [lista de productos con precios]
ACCIONES DISPONIBLES: VER_CATALOGO, AGREGAR_CARRITO, VER_CARRITO, CREAR_PEDIDO, ENVIAR_PAGO, CREAR_RESERVA, VER_RESERVAS
FORMAS DE PAGO: Pago digital vía Wompi (Nequi, Daviplata, tarjeta, transferencia y más) o Efectivo contraentrega
REGLAS:
- Cuando el cliente pida algo del menú → agrega al carrito (AGREGAR_CARRITO)
- Cuando el cliente diga "eso es todo" o "confirmar" → muestra carrito (VER_CARRITO)
- Después de confirmar → pregunta método de pago (CREAR_PEDIDO)
- Si pago digital → genera link (ENVIAR_PAGO)
```

**Para `salon_belleza_barberia`** (capabilities: catalog, appointments, payments):
```
ERES: Asistente de {NombreNegocio}
SERVICIOS: [lista de servicios con precios y duración]
ACCIONES DISPONIBLES: VER_CATALOGO, VER_SLOTS, CREAR_CITA, CANCELAR_CITA, REAGENDAR_CITA, VER_CITAS, ENVIAR_PAGO
REGLAS:
- Cuando el cliente quiera agendar → pide servicio, fecha y hora (VER_SLOTS para ver disponibles)
- NUNCA confirmes disponibilidad por tu cuenta → usa VER_SLOTS
- NUNCA confirmes la cita → el SISTEMA lo hace
```

**Para `abogado_juridico`** (capabilities: catalog, appointments, quotes, payments):
```
ERES: Asistente de {NombreNegocio}
ACCIONES DISPONIBLES: VER_CATALOGO, CREAR_CITA, COTIZAR, ENVIAR_PAGO
REGLAS:
- Para consultas generales → responde con información del negocio
- Para presupuestos → usa COTIZAR
- Para agendar consulta → CREAR_CITA
```

---

### CHECKPOINT SPRINT 2

```bash
# 1. Flujo completo de cita
curl -X POST http://localhost:3001/api/dev/simulate-message \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"customerPhone":"+573001111111","message":"hola quiero agendar una manicure"}'
# Esperado: saludo + pregunta por fecha

curl -X POST http://localhost:3001/api/dev/simulate-message \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"customerPhone":"+573001111111","message":"el martes a las 3pm"}'
# Esperado: confirmación de cita + "✅ Tu cita está confirmada"

# Verificar en DB:
curl http://localhost:3001/api/appointments \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].status'
# Esperado: "confirmed"

# 2. Flujo completo de pedido (para tenant tipo restaurante)
# Cambiar tenant a restaurante y repetir flujo de demoMessages
# El pedido debe quedar en DB con payment_status: 'pending'

# 3. Panel de prueba de IA en /dashboard/ai-config funciona
# Escribir "hola" → bot responde en español colombiano, coherente con el negocio
```

---

## SPRINT 3: CANALES Y TIEMPO REAL
**Duración estimada: 3 días | Prioridad: ALTA**

### 3.1 WhatsApp: Conexión completa end-to-end

Con el fix de Content-Type del Sprint 1, el botón "Conectar WhatsApp" debe funcionar. Pero además hay que completar:

**3.1.1 Página de canales — WhatsApp:**
```
Estado desconectado:
┌────────────────────────────────┐
│ 📱 WhatsApp Business            │
│ Sin conectar                   │
│ [Conectar] [Ver instrucciones] │
└────────────────────────────────┘

Click "Conectar" → Modal:
┌─────────────────────────────────┐
│ Conectar WhatsApp               │
│                                 │
│ [QR CODE aquí — 250x250px]      │
│                                 │
│ Escanea con WhatsApp Business   │
│ ⏳ Esperando escaneo...         │
└─────────────────────────────────┘

Después de escanear → Modal muestra:
│ ✅ ¡Conectado!                  │
│ Número: +573001234567           │
│ [Cerrar]                        │

Estado conectado:
┌────────────────────────────────┐
│ 📱 WhatsApp Business            │
│ ✅ +573001234567                │
│ Conectado desde: 19 May 2026   │
│ [Ver QR] [Desconectar]         │
└────────────────────────────────┘
```

**3.1.2 SSE para QR en tiempo real:**

El QR de WhatsApp cambia cada 20-30 segundos. El frontend debe actualizarse automáticamente.

```
GET /api/channels/whatsapp/stream
→ Server-Sent Events stream
→ Eventos: { type: 'qr', data: 'data:image/png;base64,...' }
             { type: 'connected', data: { phone: '+573001234567' } }
             { type: 'disconnected', data: {} }
```

**3.1.3 Conversación real end-to-end:**

Cuando alguien le escribe al número de WhatsApp conectado:
1. Evolution API → webhook → `evolution.webhook.ts`
2. Handler → findOrCreate customer + conversation
3. Guarda mensaje inbound
4. Invoca `aiEngine.process()`
5. AI genera respuesta
6. `channelManager.sendMessage()` → Evolution API → WhatsApp del cliente
7. Guarda mensaje outbound
8. SSE notifica al dashboard → inbox se actualiza en tiempo real

---

### 3.2 Instagram: Conectar la UI

Los drivers existen en backend. El frontend dice "Próximamente". Hay que conectar la UI.

**Modal de conexión Instagram:**
```
┌─────────────────────────────────────┐
│ Conectar Instagram                  │
│                                     │
│ Usuario: [__________________]        │
│ Contraseña: [________________]      │
│                                     │
│ [Conectar] [Cancelar]               │
│                                     │
│ ⚠️ Usa una cuenta secundaria.       │
│ No uses tu cuenta principal.        │
└─────────────────────────────────────┘
```

Endpoint: `POST /api/channels/instagram/connect` — ya existe en backend.

---

### 3.3 Facebook: Conectar la UI

```
┌─────────────────────────────────────┐
│ Conectar Facebook Messenger         │
│                                     │
│ App State (cookies JSON):           │
│ [textarea para pegar el JSON]       │
│                                     │
│ 📖 Cómo obtener el App State:      │
│ [Ver instrucciones]                 │
│                                     │
│ [Conectar] [Cancelar]               │
└─────────────────────────────────────┘
```

---

### 3.4 Inbox — UI completa del monitor de conversaciones

El inbox NO es donde el humano atiende. Es donde MONITOREA lo que la IA está haciendo.

```
LAYOUT DEL INBOX:
┌──────────────┬─────────────────────┬─────────────────┐
│ LISTA CONVS  │  THREAD MENSAJES    │  INFO CLIENTE   │
│              │                     │                 │
│ [Filtros]    │  Juan García        │  👤 Juan García │
│ Canal: Todos │  📱 WhatsApp        │  📞 +5730012... │
│ Estado: Todo │  ─────────────────  │  📊 3 pedidos   │
│ IA: Activa   │  Juan: hola         │  🎂 2 citas     │
│              │  🤖 ¡Hola Juan!...  │                 │
│ ▶ Juan G.    │  Juan: quiero pizza │  [Ver perfil]   │
│   🤖 IA      │  🤖 Claro que sí...│                 │
│   hace 2min  │                     │  ESTADO IA:     │
│              │  ─────────────────  │  🟢 IA Activa   │
│ ▶ María L.   │  [Enviar mensaje]   │  [Tomar control]│
│   👤 Agente  │                     │                 │
│   hace 5min  │  ────────────────── │  ACCIONES:      │
│              │  [Toggle IA/Agente] │  [Cerrar conv]  │
└──────────────┴─────────────────────┴─────────────────┘
```

**Toggle "IA Activa / Tomar Control":**
- IA Activa (verde 🟢): la IA responde automáticamente
- Tomando control (naranja 🟠): el agente escribe, la IA está pausada
- Al tomar control: `PATCH /api/conversations/:id/state` → `{ state: 'AGENTE_HUMANO', assignedUserId: me }`
- Al devolver a IA: `PATCH /api/conversations/:id/state` → `{ state: 'IA_ACTIVA' }`

**Tiempo real con SSE:**
```javascript
// Frontend conecta al stream del tenant
const eventSource = new EventSource('/api/conversations/stream', {
  headers: { Authorization: `Bearer ${token}` }
});

eventSource.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'message:new') updateConversation(data.conversationId, data.message);
  if (type === 'conversation:new') addToInbox(data);
};
```

---

### CHECKPOINT SPRINT 3

```bash
# 1. WhatsApp conecta
# - Abrir /dashboard/channels
# - Click "Conectar WhatsApp"
# - QR aparece y se actualiza cada 30s
# - Escanear con WhatsApp real → "✅ Conectado"

# 2. Mensaje real llega y AI responde
# - Enviar "hola" al número conectado desde otro WhatsApp
# - En /dashboard/inbox debe aparecer la conversación
# - El cliente recibe respuesta de la IA en WhatsApp

# 3. Tomar control funciona
# - En inbox, togglear a "Tomando control"
# - Escribir mensaje → se envía como agente (sin IA)
# - Devolver a IA → IA retoma el control

# 4. Historial de mensajes visible
curl http://localhost:3001/api/conversations \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].id' 
# Luego:
curl http://localhost:3001/api/conversations/{ID}/messages \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'
# Esperado: los mensajes del flujo real
```

---

## SPRINT 4: DASHBOARD — VENTANAS DE MONITOREO
**Duración estimada: 3-4 días | Prioridad: ALTA**

El dashboard no es donde se trabaja. Es donde se MONITOREA lo que la IA ya hizo.
Cada sección es una ventana sobre los datos que la IA fue creando.

### 4.1 Dashboard Principal — KPIs reales

**Datos reales desde la DB:**

```typescript
// GET /api/analytics/dashboard
// Retorna KPIs del día (o período seleccionado):
{
  conversationsToday: 47,          // conversations creadas hoy
  aiHandledPct: 94,                // % que la IA manejó sin escalamiento
  ordersToday: 12,                 // orders creados hoy
  revenueToday: 340000,            // suma de payments APPROVED hoy
  appointmentsToday: 8,            // citas creadas hoy
  pendingOrders: 3,                // orders que necesitan prepararse
  channelBreakdown: {              // por canal
    whatsapp: 38, instagram: 7, facebook: 2
  }
}
```

**UI del dashboard:**
```
┌─────────────────────────────────────────────────────────┐
│ Buenos días, Glamour Nails 🌟         [Hoy ▼]           │
├──────────┬──────────┬──────────┬────────────────────────┤
│ 47 conv  │ 94% IA   │ $340K    │ 12 pedidos             │
│ hoy      │ autom.   │ ventas   │ creados hoy            │
├──────────┴──────────┴──────────┴────────────────────────┤
│ CONVERSACIONES POR HORA           VENTAS POR CANAL      │
│ [gráfico de línea]                [gráfico de dona]     │
├─────────────────────────────────────────────────────────┤
│ PEDIDOS PENDIENTES DE ATENCIÓN                          │
│ #7823 Juan García — Choriburguer — $18.000 — Pagado ✅  │
│ #7824 María López — Pizza — $25.000 — Pagado ✅         │
│ #7825 Carlos R. — Hamburguesa — $15.000 — Efectivo 💵   │
└─────────────────────────────────────────────────────────┘
```

---

### 4.2 Pedidos — Centro de operaciones

Los pedidos los crea la IA. El humano solo actualiza el estado.

```
LISTA DE PEDIDOS:
┌──────┬────────────────┬──────────┬──────────┬──────────┬───────────┐
│ #    │ Cliente        │ Total    │ Pago     │ Estado   │ Acción    │
├──────┼────────────────┼──────────┼──────────┼──────────┼───────────┤
│ 7823 │ Juan García    │ $18.000  │ ✅ Pagado│ Pedido   │[Preparar] │
│ 7824 │ María López    │ $25.000  │ ✅ Pagado│ En prep. │[Listo]    │
│ 7825 │ Carlos R.      │ $15.000  │ 💵 Efect │ Pedido   │[Preparar] │
└──────┴────────────────┴──────────┴──────────┴──────────┴───────────┘

Click en un pedido → Ver detalle:
┌───────────────────────────────┐
│ Pedido #7823                  │
│ Juan García • +573001234567   │
│                               │
│ Items:                        │
│ • Choriburguer Especial       │
│   Sin cebolla, + huevo extra  │
│   $14.000                     │
│ • Gaseosa 500ml naranja       │
│   $4.000                      │
│                               │
│ Subtotal: $18.000             │
│ Pago: Wompi — Nequi ✅ PAGADO │
│                               │
│ 📍 Carrera 25 #45-67, apto 302│
│ 📞 3123544994                 │
│                               │
│ [En preparación] [Enviado]    │
│ [Cancelar] [Ver conversación] │
└───────────────────────────────┘
```

**Estados del pedido:**
`pending` → `confirmed` → `preparing` → `shipped` → `delivered`

El humano avanza el estado. La IA notifica al cliente en cada cambio:
- "En preparación": "🔥 ¡Tu pedido #7823 está siendo preparado!"
- "Enviado": "🛵 Tu domiciliario está en camino. Aprox. 30-40 min"
- "Entregado": "✅ ¡Tu pedido ha llegado! ¿Cómo estuvo? (1-5 ⭐)"

---

### 4.2b Impresión POS automática — para toda operación generada

**Aplica a:** Pedidos (restaurantes, tiendas, ferreterías, papelerías, cualquier negocio con `cart_orders`), Citas (salones, médicos), Reservas (restaurantes con mesas), Cotizaciones, Domicilios.

Cuando la IA crea un pedido/cita/reserva, el ticket llega automáticamente a la impresora de cocina/bodega/punto de atención. El personal humano solo recoge el papel y procesa.

#### Arquitectura de impresión (dos opciones):

**Opción A — QZ Tray (recomendada para impresoras térmicas POS):**

QZ Tray es una aplicación gratuita y open-source que corre en segundo plano en el computador de cocina/bodega. Se comunica con el dashboard vía WebSocket y ejecuta impresiones sin diálogos ni clics.

```
Flujo automático:
1. IA crea pedido → SSE notifica al dashboard
2. Dashboard detecta nuevo pedido (event: 'order:new')
3. Dashboard verifica conexión con QZ Tray (WebSocket local :8181)
4. Si QZ Tray disponible → envía ticket en formato ESC/POS directamente
5. Impresora térmica imprime AUTOMÁTICAMENTE sin que nadie haga clic

Instalación en la cocina/bodega:
1. Descargar QZ Tray (qz.io — gratis, Windows/Mac/Linux)
2. Instalar → corre en segundo plano como servicio
3. En el dashboard: Configuración → Impresión → [Conectar impresora]
4. Seleccionar impresora de la lista
5. Listo — desde ese momento cada pedido nuevo se imprime solo
```

**Opción B — Impresión por navegador (para cualquier impresora):**

Para negocios que no tienen impresora térmica o no quieren instalar software adicional:
```
1. Nuevo pedido llega al dashboard vía SSE
2. Aparece notificación con botón "🖨️ Imprimir"
3. Click → se abre ventana de impresión del navegador con ticket formateado
4. Se puede imprimir en cualquier impresora conectada al computador
```

#### Configuración en el dashboard:

```
CONFIGURACIÓN → IMPRESIÓN POS:
┌────────────────────────────────────────────────────────┐
│ IMPRESIÓN AUTOMÁTICA                                   │
│                                                        │
│ Método: ◉ QZ Tray (automático)  ○ Navegador (manual) │
│                                                        │
│ Estado QZ Tray: ✅ Conectado (Puerto 8181)             │
│                                                        │
│ Impresoras disponibles:                                │
│ ◉ EPSON TM-T20III (USB)     — Cocina                 │
│ ○ Star TSP143III (Red)      — Caja                    │
│                                                        │
│ Imprimir automáticamente cuando:                       │
│ ☑ Nuevo pedido confirmado (pago recibido)             │
│ ☑ Nuevo pedido con pago contraentrega                 │
│ ☑ Nueva cita agendada                                 │
│ ☑ Nueva reserva confirmada                            │
│ ☐ Nueva cotización generada                           │
│                                                        │
│ [Imprimir ticket de prueba]                            │
└────────────────────────────────────────────────────────┘
```

#### Formato del ticket impreso (ESC/POS):

```
================================
     BURGER PALACE 🍔
  Tel: +573001234567
================================
PEDIDO #7823
Fecha: 19/05/2026  11:34 AM
--------------------------------
Canal: WhatsApp
Cliente: Juan García
Tel: +573001234567
--------------------------------
ITEMS:
1x Choriburguer Especial
   Sin cebolla
   + Huevo frito extra       $14.000
1x Gaseosa 500ml naranja      $4.000
--------------------------------
SUBTOTAL:                   $18.000
ENVÍO:                       GRATIS
TOTAL:                      $18.000
--------------------------------
PAGO: NEQUI ✅ CONFIRMADO
--------------------------------
ENTREGA A DOMICILIO:
Carrera 25 #45-67, Apto 302
Tel domicilio: 3123544994
================================
  ¡Gracias por su pedido!
================================
[cortar papel]
```

#### Implementación técnica:

**Backend — endpoint de impresión:**
```
GET /api/orders/:id/ticket
→ Genera ticket en formato:
  - HTML (para impresión en navegador con @media print)
  - ESC/POS raw bytes (para QZ Tray / impresora térmica directa)
  - PDF (para guardar o enviar)

Query param: ?format=html|escpos|pdf
```

**Frontend — cliente QZ Tray:**
```typescript
// apps/web/src/lib/printer.ts
import qz from 'qz-tray'; // npm: qz-tray

export class PossPrinter {
  async connect(): Promise<boolean>
  async getPrinters(): Promise<string[]>
  async print(printerName: string, escposData: number[]): Promise<void>
  isConnected(): boolean
}

// En el inbox/dashboard, cuando llega SSE 'order:new':
sseClient.on('order:new', async (data) => {
  const printerConfig = await getPrinterConfig(); // de tenant_config
  if (printerConfig.autoprint && printer.isConnected()) {
    const ticket = await api.get(`/orders/${data.orderId}/ticket?format=escpos`);
    await printer.print(printerConfig.printerName, ticket.data);
  }
  // Siempre mostrar notificación con botón manual como fallback
  showNotification({ orderId: data.orderId, allowManualPrint: true });
});
```

**Nota:** La generación de ESC/POS usa la librería `escpos` (npm: escpos-buffer) que permite formatear tickets con bold, corte de papel, etc.

---

### 4.3 Citas — Calendario de lo que la IA agendó

```
VISTA SEMANA:
       Lun 18  Mar 19  Mié 20  Jue 21  Vie 22
9:00   [Manicure: Ana]
10:00          [Pedicure: Pedro]
11:00                  [Manicure: Sofía]
...

LISTA DEL DÍA:
09:00 Manicure — Ana García (+57300...)  [Ver] [Cancelar] [Notificar]
10:30 Pedicure — Pedro López            [Ver] [Cancelar] [Notificar]
14:00 Manicure + Pedicure — Laura R.    [Ver] [Cancelar] [Notificar]

Cada cita tiene:
- Botón "Notificar" → envía recordatorio por WhatsApp
- Botón "Ver conversación" → abre el inbox en la conversación de esa cita
- Estado: confirmada / cancelada / completada / no_show
```

---

### 4.4 Catálogo — El menú que la IA conoce

Esta es la sección MÁS IMPORTANTE de la configuración. Todo lo que esté en el catálogo, la IA lo sabe y puede venderlo. Lo que no esté, la IA no lo ofrece.

**Estructura del catálogo:**
```
CATEGORÍAS:
├── Hamburguesas
│   ├── Choriburguer Sencilla — $10.000
│   ├── Choriburguer Especial — $13.000 [★ Más vendida]
│   └── Choriburguer Doble — $14.000
├── Bebidas
│   ├── Gaseosa 350ml — $3.500
│   └── Gaseosa 500ml — $4.000
└── Adicionales
    ├── Huevo frito extra — $1.000
    └── Porción de queso — $1.000

[+ Nueva Categoría] [+ Nuevo Producto]
```

**Crear categoría:** (faltaba en el código anterior)
- Nombre + orden de presentación
- Categoría padre (para subcategorías)

**Crear producto:**
- Nombre, descripción, precio, categoría
- Tipo: producto | servicio
- Si es servicio: duración en minutos
- Si tiene variantes (tallas, colores): definirlas
- Fotos (URLs)
- Estado: activo / inactivo

**Importante:** Cuando el dueño actualiza el catálogo, el cache de Redis de tenant_config se invalida y la IA inmediatamente empieza a ofrecer los nuevos productos.

---

### 4.5 Clientes — Perfiles automáticos

Los clientes se crean automáticamente cuando la IA tiene una primera conversación. El humano puede enriquecer el perfil.

```
LISTA DE CLIENTES:
┌────────────────┬─────────────┬──────────┬──────────────┬──────────┐
│ Nombre         │ Canal       │ Pedidos  │ Última conv. │ Acciones │
├────────────────┼─────────────┼──────────┼──────────────┼──────────┤
│ Juan García    │ 📱 WhatsApp │ 3 ($54k) │ hace 2h      │[Ver]     │
│ María López    │ 📸 Instagram│ 1 ($25k) │ ayer         │[Ver]     │
└────────────────┴─────────────┴──────────┴──────────────┴──────────┘

PERFIL DE CLIENTE:
┌─────────────────────────────────────────────────────────┐
│ 👤 Juan García                                          │
│ 📞 +573001234567 • 📱 WhatsApp                         │
│ 📍 Carrera 25 #45-67, apto 302                         │
│ Desde: 15 Mayo 2026                                     │
├─────────────────────────────────────────────────────────┤
│ HISTORIAL                                               │
│ 📦 Pedido #7823 — $18.000 — Entregado — 19 May          │
│ 📦 Pedido #7801 — $12.000 — Entregado — 15 May          │
│ 📅 Cita — Manicure — 20 May 10:00                      │
├─────────────────────────────────────────────────────────┤
│ CONVERSACIONES (3)                                      │
│ [📱 WhatsApp — hace 2h] [📱 WhatsApp — ayer]           │
├─────────────────────────────────────────────────────────┤
│ VALOR TOTAL: $30.000 | PEDIDOS: 2 | CITAS: 1           │
└─────────────────────────────────────────────────────────┘
```

---

### 4.6 Cotizaciones

Las cotizaciones las puede crear la IA (acción COTIZAR) o el humano manualmente.

```
LISTA COTIZACIONES:
┌──────┬──────────────┬──────────┬──────────┬──────────────┐
│ #    │ Cliente      │ Total    │ Estado   │ Vence        │
├──────┼──────────────┼──────────┼──────────┼──────────────┤
│ C001 │ Empresa XYZ  │ $500.000 │ Enviada  │ 26 May       │
│ C002 │ Juan García  │ $120.000 │ Aceptada │ —            │
└──────┴──────────────┴──────────┴──────────┴──────────────┘

[+ Crear cotización manual]
```

Crear cotización manual: seleccionar cliente, agregar items con precios, fecha de vencimiento. Genera PDF descargable y se puede enviar al cliente por WhatsApp directamente.

---

### 4.7 Reservas

Para negocios con mesas, habitaciones, espacios:

```
VISTA DISPONIBILIDAD:
Hoy — 19 Mayo 2026

Mesa 1: ✅ Libre | 🔴 12:00-14:00 (3 personas) | ✅ Libre
Mesa 2: ✅ Libre | ✅ Libre                     | 🔴 19:00-21:00 (6 personas)
Mesa 3: 🔴 12:00-15:00 (2 personas) | ✅ Libre  | ✅ Libre

[+ Nueva reserva manual]
```

---

### 4.8 Domicilios

Los domicilios se crean automáticamente cuando un pedido se confirma con dirección.

```
DOMICILIOS ACTIVOS:
┌─────┬──────────────┬────────────────────────┬─────────────┬──────────┐
│ #   │ Cliente      │ Dirección              │ Estado      │ Acción   │
├─────┼──────────────┼────────────────────────┼─────────────┼──────────┤
│ 7823│ Juan García  │ Cra 25 #45-67, apt 302 │ En camino   │[Entregado]│
│ 7820│ Laura R.     │ Calle 80 #12-34        │ Preparando  │[Despachar]│
└─────┴──────────────┴────────────────────────┴─────────────┴──────────┘
```

---

### 4.9 Kanban — Pipeline visual

El Kanban es un tablero visual donde cada columna representa una etapa del proceso de venta. Las conversaciones se mueven automáticamente o el agente las mueve manualmente.

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ NUEVO        │ EN PROCESO   │ COTIZADO     │ CERRADO      │
│ (3)          │ (2)          │ (1)          │ (5)          │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │
│ │Juan G.   │ │ │María L.  │ │ │Emp. XYZ  │ │ │Carlos R. │ │
│ │WhatsApp  │ │ │Instagram │ │ │WhatsApp  │ │ │WhatsApp  │ │
│ │$18.000   │ │ │$45.000   │ │ │$500.000  │ │ │✅ Cerrado│ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Las conversaciones entran automáticamente en "Nuevo" cuando llega el primer mensaje. La IA las mueve a "En Proceso" cuando hay acción. El agente las mueve a "Cerrado" cuando se concretó la venta.

---

### 4.10 Equipo y Departamentos

**Departamentos:** divisiones del negocio que la IA puede usar para enrutar conversaciones.

Ejemplo de configuración para un restaurante con delivery:
- Departamento "Pedidos": recibe y procesa órdenes
- Departamento "Domicilios": rastrea entregas
- Departamento "Soporte": quejas y reclamaciones

La IA puede transferir a un departamento: `{"accion":"ESCALAMIENTO","departamento":"Soporte","motivo":"queja cliente"}`

**Equipo (Agentes):** Usuarios que pueden:
- Ver el inbox y monitorear conversaciones
- Tomar control de conversaciones de la IA
- Crear pedidos/citas manuales
- Responder en nombre del negocio

```
AGENTES:
┌────────────────┬──────────────┬──────────┬──────────────┐
│ Nombre         │ Rol          │ Estado   │ Conversaciones│
├────────────────┼──────────────┼──────────┼──────────────┤
│ Ana Martínez   │ Agente       │ 🟢 Disp. │ 2 activas    │
│ Pedro López    │ Administrador│ 🟡 Ocup. │ 5 activas    │
│ Sofia Ramírez  │ Agente       │ 🔴 Fuera │ 0 activas    │
└────────────────┴──────────────┴──────────┴──────────────┘
```

---

### 4.11 Campañas — IA como vendedor proactivo

Inspirado en el sistema de campañas de Whaticket, llevado al nivel siguiente.

#### ¿Qué puede hacer una campaña?

- Envío masivo a **listas de contactos** (CSV/XLS importado)
- Envío masivo a **grupos de WhatsApp** (misma UI, diferente destino)
- Hasta **5 variantes de mensaje** por campaña (rotación aleatoria = evita bloqueos de WhatsApp)
- **Variables dinámicas** desde las columnas del CSV: `{{nombre}}`, `{{saldo}}`, `{{apellido}}`, `{{cualquier_columna}}`
- **Archivos adjuntos**: lista de imágenes/PDFs (una se envía aleatoriamente por envío)
- **Modo confirmación**: primero envía un mensaje de confirmación, solo despacha el contenido si el contacto responde SÍ
- **Programación**: ahora / fecha y hora específica / recurrente (diario, semanal, mensual)
- **Cancelar y reiniciar** envíos en progreso
- Cuando el cliente responde → la IA retoma automáticamente

#### Estados de una campaña (patrón Whaticket):
```
INACTIVA → PROGRAMADA → EN_PROGRESO → FINALIZADA
                                    ↘ CANCELADA
```

#### UI de creación — paso a paso:

```
PASO 1: INFORMACIÓN BÁSICA
┌────────────────────────────────────────────────────────┐
│ Nombre: [Promo Choriburguer Mayo________________]       │
│                                                        │
│ Destino:                                               │
│ ◉ Lista de contactos  ○ Grupos de WhatsApp            │
│                                                        │
│ Lista: [Clientes VIP (45 contactos) ▼]                 │
│   o [+ Crear nueva lista] [Importar CSV/XLS]           │
│                                                        │
│ Canal WhatsApp: [+573001234567 ▼]                      │
└────────────────────────────────────────────────────────┘

PASO 2: MENSAJES (hasta 5 variantes — se envían en rotación)
┌────────────────────────────────────────────────────────┐
│ Mensaje 1: (activo ✅)                                  │
│ ┌──────────────────────────────────────────────────┐   │
│ │Hola {{nombre}}! 🎉 Oferta especial hoy:          │   │
│ │Choriburguer Especial $11.000 (antes $13.000)     │   │
│ │¿Quieres pedir? Escribe "quiero" 😊               │   │
│ └──────────────────────────────────────────────────┘   │
│ Variables detectadas: {{nombre}} ✅                    │
│                                                        │
│ Mensaje 2: (activo ✅)                                  │
│ ┌──────────────────────────────────────────────────┐   │
│ │{{nombre}}, ¡hoy tenemos promo! 🍔               │   │
│ │Choriburguer Esp a $11.000. ¿Te mandamos uno? 🛵  │   │
│ └──────────────────────────────────────────────────┘   │
│                                                        │
│ Mensaje 3: (inactivo ⬜) [activar]                     │
│ [+ Agregar variante]                                   │
└────────────────────────────────────────────────────────┘

PASO 3: ARCHIVO ADJUNTO (opcional)
┌────────────────────────────────────────────────────────┐
│ ☐ Adjuntar imagen o PDF                               │
│                                                        │
│ Lista de archivos: [Fotos Hamburguesas ▼]             │
│   (uno se envía aleatoriamente con cada mensaje)       │
│                                                        │
│ [Crear lista de archivos]                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ │ foto1.jpg│ │ foto2.jpg│ │ promo.pdf│  [+ Subir]     │
│ └──────────┘ └──────────┘ └──────────┘               │
└────────────────────────────────────────────────────────┘

PASO 4: MODO CONFIRMACIÓN (opcional)
┌────────────────────────────────────────────────────────┐
│ ☐ Pedir confirmación antes de enviar el contenido      │
│                                                        │
│ Si activo, primero envía:                              │
│ "Hola {{nombre}}, ¿quieres recibir nuestra promo       │
│  de hoy? Responde SI o NO"                             │
│                                                        │
│ Solo envía el mensaje principal si responde SI         │
└────────────────────────────────────────────────────────┘

PASO 5: PROGRAMACIÓN
┌────────────────────────────────────────────────────────┐
│ ◉ Enviar ahora                                         │
│ ○ Programar para: [2026-05-25] [10:00 AM]             │
│ ○ Recurrente: [Cada lunes ▼] a las [09:00]            │
│                                                        │
│ [Vista previa del mensaje] [Programar campaña]         │
└────────────────────────────────────────────────────────┘
```

#### Vista previa del mensaje:

Antes de enviar, el sistema muestra cómo quedará el mensaje con datos reales de un contacto de la lista:

```
VISTA PREVIA — contacto: Juan García (+573001234567)
─────────────────────────────────────────────────
"Hola Juan! 🎉 Oferta especial hoy:
Choriburguer Especial $11.000 (antes $13.000)
¿Quieres pedir? Escribe 'quiero' 😊"
[Imagen: foto2.jpg]
─────────────────────────────────────────────────
```

#### Seguimiento de la campaña:

```
CAMPAÑA: Promo Choriburguer Mayo
Estado: EN_PROGRESO  ████████████░░░░ 78% (35/45)

┌──────────┬───────────┬───────────┬──────────┐
│ Total    │ Enviados  │ Entregados│ Fallidos │
│ 45       │ 35        │ 30        │ 2        │
└──────────┴───────────┴───────────┴──────────┘

LOGS POR CONTACTO:
Juan García    +573001234567  ✅ Entregado  hace 2min
María López    +573009876543  ✅ Leído      hace 3min
Carlos Ruiz    +573005551234  ❌ Fallido    hace 5min  [ver error]
...

[Cancelar campaña] [Exportar logs CSV]
```

#### Motor de envío (BullMQ campaign-sender.job.ts):

```typescript
// Reglas de envío:
// - Max 30 mensajes/minuto por instancia WhatsApp (evitar baneo)
// - Intervalo aleatorio entre mensajes: 2-8 segundos (más humano)
// - Rotación de mensajes: campaignMessages[Math.floor(Math.random() * activeMessages.length)]
// - Rotación de archivos: fileOptions[Math.floor(Math.random() * fileOptions.length)]
// - Resolución de variables: message.replace(/{{(\w+)}}/g, (_, key) => contact.variables[key] || contact[key] || '')
// - Si falla: reintento máximo 3 veces, luego marcar como 'failed'
// - Si confirmación activa: enviar mensaje de confirmación, pausar job, reanudar si recibe 'SI'
```

---

### 4.12 Contactos — Base de datos para campañas con variables dinámicas

Esta es la pieza más importante de las campañas. Las listas soportan **variables completamente dinámicas** — cualquier columna del CSV/XLS se convierte en una variable usable en los mensajes.

#### Regla de columnas en CSV/XLS:

```
REGLA DE ORO:
- La primera columna SIEMPRE es el número de teléfono
- Puede llamarse: "telefono", "celular", "phone", "numero", "número"
- Todas las demás columnas son variables DINÁMICAS
- Los nombres de las columnas SON el nombre de la variable: {{nombre_columna}}

EJEMPLO — archivo "clientes_mayo.csv":
┌──────────────┬───────────┬──────────────┬─────────────┬──────────┐
│ telefono     │ nombre    │ apellido     │ ciudad      │ saldo    │
├──────────────┼───────────┼──────────────┼─────────────┼──────────┤
│ 3001234567   │ Juan      │ García       │ Bogotá      │ 45000    │
│ 3009876543   │ María     │ López        │ Medellín    │ 12000    │
│ 3005551234   │ Carlos    │ Ramírez      │ Cali        │ 78500    │
└──────────────┴───────────┴──────────────┴─────────────┴──────────┘

Variables disponibles en el mensaje:
{{nombre}} → Juan / María / Carlos
{{apellido}} → García / López / Ramírez
{{ciudad}} → Bogotá / Medellín / Cali
{{saldo}} → 45000 / 12000 / 78500

OTRO EJEMPLO — cobranzas "deudores.xls":
┌──────────────┬──────────────┬─────────────────┬───────────────┐
│ celular      │ cliente      │ deuda           │ fecha_vence   │
├──────────────┼──────────────┼─────────────────┼───────────────┤
│ 3001234567   │ Empresa ABC  │ $1.500.000      │ 25/05/2026    │
└──────────────┴──────────────┴─────────────────┴───────────────┘

Mensaje: "Estimado {{cliente}}, recuerde que tiene una deuda 
de {{deuda}} con vencimiento el {{fecha_vence}}"
```

#### Formatos soportados:

| Formato | Extensión | Librería |
|---------|-----------|---------|
| CSV (UTF-8, Latin-1) | .csv | papaparse |
| Excel moderno | .xlsx | xlsx (SheetJS) |
| Excel clásico | .xls | xlsx (SheetJS) |

**Detección de encoding automática:** Si el CSV viene en Latin-1 (común en archivos colombianos de Excel "Guardar como CSV"), el sistema lo detecta y convierte a UTF-8.

#### UI de importación:

```
IMPORTAR CONTACTOS A LISTA
┌────────────────────────────────────────────────────────┐
│ [Arrastrar archivo aquí o hacer clic para seleccionar] │
│ Formatos: CSV, XLS, XLSX                              │
│ Máximo: 50.000 contactos por archivo                  │
└────────────────────────────────────────────────────────┘

Una vez cargado el archivo:
┌────────────────────────────────────────────────────────┐
│ VISTA PREVIA — clientes_mayo.csv (3 filas, 5 columnas) │
│                                                        │
│ Columna teléfono detectada: ✅ "telefono"              │
│                                                        │
│ Variables disponibles para mensajes:                   │
│ {{nombre}} {{apellido}} {{ciudad}} {{saldo}}           │
│                                                        │
│ ┌──────────┬────────┬─────────┬────────┬──────────┐   │
│ │telefono  │nombre  │apellido │ciudad  │saldo     │   │
│ ├──────────┼────────┼─────────┼────────┼──────────┤   │
│ │3001234567│Juan    │García   │Bogotá  │45000     │   │
│ │3009876543│María   │López    │Medellín│12000     │   │
│ └──────────┴────────┴─────────┴────────┴──────────┘   │
│                                                        │
│ Agregar a lista: [Clientes VIP ▼] [+ Nueva lista]     │
│ ☐ Reemplazar lista existente                           │
│ ☑ Agregar a los existentes (evitar duplicados)        │
│                                                        │
│ [Cancelar] [Importar 3 contactos]                      │
└────────────────────────────────────────────────────────┘
```

#### Schema DB actualizado para variables dinámicas:

La tabla `contact_list_entries` ya tiene el campo `variables JSONB`:
```sql
-- Ya existe en el schema:
variables JSONB DEFAULT '{}'
-- Almacena: {"nombre":"Juan","apellido":"García","ciudad":"Bogotá","saldo":"45000"}
-- Todas las columnas del CSV (excepto el teléfono) van aquí
```

#### Resolución de variables en el campaign-sender:

```typescript
function resolveVariables(message: string, contact: ContactListEntry): string {
  return message.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    // Primero buscar en variables dinámicas del CSV
    if (contact.variables && contact.variables[key] !== undefined) {
      return String(contact.variables[key]);
    }
    // Luego en campos fijos
    if (key === 'nombre' || key === 'name') return contact.name || '';
    if (key === 'telefono' || key === 'phone') return contact.phone || '';
    // Si no existe la variable → dejar en blanco (no mostrar {{variable}})
    return '';
  });
}
```

#### Gestión de listas:

```
LISTAS DE CONTACTOS:
┌───────────────────┬──────────┬──────────────────────────┬──────────────┐
│ Lista             │Contactos │ Variables disponibles    │ Campaña      │
├───────────────────┼──────────┼──────────────────────────┼──────────────┤
│ Clientes VIP      │ 45       │ nombre, saldo, ciudad    │ Hace 5 días  │
│ Deudores Mayo     │ 128      │ cliente, deuda, vence    │ —            │
│ Prospectos 2026   │ 500      │ nombre, empresa, cargo   │ —            │
└───────────────────┴──────────┴──────────────────────────┴──────────────┘

[+ Nueva lista vacía] [Importar CSV/XLS]
```

**Endpoint de importación:**
```
POST /api/contact-lists/:listId/import
Content-Type: multipart/form-data
Body: { file: File, append: boolean }

Proceso:
1. Recibir archivo con multer
2. Detectar formato (CSV/XLS/XLSX)
3. Detectar columna de teléfono (primera columna o columna con nombre 'telefono'|'celular')
4. Detectar encoding del CSV (UTF-8 o Latin-1)
5. Parsear con papaparse (CSV) o SheetJS (XLS/XLSX)
6. Normalizar teléfonos (agregar +57 si solo 10 dígitos colombianos)
7. Insertar en contact_list_entries con variables JSONB
8. Actualizar contact_lists.contact_count
9. Retornar: { imported: N, duplicates: M, errors: K }
```

---

### 4.13 Grupos WhatsApp — Envíos masivos a grupos

Los grupos tienen **dos funciones distintas**:

1. **Gestión de grupos**: crear grupos, agregar miembros, administrar
2. **Envíos masivos a grupos**: enviar mensajes/archivos a múltiples grupos a la vez (mismo sistema que campañas pero con grupos como destino)

#### Gestión de grupos:

```
NÚMERO CONECTADO: +573001234567 (Burger Palace)    [🔄 Cargar mis grupos]

Cargando grupos desde WhatsApp...  ←  al hacer clic en "Cargar mis grupos"

GRUPOS (12 grupos encontrados):
┌───────────────────────┬──────────┬─────────┬───────────────────────┐
│ Nombre del grupo      │ Miembros │ Admin   │ Acciones              │
├───────────────────────┼──────────┼─────────┼───────────────────────┤
│ Clientes VIP 🏆       │ 45       │ ✅ Sí   │[Enviar][Miembros][⚙️]│
│ Ofertas del día 🛒    │ 234      │ ✅ Sí   │[Enviar][Miembros][⚙️]│
│ Comunidad Chapinero   │ 89       │ ❌ No   │[Enviar]               │
│ Vecinos Chapinero     │ 156      │ ❌ No   │[Enviar]               │
│ Familia García        │ 12       │ ✅ Sí   │[Enviar][Miembros][⚙️]│
│ ...                   │ ...      │ ...     │ ...                   │
└───────────────────────┴──────────┴─────────┴───────────────────────┘

Filtrar: [Todos ▼] Todos | Solo donde soy admin | Solo donde no soy admin
Buscar: [_________________________]

[+ Crear nuevo grupo]  [🔄 Recargar lista]
```

**Comportamiento de "Cargar mis grupos":**
- Al entrar a la sección por primera vez → muestra botón prominente "Cargar mis grupos"
- Al hacer clic → llama a Evolution API y trae TODOS los grupos del número conectado
- Los grupos se guardan en DB (`channel_sessions.metadata.groups`) con TTL de 1 hora
- Si hay grupos guardados en cache → los muestra directamente sin volver a llamar la API
- Botón "Recargar lista" → fuerza nueva consulta a Evolution API (ignora cache)

**¿Qué información se muestra por grupo?**
- Nombre del grupo
- Número de miembros
- Si el número conectado es administrador (puede enviar sin restricciones)
- Icono del grupo (si tiene)
- JID del grupo (ID interno de WhatsApp, ej: `120363123456789@g.us`)

**Endpoint backend:**
```
GET /api/groups
→ Retorna grupos cacheados en DB o llama Evolution API si no hay cache

POST /api/groups/sync
→ Fuerza sincronización con Evolution API
→ Llama: GET {EVOLUTION_API_URL}/group/fetchAllGroups/{instanceName}?getParticipants=true
→ Guarda resultado en DB
→ Retorna lista actualizada

GET /api/groups/:groupJid/participants
→ Lista participantes de un grupo específico
→ Llama: GET {EVOLUTION_API_URL}/group/participants/{instanceName}?groupJid={jid}
```

**Crear grupo:**
```
┌─────────────────────────────────────────────┐
│ Crear grupo WhatsApp                        │
│                                             │
│ Nombre: [_______________________________]   │
│                                             │
│ Participantes iniciales:                    │
│ [+57300...] [+ Agregar]                    │
│ 3001234567 ✅  3009876543 ✅                │
│                                             │
│ [Crear grupo]                               │
└─────────────────────────────────────────────┘
```

#### Envío masivo a grupos (misma lógica que campañas):

```
ENVÍO A GRUPOS:
┌────────────────────────────────────────────────────────┐
│ Nombre: [Promo del día — grupos]                       │
│                                                        │
│ Destino: ○ Lista de contactos  ◉ Grupos de WhatsApp   │
│                                                        │
│ Seleccionar grupos:                                    │
│ ☑ Clientes VIP (45 miembros)                          │
│ ☑ Ofertas del día (234 miembros)                      │
│ ☐ Comunidad Chapinero (89 miembros)                   │
│                                                        │
│ Total de grupos seleccionados: 2                       │
│                                                        │
│ Mensaje:                                               │
│ ┌────────────────────────────────────────────────────┐ │
│ │🎉 Oferta de hoy: Choriburguer $11.000              │ │
│ │¿Quieres pedir? Escríbenos directamente 🛵           │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ Nota: Para grupos NO se usan variables {{nombre}}      │
│ ya que el mensaje va al grupo, no a cada miembro.     │
│                                                        │
│ Adjuntar: [foto_oferta.jpg ✅] [+ Cambiar]            │
│                                                        │
│ [Enviar ahora] [Programar]                            │
└────────────────────────────────────────────────────────┘
```

**Diferencia clave entre campañas y grupos:**
- **Campañas**: 1 mensaje por contacto individual → variables `{{nombre}}` funcionan
- **Grupos**: 1 mensaje al grupo → sin variables individuales, el mensaje es para todos

**Endpoint de grupos (Evolution API):**
```typescript
// Listar grupos del número conectado
GET /group/fetchAllGroups/{instanceName}?getParticipants=true

// Enviar mensaje a grupo
POST /message/sendText/{instanceName}
{ "number": "120363123456789@g.us", "text": "..." }

// Crear grupo
POST /group/create/{instanceName}
{ "subject": "Clientes VIP", "participants": ["573001234567"] }

// Agregar participante
PUT /group/updateParticipant/{instanceName}
{ "groupJid": "...", "action": "add", "participants": ["573001234567"] }
```

---

### 4.14 Configuración de IA

Esta es la sección más poderosa. Aquí el dueño configura su vendedor IA.

```
CONFIGURACIÓN DEL AGENTE:
┌─────────────────────────────────────────────────────────┐
│ IDENTIDAD                                               │
│ Nombre del agente: [Luna_________________________]      │
│ Tono: [Amigable ▼] Formal | Amigable | Juvenil | Pro  │
│ Idioma: [Español colombiano ▼]                         │
│                                                         │
│ MODELO DE IA                                           │
│ Proveedor: [OpenAI ▼] OpenAI | Groq | Anthropic        │
│ Modelo: [gpt-4o-mini ▼]                                │
│ API Key: [sk-...________________] [Probar conexión]    │
│                                                         │
│ COMPORTAMIENTO                                          │
│ Max citas por cliente: [5]                             │
│ Días máximo de adelanto: [30]                          │
│ Horario de atención automática: Lun-Vie 8am-8pm        │
│ Mensaje fuera de horario: [Si]                         │
│ "Estamos cerrados, te respondemos..."                  │
└─────────────────────────────────────────────────────────┘

KNOWLEDGE BASE — Lo que la IA puede responder:
┌─────────────────────────────────────────────────────────┐
│ + Agregar conocimiento                                  │
│                                                         │
│ ❓ ¿Aceptan tarjeta?                                    │
│    ✅ Sí, procesamos pagos con Wompi: Nequi, Daviplata, tarjetas y más [Editar]    │
│                                                         │
│ ❓ ¿Hacen domicilios?                                   │
│    ✅ Sí, gratis en pedidos > $30.000      [Editar]    │
│                                                         │
│ ❓ ¿Cuál es la dirección?                               │
│    ✅ Calle 50 #30-20, Chapinero           [Editar]    │
└─────────────────────────────────────────────────────────┘

PREGUNTAS SIN RESPONDER (la IA no supo qué decir):
┌─────────────────────────────────────────────────────────┐
│ "¿Tienen opción sin gluten?" — 3 veces preguntado      │
│ [Agregar respuesta] [Ignorar]                           │
│                                                         │
│ "¿Cuánto cuesta el domicilio a Soacha?" — 1 vez        │
│ [Agregar respuesta] [Ignorar]                           │
└─────────────────────────────────────────────────────────┘

PROBAR AGENTE:
[Panel de chat para simular conversación con la IA]
```

---

### 4.15 Analíticas

```
MÉTRICAS PRINCIPALES:
[Período: Últimos 30 días ▼]

┌──────────────────────────────────────────────────────────┐
│ 📊 RESUMEN                                               │
│ Conversaciones: 1,234  │ Manejadas por IA: 94%          │
│ Ventas cerradas: 456   │ Valor promedio: $28.000         │
│ Ingresos: $12.7M       │ Tasa conversión: 37%           │
└──────────────────────────────────────────────────────────┘

CONVERSIONES POR CANAL:
WhatsApp:  385 conv → 234 ventas (61%) ████████████
Instagram: 234 conv → 89 ventas  (38%) ████████
Facebook:  45 conv → 12 ventas   (27%) ████

PRODUCTOS MÁS VENDIDOS:
1. Choriburguer Especial — 156 unidades — $2.028.000
2. Gaseosa 500ml — 134 unidades — $536.000
3. Choriburguer Sencilla — 98 unidades — $980.000

COMPORTAMIENTO DE LA IA:
Respuestas exitosas: 94%     Escalamientos: 6%
Tiempo promedio respuesta: 2.3s
Acciones ejecutadas: CREAR_PEDIDO (45%) | AGREGAR_CARRITO (28%) | CREAR_CITA (18%)
Preguntas sin respuesta: 12 (ver Knowledge Base)
```

---

### 4.16 Integraciones

```
INTEGRACIONES DISPONIBLES:

MODELOS DE IA:
┌─────────────────┬───────────────────────────────────────┐
│ OpenAI          │ ✅ Conectado | gpt-4o-mini [Cambiar] │
│ Groq            │ ⚫ No conectado [Conectar]           │
│ Anthropic       │ ⚫ No conectado [Conectar]           │
└─────────────────┴───────────────────────────────────────┘

AUTOMATIZACIÓN:
┌─────────────────┬───────────────────────────────────────┐
│ n8n             │ ⚫ No conectado [Conectar]           │
│ Typebot         │ ⚫ No conectado [Conectar]           │
└─────────────────┴───────────────────────────────────────┘

PAGOS:
┌─────────────────┬───────────────────────────────────────┐
│ Wompi           │ 🟡 Sandbox [Activar producción]      │
│ Wompi Producción│ ⚫ Requiere llaves de producción     │
└─────────────────┴───────────────────────────────────────┘
```

---

### 4.17 Configuración General del Negocio

```
TABS:
[ Mi Negocio ] [ Horarios ] [ Pagos ] [ Notificaciones ] [ Apariencia ]

TAB "MI NEGOCIO":
  Nombre del negocio: [Glamour Nails]
  Actividad económica: [Salón de belleza / Barbería ▼]
  Teléfono: [+573001234567]
  Dirección: [Cra 7 #50-20, Chapinero]
  Descripción: [Salon de belleza premium...]
  Logo: [Subir imagen]
  
TAB "HORARIOS":
  Lunes:     [08:00] - [20:00] ✅
  Martes:    [08:00] - [20:00] ✅
  Miércoles: [08:00] - [20:00] ✅
  ...
  Domingo:   ❌ Cerrado
  
  Mensaje fuera de horario:
  "¡Hola! 👋 En este momento estamos cerrados. 
   Nuestro horario es Lun-Sáb 8am-8pm.
   Te responderemos en cuanto abramos 🌟"

TAB "PAGOS":
  Wompi sandbox public key: [pub_test_...]
  Wompi sandbox private key: [prv_test_...]
  Wompi production public key: [pub_...]
  Wompi production private key: [prv_...]
  Wompi event secret: [...]
  
  [Sandbox] [Producción] ← Toggle
  
TAB "NOTIFICACIONES":
  WhatsApp del dueño: [+573009876543]
  Notificar al dueño cuando:
  ✅ Nuevo pedido
  ✅ Nuevo pago
  ✅ Cita agendada
  ✅ Escalamiento a agente
  ☐ Cada mensaje entrante

TAB "APARIENCIA":
  Tema: [Oscuro ▼] Oscuro | Claro
  Color de acento: [#6366F1]
  [Vista previa]
```

---

## SPRINT 5: SUPERADMIN COMPLETO
**Duración estimada: 2-3 días | Prioridad: MEDIA-ALTA**

### 5.1 Panel SuperAdmin — Lo que falta

El superadmin existe parcialmente. Lo que falta:

#### 5.1.1 Crear Tenant — FALTA

```
WIZARD DE CREACIÓN DE TENANT:
Paso 1: Información del negocio
  - Nombre del negocio
  - Slug (subdomain)
  - Actividad económica → auto-asigna capabilities

Paso 2: Datos del owner
  - Nombre completo
  - Email
  - Password temporal

Paso 3: Plan y configuración
  - Plan (Free / Starter / Pro)
  - Es demo? [Si] → fecha de expiración
  - Reseller? [Seleccionar ▼]

[Crear tenant] → Crea en DB + envía email de bienvenida al owner
```

**Endpoint:** `POST /api/superadmin/tenants`
```json
{
  "name": "Glamour Nails",
  "slug": "glamour-nails",
  "businessType": "salon_belleza_barberia",
  "ownerEmail": "owner@glamournails.co",
  "ownerName": "Ana Martínez",
  "ownerPassword": "TempPass123!",
  "planId": "...",
  "isDemo": false
}
```

#### 5.1.2 KPIs SaaS — Datos reales

```
MÉTRICAS SAAS (datos reales desde DB):
┌──────────┬──────────┬──────────┬──────────────────┐
│ 7        │ $350.000 │ 2        │ 94%              │
│ Tenants  │ MRR      │ Demos    │ Uptime servicio  │
└──────────┴──────────┴──────────┴──────────────────┘

ÚLTIMOS TENANTS:
┌─────────────────┬──────────┬──────────┬────────────┬──────┐
│ Nombre          │ Plan     │ Mensajes │ Estado     │      │
├─────────────────┼──────────┼──────────┼────────────┼──────┤
│ Glamour Nails   │ Pro      │ 1,234    │ ✅ Activo  │[Ver] │
│ Burger Palace   │ Starter  │ 456      │ ✅ Activo  │[Ver] │
│ Demo Restaurante│ Demo     │ 23       │ ⏳ 5 días  │[Ver] │
└─────────────────┴──────────┴──────────┴────────────┴──────┘
```

#### 5.1.3 Monitor VPS — Métricas en vivo

```
ESTADO DEL SERVIDOR:
┌──────────────────────────────────────────────────┐
│ CPU: ████████░░ 78%     RAM: ██████░░░░ 62%      │
│ Disco: ██░░░░░░░░ 23%   Red: ↑ 1.2 MB/s ↓ 0.8   │
├──────────────────────────────────────────────────┤
│ SERVICIOS:                                       │
│ ✅ PostgreSQL — Activo  | Conexiones: 12/100     │
│ ✅ Redis — Activo       | Memoria: 45MB          │
│ ✅ Evolution API — Activo | Instancias WA: 3     │
│ ✅ API — Activo         | Requests/min: 45       │
│ ✅ Web — Activo                                  │
└──────────────────────────────────────────────────┘

[Actualizar cada 10s ▼] [Ver logs]
```

Endpoint: `GET /api/superadmin/monitor/health`
- CPU/RAM: `os.cpus()` + `process.memoryUsage()`
- Disco: `df -h /` via child_process (o librería `disk-usage`)
- Servicios: health check a cada servicio (DB query, Redis ping, etc.)

#### 5.1.4 Impersonar tenant

El superadmin puede "entrar" a un tenant como si fuera el owner, para dar soporte.

```
En la lista de tenants → [Impersonar]
→ Genera un JWT temporal con el tenant_id + role=owner
→ Redirige al dashboard del tenant
→ Banner amarillo: "⚠️ Modo superadmin — Estás viendo como owner de Glamour Nails"
```

---

## SPRINT 6: CALIDAD Y PRODUCCIÓN
**Duración estimada: 2 días | Prioridad: MEDIA**

### 6.1 Recordatorios automáticos vía BullMQ

**Job: `reminder.job.ts`** — ejecuta cada hora

```typescript
// Busca citas del día siguiente
// Para cada cita → envía mensaje al cliente:
"Hola {{nombre}}! 👋 Te recordamos que mañana tienes:
📅 {{servicioNombre}}
🕐 {{hora}} en {{negocioNombre}}
¿Confirmas tu asistencia? Responde SI o NO"

// Si responde NO → cancelar cita automáticamente + notificar dueño
```

### 6.2 Demo expiry automático

**Job: `demo-expiry.job.ts`** — ya existe, verificar que funciona

```typescript
// Cada hora: busca demos con demo_expires_at < NOW()
// Para cada demo expirada:
// 1. tenant.suspended_at = NOW()
// 2. tenant.suspended_reason = 'demo_expired'
// 3. Enviar email al owner con oferta de upgrade
```

### 6.3 Rate limiting por canal

Prevenir spam en campañas y flujos de IA:

```typescript
// En channelManager.sendMessage():
// Verificar límite: max 30 mensajes/minuto por instancia WhatsApp
// Si supera → encolar en BullMQ con delay
// Log de rate limiting para analytics
```

### 6.4 Manejo de errores en la IA

```typescript
// Si OpenAI falla:
try {
  const respuestaIA = await llmClient.chat(...);
} catch (error) {
  // 1. Guardar en ai_unanswered_queries
  // 2. Enviar mensaje de fallback al cliente:
  await channelManager.sendMessage(tenantId, channel, customerPhone, {
    type: 'text',
    text: 'Tuve un problema técnico. Por favor intenta de nuevo o escribe "agente" para hablar con nosotros 🙏'
  });
  // 3. Notificar al dueño si está configurado
}
```

---

## RESUMEN EJECUTIVO DE PRIORIDADES

| Sprint | ¿Qué arregla/construye? | Sin esto, ¿qué falla? |
|--------|--------------------------|----------------------|
| 1 | Bugs críticos + mensajes + pagos | TODO |
| 2 | AI Engine completo + probado | El negocio no puede vender |
| 3 | WhatsApp real + inbox | Los clientes no pueden comunicarse |
| 4 | Dashboard de monitoreo | El dueño no puede ver nada |
| 5 | SuperAdmin completo | No se pueden vender cuentas |
| 6 | Calidad + producción | Producto inestable |

---

## REGLA INMUTABLE (nunca olvidar)

> **"SI NO SIRVE NO FUNCIONA — CORREGIR HASTA QUE FUNCIONE TODO LO QUE CAUSA PROBLEMAS,
> REALIZAR TODO HASTA CUMPLIR ESTA REGLA INMUTABLE,
> SIN CREAR FALSAS EXPECTATIVAS O CREAR FALSOS POSITIVOS"**

Cada sprint tiene un checkpoint con comandos exactos que deben pasar al 100%.
Si un comando falla, no avanzamos al siguiente sprint.
Si algo que antes funcionaba deja de funcionar, lo corregimos antes de continuar.

No hay "parcialmente funcional". Hay "funciona" o "hay que arreglarlo".

---

*Plan revisado: 2026-05-19 | Arquitectura: AI-First | Inspirado en: index.js probado en producción*

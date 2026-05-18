import type { Tenant } from '@saas/db';

type Capability = 'catalog' | 'cart_orders' | 'appointments' | 'delivery' | 'payments' | 'quotes' | 'reservations';

const CAPABILITY_ACTIONS: Record<Capability, string> = {
  catalog: `- VER_CATALOGO: Listar servicios/productos disponibles. params: {}`,
  appointments: `- VER_SLOTS: Ver horarios disponibles. params: {"servicio": string, "fecha": "YYYY-MM-DD"}
- CREAR_CITA: Crear una cita. params: {"servicio": string, "fecha_hora": "ISO8601", "duracion_minutos": number}
- VER_CITAS: Ver citas del cliente. params: {}
- CANCELAR_CITA: Cancelar una cita. params: {"cita_id": string}`,
  cart_orders: `- AGREGAR_CARRITO: Agregar producto al carrito. params: {"producto": string, "cantidad": number}
- VER_CARRITO: Ver el carrito actual. params: {}
- CREAR_PEDIDO: Confirmar y crear el pedido. params: {}
- VER_ESTADO_PEDIDO: Ver estado de un pedido. params: {"pedido_id": string}`,
  quotes: `- COTIZAR: Solicitar una cotización. params: {"descripcion": string}
- VER_COTIZACION: Ver una cotización existente. params: {"cotizacion_id": string}`,
  reservations: `- CREAR_RESERVA: Crear una reserva. params: {"fecha_hora": "ISO8601", "personas": number, "notas": string}
- VER_RESERVAS: Ver reservas del cliente. params: {}
- CANCELAR_RESERVA: Cancelar una reserva. params: {"reserva_id": string}`,
  delivery: ``,
  payments: `- ENVIAR_PAGO: Enviar link de pago Wompi. params: {"monto": number, "concepto": string}`,
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  amigable: 'Sé cálido, cercano y usa emojis con moderación.',
  profesional: 'Mantén un tono profesional y conciso.',
  formal: 'Usa lenguaje formal y respetuoso.',
  casual: 'Sé casual, relajado y usa jerga colombiana cuando sea apropiado.',
};

export function buildSystemPrompt(params: {
  tenant: Tenant;
  capabilities: string[];
  knowledgeContext: string;
  dynamicContext: string;
  currentDateTime: string;
}): string {
  const { tenant, capabilities, knowledgeContext, dynamicContext, currentDateTime } = params;

  const enabledActions = capabilities
    .map((cap) => CAPABILITY_ACTIONS[cap as Capability] ?? '')
    .filter(Boolean)
    .join('\n');

  const toneInstruction = TONE_INSTRUCTIONS[tenant.aiTone ?? 'amigable'] ?? TONE_INSTRUCTIONS['amigable']!;

  const sections: string[] = [
    `Eres ${tenant.aiAgentName ?? 'Asistente'}, el asistente de IA de ${tenant.name}. ${toneInstruction}`,
    `Responde SIEMPRE en español colombiano. Sé conciso y útil.`,
    ``,
    `FECHA Y HORA ACTUAL: ${currentDateTime} (zona horaria: America/Bogota)`,
    ``,
    `INFORMACIÓN DEL NEGOCIO:`,
    `- Nombre: ${tenant.name}`,
    tenant.description ? `- Descripción: ${tenant.description}` : '',
    tenant.phone ? `- Teléfono: ${tenant.phone}` : '',
    tenant.address ? `- Dirección: ${tenant.address}` : '',
  ];

  if (knowledgeContext) {
    sections.push('', 'BASE DE CONOCIMIENTO:', knowledgeContext);
  }

  if (dynamicContext) {
    sections.push('', 'CONTEXTO DEL CLIENTE:', dynamicContext);
  }

  if (enabledActions) {
    sections.push(
      '',
      'INSTRUCCIÓN CRÍTICA — ACCIONES:',
      'Cuando el cliente quiera realizar una acción, responde SOLO con este JSON exacto (sin texto adicional):',
      '{"accion": "NOMBRE_ACCION", "params": {...}}',
      '',
      'Acciones disponibles:',
      '- INFO_NEGOCIO: Dar información del negocio. params: {}',
      '- ESCALAMIENTO: Transferir a agente humano. params: {"motivo": string}',
      enabledActions,
    );
  }

  return sections.filter((s) => s !== undefined).join('\n');
}

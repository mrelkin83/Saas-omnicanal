import { z } from 'zod';

const actionSchema = z.object({
  accion: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});

export interface ParsedAction {
  accion: string;
  params: Record<string, unknown>;
}

export function parseAction(text: string): ParsedAction | null {
  // Try to find a JSON block in the response
  const jsonPatterns = [
    /^\s*(\{[\s\S]*\})\s*$/,           // entire response is JSON
    /```json\s*([\s\S]*?)\s*```/,      // fenced code block
    /\{[\s\S]*"accion"[\s\S]*\}/,     // JSON object containing "accion"
  ];

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const candidate = match[1] ?? match[0];
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const result = actionSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // not valid JSON, try next pattern
    }
  }

  return null;
}

export function isCapabilityAllowed(accion: string, capabilities: string[]): boolean {
  const capabilityMap: Record<string, string[]> = {
    VER_CATALOGO: ['catalog'],
    CREAR_CITA: ['appointments'],
    CANCELAR_CITA: ['appointments'],
    REAGENDAR_CITA: ['appointments'],
    VER_CITAS: ['appointments'],
    VER_SLOTS: ['appointments'],
    AGREGAR_CARRITO: ['cart_orders'],
    VER_CARRITO: ['cart_orders'],
    CREAR_PEDIDO: ['cart_orders'],
    VER_ESTADO_PEDIDO: ['cart_orders'],
    COTIZAR: ['quotes'],
    VER_COTIZACION: ['quotes'],
    CREAR_RESERVA: ['reservations'],
    CANCELAR_RESERVA: ['reservations'],
    VER_RESERVAS: ['reservations'],
    ENVIAR_PAGO: ['payments'],
    INFO_NEGOCIO: [],      // always allowed
    ESCALAMIENTO: [],      // always allowed
  };

  const required = capabilityMap[accion];
  if (required === undefined) return false; // unknown action
  if (required.length === 0) return true;   // always available
  return required.some((cap) => capabilities.includes(cap));
}

import type { Tenant } from '@saas/db';
import { isCapabilityAllowed } from './ai.action-parser.js';
import { verCatalogoProcessor } from './processors/ver-catalogo.processor.js';
import { crearCitaProcessor, verCitasProcessor } from './processors/crear-cita.processor.js';
import { verSlotsProcessor } from './processors/ver-slots.processor.js';
import { infoNegocioProcessor } from './processors/info-negocio.processor.js';
import {
  escalamientoProcessor,
  agregarCarritoProcessor,
  crearPedidoProcessor,
  cotizarProcessor,
  crearReservaProcessor,
} from './processors/stub.processor.js';

export async function routeAction(
  accion: string,
  params: Record<string, unknown>,
  tenant: Tenant,
  customerId: string,
  capabilities: string[],
): Promise<string> {
  if (!isCapabilityAllowed(accion, capabilities)) {
    return 'Lo siento, esa funcionalidad no está disponible actualmente.';
  }

  switch (accion) {
    case 'VER_CATALOGO':
      return verCatalogoProcessor(tenant.id);

    case 'CREAR_CITA':
      return crearCitaProcessor(tenant.id, customerId, params);

    case 'VER_CITAS':
    case 'CANCELAR_CITA':
    case 'REAGENDAR_CITA':
      return verCitasProcessor(tenant.id, customerId);

    case 'VER_SLOTS':
      return verSlotsProcessor(tenant.id, params);

    case 'INFO_NEGOCIO':
      return infoNegocioProcessor(tenant);

    case 'ESCALAMIENTO':
      return escalamientoProcessor();

    case 'AGREGAR_CARRITO':
    case 'VER_CARRITO':
      return agregarCarritoProcessor();

    case 'CREAR_PEDIDO':
    case 'VER_ESTADO_PEDIDO':
      return crearPedidoProcessor();

    case 'COTIZAR':
    case 'VER_COTIZACION':
      return cotizarProcessor();

    case 'CREAR_RESERVA':
    case 'VER_RESERVAS':
    case 'CANCELAR_RESERVA':
      return crearReservaProcessor();

    default:
      return 'No reconozco esa acción. ¿En qué más puedo ayudarte?';
  }
}

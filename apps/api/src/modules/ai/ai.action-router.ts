import type { Tenant } from '@saas/db';
import { isCapabilityAllowed } from './ai.action-parser.js';
import { verCatalogoProcessor } from './processors/ver-catalogo.processor.js';
import { crearCitaProcessor, verCitasProcessor } from './processors/crear-cita.processor.js';
import { verSlotsProcessor } from './processors/ver-slots.processor.js';
import { infoNegocioProcessor } from './processors/info-negocio.processor.js';
import { enviarPagoProcessor } from './processors/enviar-pago.processor.js';
import { agregarCarritoProcessor, verCarritoProcessor, crearPedidoProcessor, verEstadoPedidoProcessor } from './processors/pedido.processor.js';
import { cotizarProcessor, verCotizacionProcessor } from './processors/cotizar.processor.js';
import { crearReservaProcessor, verReservasProcessor, cancelarReservaProcessor } from './processors/reservar.processor.js';
import { escalamientoProcessor } from './processors/stub.processor.js';

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
      return agregarCarritoProcessor(tenant.id, customerId, params);

    case 'VER_CARRITO':
      return verCarritoProcessor(tenant.id, customerId);

    case 'CREAR_PEDIDO':
      return crearPedidoProcessor(tenant.id, customerId);

    case 'VER_ESTADO_PEDIDO':
      return verEstadoPedidoProcessor(tenant.id, customerId, params);

    case 'COTIZAR':
      return cotizarProcessor(tenant.id, customerId, params);

    case 'VER_COTIZACION':
      return verCotizacionProcessor(tenant.id, customerId, params);

    case 'CREAR_RESERVA':
      return crearReservaProcessor(tenant.id, customerId, params);

    case 'VER_RESERVAS':
      return verReservasProcessor(tenant.id, customerId);

    case 'CANCELAR_RESERVA':
      return cancelarReservaProcessor(tenant.id, customerId, params);

    case 'ENVIAR_PAGO':
      return enviarPagoProcessor(tenant.id, customerId, params);

    default:
      return 'No reconozco esa acción. ¿En qué más puedo ayudarte?';
  }
}

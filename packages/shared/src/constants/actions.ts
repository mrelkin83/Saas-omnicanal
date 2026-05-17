import type { Capability } from './capabilities.js';

export const AI_ACTIONS = [
  'VER_CATALOGO',
  'AGREGAR_CARRITO',
  'VER_CARRITO',
  'CREAR_PEDIDO',
  'VER_ESTADO_PEDIDO',
  'CREAR_CITA',
  'CANCELAR_CITA',
  'REAGENDAR_CITA',
  'VER_SLOTS',
  'VER_CITAS',
  'CREAR_RESERVA',
  'CANCELAR_RESERVA',
  'VER_RESERVAS',
  'COTIZAR',
  'VER_COTIZACION',
  'ENVIAR_PAGO',
  'ESCALAMIENTO',
  'INFO_NEGOCIO',
] as const;

export type AIAction = (typeof AI_ACTIONS)[number];

export const ACTION_CAPABILITY: Record<AIAction, Capability | null> = {
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
  ESCALAMIENTO: null,
  INFO_NEGOCIO: null,
};

export const CAPABILITIES = [
  'catalog',
  'cart_orders',
  'appointments',
  'delivery',
  'payments',
  'quotes',
  'reservations',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

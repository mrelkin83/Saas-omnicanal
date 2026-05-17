const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}

export function parseCOP(formatted: string): number {
  const digits = formatted.replace(/[^\d]/g, '');
  return parseInt(digits, 10);
}

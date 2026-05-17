export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('57') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('3')) {
    return `+57${digits}`;
  }
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  return phone;
}

export function isValidColombianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+573\d{9}$/.test(normalized);
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return '****';
  return `${phone.slice(0, -4).replace(/\d/g, '*')}${phone.slice(-4)}`;
}

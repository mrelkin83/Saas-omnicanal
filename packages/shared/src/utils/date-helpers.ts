const BOGOTA_TZ = 'America/Bogota';

export function toUTC(date: Date): Date {
  return new Date(date.toISOString());
}

export function toBogotaTime(date: Date): Date {
  const bogotaStr = date.toLocaleString('en-US', { timeZone: BOGOTA_TZ });
  return new Date(bogotaStr);
}

export function formatBogotaDate(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatBogotaDateTime(date: Date): string {
  return date.toLocaleString('es-CO', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBogotaTime(date: Date): string {
  return date.toLocaleTimeString('es-CO', {
    timeZone: BOGOTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function nowUTC(): Date {
  return new Date();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  const aB = toBogotaTime(a);
  const bB = toBogotaTime(b);
  return (
    aB.getFullYear() === bB.getFullYear() &&
    aB.getMonth() === bB.getMonth() &&
    aB.getDate() === bB.getDate()
  );
}

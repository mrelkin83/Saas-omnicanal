import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_B64 = process.env['ENCRYPTION_KEY'] ?? '';
const key = KEY_B64
  ? Buffer.from(KEY_B64, 'base64').subarray(0, 32)
  : randomBytes(32); // fallback for dev — not stable across restarts

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  if (!ivHex || !encHex) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

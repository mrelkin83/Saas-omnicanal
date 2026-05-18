import { describe, it, expect } from 'vitest';

// Set ENCRYPTION_KEY before importing the module so key derivation uses it
const key = Buffer.from('test-encryption-key-32bytes-pad00').subarray(0, 32).toString('base64');
process.env['ENCRYPTION_KEY'] = key;

// Dynamic import after env is set
const { encrypt, decrypt } = await import('./crypto.js');

describe('crypto', () => {
  describe('encrypt', () => {
    it('returns a string with iv:ciphertext format (hex:hex)', () => {
      const enc = encrypt('hello');
      const parts = enc.split(':');
      expect(parts.length).toBe(2);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    });

    it('produces different output each call (random IV)', () => {
      const enc1 = encrypt('same text');
      const enc2 = encrypt('same text');
      expect(enc1).not.toBe(enc2);
    });

    it('can encrypt empty string', () => {
      const enc = encrypt('');
      expect(enc).toContain(':');
    });
  });

  describe('decrypt', () => {
    it('round-trips a simple string', () => {
      const plain = 'hello world';
      expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it('round-trips a string with special chars', () => {
      const plain = 'contraseña: @#$%^&*()_+-=[]{}|;\':",./<>?';
      expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it('round-trips a long string', () => {
      const plain = 'a'.repeat(1000);
      expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it('throws on tampered ciphertext', () => {
      const enc = encrypt('data');
      const [iv] = enc.split(':');
      expect(() => decrypt(`${iv}:deadbeefdeadbeef`)).toThrow();
    });
  });
});

import { describe, it, expect, vi } from 'vitest';

// Mock @saas/db before importing auth.service to avoid real DB connection
vi.mock('@saas/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), query: { users: { findFirst: vi.fn() } } },
  users: {}, tenants: {}, saasPlans: {}, eq: vi.fn(),
}));

const { hashPassword, verifyPassword } = await import('./auth.service.js');

describe('auth.service', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash string', async () => {
      const hash = await hashPassword('secret123');
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('produces different hashes for same input (random salt)', async () => {
      const h1 = await hashPassword('same');
      const h2 = await hashPassword('same');
      expect(h1).not.toBe(h2);
    });

    it('hash is at least 60 characters long', async () => {
      const hash = await hashPassword('mypassword');
      expect(hash.length).toBeGreaterThanOrEqual(60);
    });
  });

  describe('verifyPassword', () => {
    it('returns true when password matches hash', async () => {
      const hash = await hashPassword('correct');
      expect(await verifyPassword('correct', hash)).toBe(true);
    });

    it('returns false when password does not match', async () => {
      const hash = await hashPassword('correct');
      expect(await verifyPassword('wrong', hash)).toBe(false);
    });

    it('returns false for empty string against a real hash', async () => {
      const hash = await hashPassword('notempty');
      expect(await verifyPassword('', hash)).toBe(false);
    });
  });
});

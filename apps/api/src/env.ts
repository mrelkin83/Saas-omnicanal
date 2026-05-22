// In production, Docker injects env vars via env_file/environment.
// Only load the .env file when running locally.
if (process.env['NODE_ENV'] !== 'production') {
  const { config } = await import('dotenv');
  const { resolve } = await import('node:path');
  config({ path: resolve(import.meta.dirname, '../../../.env') });
}

// ── Required vars — fail fast before any service starts ──────────────────────
const REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'EVOLUTION_API_GLOBAL_KEY',
] as const;

for (const key of REQUIRED) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[env] Missing required environment variable: ${key}`);
  }
  if (value.includes('CHANGEME')) {
    throw new Error(
      `[env] ${key} contains placeholder "CHANGEME" — set a real value before starting`,
    );
  }
}

// JWT_SECRET must be at least 32 characters
if (process.env['JWT_SECRET']!.length < 32) {
  throw new Error('[env] JWT_SECRET must be at least 32 characters');
}

// ENCRYPTION_KEY must be valid base64 decoding to ≥ 32 bytes
const encKeyBytes = Buffer.from(process.env['ENCRYPTION_KEY']!, 'base64');
if (encKeyBytes.length < 32) {
  throw new Error(
    `[env] ENCRYPTION_KEY must decode to at least 32 bytes (got ${encKeyBytes.length})`,
  );
}

// OPENAI_API_KEY is optional — tenants configure their own via Integrations
if (!process.env['OPENAI_API_KEY']) {
  console.warn(
    '[env] OPENAI_API_KEY not set — AI features disabled until tenants configure their own key in Dashboard > Integraciones',
  );
}

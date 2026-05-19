// In production, Docker injects env vars via env_file/environment.
// Only load the .env file when running locally.
if (process.env['NODE_ENV'] !== 'production') {
  const { config } = await import('dotenv');
  const { resolve } = await import('node:path');
  config({ path: resolve(import.meta.dirname, '../../../.env') });
}

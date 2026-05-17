import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient);

await migrate(db, {
  migrationsFolder: join(__dirname, '../migrations'),
});

console.log('Migrations applied successfully');
await migrationClient.end();

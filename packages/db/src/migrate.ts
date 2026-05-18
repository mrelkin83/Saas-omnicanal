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

// Create non-superuser app role (NOT the docker bootstrap superuser)
// This role IS subject to RLS — use it for testing tenant isolation
await migrationClient`
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
      CREATE ROLE app WITH LOGIN PASSWORD 'saas_dev_password'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END
  $$
`;

await migrationClient`GRANT USAGE ON SCHEMA public TO app`;
await migrationClient`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app`;
await migrationClient`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app`;
await migrationClient`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app`;
await migrationClient`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app`;

// Enable RLS on tenant-isolated tables (FORCE so even table owner must comply)
// Note: the 'saas' bootstrap superuser bypasses RLS regardless of FORCE —
// use the 'app' role (NOSUPERUSER) to test tenant isolation.
const tenantTables = [
  'users', 'customers', 'categories', 'products', 'product_variants',
  'carts', 'orders', 'appointments', 'reservations', 'quotes',
  'channel_sessions', 'conversations', 'conversation_state', 'tenant_config',
  'ai_knowledge_entries', 'ai_unanswered_queries', 'departments',
  'kanban_columns', 'contact_lists', 'campaigns', 'integrations',
  'deliveries', 'payments', 'analytics_daily',
];

for (const table of tenantTables) {
  await migrationClient.unsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  await migrationClient.unsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);

  await migrationClient.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = '${table}' AND policyname = 'tenant_isolation'
      ) THEN
        CREATE POLICY tenant_isolation ON "${table}"
          AS PERMISSIVE
          FOR ALL
          TO app
          USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
      END IF;
    END $$
  `);
}

// FK-isolated tables
const fkTables: Array<{ table: string; using: string }> = [
  {
    table: 'messages',
    using: `conversation_id IN (SELECT id FROM conversations WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`,
  },
  {
    table: 'cart_items',
    using: `cart_id IN (SELECT id FROM carts WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`,
  },
  {
    table: 'order_items',
    using: `order_id IN (SELECT id FROM orders WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`,
  },
  {
    table: 'department_members',
    using: `department_id IN (SELECT id FROM departments WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`,
  },
  {
    table: 'contact_list_entries',
    using: `list_id IN (SELECT id FROM contact_lists WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`,
  },
  {
    table: 'campaign_logs',
    using: `campaign_id IN (SELECT id FROM campaigns WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`,
  },
];

for (const { table, using: usingExpr } of fkTables) {
  await migrationClient.unsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  await migrationClient.unsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);

  await migrationClient.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = '${table}' AND policyname = 'tenant_isolation'
      ) THEN
        CREATE POLICY tenant_isolation ON "${table}"
          AS PERMISSIVE FOR ALL TO app USING (${usingExpr});
      END IF;
    END $$
  `);
}

console.log('Migrations applied successfully');
await migrationClient.end();

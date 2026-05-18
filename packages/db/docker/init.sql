-- Runs as postgres superuser on first container start (via /docker-entrypoint-initdb.d/)
-- Creates extensions that require superuser, then downgrades the app user

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Downgrade saas to non-superuser so RLS applies to it
-- saas still owns the database so it can CREATE/ALTER tables and policies
ALTER ROLE saas NOSUPERUSER NOBYPASSRLS;

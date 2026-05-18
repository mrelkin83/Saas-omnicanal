#!/bin/bash
# init.sh - runs in docker-entrypoint-initdb.d as the bootstrap superuser (saas)
# Extensions are created here by the superuser, before tables are created

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "vector";
EOSQL

echo "init.sh: pgcrypto and vector extensions created"

#!/bin/bash
# init.sh - runs in docker-entrypoint-initdb.d as the bootstrap superuser (saas)
# Creates extensions and auxiliary databases needed by third-party services

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "vector";
EOSQL

# Evolution API needs its own database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    SELECT 'CREATE DATABASE evolution_api OWNER "$POSTGRES_USER"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution_api')\gexec
EOSQL

echo "init.sh: extensions and evolution_api database created"

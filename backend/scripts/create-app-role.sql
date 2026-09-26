-- Stackduck: least-privilege application role for Postgres (Security Plan §6).
--
-- Run this while connected as the Railway-provisioned admin user, against the
-- application database (the one DATABASE_URL points at). It is safe to run
-- more than once (CREATE ROLE is guarded by a block, grants are idempotent).
--
--   PGPASSWORD='<railway-admin-password>' psql "$DATABASE_URL" -v app_password='<generate-a-long-random-password>' -f backend/scripts/create-app-role.sql
--
-- Generate the password e.g.:
--   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
--
-- Then point the API at the new role by replacing the user/password in
-- DATABASE_URL. Two operational notes, read before switching:
--
--   1. TypeORM `synchronize: true` (current dev behavior) requires CREATE on
--      the schema. This script therefore keeps CREATE granted. For
--      production, make one schema sync as the admin user first (or run
--      migrations), then REVOKE CREATE and ALTER DEFAULT PRIVILEGES grants:
--        REVOKE CREATE ON SCHEMA public FROM stackduck_app;
--      After that, the app can read/write/query but not change the schema.
--
--   2. `CREATE EXTENSION` needs a superuser, so the app role never runs it.
--      The Railway TimescaleDB template ships the extension preinstalled;
--      the API's TimescaleSetupService only calls create_hypertable on tables
--      it owns (allowed for non-superusers). If setup reports the extension
--      missing, do not relax these grants — fix the database template instead.
--
-- What the role gets: connect + use the schema, full row-level access to the
-- application tables, sequence usage for generated IDs — and nothing else.
-- No CREATEDB, no CREATEROLE, no SUPERUSER, no BYPASSRLS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'stackduck_app') THEN
    CREATE ROLE stackduck_app WITH LOGIN PASSWORD :'app_password';
  ELSE
    ALTER ROLE stackduck_app WITH LOGIN PASSWORD :'app_password';
  END IF;
END
$$;

ALTER ROLE stackduck_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Least privilege is a property of the database, not the connection: revoke
-- the over-broad PUBLIC defaults that stock Postgres ships with.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE current_database() TO stackduck_app;
GRANT USAGE ON SCHEMA public TO stackduck_app;
-- KEEP CREATE during the synchronize phase (see note 1 above).
GRANT CREATE ON SCHEMA public TO stackduck_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stackduck_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stackduck_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stackduck_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO stackduck_app;

-- Sanity output: confirm what was granted.
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
  FROM pg_catalog.pg_roles WHERE rolname = 'stackduck_app';

import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Bootstrap fresh databases and adopt the schema previously created by synchronize. */
export class Baseline1791500000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE EXTENSION IF NOT EXISTS citext');
    await runner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), email citext,
        password_hash text, display_name text, photo_url text, provider_key text,
        consent_accepted_at timestamptz, prefs jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL,
        token_hash text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), owner_id uuid NOT NULL,
        name text NOT NULL, description text, stack_tags text[] NOT NULL DEFAULT '{}',
        repo_url text, live_url text, environment text, status text NOT NULL DEFAULT 'active', notes text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS connectors (
        id text PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type text NOT NULL, auth_type text NOT NULL, fetch_mode text NOT NULL,
        capabilities text[] NOT NULL DEFAULT '{}', credentials_enc text NOT NULL,
        previous_credentials_enc text, grace_until timestamptz,
        status text NOT NULL DEFAULT 'pending', last_error text, last_health_check timestamptz,
        last_fetched_at timestamptz, poll_interval_minutes integer,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS metric_points (
        id serial NOT NULL, project_id uuid NOT NULL, connector_id text NOT NULL,
        metric_type text NOT NULL, key text NOT NULL, value double precision NOT NULL,
        timestamp timestamptz NOT NULL, metadata jsonb, PRIMARY KEY (id, timestamp)
      )`,
      `CREATE TABLE IF NOT EXISTS alert_rules (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        metric_type text NOT NULL, key text NOT NULL, condition text NOT NULL,
        threshold double precision NOT NULL, window_minutes integer NOT NULL DEFAULT 60,
        channel text NOT NULL, channel_target text NOT NULL, status text NOT NULL DEFAULT 'active',
        last_triggered_at timestamptz, cooldown_minutes integer NOT NULL DEFAULT 60,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS feedback (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text, email text, message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS integration_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL, provider text NOT NULL,
        access_token_enc text NOT NULL, scope text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL,
        token_hash text NOT NULL, expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)',
      'CREATE UNIQUE INDEX IF NOT EXISTS users_provider_unique ON users(provider_key)',
      'CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_unique ON refresh_tokens(token_hash)',
      'CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id)',
      'CREATE INDEX IF NOT EXISTS connectors_project_idx ON connectors(project_id)',
      'CREATE INDEX IF NOT EXISTS connectors_project_type_idx ON connectors(project_id, type)',
      'CREATE INDEX IF NOT EXISTS metric_points_project_key_time_idx ON metric_points(project_id, metric_type, key, timestamp)',
      'CREATE INDEX IF NOT EXISTS metric_points_connector_time_idx ON metric_points(connector_id, timestamp)',
      'CREATE INDEX IF NOT EXISTS alert_rules_project_idx ON alert_rules(project_id)',
      'CREATE INDEX IF NOT EXISTS integration_tokens_user_idx ON integration_tokens(user_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS integration_tokens_provider_unique ON integration_tokens(user_id, provider)',
      'CREATE UNIQUE INDEX IF NOT EXISTS password_reset_hash_unique ON password_reset_tokens(token_hash)',
    ]) await runner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error('The adopted baseline is forward-only. Restore a database backup to roll back.');
  }
}

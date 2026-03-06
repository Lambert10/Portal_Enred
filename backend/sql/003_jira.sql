-- Integracion Jira Cloud 3LO por cliente.
-- Ejecutar manualmente en Postgres.

CREATE TABLE IF NOT EXISTS jira_connections (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  jira_site_url TEXT NOT NULL,
  cloud_id TEXT NOT NULL,
  project_key TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jira_connections_client_unique UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_jira_connections_cloud_id ON jira_connections (cloud_id);

CREATE TABLE IF NOT EXISTS jira_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_activity_logs_client_id ON jira_activity_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_jira_activity_logs_created_at ON jira_activity_logs (created_at);

-- Compatibilidad de roles para permisos Jira:
-- admin (todo), editor (crear/editar), viewer/user (lectura).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END$$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'editor', 'viewer', 'user'));

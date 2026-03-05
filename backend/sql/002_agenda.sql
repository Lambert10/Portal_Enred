-- Agenda de actividades por cliente (multi-tenant por client_id).
-- Ejecutar manualmente en Postgres.

CREATE TABLE IF NOT EXISTS agenda_events (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  created_by_user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('actividad', 'hito', 'compromiso')),
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_progreso', 'completado', 'cancelado')),
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agenda_events_end_after_start CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_agenda_events_client_id ON agenda_events (client_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_start_at ON agenda_events (start_at);
CREATE INDEX IF NOT EXISTS idx_agenda_events_status ON agenda_events (status);

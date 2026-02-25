-- Ejecutar una vez en tu Postgres de Render.
-- Crea la tabla esperada por el backend.

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opcional: indice para consultas por estado.
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients (is_active);

-- Ejemplo de insercion (reemplaza embed_url por el tuyo):
-- INSERT INTO clients (slug, name, embed_url, is_active)
-- VALUES ('abastible', 'Abastible', 'https://app.powerbi.com/view?r=TU_LINK', TRUE)
-- ON CONFLICT (slug) DO UPDATE
-- SET
--   name = EXCLUDED.name,
--   embed_url = EXCLUDED.embed_url,
--   is_active = EXCLUDED.is_active,
--   updated_at = NOW();

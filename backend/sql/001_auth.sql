-- Ejecutar manualmente en Postgres (no hay migraciones automaticas).
-- Crea tablas de autenticacion/autorizacion basicas para el portal.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_clients (
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON user_clients (user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_client_id ON user_clients (client_id);

-- Admin inicial.
-- IMPORTANTE: reemplaza el hash por uno propio antes de produccion.
-- Ejemplo para generarlo con bcrypt en Node (en cualquier entorno con bcrypt/bcryptjs):
-- node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('CambiaEstaClaveSegura', 10));"
INSERT INTO users (email, full_name, role, password_hash, is_active)
VALUES (
  'admin@enred.cl',
  'Admin Enred',
  'admin',
  '$2b$10$7EqJtq98hPqEX7fNZaFWoOeR4T6rK4f5P4xMIOKgHdwNwp0UrEGou',
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash,
  is_active = EXCLUDED.is_active;

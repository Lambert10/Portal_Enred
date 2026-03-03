import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";
import { requireAuth, requireAdmin } from "./middlewares/requireAuth.js";

const app = express();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validRoles = new Set(["admin", "user"]);
const passwordMinLength = 8;

function getCorsOrigins() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return true;

  const list = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!list.length) return true;
  if (list.includes("*")) return true;
  if (list.length === 1) return list[0];
  return list;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseId(value) {
  const id = Number.parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseClientIds(value) {
  if (!Array.isArray(value)) return null;

  const ids = [];
  for (const rawId of value) {
    const clientId = Number.parseInt(String(rawId), 10);
    if (!Number.isInteger(clientId) || clientId <= 0) return null;
    if (!ids.includes(clientId)) ids.push(clientId);
  }

  return ids;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function validateClientIds(dbClient, clientIds) {
  if (!clientIds.length) return true;

  const { rows } = await dbClient.query(
    `SELECT id
     FROM clients
     WHERE id = ANY($1::bigint[])`,
    [clientIds]
  );

  return rows.length === clientIds.length;
}

async function replaceUserClients(dbClient, userId, clientIds) {
  await dbClient.query(
    `DELETE FROM user_clients
     WHERE user_id = $1`,
    [userId]
  );

  if (!clientIds.length) return;

  await dbClient.query(
    `INSERT INTO user_clients (user_id, client_id)
     SELECT $1, UNNEST($2::bigint[])`,
    [userId, clientIds]
  );
}

app.use(express.json());
app.use(cors({ origin: getCorsOrigins() }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/api/auth/login", async (req, res) => {
  const email = cleanText(req.body?.email).toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, password_hash
       FROM users
       WHERE email = $1 AND is_active = TRUE
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const user = rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("auth login error: JWT_SECRET no configurado");
      return res.status(500).json({ error: "Error de servidor" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("auth login error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role
       FROM users
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [req.user.userId]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "No autorizado" });
    }

    return res.json({ user: rows[0] });
  } catch (e) {
    console.error("auth me error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.use("/api/admin", requireAuth, requireAdmin);

app.get("/api/admin/users", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC, id DESC`
    );

    return res.json({ items: rows });
  } catch (e) {
    console.error("admin users list error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.post("/api/admin/users", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const fullName = cleanText(req.body?.full_name) || null;
  const role = normalizeSlug(req.body?.role || "user");
  const password = String(req.body?.password || "");
  const clientIds = parseClientIds(req.body?.client_ids || []);

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email invalido." });
  }

  if (!validRoles.has(role)) {
    return res.status(400).json({ error: "Role invalido. Usa admin o user." });
  }

  if (password.length < passwordMinLength) {
    return res.status(400).json({ error: "Password debe tener al menos 8 caracteres." });
  }

  if (clientIds === null) {
    return res.status(400).json({ error: "client_ids debe ser un arreglo de IDs validos." });
  }

  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");

    const { rows: existsRows } = await dbClient.query(
      `SELECT 1
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );
    if (existsRows.length) {
      throw createHttpError(409, "El email ya existe.");
    }

    const clientsAreValid = await validateClientIds(dbClient, clientIds);
    if (!clientsAreValid) {
      throw createHttpError(400, "Uno o mas client_ids no existen.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows: userRows } = await dbClient.query(
      `INSERT INTO users (email, full_name, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email, fullName, role, passwordHash]
    );

    const user = userRows[0];
    await replaceUserClients(dbClient, user.id, clientIds);

    await dbClient.query("COMMIT");
    return res.status(201).json({ user, client_ids: clientIds });
  } catch (e) {
    await dbClient.query("ROLLBACK");

    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    if (e?.code === "23505") {
      return res.status(409).json({ error: "El email ya existe." });
    }

    console.error("admin users create error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  } finally {
    dbClient.release();
  }
});

app.get("/api/admin/users/:id", async (req, res) => {
  const userId = parseId(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: "ID de usuario invalido." });
  }

  try {
    const { rows: userRows } = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const { rows: clientRows } = await pool.query(
      `SELECT c.id, c.slug, c.name, c.is_active
       FROM clients c
       INNER JOIN user_clients uc ON uc.client_id = c.id
       WHERE uc.user_id = $1
       ORDER BY c.name ASC`,
      [userId]
    );

    return res.json({ user: userRows[0], clients: clientRows });
  } catch (e) {
    console.error("admin users detail error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.put("/api/admin/users/:id", async (req, res) => {
  const userId = parseId(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: "ID de usuario invalido." });
  }

  if (!hasOwn(req.body, "client_ids")) {
    return res.status(400).json({ error: "client_ids es obligatorio para reasignar accesos." });
  }

  const clientIds = parseClientIds(req.body?.client_ids);
  if (clientIds === null) {
    return res.status(400).json({ error: "client_ids debe ser un arreglo de IDs validos." });
  }

  const hasEmail = hasOwn(req.body, "email");
  const hasFullName = hasOwn(req.body, "full_name");
  const hasRole = hasOwn(req.body, "role");
  const hasIsActive = hasOwn(req.body, "is_active");

  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");

    const { rows: currentRows } = await dbClient.query(
      `SELECT id, email, full_name, role, is_active, created_at
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (!currentRows.length) {
      throw createHttpError(404, "Usuario no encontrado.");
    }

    const currentUser = currentRows[0];

    let nextEmail = currentUser.email;
    if (hasEmail) {
      nextEmail = normalizeEmail(req.body?.email);
      if (!nextEmail || !nextEmail.includes("@")) {
        throw createHttpError(400, "Email invalido.");
      }
    }

    let nextRole = currentUser.role;
    if (hasRole) {
      nextRole = normalizeSlug(req.body?.role);
      if (!validRoles.has(nextRole)) {
        throw createHttpError(400, "Role invalido. Usa admin o user.");
      }
    }

    let nextIsActive = currentUser.is_active;
    if (hasIsActive) {
      if (typeof req.body?.is_active !== "boolean") {
        throw createHttpError(400, "is_active debe ser booleano.");
      }
      nextIsActive = req.body.is_active;
    }

    const nextFullName = hasFullName ? cleanText(req.body?.full_name) || null : currentUser.full_name;

    const { rows: existsRows } = await dbClient.query(
      `SELECT 1
       FROM users
       WHERE email = $1 AND id <> $2
       LIMIT 1`,
      [nextEmail, userId]
    );
    if (existsRows.length) {
      throw createHttpError(409, "El email ya existe.");
    }

    const clientsAreValid = await validateClientIds(dbClient, clientIds);
    if (!clientsAreValid) {
      throw createHttpError(400, "Uno o mas client_ids no existen.");
    }

    const { rows: updatedRows } = await dbClient.query(
      `UPDATE users
       SET email = $1,
           full_name = $2,
           role = $3,
           is_active = $4
       WHERE id = $5
       RETURNING id, email, full_name, role, is_active, created_at`,
      [nextEmail, nextFullName, nextRole, nextIsActive, userId]
    );

    await replaceUserClients(dbClient, userId, clientIds);

    await dbClient.query("COMMIT");
    return res.json({ user: updatedRows[0], client_ids: clientIds });
  } catch (e) {
    await dbClient.query("ROLLBACK");

    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    if (e?.code === "23505") {
      return res.status(409).json({ error: "El email ya existe." });
    }

    console.error("admin users update error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  } finally {
    dbClient.release();
  }
});

app.put("/api/admin/users/:id/password", async (req, res) => {
  const userId = parseId(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: "ID de usuario invalido." });
  }

  const password = String(req.body?.password || "");
  if (password.length < passwordMinLength) {
    return res.status(400).json({ error: "Password debe tener al menos 8 caracteres." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active, created_at`,
      [passwordHash, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    return res.json({ user: rows[0] });
  } catch (e) {
    console.error("admin users password error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  const userId = parseId(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: "ID de usuario invalido." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET is_active = FALSE
       WHERE id = $1
       RETURNING id, email, full_name, role, is_active, created_at`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    return res.json({ user: rows[0] });
  } catch (e) {
    console.error("admin users delete error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/clients", requireAuth, async (req, res) => {
  const includeAll = req.query?.all === "1";

  try {
    const selectFields = includeAll
      ? "id, slug, name, embed_url, is_active"
      : "slug, name";
    let rows = [];

    if (req.user.role === "admin") {
      const whereClause = includeAll ? "" : "WHERE is_active = TRUE";
      const { rows: adminRows } = await pool.query(
        `SELECT ${selectFields}
         FROM clients
         ${whereClause}
         ORDER BY name ASC`
      );
      rows = adminRows;
    } else {
      const { rows: userRows } = await pool.query(
        `SELECT c.${selectFields.replaceAll(", ", ", c.")}
         FROM clients c
         INNER JOIN user_clients uc ON uc.client_id = c.id
         WHERE uc.user_id = $1
           AND c.is_active = TRUE
         ORDER BY c.name ASC`,
        [req.user.userId]
      );
      rows = userRows;
    }

    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/clients/:slug/embed", requireAuth, async (req, res) => {
  const { slug } = req.params;
  try {
    let rows = [];

    if (req.user.role === "admin") {
      const { rows: adminRows } = await pool.query(
        `SELECT slug, name, embed_url
         FROM clients
         WHERE slug = $1 AND is_active = TRUE
         LIMIT 1`,
        [slug]
      );
      rows = adminRows;
    } else {
      const { rows: userRows } = await pool.query(
        `SELECT c.slug, c.name, c.embed_url
         FROM clients c
         INNER JOIN user_clients uc ON uc.client_id = c.id
         WHERE c.slug = $1
           AND uc.user_id = $2
           AND c.is_active = TRUE
         LIMIT 1`,
        [slug, req.user.userId]
      );
      rows = userRows;
    }

    if (!rows.length) {
      if (req.user.role === "user") {
        const { rows: existsRows } = await pool.query(
          `SELECT 1
           FROM clients
           WHERE slug = $1 AND is_active = TRUE
           LIMIT 1`,
          [slug]
        );
        if (existsRows.length) {
          return res.status(403).json({ error: "Sin acceso a este cliente" });
        }
      }

      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error de servidor" });
  }
});

app.post("/api/clients", requireAuth, requireAdmin, async (req, res) => {
  const slug = normalizeSlug(req.body?.slug);
  const name = cleanText(req.body?.name);
  const embedUrl = cleanText(req.body?.embed_url);
  const isActive = req.body?.is_active !== false;

  if (!slugPattern.test(slug)) {
    return res.status(400).json({
      error: "Slug invalido. Usa solo minusculas, numeros y guiones.",
    });
  }

  if (!name) {
    return res.status(400).json({ error: "El nombre es obligatorio." });
  }

  if (!isValidHttpUrl(embedUrl)) {
    return res.status(400).json({ error: "embed_url debe ser una URL http/https valida." });
  }

  try {
    const params = [slug, name, embedUrl, isActive];
    const upsertWithUpdatedAt = `
      INSERT INTO clients (slug, name, embed_url, is_active, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (slug) DO UPDATE
      SET
        name = EXCLUDED.name,
        embed_url = EXCLUDED.embed_url,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING slug, name, embed_url, is_active
    `;
    const upsertWithoutUpdatedAt = `
      INSERT INTO clients (slug, name, embed_url, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slug) DO UPDATE
      SET
        name = EXCLUDED.name,
        embed_url = EXCLUDED.embed_url,
        is_active = EXCLUDED.is_active
      RETURNING slug, name, embed_url, is_active
    `;

    try {
      const { rows } = await pool.query(upsertWithUpdatedAt, params);
      return res.status(201).json(rows[0]);
    } catch (innerErr) {
      if (innerErr?.code !== "42703") throw innerErr;
      const { rows } = await pool.query(upsertWithoutUpdatedAt, params);
      return res.status(201).json(rows[0]);
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = TRUE)::int AS clients_active,
        COUNT(*)::int AS dashboards_published,
        GREATEST(
          COALESCE((CURRENT_DATE - MIN(created_at)::date) + 1, 1),
          1
        )::int AS days_live
      FROM clients
    `);

    const stats = rows[0] || {
      clients_active: 0,
      dashboards_published: 0,
      days_live: 1,
    };

    res.json(stats);
  } catch (e) {
    console.error("stats error:", e);
    res.status(500).json({ error: "Error de servidor" });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on port ${port}`));

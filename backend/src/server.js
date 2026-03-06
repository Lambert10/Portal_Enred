import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";
import { requireAuth, requireAdmin } from "./middlewares/requireAuth.js";

const app = express();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validRoles = new Set(["admin", "editor", "viewer", "user"]);
const passwordMinLength = 8;
const agendaTypes = new Set(["actividad", "hito", "compromiso"]);
const agendaStatuses = new Set(["pendiente", "en_progreso", "completado", "cancelado"]);
const agendaPriorities = new Set(["baja", "media", "alta"]);
const jiraScopes = ["offline_access", "read:jira-work", "write:jira-work", "read:jira-user"];

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

function parseDateTimeInput(value) {
  if (value === null || value === undefined || value === "") return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseDateOnlyToIso(value, endExclusive = false) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [year, month, day] = raw.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;

  const date = endExclusive
    ? new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))
    : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

async function queryWithOptionalUpdatedAt(dbClient, sqlWithUpdatedAt, sqlWithoutUpdatedAt, params) {
  try {
    return await dbClient.query(sqlWithUpdatedAt, params);
  } catch (e) {
    if (e?.code !== "42703") throw e;
    return dbClient.query(sqlWithoutUpdatedAt, params);
  }
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

async function resolveClientAccessBySlug(dbClient, user, slug) {
  const { rows: clientRows } = await dbClient.query(
    `SELECT id, slug, name
     FROM clients
     WHERE slug = $1
     LIMIT 1`,
    [slug]
  );

  if (!clientRows.length) {
    throw createHttpError(404, "Cliente no encontrado");
  }

  const client = clientRows[0];

  if (user?.role === "admin") {
    return client;
  }

  const { rows: accessRows } = await dbClient.query(
    `SELECT 1
     FROM user_clients
     WHERE user_id = $1
       AND client_id = $2
     LIMIT 1`,
    [user.userId, client.id]
  );

  if (!accessRows.length) {
    throw createHttpError(403, "Sin acceso a este cliente");
  }

  return client;
}

function getPortalRole(rawRole) {
  const role = cleanText(rawRole).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "editor") return "editor";
  return "viewer";
}

function canJiraWrite(portalRole) {
  return portalRole === "admin" || portalRole === "editor";
}

function canJiraConnect(portalRole) {
  return portalRole === "admin";
}

function getAtlassianConfig() {
  const clientId = cleanText(process.env.ATLASSIAN_CLIENT_ID);
  const clientSecret = cleanText(process.env.ATLASSIAN_CLIENT_SECRET);
  const redirectUri = cleanText(process.env.ATLASSIAN_REDIRECT_URI);

  if (!clientId || !clientSecret || !redirectUri) {
    throw createHttpError(
      500,
      "Faltan variables ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET o ATLASSIAN_REDIRECT_URI."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function normalizeProjectKey(value) {
  return cleanText(value).toUpperCase();
}

function normalizeOptionalUrl(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  if (!isValidHttpUrl(raw)) return null;
  return raw.replace(/\/+$/, "");
}

function buildJiraState(payload) {
  if (!process.env.JWT_SECRET) {
    throw createHttpError(500, "JWT_SECRET no configurado.");
  }

  return jwt.sign({ kind: "jira_oauth", ...payload }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });
}

function parseJiraState(value) {
  if (!process.env.JWT_SECRET) {
    throw createHttpError(500, "JWT_SECRET no configurado.");
  }

  try {
    const payload = jwt.verify(String(value || ""), process.env.JWT_SECRET);
    if (payload?.kind !== "jira_oauth") {
      throw createHttpError(400, "State OAuth invalido.");
    }
    return payload;
  } catch {
    throw createHttpError(400, "State OAuth invalido o expirado.");
  }
}

function toJiraAdf(value) {
  const text = cleanText(value);
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function jiraAdfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map((item) => jiraAdfToText(item)).join("");
  if (typeof node !== "object") return "";
  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = jiraAdfToText(node.content);
  return `${ownText}${childText}`;
}

function computeTokenExpiresAt(expiresInSeconds) {
  const safeSeconds = Math.max(Number(expiresInSeconds || 3600) - 60, 30);
  return new Date(Date.now() + safeSeconds * 1000).toISOString();
}

function extractJiraApiError(data, fallbackMessage) {
  const messages = Array.isArray(data?.errorMessages) ? data.errorMessages : [];
  const fieldErrors = data?.errors && typeof data.errors === "object" ? Object.values(data.errors) : [];
  const message = [data?.error, ...messages, ...fieldErrors].filter(Boolean).join(" | ");
  return message || fallbackMessage;
}

async function exchangeJiraCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getAtlassianConfig();
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code || ""),
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(502, extractJiraApiError(data, "No se pudo intercambiar code por token."));
  }

  return data;
}

async function refreshJiraTokens(refreshToken) {
  const { clientId, clientSecret } = getAtlassianConfig();
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: String(refreshToken || ""),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(502, extractJiraApiError(data, "No se pudo refrescar token Jira."));
  }

  return data;
}

async function getAccessibleJiraResources(accessToken) {
  const response = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw createHttpError(502, extractJiraApiError(data, "No se pudieron obtener recursos accesibles Jira."));
  }

  return Array.isArray(data) ? data : [];
}

async function getJiraConnectionByClientId(dbClient, clientId) {
  const { rows } = await dbClient.query(
    `SELECT id, client_id, jira_site_url, cloud_id, project_key, access_token, refresh_token, token_expires_at, created_at, updated_at
     FROM jira_connections
     WHERE client_id = $1
     LIMIT 1`,
    [clientId]
  );
  return rows[0] || null;
}

async function saveJiraConnection(dbClient, {
  clientId,
  jiraSiteUrl,
  cloudId,
  projectKey,
  accessToken,
  refreshToken,
  expiresAt,
}) {
  const { rows } = await dbClient.query(
    `INSERT INTO jira_connections (
       client_id,
       jira_site_url,
       cloud_id,
       project_key,
       access_token,
       refresh_token,
       token_expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (client_id) DO UPDATE
     SET
       jira_site_url = EXCLUDED.jira_site_url,
       cloud_id = EXCLUDED.cloud_id,
       project_key = EXCLUDED.project_key,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       token_expires_at = EXCLUDED.token_expires_at,
       updated_at = NOW()
     RETURNING id, client_id, jira_site_url, cloud_id, project_key, access_token, refresh_token, token_expires_at, created_at, updated_at`,
    [clientId, jiraSiteUrl, cloudId, projectKey, accessToken, refreshToken, expiresAt]
  );
  return rows[0];
}

async function ensureFreshJiraConnection(dbClient, connection) {
  if (!connection) return null;

  const expiresAtMs = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now() + 30_000) {
    return connection;
  }

  if (!connection.refresh_token) {
    throw createHttpError(401, "Conexion Jira expirada. Requiere reconexion.");
  }

  const refreshed = await refreshJiraTokens(connection.refresh_token);
  const nextAccessToken = cleanText(refreshed?.access_token);
  const nextRefreshToken = cleanText(refreshed?.refresh_token) || connection.refresh_token;
  if (!nextAccessToken) {
    throw createHttpError(502, "Respuesta invalida al refrescar token Jira.");
  }

  const { rows } = await dbClient.query(
    `UPDATE jira_connections
     SET
       access_token = $1,
       refresh_token = $2,
       token_expires_at = $3,
       updated_at = NOW()
     WHERE id = $4
     RETURNING id, client_id, jira_site_url, cloud_id, project_key, access_token, refresh_token, token_expires_at, created_at, updated_at`,
    [nextAccessToken, nextRefreshToken, computeTokenExpiresAt(refreshed?.expires_in), connection.id]
  );

  return rows[0];
}

async function jiraApiRequest(dbClient, connection, { method = "GET", path, body }) {
  let liveConnection = await ensureFreshJiraConnection(dbClient, connection);
  if (!liveConnection) {
    throw createHttpError(404, "Jira no conectado para este cliente.");
  }

  const base = `https://api.atlassian.com/ex/jira/${encodeURIComponent(liveConnection.cloud_id)}/rest/api/3`;
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const makeRequest = async (accessToken) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  let response = await makeRequest(liveConnection.access_token);

  if (response.status === 401 && liveConnection.refresh_token) {
    liveConnection = await ensureFreshJiraConnection(dbClient, {
      ...liveConnection,
      token_expires_at: new Date(0).toISOString(),
    });
    response = await makeRequest(liveConnection.access_token);
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw createHttpError(502, extractJiraApiError(data, `Jira API error (${response.status}).`));
  }

  return { data, connection: liveConnection };
}

function mapJiraIssue(issue) {
  const fields = issue?.fields || {};
  return {
    key: issue?.key,
    summary: fields?.summary || "",
    description: jiraAdfToText(fields?.description),
    status: fields?.status?.name || "",
    issue_type: fields?.issuetype?.name || "",
    priority: fields?.priority?.name || "",
    assignee: fields?.assignee?.displayName || null,
    updated: fields?.updated || null,
    created: fields?.created || null,
    raw: issue,
  };
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

app.get("/api/admin/clients", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, embed_url, is_active, created_at
       FROM clients
       ORDER BY created_at DESC, id DESC`
    );

    return res.json({ items: rows });
  } catch (e) {
    console.error("admin clients list error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/admin/clients/:id", async (req, res) => {
  const clientId = parseId(req.params.id);
  if (!clientId) {
    return res.status(400).json({ error: "ID de cliente invalido." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, embed_url, is_active, created_at
       FROM clients
       WHERE id = $1
       LIMIT 1`,
      [clientId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    return res.json({ client: rows[0] });
  } catch (e) {
    console.error("admin clients detail error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.post("/api/admin/clients", async (req, res) => {
  const slug = normalizeSlug(req.body?.slug);
  const name = cleanText(req.body?.name);
  const embedUrl = cleanText(req.body?.embed_url);
  const isActive = hasOwn(req.body, "is_active") ? req.body?.is_active : true;

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

  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "is_active debe ser booleano." });
  }

  try {
    const { rows } = await queryWithOptionalUpdatedAt(
      pool,
      `INSERT INTO clients (slug, name, embed_url, is_active, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, slug, name, embed_url, is_active, created_at`,
      `INSERT INTO clients (slug, name, embed_url, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug, name, embed_url, is_active, created_at`,
      [slug, name, embedUrl, isActive]
    );

    return res.status(201).json({ client: rows[0] });
  } catch (e) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "El slug ya existe." });
    }

    console.error("admin clients create error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.put("/api/admin/clients/:id", async (req, res) => {
  const clientId = parseId(req.params.id);
  if (!clientId) {
    return res.status(400).json({ error: "ID de cliente invalido." });
  }

  if (!hasOwn(req.body, "name") || !hasOwn(req.body, "embed_url") || !hasOwn(req.body, "is_active")) {
    return res.status(400).json({ error: "name, embed_url e is_active son obligatorios." });
  }

  const name = cleanText(req.body?.name);
  const embedUrl = cleanText(req.body?.embed_url);
  const isActive = req.body?.is_active;

  if (!name) {
    return res.status(400).json({ error: "El nombre es obligatorio." });
  }

  if (!isValidHttpUrl(embedUrl)) {
    return res.status(400).json({ error: "embed_url debe ser una URL http/https valida." });
  }

  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "is_active debe ser booleano." });
  }

  try {
    const { rows } = await queryWithOptionalUpdatedAt(
      pool,
      `UPDATE clients
       SET
         name = $1,
         embed_url = $2,
         is_active = $3,
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, slug, name, embed_url, is_active, created_at`,
      `UPDATE clients
       SET
         name = $1,
         embed_url = $2,
         is_active = $3
       WHERE id = $4
       RETURNING id, slug, name, embed_url, is_active, created_at`,
      [name, embedUrl, isActive, clientId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    return res.json({ client: rows[0] });
  } catch (e) {
    console.error("admin clients update error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.delete("/api/admin/clients/:id", async (req, res) => {
  const clientId = parseId(req.params.id);
  if (!clientId) {
    return res.status(400).json({ error: "ID de cliente invalido." });
  }

  try {
    const { rows } = await queryWithOptionalUpdatedAt(
      pool,
      `UPDATE clients
       SET
         is_active = FALSE,
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, name, embed_url, is_active, created_at`,
      `UPDATE clients
       SET is_active = FALSE
       WHERE id = $1
       RETURNING id, slug, name, embed_url, is_active, created_at`,
      [clientId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    return res.json({ client: rows[0] });
  } catch (e) {
    console.error("admin clients delete error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

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
    return res.status(400).json({ error: "Role invalido. Usa admin, editor, viewer o user." });
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
        throw createHttpError(400, "Role invalido. Usa admin, editor, viewer o user.");
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

app.get("/api/clients/:slug/jira/connect-url", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const projectKey = normalizeProjectKey(req.query?.project_key);
  const jiraSiteUrlRaw = cleanText(req.query?.jira_site_url);
  const jiraSiteUrl = normalizeOptionalUrl(jiraSiteUrlRaw);
  const portalRole = getPortalRole(req.user?.role);

  if (!canJiraConnect(portalRole)) {
    return res.status(403).json({ error: "Solo admin puede conectar Jira." });
  }

  if (!projectKey) {
    return res.status(400).json({ error: "project_key es obligatorio." });
  }

  if (!/^[A-Z][A-Z0-9_]*$/.test(projectKey)) {
    return res.status(400).json({ error: "project_key invalido." });
  }

  if (jiraSiteUrlRaw && !jiraSiteUrl) {
    return res.status(400).json({ error: "jira_site_url invalido." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const { clientId, redirectUri } = getAtlassianConfig();
    // Scopes 3LO Jira Cloud: ajusta en Atlassian Developer Console segun permisos requeridos.
    const scope = jiraScopes.join(" ");
    const state = buildJiraState({
      clientId: client.id,
      clientSlug: client.slug,
      userId: req.user.userId,
      projectKey,
      jiraSiteUrl,
    });

    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: clientId,
      scope,
      redirect_uri: redirectUri,
      response_type: "code",
      prompt: "consent",
      state,
    });

    return res.json({
      url: `https://auth.atlassian.com/authorize?${params.toString()}`,
    });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("jira connect-url error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/integrations/jira/callback", requireAuth, async (req, res) => {
  const code = cleanText(req.query?.code);
  const state = cleanText(req.query?.state);
  const portalRole = getPortalRole(req.user?.role);

  if (!canJiraConnect(portalRole)) {
    return res.status(403).json({ error: "Solo admin puede conectar Jira." });
  }

  if (!code || !state) {
    return res.status(400).json({ error: "code y state son obligatorios." });
  }

  try {
    const parsedState = parseJiraState(state);
    if (Number(parsedState?.userId) !== Number(req.user.userId)) {
      return res.status(403).json({ error: "State no corresponde al usuario autenticado." });
    }

    const client = await resolveClientAccessBySlug(pool, req.user, parsedState.clientSlug);
    if (Number(client.id) !== Number(parsedState.clientId)) {
      return res.status(400).json({ error: "State invalido para cliente." });
    }

    const tokenData = await exchangeJiraCodeForTokens(code);
    const accessToken = cleanText(tokenData?.access_token);
    const refreshToken = cleanText(tokenData?.refresh_token);
    if (!accessToken || !refreshToken) {
      throw createHttpError(502, "Respuesta invalida de OAuth Jira.");
    }

    const resources = await getAccessibleJiraResources(accessToken);
    if (!resources.length) {
      throw createHttpError(400, "No se encontraron recursos Jira accesibles.");
    }

    const stateSiteUrl = normalizeOptionalUrl(parsedState?.jiraSiteUrl);
    const matchedByUrl = stateSiteUrl
      ? resources.find((item) => normalizeOptionalUrl(item?.url) === stateSiteUrl)
      : null;
    const selectedResource = matchedByUrl || resources[0];
    if (!selectedResource?.id) {
      throw createHttpError(400, "No se pudo determinar cloud_id de Jira.");
    }

    const cloudId = cleanText(selectedResource?.id);
    const nextProjectKey = normalizeProjectKey(parsedState?.projectKey);
    if (!cloudId || !nextProjectKey) {
      throw createHttpError(400, "No se pudo completar configuracion Jira.");
    }

    const connection = await saveJiraConnection(pool, {
      clientId: client.id,
      jiraSiteUrl: cleanText(selectedResource?.url) || stateSiteUrl || "https://atlassian.net",
      cloudId,
      projectKey: nextProjectKey,
      accessToken,
      refreshToken,
      expiresAt: computeTokenExpiresAt(tokenData?.expires_in),
    });

    return res.json({
      ok: true,
      client_slug: client.slug,
      connection: {
        jira_site_url: connection.jira_site_url,
        cloud_id: connection.cloud_id,
        project_key: connection.project_key,
        updated_at: connection.updated_at,
      },
    });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("jira callback error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/clients/:slug/jira/meta", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const portalRole = getPortalRole(req.user?.role);
    const connection = await getJiraConnectionByClientId(pool, client.id);

    return res.json({
      client,
      role: portalRole,
      connected: Boolean(connection),
      can_connect: canJiraConnect(portalRole),
      can_write: canJiraWrite(portalRole),
      connection: connection
        ? {
            jira_site_url: connection.jira_site_url,
            cloud_id: connection.cloud_id,
            project_key: connection.project_key,
            updated_at: connection.updated_at,
          }
        : null,
    });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("jira meta error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/clients/:slug/jira/issues", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const maxResultsRaw = Number.parseInt(String(req.query?.maxResults || "30"), 10);
  const maxResults = Number.isInteger(maxResultsRaw) ? Math.min(Math.max(maxResultsRaw, 1), 100) : 30;

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const connection = await getJiraConnectionByClientId(pool, client.id);
    if (!connection) {
      return res.status(404).json({ error: "Jira no conectado para este cliente." });
    }

    const jql = `project = "${connection.project_key}" ORDER BY updated DESC`;
    const { data } = await jiraApiRequest(pool, connection, {
      method: "POST",
      path: "/search",
      body: {
        jql,
        maxResults,
        fields: ["summary", "description", "status", "issuetype", "priority", "assignee", "updated", "created"],
      },
    });

    const items = Array.isArray(data?.issues) ? data.issues.map(mapJiraIssue) : [];
    return res.json({
      client,
      connection: {
        jira_site_url: connection.jira_site_url,
        project_key: connection.project_key,
      },
      items,
      total: Number(data?.total || items.length),
    });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("jira issues list error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.post("/api/clients/:slug/jira/issues", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const summary = cleanText(req.body?.summary);
  const description = cleanText(req.body?.description);
  const issueType = cleanText(req.body?.issueType || "Task");
  const priority = cleanText(req.body?.priority);
  const portalRole = getPortalRole(req.user?.role);

  if (!canJiraWrite(portalRole)) {
    return res.status(403).json({ error: "No tienes permisos para crear issues." });
  }

  if (!summary) {
    return res.status(400).json({ error: "summary es obligatorio." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const connection = await getJiraConnectionByClientId(pool, client.id);
    if (!connection) {
      return res.status(404).json({ error: "Jira no conectado para este cliente." });
    }

    const fields = {
      project: { key: connection.project_key },
      summary,
      issuetype: { name: issueType },
    };

    if (description) {
      fields.description = toJiraAdf(description);
    }
    if (priority) {
      fields.priority = { name: priority };
    }

    const created = await jiraApiRequest(pool, connection, {
      method: "POST",
      path: "/issue",
      body: { fields },
    });

    const issueKey = cleanText(created?.data?.key);
    if (!issueKey) {
      throw createHttpError(502, "No se obtuvo key del issue creado.");
    }

    const issueData = await jiraApiRequest(pool, created.connection, {
      method: "GET",
      path: `/issue/${encodeURIComponent(issueKey)}?fields=summary,description,status,issuetype,priority,assignee,updated,created`,
    });

    return res.status(201).json({ issue: mapJiraIssue(issueData.data) });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("jira create issue error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.put("/api/clients/:slug/jira/issues/:issueKey", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const issueKey = cleanText(req.params?.issueKey);
  const summary = hasOwn(req.body, "summary") ? cleanText(req.body?.summary) : null;
  const description = hasOwn(req.body, "description") ? cleanText(req.body?.description) : null;
  const priority = hasOwn(req.body, "priority") ? cleanText(req.body?.priority) : null;
  const status = hasOwn(req.body, "status") ? cleanText(req.body?.status) : null;
  const portalRole = getPortalRole(req.user?.role);

  if (!canJiraWrite(portalRole)) {
    return res.status(403).json({ error: "No tienes permisos para editar issues." });
  }

  if (!issueKey) {
    return res.status(400).json({ error: "issueKey invalido." });
  }

  if (!hasOwn(req.body, "summary") && !hasOwn(req.body, "description") && !hasOwn(req.body, "priority") && !status) {
    return res.status(400).json({ error: "No hay campos para actualizar." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const connection = await getJiraConnectionByClientId(pool, client.id);
    if (!connection) {
      return res.status(404).json({ error: "Jira no conectado para este cliente." });
    }

    const fields = {};
    if (hasOwn(req.body, "summary")) {
      if (!summary) {
        return res.status(400).json({ error: "summary no puede quedar vacio." });
      }
      fields.summary = summary;
    }
    if (hasOwn(req.body, "description")) {
      fields.description = toJiraAdf(description);
    }
    if (hasOwn(req.body, "priority")) {
      if (priority) {
        fields.priority = { name: priority };
      }
    }

    if (!Object.keys(fields).length && !status) {
      return res.status(400).json({ error: "No hay campos validos para actualizar." });
    }

    let liveConnection = connection;
    if (Object.keys(fields).length) {
      const updated = await jiraApiRequest(pool, liveConnection, {
        method: "PUT",
        path: `/issue/${encodeURIComponent(issueKey)}`,
        body: { fields },
      });
      liveConnection = updated.connection;
    }

    if (status) {
      const transitionsResponse = await jiraApiRequest(pool, liveConnection, {
        method: "GET",
        path: `/issue/${encodeURIComponent(issueKey)}/transitions`,
      });
      const transitions = Array.isArray(transitionsResponse?.data?.transitions)
        ? transitionsResponse.data.transitions
        : [];
      const target = transitions.find((item) => cleanText(item?.to?.name).toLowerCase() === status.toLowerCase());

      if (!target?.id) {
        return res.status(400).json({ error: "No existe transicion para el status solicitado." });
      }

      const transitioned = await jiraApiRequest(pool, transitionsResponse.connection, {
        method: "POST",
        path: `/issue/${encodeURIComponent(issueKey)}/transitions`,
        body: { transition: { id: target.id } },
      });
      liveConnection = transitioned.connection;
    }

    const issueData = await jiraApiRequest(pool, liveConnection, {
      method: "GET",
      path: `/issue/${encodeURIComponent(issueKey)}?fields=summary,description,status,issuetype,priority,assignee,updated,created`,
    });

    return res.json({ issue: mapJiraIssue(issueData.data) });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("jira update issue error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/clients/:slug/agenda", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const hasFrom = hasOwn(req.query, "from");
  const hasTo = hasOwn(req.query, "to");
  const fromIso = hasFrom ? parseDateOnlyToIso(req.query?.from, false) : null;
  const toExclusiveIso = hasTo ? parseDateOnlyToIso(req.query?.to, true) : null;

  if (hasFrom && !fromIso) {
    return res.status(400).json({ error: "Parametro from invalido. Usa YYYY-MM-DD." });
  }

  if (hasTo && !toExclusiveIso) {
    return res.status(400).json({ error: "Parametro to invalido. Usa YYYY-MM-DD." });
  }

  if (fromIso && toExclusiveIso && fromIso >= toExclusiveIso) {
    return res.status(400).json({ error: "Rango de fechas invalido." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const params = [client.id];
    const filters = ["client_id = $1"];

    if (fromIso) {
      params.push(fromIso);
      filters.push(`COALESCE(end_at, start_at) >= $${params.length}`);
    }

    if (toExclusiveIso) {
      params.push(toExclusiveIso);
      filters.push(`start_at < $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT id, client_id, created_by_user_id, title, type, description, start_at, end_at, status, priority, created_at, updated_at
       FROM agenda_events
       WHERE ${filters.join(" AND ")}
       ORDER BY start_at ASC, id ASC`,
      params
    );

    return res.json({
      client,
      items: rows,
    });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("agenda list error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.post("/api/clients/:slug/agenda", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const title = cleanText(req.body?.title);
  const type = cleanText(req.body?.type || "actividad").toLowerCase();
  const description = cleanText(req.body?.description) || null;
  const startAt = parseDateTimeInput(req.body?.start_at);
  const endAt = parseDateTimeInput(req.body?.end_at);
  const status = cleanText(req.body?.status || "pendiente").toLowerCase();
  const priority = cleanText(req.body?.priority || "media").toLowerCase();

  if (!title) {
    return res.status(400).json({ error: "title es obligatorio." });
  }

  if (!agendaTypes.has(type)) {
    return res.status(400).json({ error: "type invalido." });
  }

  if (!startAt) {
    return res.status(400).json({ error: "start_at es obligatorio y debe ser fecha valida." });
  }

  if (req.body?.end_at !== undefined && req.body?.end_at !== null && req.body?.end_at !== "" && !endAt) {
    return res.status(400).json({ error: "end_at debe ser fecha valida." });
  }

  if (endAt && endAt < startAt) {
    return res.status(400).json({ error: "end_at no puede ser menor que start_at." });
  }

  if (!agendaStatuses.has(status)) {
    return res.status(400).json({ error: "status invalido." });
  }

  if (!agendaPriorities.has(priority)) {
    return res.status(400).json({ error: "priority invalido." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const { rows } = await pool.query(
      `INSERT INTO agenda_events (
         client_id,
         created_by_user_id,
         title,
         type,
         description,
         start_at,
         end_at,
         status,
         priority
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, client_id, created_by_user_id, title, type, description, start_at, end_at, status, priority, created_at, updated_at`,
      [client.id, req.user.userId, title, type, description, startAt, endAt, status, priority]
    );

    return res.status(201).json({ event: rows[0] });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("agenda create error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.put("/api/clients/:slug/agenda/:eventId", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const eventId = parseId(req.params?.eventId);
  if (!eventId) {
    return res.status(400).json({ error: "eventId invalido." });
  }

  const editableFields = ["title", "type", "description", "start_at", "end_at", "status", "priority"];
  const hasAnyField = editableFields.some((field) => hasOwn(req.body, field));
  if (!hasAnyField) {
    return res.status(400).json({ error: "No hay campos para actualizar." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const { rows: currentRows } = await pool.query(
      `SELECT id, client_id, title, type, description, start_at, end_at, status, priority
       FROM agenda_events
       WHERE id = $1 AND client_id = $2
       LIMIT 1`,
      [eventId, client.id]
    );

    if (!currentRows.length) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }

    const current = currentRows[0];
    const nextTitle = hasOwn(req.body, "title") ? cleanText(req.body?.title) : current.title;
    const nextType = hasOwn(req.body, "type")
      ? cleanText(req.body?.type).toLowerCase()
      : cleanText(current.type).toLowerCase();
    const nextDescription = hasOwn(req.body, "description")
      ? cleanText(req.body?.description) || null
      : current.description;
    const nextStartAt = hasOwn(req.body, "start_at")
      ? parseDateTimeInput(req.body?.start_at)
      : parseDateTimeInput(current.start_at);
    const nextEndAt = hasOwn(req.body, "end_at")
      ? parseDateTimeInput(req.body?.end_at)
      : parseDateTimeInput(current.end_at);
    const nextStatus = hasOwn(req.body, "status")
      ? cleanText(req.body?.status).toLowerCase()
      : cleanText(current.status).toLowerCase();
    const nextPriority = hasOwn(req.body, "priority")
      ? cleanText(req.body?.priority).toLowerCase()
      : cleanText(current.priority).toLowerCase();

    if (!nextTitle) {
      return res.status(400).json({ error: "title es obligatorio." });
    }

    if (!agendaTypes.has(nextType)) {
      return res.status(400).json({ error: "type invalido." });
    }

    if (!nextStartAt) {
      return res.status(400).json({ error: "start_at debe ser fecha valida." });
    }

    if (hasOwn(req.body, "end_at") && req.body?.end_at !== null && req.body?.end_at !== "" && !nextEndAt) {
      return res.status(400).json({ error: "end_at debe ser fecha valida." });
    }

    if (nextEndAt && nextEndAt < nextStartAt) {
      return res.status(400).json({ error: "end_at no puede ser menor que start_at." });
    }

    if (!agendaStatuses.has(nextStatus)) {
      return res.status(400).json({ error: "status invalido." });
    }

    if (!agendaPriorities.has(nextPriority)) {
      return res.status(400).json({ error: "priority invalido." });
    }

    const { rows } = await pool.query(
      `UPDATE agenda_events
       SET
         title = $1,
         type = $2,
         description = $3,
         start_at = $4,
         end_at = $5,
         status = $6,
         priority = $7,
         updated_at = NOW()
       WHERE id = $8
         AND client_id = $9
       RETURNING id, client_id, created_by_user_id, title, type, description, start_at, end_at, status, priority, created_at, updated_at`,
      [nextTitle, nextType, nextDescription, nextStartAt, nextEndAt, nextStatus, nextPriority, eventId, client.id]
    );

    return res.json({ event: rows[0] });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("agenda update error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.delete("/api/clients/:slug/agenda/:eventId", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const eventId = parseId(req.params?.eventId);
  if (!eventId) {
    return res.status(400).json({ error: "eventId invalido." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const { rows } = await pool.query(
      `DELETE FROM agenda_events
       WHERE id = $1
         AND client_id = $2
       RETURNING id`,
      [eventId, client.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }

    return res.json({ ok: true, event_id: eventId });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("agenda delete error:", e);
    return res.status(500).json({ error: "Error de servidor" });
  }
});

app.patch("/api/clients/:slug/agenda/:eventId/status", requireAuth, async (req, res) => {
  const slug = cleanText(req.params?.slug);
  const eventId = parseId(req.params?.eventId);
  const nextStatus = cleanText(req.body?.status).toLowerCase();

  if (!eventId) {
    return res.status(400).json({ error: "eventId invalido." });
  }

  if (!agendaStatuses.has(nextStatus)) {
    return res.status(400).json({ error: "status invalido." });
  }

  try {
    const client = await resolveClientAccessBySlug(pool, req.user, slug);
    const { rows } = await pool.query(
      `UPDATE agenda_events
       SET
         status = $1,
         updated_at = NOW()
       WHERE id = $2
         AND client_id = $3
       RETURNING id, client_id, created_by_user_id, title, type, description, start_at, end_at, status, priority, created_at, updated_at`,
      [nextStatus, eventId, client.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }

    return res.json({ event: rows[0] });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message });
    }

    console.error("agenda status update error:", e);
    return res.status(500).json({ error: "Error de servidor" });
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
      if (req.user.role !== "admin") {
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

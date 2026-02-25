import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";

const app = express();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

app.use(express.json());
app.use(cors({ origin: getCorsOrigins() }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/clients", async (req, res) => {
  const includeAll = req.query?.all === "1";

  try {
    const query = includeAll
      ? `SELECT slug, name, embed_url, is_active
         FROM clients
         ORDER BY name ASC`
      : `SELECT slug, name
         FROM clients
         WHERE is_active = TRUE
         ORDER BY name ASC`;

    const { rows } = await pool.query(query);

    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error de servidor" });
  }
});

app.get("/api/clients/:slug/embed", async (req, res) => {
  const { slug } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT slug, name, embed_url
       FROM clients
       WHERE slug = $1 AND is_active = TRUE
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) return res.status(404).json({ error: "Cliente no encontrado" });

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error de servidor" });
  }
});

app.post("/api/clients", async (req, res) => {
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

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on port ${port}`));

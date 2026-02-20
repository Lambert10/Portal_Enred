import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";

const app = express();

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

app.use(express.json());
app.use(cors({ origin: getCorsOrigins() }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/clients", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug, name
       FROM clients
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );

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

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on port ${port}`));

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

const emptyForm = {
  slug: "",
  name: "",
  embed_url: "",
  is_active: true,
};

function normalizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminProviders() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);

  async function loadProviders() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet("/api/clients?all=1");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [items]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setOk("");

    try {
      const payload = {
        slug: normalizeSlug(form.slug),
        name: String(form.name || "").trim(),
        embed_url: String(form.embed_url || "").trim(),
        is_active: !!form.is_active,
      };

      await apiPost("/api/clients", payload);
      setOk(`Proveedor "${payload.name}" guardado.`);
      setForm((prev) => ({ ...prev, slug: payload.slug, name: payload.name, embed_url: payload.embed_url }));
      await loadProviders();
    } catch (e2) {
      setErr(e2.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(client) {
    setErr("");
    setOk("");
    setForm({
      slug: client.slug || "",
      name: client.name || "",
      embed_url: client.embed_url || "",
      is_active: client.is_active !== false,
    });
  }

  function clearForm() {
    setErr("");
    setOk("");
    setForm(emptyForm);
  }

  return (
    <div className="adminGrid">
      <section className="adminPanel">
        <h2 className="adminTitle">Admin proveedores</h2>
        <p className="adminSub">Agrega o actualiza un proveedor para publicar otro dashboard de Power BI.</p>

        <form onSubmit={onSubmit} className="adminForm">
          <label className="adminLabel" htmlFor="name">
            Nombre proveedor
          </label>
          <input
            id="name"
            className="adminInput"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ej: Empresa Norte"
            required
          />

          <label className="adminLabel" htmlFor="slug">
            Slug
          </label>
          <input
            id="slug"
            className="adminInput"
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: normalizeSlug(e.target.value) }))}
            placeholder="empresa-norte"
            required
          />

          <label className="adminLabel" htmlFor="embed">
            URL embed Power BI
          </label>
          <textarea
            id="embed"
            className="adminInput adminTextarea"
            value={form.embed_url}
            onChange={(e) => setForm((prev) => ({ ...prev, embed_url: e.target.value }))}
            placeholder="https://app.powerbi.com/view?r=..."
            required
          />

          <label className="adminCheck">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            <span>Proveedor activo</span>
          </label>

          <div className="adminActions">
            <button type="submit" className="adminBtn" disabled={saving}>
              {saving ? "Guardando..." : "Guardar proveedor"}
            </button>
            <button type="button" className="adminBtnGhost" onClick={clearForm} disabled={saving}>
              Limpiar
            </button>
          </div>
        </form>

        {ok && <div className="state">{ok}</div>}
        {err && <div className="state error">Error: {err}</div>}
      </section>

      <section className="adminPanel">
        <h3 className="adminTitle">Proveedores cargados</h3>
        <p className="adminSub">Selecciona uno para editarlo o desactivarlo.</p>

        {loading ? (
          <div className="state">Cargando proveedores...</div>
        ) : sortedItems.length ? (
          <div className="adminList">
            {sortedItems.map((item) => (
              <button key={item.slug} type="button" className="adminListItem" onClick={() => startEdit(item)}>
                <strong>{item.name}</strong>
                <span>{item.slug}</span>
                <span className={item.is_active ? "adminStatus adminStatusOn" : "adminStatus"}>
                  {item.is_active ? "Activo" : "Inactivo"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="state">No hay proveedores todavia.</div>
        )}
      </section>
    </div>
  );
}

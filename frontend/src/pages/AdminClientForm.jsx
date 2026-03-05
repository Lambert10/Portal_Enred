import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../lib/api";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminClientForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const isCreate = !id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);
      setErr("");
      try {
        if (isCreate) {
          setForm(emptyForm);
          return;
        }

        const data = await apiGet(`/api/admin/clients/${id}`);
        if (!alive) return;

        const client = data?.client || {};
        setForm({
          slug: client.slug || "",
          name: client.name || "",
          embed_url: client.embed_url || "",
          is_active: client.is_active !== false,
        });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "No se pudo cargar el cliente.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [id, isCreate]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    const payload = {
      slug: normalizeSlug(form.slug),
      name: String(form.name || "").trim(),
      embed_url: String(form.embed_url || "").trim(),
      is_active: !!form.is_active,
    };

    if (isCreate && !slugPattern.test(payload.slug)) {
      setErr("Slug invalido. Usa solo minusculas, numeros y guiones.");
      return;
    }

    if (!payload.name) {
      setErr("El nombre es obligatorio.");
      return;
    }

    if (!isValidHttpUrl(payload.embed_url)) {
      setErr("embed_url debe ser una URL http/https valida.");
      return;
    }

    setSaving(true);
    try {
      if (isCreate) {
        await apiPost("/api/admin/clients", payload);
        nav("/admin/clients", { replace: true });
        return;
      }

      await apiPut(`/api/admin/clients/${id}`, {
        name: payload.name,
        embed_url: payload.embed_url,
        is_active: payload.is_active,
      });
      setOk("Cliente actualizado.");
    } catch (e2) {
      setErr(e2.message || "No se pudo guardar cliente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="state">Cargando formulario...</div>;

  return (
    <div className="adminUsersWrap">
      <section className="adminPanel adminUserFormPanel">
        <div className="adminUsersHead">
          <div>
            <h2 className="adminTitle">{isCreate ? "Crear cliente" : "Editar cliente"}</h2>
            <p className="adminSub">Configura nombre, slug y URL embed del dashboard.</p>
          </div>
          <Link className="adminBtnGhost adminBtnLink" to="/admin/clients">
            Volver
          </Link>
        </div>

        {ok && <div className="state">{ok}</div>}
        {err && <div className="state error">Error: {err}</div>}

        <form className="adminForm adminUserForm" onSubmit={onSubmit}>
          <label className="adminLabel" htmlFor="client-name">
            Nombre cliente
          </label>
          <input
            id="client-name"
            className="adminInput"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ej: Empresa Norte"
            required
          />

          <label className="adminLabel" htmlFor="client-slug">
            Slug
          </label>
          <input
            id="client-slug"
            className="adminInput"
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: normalizeSlug(e.target.value) }))}
            placeholder="empresa-norte"
            disabled={!isCreate}
            required
          />

          <label className="adminLabel" htmlFor="client-embed">
            URL embed Power BI
          </label>
          <textarea
            id="client-embed"
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
            <span>Cliente activo</span>
          </label>

          <div className="adminActions">
            <button type="submit" className="adminBtn" disabled={saving}>
              {saving ? "Guardando..." : isCreate ? "Crear cliente" : "Guardar cambios"}
            </button>
            <Link className="adminBtnGhost adminBtnLink" to="/admin/clients">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

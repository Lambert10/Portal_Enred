import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../lib/api";

const emptyForm = {
  email: "",
  full_name: "",
  role: "user",
  is_active: true,
  password: "",
  client_ids: [],
};

function toIntArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number.parseInt(String(item), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export default function AdminUserForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const isCreate = !id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);
      setErr("");
      try {
        const clientsData = await apiGet("/api/clients?all=1");
        const nextClients = Array.isArray(clientsData?.items) ? clientsData.items : [];

        if (!alive) return;
        setClients(nextClients);

        if (isCreate) {
          setForm(emptyForm);
          return;
        }

        const userData = await apiGet(`/api/admin/users/${id}`);
        if (!alive) return;

        const user = userData?.user || {};
        const assignedIds = toIntArray((userData?.clients || []).map((item) => item.id));
        setForm({
          email: user.email || "",
          full_name: user.full_name || "",
          role: user.role || "user",
          is_active: user.is_active !== false,
          password: "",
          client_ids: assignedIds,
        });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "No se pudo cargar la informacion.");
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

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [clients]
  );

  function onClientsChange(e) {
    const selectedIds = Array.from(e.target.selectedOptions).map((option) => Number(option.value));
    setForm((prev) => ({ ...prev, client_ids: toIntArray(selectedIds) }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    const payloadBase = {
      email: String(form.email || "").trim().toLowerCase(),
      full_name: String(form.full_name || "").trim(),
      role: String(form.role || "user"),
      is_active: !!form.is_active,
      client_ids: toIntArray(form.client_ids),
    };

    if (!payloadBase.email.includes("@")) {
      setErr("Email invalido.");
      return;
    }

    if (!["admin", "editor", "viewer", "user"].includes(payloadBase.role)) {
      setErr("Role invalido.");
      return;
    }

    if (isCreate && String(form.password || "").length < 8) {
      setErr("Password debe tener al menos 8 caracteres.");
      return;
    }

    if (!isCreate && form.password && form.password.length < 8) {
      setErr("Password debe tener al menos 8 caracteres.");
      return;
    }

    setSaving(true);
    try {
      if (isCreate) {
        await apiPost("/api/admin/users", {
          ...payloadBase,
          password: String(form.password || ""),
        });
        nav("/admin/users", { replace: true });
        return;
      }

      await apiPut(`/api/admin/users/${id}`, payloadBase);

      if (form.password) {
        await apiPut(`/api/admin/users/${id}/password`, { password: form.password });
      }

      setOk("Usuario actualizado.");
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (e2) {
      setErr(e2.message || "No se pudo guardar usuario.");
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
            <h2 className="adminTitle">{isCreate ? "Crear usuario" : "Editar usuario"}</h2>
            <p className="adminSub">Configura perfil, permisos y clientes asignados.</p>
          </div>
          <Link className="adminBtnGhost adminBtnLink" to="/admin/users">
            Volver
          </Link>
        </div>

        {ok && <div className="state">{ok}</div>}
        {err && <div className="state error">Error: {err}</div>}

        <form className="adminForm adminUserForm" onSubmit={onSubmit}>
          <label className="adminLabel" htmlFor="user-email">
            Email
          </label>
          <input
            id="user-email"
            className="adminInput"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="usuario@empresa.com"
            required
          />

          <label className="adminLabel" htmlFor="user-name">
            Nombre completo
          </label>
          <input
            id="user-name"
            className="adminInput"
            value={form.full_name}
            onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            placeholder="Nombre Apellido"
          />

          <div className="adminFormRow">
            <div>
              <label className="adminLabel" htmlFor="user-role">
                Rol
              </label>
              <select
                id="user-role"
                className="adminInput"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="user">user</option>
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <label className="adminCheck adminCheckInline">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              <span>Usuario activo</span>
            </label>
          </div>

          <label className="adminLabel" htmlFor="user-password">
            {isCreate ? "Password" : "Password nueva (opcional)"}
          </label>
          <input
            id="user-password"
            className="adminInput"
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder={isCreate ? "Minimo 8 caracteres" : "Solo si quieres resetear"}
          />

          <label className="adminLabel" htmlFor="user-clients">
            Acceso a clientes (multi-select)
          </label>
          <select
            id="user-clients"
            className="adminInput adminMultiSelect"
            multiple
            value={form.client_ids.map(String)}
            onChange={onClientsChange}
          >
            {sortedClients.map((client) => (
              <option key={client.slug} value={client.id}>
                {client.name} ({client.slug})
              </option>
            ))}
          </select>
          <p className="adminSub adminHint">Tip: usa Ctrl/Cmd para seleccionar varios clientes.</p>

          <div className="adminActions">
            <button type="submit" className="adminBtn" disabled={saving}>
              {saving ? "Guardando..." : isCreate ? "Crear usuario" : "Guardar cambios"}
            </button>
            <Link className="adminBtnGhost adminBtnLink" to="/admin/users">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

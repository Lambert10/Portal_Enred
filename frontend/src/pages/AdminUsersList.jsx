import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPut } from "../lib/api";

export default function AdminUsersList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function loadUsers() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet("/api/admin/users");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e.message || "No se pudieron cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));
  }, [items]);

  async function onResetPassword(user) {
    const nextPassword = window.prompt(`Nueva password para ${user.email} (minimo 8 caracteres):`, "");
    if (!nextPassword) return;

    if (nextPassword.length < 8) {
      setErr("Password debe tener al menos 8 caracteres.");
      return;
    }

    setBusyId(user.id);
    setErr("");
    setOk("");
    try {
      await apiPut(`/api/admin/users/${user.id}/password`, { password: nextPassword });
      setOk(`Password actualizada para ${user.email}.`);
    } catch (e) {
      setErr(e.message || "No se pudo resetear password.");
    } finally {
      setBusyId(null);
    }
  }

  async function onSoftDelete(user) {
    if (!window.confirm(`Desactivar usuario ${user.email}?`)) return;

    setBusyId(user.id);
    setErr("");
    setOk("");
    try {
      await apiDelete(`/api/admin/users/${user.id}`);
      setOk(`Usuario ${user.email} desactivado.`);
      await loadUsers();
    } catch (e) {
      setErr(e.message || "No se pudo desactivar usuario.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adminUsersWrap">
      <section className="adminPanel">
        <div className="adminUsersHead">
          <div>
            <h2 className="adminTitle">Admin usuarios</h2>
            <p className="adminSub">Gestiona cuentas, roles y permisos por cliente.</p>
          </div>
          <Link className="adminBtn adminBtnLink" to="/admin/users/new">
            Crear usuario
          </Link>
        </div>

        {ok && <div className="state">{ok}</div>}
        {err && <div className="state error">Error: {err}</div>}

        {loading ? (
          <div className="state">Cargando usuarios...</div>
        ) : sortedItems.length ? (
          <div className="adminUsersTableWrap">
            <table className="adminUsersTable">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="adminUserCell">
                        <strong>{user.full_name || "Sin nombre"}</strong>
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="adminPill">{user.role}</span>
                    </td>
                    <td>
                      <span className={user.is_active ? "adminStatus adminStatusOn" : "adminStatus"}>
                        {user.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>{String(user.created_at || "").slice(0, 10) || "-"}</td>
                    <td>
                      <div className="adminRowActions">
                        <Link className="adminBtnGhost adminBtnLink" to={`/admin/users/${user.id}`}>
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="adminBtnGhost"
                          onClick={() => onResetPassword(user)}
                          disabled={busyId === user.id}
                        >
                          Password
                        </button>
                        <button
                          type="button"
                          className="adminBtnGhost"
                          onClick={() => onSoftDelete(user)}
                          disabled={!user.is_active || busyId === user.id}
                        >
                          Desactivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state">No hay usuarios creados.</div>
        )}
      </section>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet } from "../lib/api";

export default function AdminClientsList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteErr, setDeleteErr] = useState("");

  async function loadClients() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet("/api/admin/clients");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e.message || "No se pudieron cargar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [items]
  );

  async function onSoftDelete(client) {
    if (!window.confirm(`Desactivar cliente ${client.name}?`)) return;

    setBusyId(client.id);
    setErr("");
    setOk("");
    try {
      await apiDelete(`/api/admin/clients/${client.id}`);
      setOk(`Cliente ${client.name} desactivado.`);
      await loadClients();
    } catch (e) {
      setErr(e.message || "No se pudo desactivar cliente.");
    } finally {
      setBusyId(null);
    }
  }

  function openPermanentDeleteModal(client) {
    const expectedName = String(client?.name || "");
    if (!expectedName.trim()) {
      setErr("No se puede confirmar eliminacion: cliente sin nombre valido.");
      return;
    }

    setDeleteTarget(client);
    setDeleteConfirmName("");
    setDeleteErr("");
  }

  function closePermanentDeleteModal() {
    if (busyId !== null) return;
    setDeleteTarget(null);
    setDeleteConfirmName("");
    setDeleteErr("");
  }

  async function onPermanentDelete() {
    if (!deleteTarget) return;

    const expectedName = String(deleteTarget?.name || "");
    if (deleteConfirmName !== expectedName) {
      setDeleteErr("El nombre ingresado no coincide exactamente.");
      return;
    }

    setBusyId(deleteTarget.id);
    setDeleteErr("");
    setErr("");
    setOk("");
    try {
      await apiDelete(`/api/admin/clients/${deleteTarget.id}/permanent`, {
        confirm_name: deleteConfirmName,
      });
      setOk(`Cliente ${expectedName} eliminado definitivamente.`);
      setDeleteTarget(null);
      setDeleteConfirmName("");
      await loadClients();
    } catch (e) {
      setDeleteErr(e.message || "No se pudo eliminar cliente.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adminUsersWrap">
      <section className="adminPanel">
        <div className="adminUsersHead">
          <div>
            <h2 className="adminTitle">Admin clientes</h2>
            <p className="adminSub">Gestiona clientes y su URL de dashboard externo.</p>
          </div>
          <Link className="adminBtn adminBtnLink" to="/admin/clients/new">
            Crear cliente
          </Link>
        </div>

        {ok && <div className="state">{ok}</div>}
        {err && <div className="state error">Error: {err}</div>}

        {loading ? (
          <div className="state">Cargando clientes...</div>
        ) : sortedItems.length ? (
          <div className="adminUsersTableWrap">
            <table className="adminUsersTable">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Slug</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="adminUserCell">
                        <strong>{client.name}</strong>
                        <span>{client.dashboard_url || client.embed_url}</span>
                      </div>
                    </td>
                    <td>
                      <span className="adminPill">{client.slug}</span>
                    </td>
                    <td>
                      <span className={client.is_active ? "adminStatus adminStatusOn" : "adminStatus"}>
                        {client.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>{String(client.created_at || "").slice(0, 10) || "-"}</td>
                    <td>
                      <div className="adminRowActions">
                        <Link className="adminBtnGhost adminBtnLink" to={`/admin/clients/${client.id}`}>
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="adminBtnGhost"
                          onClick={() => onSoftDelete(client)}
                          disabled={!client.is_active || busyId === client.id}
                        >
                          Desactivar
                        </button>
                        <button
                          type="button"
                          className="adminBtnDanger"
                          onClick={() => openPermanentDeleteModal(client)}
                          disabled={busyId === client.id}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state">No hay clientes creados.</div>
        )}
      </section>

      {deleteTarget && (
        <div className="agendaModalOverlay" onClick={busyId !== null ? undefined : closePermanentDeleteModal}>
          <section className="agendaModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="adminUsersHead">
              <div>
                <h3 className="adminTitle">Eliminar cliente</h3>
                <p className="adminSub">
                  Esta accion es permanente. Escribe el nombre exacto para confirmar:
                </p>
              </div>
              <button
                type="button"
                className="adminBtnGhost"
                onClick={closePermanentDeleteModal}
                disabled={busyId !== null}
              >
                Cerrar
              </button>
            </div>

            <p className="adminHint">
              Nombre esperado: <strong>{String(deleteTarget.name || "")}</strong>
            </p>

            {deleteErr && <div className="state error">Error: {deleteErr}</div>}

            <form
              className="adminForm adminUserForm"
              onSubmit={(e) => {
                e.preventDefault();
                onPermanentDelete();
              }}
            >
              <label className="adminLabel" htmlFor="confirm-delete-client-name">
                Confirmacion por nombre exacto
              </label>
              <input
                id="confirm-delete-client-name"
                className="adminInput"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Escribe el nombre exacto"
                autoFocus
                disabled={busyId !== null}
              />

              <div className="adminActions">
                <button type="submit" className="adminBtnDanger" disabled={busyId !== null}>
                  {busyId !== null ? "Eliminando..." : "Eliminar definitivamente"}
                </button>
                <button
                  type="button"
                  className="adminBtnGhost"
                  onClick={closePermanentDeleteModal}
                  disabled={busyId !== null}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

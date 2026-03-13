import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet } from "../lib/api";

export default function AdminClientsList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);

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

  async function onPermanentDelete(client) {
    const expectedName = String(client?.name || "");
    if (!expectedName.trim()) {
      setErr("No se puede confirmar eliminacion: cliente sin nombre valido.");
      return;
    }

    const typedName = window.prompt(
      `Eliminar cliente "${expectedName}" de forma definitiva.\nEsta accion borrara sus accesos y datos asociados.\n\nEscribe exactamente el nombre (incluyendo mayusculas y espacios) para confirmar:`,
      ""
    );

    if (typedName === null) return;

    if (typedName !== expectedName) {
      setErr("El nombre ingresado no coincide. Eliminacion cancelada.");
      setOk("");
      return;
    }

    if (!window.confirm(`Confirmas eliminar definitivamente al cliente "${expectedName}"?`)) return;

    setBusyId(client.id);
    setErr("");
    setOk("");
    try {
      await apiDelete(`/api/admin/clients/${client.id}/permanent`, {
        confirm_name: typedName,
      });
      setOk(`Cliente ${expectedName} eliminado definitivamente.`);
      await loadClients();
    } catch (e) {
      setErr(e.message || "No se pudo eliminar cliente.");
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
                          onClick={() => onPermanentDelete(client)}
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
    </div>
  );
}

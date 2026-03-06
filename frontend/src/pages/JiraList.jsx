import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";

export default function JiraList() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const data = await apiGet("/api/clients");
        if (!alive) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "No se pudo cargar clientes.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [items]
  );

  if (loading) return <div className="state">Cargando Jira...</div>;
  if (err) return <div className="state error">Error: {err}</div>;
  if (!sortedItems.length) return <div className="state">No hay clientes disponibles para Jira.</div>;

  return (
    <div className="adminUsersWrap">
      <section className="adminPanel">
        <div className="adminUsersHead">
          <div>
            <h2 className="adminTitle">Jira por cliente</h2>
            <p className="adminSub">Selecciona un cliente para ver y gestionar issues de Jira Cloud.</p>
          </div>
        </div>

        <div className="adminUsersTableWrap">
          <table className="adminUsersTable">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Slug</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((client) => (
                <tr key={client.slug}>
                  <td>
                    <div className="adminUserCell">
                      <strong>{client.name}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="adminPill">{client.slug}</span>
                  </td>
                  <td>
                    <div className="adminRowActions">
                      <Link className="adminBtn adminBtnLink" to={`/jira/${client.slug}`}>
                        Abrir Jira
                      </Link>
                      <Link className="adminBtnGhost adminBtnLink" to={`/dashboard/${client.slug}`}>
                        Ver dashboard
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

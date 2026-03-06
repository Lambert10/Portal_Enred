import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../lib/api";
import JiraIssueModal from "../components/JiraIssueModal";

export default function JiraClient() {
  const { slug } = useParams();

  const [metaLoading, setMetaLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [projectKey, setProjectKey] = useState("");
  const [jiraSiteUrl, setJiraSiteUrl] = useState("");
  const [filterText, setFilterText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  async function loadMeta() {
    setMetaLoading(true);
    setErr("");

    try {
      const data = await apiGet(`/api/clients/${slug}/jira/meta`);
      setMeta(data);
      setProjectKey(data?.connection?.project_key || "");
      setJiraSiteUrl(data?.connection?.jira_site_url || "");
    } catch (e) {
      setErr(e.message || "No se pudo cargar meta de Jira.");
      setMeta(null);
    } finally {
      setMetaLoading(false);
    }
  }

  async function loadIssues() {
    setIssuesLoading(true);
    setErr("");
    try {
      const data = await apiGet(`/api/clients/${slug}/jira/issues`);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e.message || "No se pudieron cargar issues.");
      setItems([]);
    } finally {
      setIssuesLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      await loadMeta();
      if (!alive) return;
    }

    load();
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!meta?.connected) {
      setItems([]);
      return;
    }
    loadIssues();
  }, [meta?.connected, slug]);

  const canWrite = Boolean(meta?.can_write);
  const canConnect = Boolean(meta?.can_connect);

  const filteredItems = useMemo(() => {
    const q = String(filterText || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const text = `${item.key} ${item.summary} ${item.status} ${item.priority}`.toLowerCase();
      return text.includes(q);
    });
  }, [items, filterText]);

  async function onConnectJira() {
    setErr("");
    setOk("");

    const key = String(projectKey || "").trim().toUpperCase();
    if (!key) {
      setErr("project_key es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const params = new URLSearchParams({ project_key: key });
      const site = String(jiraSiteUrl || "").trim();
      if (site) params.set("jira_site_url", site);

      const data = await apiGet(`/api/clients/${slug}/jira/connect-url?${params.toString()}`);
      if (!data?.url) throw new Error("No se pudo generar URL de conexion.");
      window.location.assign(data.url);
    } catch (e) {
      setErr(e.message || "No se pudo iniciar conexion Jira.");
      setSaving(false);
    }
  }

  function openCreate() {
    setSelectedIssue(null);
    setModalOpen(true);
  }

  function openEdit(issue) {
    setSelectedIssue(issue);
    setModalOpen(true);
  }

  async function onSaveIssue(payload) {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      if (selectedIssue?.key) {
        await apiPut(`/api/clients/${slug}/jira/issues/${selectedIssue.key}`, payload);
        setOk(`Issue ${selectedIssue.key} actualizado.`);
      } else {
        await apiPost(`/api/clients/${slug}/jira/issues`, payload);
        setOk("Issue creado.");
      }
      setModalOpen(false);
      await loadIssues();
    } catch (e) {
      setErr(e.message || "No se pudo guardar issue.");
    } finally {
      setSaving(false);
    }
  }

  if (metaLoading) return <div className="state">Cargando Jira...</div>;

  return (
    <div className="jiraWrap">
      <section className="adminPanel">
        <div className="adminUsersHead">
          <div>
            <h2 className="adminTitle">Jira {meta?.client?.name ? `- ${meta.client.name}` : `- ${slug}`}</h2>
            <p className="adminSub">Integracion Jira Cloud por cliente.</p>
          </div>

          <div className="adminRowActions">
            {canWrite && meta?.connected && (
              <button type="button" className="adminBtn" onClick={openCreate}>
                Nuevo issue
              </button>
            )}
            <Link className="adminBtnGhost adminBtnLink" to="/jira">
              Volver
            </Link>
          </div>
        </div>

        {ok && <div className="state">{ok}</div>}
        {err && <div className="state error">Error: {err}</div>}

        {!meta?.connected ? (
          <div className="jiraConnectBox">
            <div className="state">Jira no conectado para este cliente.</div>

            {canConnect ? (
              <div className="adminForm jiraConnectForm">
                <label className="adminLabel" htmlFor="jira-project-key">
                  Project Key
                </label>
                <input
                  id="jira-project-key"
                  className="adminInput"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                  placeholder="Ej: ABAS"
                />

                <label className="adminLabel" htmlFor="jira-site-url">
                  Jira Site URL (opcional)
                </label>
                <input
                  id="jira-site-url"
                  className="adminInput"
                  value={jiraSiteUrl}
                  onChange={(e) => setJiraSiteUrl(e.target.value)}
                  placeholder="https://tu-dominio.atlassian.net"
                />

                <div className="adminActions">
                  <button type="button" className="adminBtn" onClick={onConnectJira} disabled={saving}>
                    {saving ? "Conectando..." : "Conectar Jira"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="adminSub">Solo admin puede configurar la conexion Jira.</p>
            )}
          </div>
        ) : (
          <>
            <div className="jiraMetaRow">
              <span className="adminPill">Proyecto: {meta.connection?.project_key}</span>
              <span className="adminPill">Rol: {meta.role}</span>
              <span className="adminPill">Sitio: {meta.connection?.jira_site_url || "-"}</span>
            </div>

            <div className="jiraFilters">
              <label className="adminLabel" htmlFor="jira-filter-text">
                Buscar
              </label>
              <input
                id="jira-filter-text"
                className="adminInput"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="issue key, summary, status..."
              />
            </div>

            {issuesLoading ? (
              <div className="state">Cargando issues...</div>
            ) : filteredItems.length ? (
              <div className="adminUsersTableWrap">
                <table className="adminUsersTable">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Prioridad</th>
                      <th>Actualizado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((issue) => (
                      <tr key={issue.key}>
                        <td>
                          <div className="adminUserCell">
                            <strong>{issue.key}</strong>
                            <span>{issue.summary}</span>
                          </div>
                        </td>
                        <td>
                          <span className="adminPill">{issue.issue_type || "-"}</span>
                        </td>
                        <td>
                          <span className="adminPill">{issue.status || "-"}</span>
                        </td>
                        <td>{issue.priority || "-"}</td>
                        <td>{String(issue.updated || "").slice(0, 10) || "-"}</td>
                        <td>
                          <div className="adminRowActions">
                            {canWrite ? (
                              <button type="button" className="adminBtnGhost" onClick={() => openEdit(issue)}>
                                Editar
                              </button>
                            ) : (
                              <button type="button" className="adminBtnGhost" onClick={() => openEdit(issue)}>
                                Ver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="state">No hay issues para este proyecto.</div>
            )}
          </>
        )}
      </section>

      <JiraIssueModal
        open={modalOpen}
        issue={selectedIssue}
        saving={saving}
        canWrite={canWrite}
        onClose={() => (saving ? null : setModalOpen(false))}
        onSave={onSaveIssue}
      />
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";

const emptyForm = {
  summary: "",
  description: "",
  issueType: "Task",
  priority: "",
  status: "",
};

export default function JiraIssueModal({ open, issue, saving, canWrite, onClose, onSave }) {
  const isEdit = useMemo(() => Boolean(issue?.key), [issue]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    setErr("");
    if (isEdit) {
      setForm({
        summary: issue.summary || "",
        description: issue.description || "",
        issueType: issue.issue_type || "Task",
        priority: issue.priority || "",
        status: issue.status || "",
      });
      return;
    }

    setForm(emptyForm);
  }, [open, isEdit, issue]);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    const payload = {
      summary: String(form.summary || "").trim(),
      description: String(form.description || "").trim(),
      issueType: String(form.issueType || "Task").trim(),
      priority: String(form.priority || "").trim(),
      status: String(form.status || "").trim(),
    };

    if (!payload.summary) {
      setErr("summary es obligatorio.");
      return;
    }

    await onSave(payload);
  }

  if (!open) return null;

  return (
    <div className="agendaModalOverlay" onClick={saving ? undefined : onClose}>
      <section className="agendaModalCard" onClick={(e) => e.stopPropagation()}>
        <div className="adminUsersHead">
          <div>
            <h3 className="adminTitle">{isEdit ? `Editar ${issue.key}` : "Nuevo issue Jira"}</h3>
            <p className="adminSub">Gestiona summary, descripcion, prioridad y estado.</p>
          </div>
          <button type="button" className="adminBtnGhost" onClick={onClose} disabled={saving}>
            Cerrar
          </button>
        </div>

        {err && <div className="state error">Error: {err}</div>}

        <form className="adminForm adminUserForm" onSubmit={submit}>
          <label className="adminLabel" htmlFor="jira-summary">
            Summary
          </label>
          <input
            id="jira-summary"
            className="adminInput"
            value={form.summary}
            onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
            required
            disabled={!canWrite || saving}
          />

          <label className="adminLabel" htmlFor="jira-description">
            Description
          </label>
          <textarea
            id="jira-description"
            className="adminInput adminTextarea"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            disabled={!canWrite || saving}
          />

          <div className="adminFormRow">
            <div>
              <label className="adminLabel" htmlFor="jira-issue-type">
                Issue Type
              </label>
              <input
                id="jira-issue-type"
                className="adminInput"
                value={form.issueType}
                onChange={(e) => setForm((prev) => ({ ...prev, issueType: e.target.value }))}
                placeholder="Task"
                disabled={isEdit || !canWrite || saving}
              />
            </div>

            <div>
              <label className="adminLabel" htmlFor="jira-priority">
                Priority
              </label>
              <input
                id="jira-priority"
                className="adminInput"
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                placeholder="High / Medium / Low"
                disabled={!canWrite || saving}
              />
            </div>
          </div>

          {isEdit && (
            <>
              <label className="adminLabel" htmlFor="jira-status">
                Status
              </label>
              <input
                id="jira-status"
                className="adminInput"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                placeholder="Ej: In Progress, Done"
                disabled={!canWrite || saving}
              />
              <p className="adminSub adminHint">
                Se intentara transicionar al status indicado si existe una transicion valida en Jira.
              </p>
            </>
          )}

          <div className="adminActions">
            {canWrite && (
              <button type="submit" className="adminBtn" disabled={saving}>
                {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear issue"}
              </button>
            )}
            <button type="button" className="adminBtnGhost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

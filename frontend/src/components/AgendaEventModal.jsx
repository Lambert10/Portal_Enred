import React, { useEffect, useMemo, useState } from "react";

const emptyForm = {
  title: "",
  type: "actividad",
  description: "",
  start_at: "",
  end_at: "",
  status: "pendiente",
  priority: "media",
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function toIsoFromLocalInput(localValue) {
  const raw = String(localValue || "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function AgendaEventModal({
  open,
  onClose,
  onSave,
  onDelete,
  onMarkCompleted,
  initialEvent,
  defaultStartIso,
  saving,
}) {
  const isEdit = useMemo(() => Boolean(initialEvent?.id), [initialEvent]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;

    setErr("");
    if (isEdit) {
      setForm({
        title: initialEvent.title || "",
        type: initialEvent.type || "actividad",
        description: initialEvent.description || "",
        start_at: toLocalInputValue(initialEvent.start_at || initialEvent.start),
        end_at: toLocalInputValue(initialEvent.end_at || initialEvent.end),
        status: initialEvent.status || "pendiente",
        priority: initialEvent.priority || "media",
      });
      return;
    }

    const startIso = defaultStartIso || new Date().toISOString();
    const startDate = new Date(startIso);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    setForm({
      ...emptyForm,
      start_at: toLocalInputValue(startDate.toISOString()),
      end_at: toLocalInputValue(endDate.toISOString()),
    });
  }, [open, isEdit, initialEvent, defaultStartIso]);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    const payload = {
      title: String(form.title || "").trim(),
      type: String(form.type || "actividad"),
      description: String(form.description || "").trim() || null,
      start_at: toIsoFromLocalInput(form.start_at),
      end_at: toIsoFromLocalInput(form.end_at),
      status: String(form.status || "pendiente"),
      priority: String(form.priority || "media"),
    };

    if (!payload.title) {
      setErr("El titulo es obligatorio.");
      return;
    }

    if (!payload.start_at) {
      setErr("start_at es obligatorio.");
      return;
    }

    if (form.end_at && !payload.end_at) {
      setErr("end_at no es valido.");
      return;
    }

    if (payload.end_at && payload.end_at < payload.start_at) {
      setErr("end_at no puede ser menor que start_at.");
      return;
    }

    await onSave(payload);
  }

  async function handleDelete() {
    if (!isEdit || !onDelete) return;
    if (!window.confirm("Eliminar este evento?")) return;
    await onDelete(initialEvent.id);
  }

  async function handleMarkCompleted() {
    if (!isEdit || !onMarkCompleted) return;
    await onMarkCompleted(initialEvent.id);
  }

  if (!open) return null;

  return (
    <div className="agendaModalOverlay" onClick={saving ? undefined : onClose}>
      <section className="agendaModalCard" onClick={(e) => e.stopPropagation()}>
        <div className="adminUsersHead">
          <div>
            <h3 className="adminTitle">{isEdit ? "Editar evento" : "Nuevo evento"}</h3>
            <p className="adminSub">Actividad, hito o compromiso del cliente.</p>
          </div>
          <button type="button" className="adminBtnGhost" onClick={onClose} disabled={saving}>
            Cerrar
          </button>
        </div>

        {err && <div className="state error">Error: {err}</div>}

        <form className="adminForm adminUserForm" onSubmit={submit}>
          <label className="adminLabel" htmlFor="agenda-title">
            Titulo
          </label>
          <input
            id="agenda-title"
            className="adminInput"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Ej: Revision mensual de KPIs"
            required
          />

          <div className="adminFormRow">
            <div>
              <label className="adminLabel" htmlFor="agenda-type">
                Tipo
              </label>
              <select
                id="agenda-type"
                className="adminInput"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="actividad">actividad</option>
                <option value="hito">hito</option>
                <option value="compromiso">compromiso</option>
              </select>
            </div>

            <div>
              <label className="adminLabel" htmlFor="agenda-status">
                Estado
              </label>
              <select
                id="agenda-status"
                className="adminInput"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="pendiente">pendiente</option>
                <option value="en_progreso">en_progreso</option>
                <option value="completado">completado</option>
                <option value="cancelado">cancelado</option>
              </select>
            </div>
          </div>

          <label className="adminLabel" htmlFor="agenda-description">
            Descripcion
          </label>
          <textarea
            id="agenda-description"
            className="adminInput adminTextarea"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Detalle opcional"
          />

          <div className="adminFormRow">
            <div>
              <label className="adminLabel" htmlFor="agenda-start">
                Inicio
              </label>
              <input
                id="agenda-start"
                className="adminInput"
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="adminLabel" htmlFor="agenda-end">
                Fin
              </label>
              <input
                id="agenda-end"
                className="adminInput"
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))}
              />
            </div>
          </div>

          <label className="adminLabel" htmlFor="agenda-priority">
            Prioridad
          </label>
          <select
            id="agenda-priority"
            className="adminInput"
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
          >
            <option value="baja">baja</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
          </select>

          <div className="adminActions">
            <button type="submit" className="adminBtn" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear evento"}
            </button>
            {isEdit && (
              <button
                type="button"
                className="adminBtnGhost"
                onClick={handleMarkCompleted}
                disabled={saving || form.status === "completado"}
              >
                Completar
              </button>
            )}
            {isEdit && (
              <button type="button" className="adminBtnGhost" onClick={handleDelete} disabled={saving}>
                Eliminar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

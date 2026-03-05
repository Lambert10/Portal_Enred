import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../lib/api";
import AgendaEventModal from "../components/AgendaEventModal";

function formatDateLocal(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultStartForDateClick(dateInfo) {
  const rawDate = dateInfo?.date instanceof Date ? dateInfo.date : new Date();
  const date = new Date(rawDate);
  date.setSeconds(0, 0);

  if (dateInfo?.allDay) {
    date.setHours(9, 0, 0, 0);
  }

  return date.toISOString();
}

export default function AgendaClient() {
  const { slug } = useParams();
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [client, setClient] = useState(null);
  const [items, setItems] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [defaultStartIso, setDefaultStartIso] = useState("");

  async function loadAgenda(nextRange = range) {
    if (!nextRange?.from || !nextRange?.to) return;

    setLoading(true);
    setErr("");
    try {
      const data = await apiGet(`/api/clients/${slug}/agenda?from=${nextRange.from}&to=${nextRange.to}`);
      setClient(data?.client || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e.message || "No se pudo cargar la agenda.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!range.from || !range.to) return;
    loadAgenda(range);
  }, [slug, range.from, range.to]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const typeOk = filterType === "all" || item.type === filterType;
      const statusOk = filterStatus === "all" || item.status === filterStatus;
      return typeOk && statusOk;
    });
  }, [items, filterType, filterStatus]);

  const calendarEvents = useMemo(() => {
    return filteredItems.map((item) => ({
      id: String(item.id),
      title: item.title,
      start: item.start_at,
      end: item.end_at || undefined,
      classNames: [`agendaEventType-${item.type}`, `agendaEventStatus-${item.status}`],
      extendedProps: { ...item },
    }));
  }, [filteredItems]);

  function handleDatesSet(info) {
    const from = formatDateLocal(info.start);
    const to = formatDateLocal(new Date(info.end.getTime() - 24 * 60 * 60 * 1000));
    setRange((prev) => {
      if (prev.from === from && prev.to === to) return prev;
      return { from, to };
    });
  }

  function openCreate(startIso) {
    setOk("");
    setErr("");
    setSelectedEvent(null);
    setDefaultStartIso(startIso || new Date().toISOString());
    setModalOpen(true);
  }

  function openEdit(eventData) {
    setOk("");
    setErr("");
    setSelectedEvent(eventData);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  async function handleSave(payload) {
    setSaving(true);
    setErr("");
    setOk("");

    try {
      if (selectedEvent?.id) {
        await apiPut(`/api/clients/${slug}/agenda/${selectedEvent.id}`, payload);
        setOk("Evento actualizado.");
      } else {
        await apiPost(`/api/clients/${slug}/agenda`, payload);
        setOk("Evento creado.");
      }

      setModalOpen(false);
      await loadAgenda();
    } catch (e) {
      setErr(e.message || "No se pudo guardar el evento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId) {
    setSaving(true);
    setErr("");
    setOk("");

    try {
      await apiDelete(`/api/clients/${slug}/agenda/${eventId}`);
      setOk("Evento eliminado.");
      setModalOpen(false);
      await loadAgenda();
    } catch (e) {
      setErr(e.message || "No se pudo eliminar el evento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCompleted(eventId) {
    setSaving(true);
    setErr("");
    setOk("");

    try {
      await apiPatch(`/api/clients/${slug}/agenda/${eventId}/status`, { status: "completado" });
      setOk("Evento marcado como completado.");
      setModalOpen(false);
      await loadAgenda();
    } catch (e) {
      setErr(e.message || "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  }

  function onDateClick(info) {
    openCreate(defaultStartForDateClick(info));
  }

  function onEventClick(info) {
    const ext = info?.event?.extendedProps || {};
    openEdit({
      id: Number.parseInt(info.event.id, 10),
      title: info.event.title || "",
      type: ext.type || "actividad",
      description: ext.description || "",
      start_at: info.event.start ? info.event.start.toISOString() : ext.start_at,
      end_at: info.event.end ? info.event.end.toISOString() : ext.end_at,
      status: ext.status || "pendiente",
      priority: ext.priority || "media",
    });
  }

  return (
    <div className="agendaWrap">
      <section className="adminPanel">
        <div className="adminUsersHead">
          <div>
            <h2 className="adminTitle">Agenda {client?.name ? `- ${client.name}` : `- ${slug}`}</h2>
            <p className="adminSub">Calendario de actividades, hitos y compromisos por cliente.</p>
          </div>

          <div className="adminRowActions">
            <button type="button" className="adminBtn" onClick={() => openCreate(new Date().toISOString())}>
              Nuevo evento
            </button>
            <Link className="adminBtnGhost adminBtnLink" to="/agenda">
              Volver
            </Link>
          </div>
        </div>

        <div className="agendaFilters">
          <label className="adminLabel" htmlFor="agenda-filter-type">
            Tipo
          </label>
          <select
            id="agenda-filter-type"
            className="adminInput"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">todos</option>
            <option value="actividad">actividad</option>
            <option value="hito">hito</option>
            <option value="compromiso">compromiso</option>
          </select>

          <label className="adminLabel" htmlFor="agenda-filter-status">
            Estado
          </label>
          <select
            id="agenda-filter-status"
            className="adminInput"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">todos</option>
            <option value="pendiente">pendiente</option>
            <option value="en_progreso">en_progreso</option>
            <option value="completado">completado</option>
            <option value="cancelado">cancelado</option>
          </select>
        </div>

        {ok && <div className="state">{ok}</div>}
        {err && <div className="state error">Error: {err}</div>}
        {loading && <div className="state">Cargando agenda...</div>}

        <div className="agendaCalendarWrap">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={calendarEvents}
            datesSet={handleDatesSet}
            dateClick={onDateClick}
            eventClick={onEventClick}
            nowIndicator
            height="auto"
          />
        </div>
      </section>

      <AgendaEventModal
        open={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
        onMarkCompleted={handleMarkCompleted}
        initialEvent={selectedEvent}
        defaultStartIso={defaultStartIso}
        saving={saving}
      />
    </div>
  );
}

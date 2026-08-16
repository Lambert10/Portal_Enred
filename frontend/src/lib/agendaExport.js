const excelFormulaPrefix = /^[=+\-@]/;

function safeSpreadsheetText(value) {
  const text = String(value ?? "");
  return excelFormulaPrefix.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const text = safeSpreadsheetText(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatChileDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}

function durationHours(startValue, endValue) {
  if (!startValue || !endValue) return "";
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";
  return ((end.getTime() - start.getTime()) / 3_600_000).toFixed(2).replace(".", ",");
}

export function filterAgendaForExport(items, { type = "all", status = "all", throughDate } = {}) {
  return (Array.isArray(items) ? items : []).filter((item) => {
    const itemDate = item?.start_at ? new Date(item.start_at) : null;
    const localDate = itemDate && !Number.isNaN(itemDate.getTime())
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Santiago",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(itemDate)
      : "";

    return (
      (type === "all" || item?.type === type) &&
      (status === "all" || item?.status === status) &&
      (!throughDate || (localDate && localDate <= throughDate))
    );
  });
}

export function buildAgendaCsv(items) {
  const headers = [
    "ID evento",
    "Título",
    "Tipo",
    "Descripción",
    "Inicio (Chile)",
    "Fin (Chile)",
    "Duración (horas)",
    "Estado",
    "Prioridad",
    "Creado (Chile)",
    "Actualizado (Chile)",
  ];

  const rows = (Array.isArray(items) ? items : []).map((item) => [
    item?.id ?? "",
    item?.title ?? "",
    item?.type ?? "",
    item?.description ?? "",
    formatChileDateTime(item?.start_at),
    formatChileDateTime(item?.end_at),
    durationHours(item?.start_at, item?.end_at),
    item?.status ?? "",
    item?.priority ?? "",
    formatChileDateTime(item?.created_at),
    formatChileDateTime(item?.updated_at),
  ]);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function downloadAgendaCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

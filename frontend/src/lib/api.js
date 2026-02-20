export async function apiGet(path) {
  const base = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${base}${cleanPath}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

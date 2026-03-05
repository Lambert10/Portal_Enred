async function apiRequest(path, options = {}) {
  const base = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers || {});

  try {
    const token = localStorage.getItem("enred_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    // ignore localStorage access errors
  }

  const res = await fetch(`${base}${cleanPath}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export function apiGet(path) {
  return apiRequest(path);
}

export function apiPost(path, body) {
  return apiRequest(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
}

export function apiPut(path, body) {
  return apiRequest(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
}

export function apiDelete(path) {
  return apiRequest(path, {
    method: "DELETE",
  });
}

export function apiPatch(path, body) {
  return apiRequest(path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
}

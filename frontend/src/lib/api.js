// frontend/src/lib/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http://") || path.startsWith("https://") ? path : `${API_BASE}${path}`;
  const fetchOpts = {
    credentials: "include", // ensure cookies/session are sent
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    cache: opts.cache || "no-store", // default: bypass cache for admin-critical calls
    ...opts,
  };

  const res = await fetch(url, fetchOpts);
  const contentType = res.headers.get("Content-Type") || "";
  let body = null;
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const err = new Error(body?.detail || res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

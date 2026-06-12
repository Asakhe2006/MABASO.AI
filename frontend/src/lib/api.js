// Central credentialed fetch helper
export async function apiFetch(path, options = {}) {
  const base = process.env.REACT_APP_API_BASE || '';
  const url = path.startsWith('http') ? path : `${base}${path}`;

  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const init = Object.assign({}, options, { headers, credentials: 'include' });

  // cache-bust if provided
  if (options.cacheBust) {
    const sep = url.includes('?') ? '&' : '?';
    const ts = Date.now();
    return fetch(`${url}${sep}_=${ts}`, init).then(handleResponse);
  }

  return fetch(url, init).then(handleResponse);
}

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    const err = new Error(res.statusText || 'Fetch error');
    err.status = res.status;
    err.body = json || text;
    throw err;
  }
  return res.json().catch(() => null);
}

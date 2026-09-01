// Cliente HTTP simples. Sempre com credentials: 'include' para levar o cookie
// httpOnly da sessao. Nenhuma chave do Supabase existe aqui — o frontend so
// conversa com o backend Express.

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = new Error((body && body.error) || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  me: () => request('/api/auth/me'),

  logs: ({ page = 1, limit = 20, success = '', q = '' } = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (success !== '') params.set('success', success);
    if (q) params.set('q', q);
    return request(`/api/logs?${params.toString()}`);
  },

  log: (id) => request(`/api/logs/${id}`),
};

// Cliente HTTP simples. Sempre com credentials: 'include' para levar o cookie
// httpOnly da sessao. Nenhuma chave do Supabase existe aqui — o frontend so
// conversa com o backend Express.

// Extrai uma mensagem legivel do corpo de erro.
// O backend responde { error: "texto" }, mas quando a requisicao nao chega ate
// ele (rewrite errado, deploy fora do ar) quem responde e a plataforma, com um
// objeto no lugar da string — era isso que virava "[object Object]" na tela.
function errorMessage(body, status, rawText) {
  const detail = body ? (body.error ?? body.message ?? body) : null;

  if (typeof detail === 'string' && detail.trim()) return detail;

  if (detail && typeof detail === 'object') {
    // Ex.: Vercel -> { error: { code: "NOT_FOUND", message: "..." } }
    const parts = [detail.code, detail.message].filter((v) => typeof v === 'string' && v);
    if (parts.length) return `${parts.join(': ')} (HTTP ${status})`;
    try {
      return `${JSON.stringify(detail)} (HTTP ${status})`;
    } catch {
      /* cai no retorno padrao */
    }
  }

  // Resposta que nem JSON era (HTML de 404, pagina de erro do proxy...)
  if (rawText && !body) {
    const isHtml = /^\s*<(!doctype|html)/i.test(rawText);
    if (isHtml) {
      return `A API respondeu HTML em vez de JSON (HTTP ${status}). ` +
        'Confira se /api esta roteado para o backend.';
    }
    const snippet = rawText.trim().slice(0, 120);
    if (snippet) return `${snippet} (HTTP ${status})`;
  }

  return `Erro ${status}`;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...options,
    });
  } catch (networkError) {
    const err = new Error('Nao foi possivel falar com o servidor. Verifique sua conexao.');
    err.status = 0;
    err.cause = networkError;
    throw err;
  }

  // Le como texto: assim uma resposta nao-JSON continua utilizavel no diagnostico
  const rawText = await res.text().catch(() => '');
  let body = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = new Error(errorMessage(body, res.status, rawText));
    err.status = res.status;
    err.body = body;
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

  changePassword: (currentPassword, newPassword) =>
    request('/api/settings/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  changeAccount: (email, currentPassword) =>
    request('/api/settings/account', {
      method: 'PATCH',
      body: JSON.stringify({ email, currentPassword }),
    }),
};

'use strict';

const express = require('express');
const axios = require('axios');
const supabase = require('../lib/supabase');
const config = require('../config');
const log = require('../lib/log');

const router = express.Router();

// Captura o corpo cru para conseguir logar mesmo quando o JSON vier malformado.
const jsonParser = express.json({
  limit: '2mb',
  type: () => true, // aceita qualquer content-type que a Axxon mandar
  verify: (req, _res, buf) => {
    req.rawBody = buf && buf.length ? buf.toString('utf8') : '';
  },
});

// Se o parse falhar, nao derruba: segue com received_body = { _raw: "..." }
function jsonParserSafe(req, res, next) {
  jsonParser(req, res, (err) => {
    if (err) {
      log.warn('[webhook] body nao é JSON valido, seguindo com raw:', err.message);
      req.body = undefined;
      req.bodyParseError = err.message;
    }
    next();
  });
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

// Remove headers sensiveis antes de gravar no banco
function sanitizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = ['authorization', 'cookie', 'proxy-authorization'].includes(k.toLowerCase())
      ? '[REDACTED]'
      : v;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retentativa APENAS em erro de rede/timeout (quando nao ha resposta HTTP).
function isNetworkError(err) {
  return !err.response;
}

/**
 * Reencaminha o payload IDENTICO para DEST_URL.
 * Com raw=true, envia os bytes exatamente como chegaram (sem re-serializar).
 * Retorna { status, data, error } — nunca lanca.
 */
async function forwardPayload(payload, { raw = false, contentType } = {}) {
  const attempts = config.forward.maxRetries + 1;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const wait = config.forward.backoffMs[attempt - 1] || 1500;
      log.warn(`[webhook] retry ${attempt}/${config.forward.maxRetries} em ${wait}ms`);
      await sleep(wait);
    }
    try {
      const response = await axios.post(config.destUrl, payload, {
        headers: { 'Content-Type': contentType || 'application/json' },
        timeout: config.forward.timeoutMs,
        // raw: entrega a string intacta, sem o axios re-serializar em JSON
        ...(raw ? { transformRequest: [(data) => data] } : {}),
        // Nao lanca para status HTTP de erro: 4xx/5xx sao respostas validas do destino
        validateStatus: () => true,
        maxRedirects: 5,
      });
      return { status: response.status, data: response.data, error: null };
    } catch (err) {
      lastError = err;
      if (!isNetworkError(err)) break; // erro nao-rede: nao adianta repetir
    }
  }

  return {
    status: null,
    data: null,
    error: lastError ? (lastError.code ? `${lastError.code}: ${lastError.message}` : lastError.message) : 'Falha desconhecida no reenvio',
  };
}

// Garante que o valor cabe numa coluna jsonb
function toJsonb(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'object') return value;
  // string/number/boolean: embrulha para manter a resposta crua visivel no painel
  return { _raw: value };
}

router.post('/axxon', jsonParserSafe, async (req, res) => {
  let logId = null;

  // ---- 1. Salva o que chegou -----------------------------------------
  const receivedBody = req.bodyParseError
    ? { _raw: req.rawBody || '', _parse_error: req.bodyParseError }
    : (req.body ?? {});

  try {
    const { data, error } = await supabase
      .from('webhook_logs')
      .insert({
        gateway: 'axxon',
        source_ip: clientIp(req),
        received_headers: sanitizeHeaders(req.headers),
        received_body: toJsonb(receivedBody),
        forwarded_url: config.destUrl,
        success: false,
      })
      .select('id')
      .single();

    if (error) log.error('[webhook] falha ao inserir log:', error.message);
    else logId = data.id;
  } catch (err) {
    log.error('[webhook] excecao ao inserir log:', err.message);
  }

  // ---- 2. Reencaminha o payload IDENTICO ------------------------------
  // Se o corpo nao era JSON valido, reenvia os bytes crus exatamente como vieram.
  const isRaw = Boolean(req.bodyParseError);
  const result = isRaw
    ? await forwardPayload(req.rawBody || '', {
        raw: true,
        contentType: req.headers['content-type'] || 'application/json',
      })
    : await forwardPayload(req.body ?? {});
  const success = result.status !== null && result.status >= 200 && result.status < 300;

  // ---- 3. Atualiza o log com o resultado do reenvio --------------------
  if (logId !== null) {
    try {
      const { error } = await supabase
        .from('webhook_logs')
        .update({
          forwarded_url: config.destUrl,
          forwarded_status: result.status,
          forwarded_response: toJsonb(result.data),
          forwarded_at: new Date().toISOString(),
          success,
          error: result.error,
        })
        .eq('id', logId);
      if (error) log.error('[webhook] falha ao atualizar log:', error.message);
    } catch (err) {
      log.error('[webhook] excecao ao atualizar log:', err.message);
    }
  }

  log.info(`[webhook] id=${logId} -> ${config.destUrl} status=${result.status} success=${success}`);

  // ---- 4. Responde a Axxon com o MESMO status do destino ---------------
  // Se nem chegamos a falar com o destino, devolve 502 para a Axxon reenviar.
  if (result.status === null) {
    return res.status(502).json({ ok: false, error: result.error });
  }
  return res.status(result.status).json(
    result.data !== null && result.data !== undefined && typeof result.data === 'object'
      ? result.data
      : { ok: success, forwarded_status: result.status, response: result.data ?? null }
  );
});

module.exports = router;

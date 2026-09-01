'use strict';

/**
 * Entrypoint serverless da Vercel.
 *
 * Todas as rotas dinamicas (/api/*, /webhook/*, /health) sao reescritas para
 * este arquivo pelo vercel.json; o painel React e servido como estatico a
 * partir de frontend/dist. O mesmo app Express roda aqui e na VPS.
 */

const app = require('../backend/src/app');

/**
 * O runtime Node da Vercel pode consumir o stream da requisicao e entregar o
 * corpo ja pronto em req.body. Quando isso acontece, o body-parser do Express
 * ficaria esperando um stream que nunca chega. Normalizamos aqui:
 *
 *  - req.rawBody      -> texto cru (usado no log e no reenvio byte a byte)
 *  - req.body         -> objeto JSON quando der para parsear
 *  - req.bodyParseError -> preenchido quando nao e JSON valido
 *  - req._body = true -> flag do body-parser para pular o parse
 */
function normalizeBody(req) {
  if (req.body === undefined || req.body === null) return; // stream intacto

  let raw;
  if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');
  else if (typeof req.body === 'string') raw = req.body;
  else raw = JSON.stringify(req.body);

  req.rawBody = raw;

  // Runtime ja devolveu objeto parseado: nada a fazer alem de marcar a flag
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req._body = true;
    return;
  }

  try {
    req.body = JSON.parse(raw);
  } catch (err) {
    req.body = undefined;
    req.bodyParseError = err.message;
  }
  req._body = true;
}

module.exports = (req, res) => {
  try {
    normalizeBody(req);
  } catch (err) {
    // Nunca derrubar a function por causa da normalizacao
    console.error('[vercel] falha ao normalizar o body:', err && err.message);
  }
  return app(req, res);
};

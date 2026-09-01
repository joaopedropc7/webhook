'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./config');
const log = require('./lib/log');
const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const logsRoutes = require('./routes/logs');
const settingsRoutes = require('./routes/settings');
const { ensureDefaultAdmin } = require('./lib/seed');

const app = express();

// Atras de nginx/Render/Railway: confia no X-Forwarded-For para pegar o IP real
app.set('trust proxy', true);
app.disable('x-powered-by');

app.use(cookieParser());

// Config incompleta: responde 503 dizendo exatamente o que falta, em vez de
// deixar cada rota estourar um 500 sem explicacao.
app.use((req, res, next) => {
  if (!config.missingEnv.length) return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return res.status(503).json({
      error: `Configuracao ausente no servidor: ${config.missingEnv.join(', ')}`,
    });
  }
  return next();
});

// Healthcheck (publico)
app.get('/', (req, res, next) => {
  // Em producao a raiz serve o painel React; o healthcheck responde
  // JSON quando o cliente pede JSON ou quando nao ha build do frontend.
  const wantsJson = (req.headers.accept || '').includes('application/json');
  if (wantsJson || !fs.existsSync(path.join(__dirname, '../../frontend/dist/index.html'))) {
    return health(req, res);
  }
  return next();
});

// Healthcheck: 503 + nomes (nunca valores) das variaveis que faltam
function health(req, res) {
  if (config.missingEnv.length) {
    return res.status(503).json({ ok: false, missingEnv: config.missingEnv });
  }
  if (config.warnings.length) {
    return res.status(200).json({ ok: true, warnings: config.warnings });
  }
  return res.status(200).json({ ok: true });
}
app.get('/health', health);

// Webhook publico (parser proprio dentro da rota, para capturar o corpo cru)
app.use('/webhook', webhookRoutes);

// APIs do painel
app.use('/api', express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota nao encontrada' }));

// ---- Frontend (build do Vite) --------------------------------------
const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback (nao intercepta /api nem /webhook, ja tratados acima)
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  log.info(`[app] servindo frontend de ${distDir}`);
} else {
  log.warn('[app] frontend/dist nao encontrado — rode "npm run build" para servir o painel');
}

// Cria o usuario padrao se a tabela users estiver vazia (uma vez por processo)
if (!config.missingEnv.length) ensureDefaultAdmin();

// Handler de erro final: nunca derruba o processo
app.use((err, req, res, _next) => {
  log.error('[app] erro nao tratado:', err && err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erro interno' });
});

module.exports = app;

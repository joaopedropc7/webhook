'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Onde procurar o .env, em ordem. Cobre o dev local, a VPS e o bundle da
// serverless function da Vercel (onde o cwd e a raiz sao /var/task).
const ENV_CANDIDATES = [
  path.resolve(__dirname, '../../.env'), // raiz do projeto
  path.resolve(__dirname, '../.env'),    // backend/.env
  path.resolve(process.cwd(), '.env'),   // cwd (Vercel: /var/task)
];

// dotenv NAO sobrescreve o que ja existe em process.env: as variaveis
// cadastradas no painel da Vercel/Render sempre vencem o arquivo.
const loadedEnvFiles = [];
for (const candidate of ENV_CANDIDATES) {
  if (loadedEnvFiles.includes(candidate)) continue;
  try {
    if (!fs.existsSync(candidate)) continue;
    const result = dotenv.config({ path: candidate });
    if (!result.error) loadedEnvFiles.push(candidate);
  } catch {
    // .env ilegivel nao pode derrubar o boot: as vars do painel podem bastar
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Variavel de ambiente obrigatoria ausente: ${name}`);
    process.exit(1);
  }
  return value;
}

const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  destUrl: process.env.DEST_URL || 'https://apipix-delta.vercel.app/api/webhook/axxon',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  cookieName: process.env.COOKIE_NAME || 'axxon_session',
  // Sem COOKIE_SECURE definido, decide sozinho: HTTPS em producao/Vercel,
  // http em local. Assim o mesmo .env versionado serve nos dois ambientes.
  cookieSecure:
    process.env.COOKIE_SECURE === undefined || process.env.COOKIE_SECURE === ''
      ? Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'
      : String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
  // Usuario padrao criado no primeiro boot, quando a tabela users esta vazia.
  defaultAdmin: {
    enabled: String(process.env.SEED_DEFAULT_ADMIN || 'true').toLowerCase() !== 'false',
    user: process.env.DEFAULT_ADMIN_USER || 'admin',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'password',
  },
  forward: {
    // Ajustaveis para caber no limite de execucao de plataformas serverless.
    // Pior caso = (maxRetries + 1) * timeoutMs + soma dos backoffs.
    timeoutMs: Number(process.env.FORWARD_TIMEOUT_MS || 10000),
    maxRetries: Number(process.env.FORWARD_MAX_RETRIES ?? 2), // 2 = 3 tentativas
    backoffMs: [500, 1500],    // backoff entre as retentativas
  },
};

config.loadedEnvFiles = loadedEnvFiles;

module.exports = config;

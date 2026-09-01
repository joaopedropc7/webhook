'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Onde procurar o .env, em ordem de precedencia.
// O local canonico e backend/.env: na Vercel o backend e um service com
// root "backend", entao o arquivo precisa estar dentro dessa pasta para ser
// empacotado junto do codigo.
const ENV_CANDIDATES = [
  path.resolve(__dirname, '../.env'),    // backend/.env (canonico)
  path.resolve(__dirname, '../../.env'), // raiz do projeto (compatibilidade)
  path.resolve(process.cwd(), '.env'),   // cwd do processo
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

// Variaveis obrigatorias que nao foram encontradas.
// Nao derrubamos o processo: num ambiente serverless, morrer no boot vira um
// 500 opaco. Guardamos a lista e o app responde 503 dizendo o que falta.
const missingEnv = [];

function required(name) {
  const value = process.env[name];
  if (!value) {
    missingEnv.push(name);
    return '';
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

// A chave do Supabase e um JWT com a claim "role". Trocar a service_role pela
// anon e um erro silencioso: com RLS ligado, as consultas voltam vazias em vez
// de dar erro, e o painel parece "sem dados" ou recusa o login sem explicacao.
function supabaseKeyRole(key) {
  try {
    const payload = JSON.parse(Buffer.from(String(key).split('.')[1], 'base64').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null; // formato novo (sb_secret_...) ou chave invalida: nao da para saber
  }
}

const keyRole = config.supabaseServiceRoleKey ? supabaseKeyRole(config.supabaseServiceRoleKey) : null;
const warnings = [];
if (keyRole && keyRole !== 'service_role') {
  warnings.push(
    `SUPABASE_SERVICE_ROLE_KEY contem a chave "${keyRole}", nao a service_role. ` +
      'Pegue a chave service_role em Project Settings -> API.'
  );
}

config.loadedEnvFiles = loadedEnvFiles;
config.missingEnv = missingEnv;
config.supabaseKeyRole = keyRole;
config.warnings = warnings;

for (const warning of warnings) console.error(`[config] ATENCAO: ${warning}`);

if (missingEnv.length) {
  console.error(
    `[config] Variaveis de ambiente obrigatorias ausentes: ${missingEnv.join(', ')}. ` +
      (loadedEnvFiles.length
        ? `.env lido de: ${loadedEnvFiles.join(', ')}`
        : 'Nenhum arquivo .env encontrado — cadastre as variaveis no painel do provedor.')
  );
}

module.exports = config;

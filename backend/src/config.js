'use strict';

const path = require('path');
const dotenv = require('dotenv');

// .env fica na raiz do projeto (um nivel acima de backend/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// fallback: .env dentro de backend/ (útil em alguns deploys)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
  cookieSecure: String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true',
  forward: {
    timeoutMs: 10000,
    maxRetries: 2,             // ate 2 retentativas (3 tentativas no total)
    backoffMs: [500, 1500],    // backoff entre as retentativas
  },
};

module.exports = config;

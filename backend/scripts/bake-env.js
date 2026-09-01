#!/usr/bin/env node
'use strict';

/**
 * Gera src/env.baked.js a partir de backend/.env
 *
 *   npm run bake-env
 *
 * Por que isso existe: o file tracing da Vercel monta o bundle da function a
 * partir do grafo de `require()`. Um .env solto nao esta nesse grafo e acaba
 * ficando de fora — foi o que deu "missingEnv" no deploy. Um modulo .js e
 * sempre empacotado, entao os valores viajam junto do codigo.
 *
 * O .env continua sendo a fonte de verdade: este arquivo e derivado dele, e
 * a Vercel o regenera no build (veja buildCommand no vercel.json).
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_PATH = path.join(__dirname, '../.env');
const OUT_PATH = path.join(__dirname, '../src/env.baked.js');

// Variaveis que NAO devem ser embutidas: a plataforma define as dela.
const SKIP = new Set(['PORT', 'NODE_ENV', 'VERCEL']);

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`[bake-env] ${ENV_PATH} nao encontrado — nada a gerar.`);
    process.exit(0); // nao quebra o build: as vars podem vir do painel
  }

  const parsed = dotenv.parse(fs.readFileSync(ENV_PATH, 'utf8'));
  const values = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!SKIP.has(key)) values[key] = value;
  }

  const body = `'use strict';

// ============================================================
// ARQUIVO GERADO — nao edite a mao.
// Fonte: backend/.env   Gerar de novo: npm run bake-env
//
// Contem credenciais. Mantenha o repositorio privado.
// ============================================================

module.exports = ${JSON.stringify(values, null, 2)};
`;

  fs.writeFileSync(OUT_PATH, body, { mode: 0o600 });
  console.log(`[bake-env] ${path.relative(process.cwd(), OUT_PATH)} gerado com ${Object.keys(values).length} variaveis`);
  console.log(`[bake-env] ignoradas (definidas pela plataforma): ${[...SKIP].join(', ')}`);
}

// Este script roda no build da Vercel. Se ele falhar, o build inteiro falha e o
// dominio continua servindo o deploy anterior — um modo de falha bem confuso.
// Entao: qualquer erro vira aviso, e o processo sempre sai com 0.
try {
  main();
} catch (err) {
  console.error('[bake-env] AVISO: nao foi possivel gerar o modulo:', err && err.message);
  console.error('[bake-env] seguindo o build — as variaveis podem vir do painel.');
  process.exit(0);
}

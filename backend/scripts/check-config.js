#!/usr/bin/env node
'use strict';

/**
 * Confere a configuracao antes do deploy:
 *   npm run check
 *
 * Valida as variaveis, o tipo da chave do Supabase, a conexao, as tabelas da
 * migration e a existencia de um usuario para login. Nao imprime segredos.
 */

const config = require('../src/config');
const supabase = require('../src/lib/supabase');

let problems = 0;
const ok = (msg) => console.log(`  ok   ${msg}`);
const bad = (msg, hint) => {
  problems++;
  console.log(`  ERRO ${msg}`);
  if (hint) console.log(`       -> ${hint}`);
};

async function main() {
  console.log('\nConfiguracao');
  console.log(
    config.loadedEnvFiles.length
      ? `  .env lido de: ${config.loadedEnvFiles.join(', ')}`
      : '  nenhum .env encontrado (usando apenas variaveis de ambiente)'
  );

  if (config.missingEnv.length) {
    bad(`variaveis ausentes: ${config.missingEnv.join(', ')}`, 'preencha o backend/.env ou o painel do provedor');
    console.log('\nSem essas variaveis nao da para testar a conexao.\n');
    process.exit(1);
  }
  ok('todas as variaveis obrigatorias estao presentes');

  // --- modulo embutido (usado no deploy da Vercel) ---
  const fs = require('fs');
  const path = require('path');
  const dotenv = require('dotenv');
  const bakedPath = path.join(__dirname, '../src/env.baked.js');

  if (!fs.existsSync(bakedPath)) {
    console.log('  aviso  src/env.baked.js nao existe — rode "npm run bake-env" antes do deploy na Vercel');
  } else {
    const baked = require(bakedPath);
    const envFile = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env'), 'utf8'));
    const skip = new Set(['PORT', 'NODE_ENV', 'VERCEL']);
    const stale = Object.entries(envFile)
      .filter(([k, v]) => !skip.has(k) && baked[k] !== v)
      .map(([k]) => k);

    if (stale.length) {
      bad(`src/env.baked.js desatualizado (${stale.join(', ')})`, 'rode: npm run bake-env');
    } else {
      ok('src/env.baked.js em dia com o .env');
    }
  }

  // --- chave do Supabase ---
  if (config.supabaseKeyRole === 'service_role') {
    ok('SUPABASE_SERVICE_ROLE_KEY e mesmo a service_role');
  } else if (config.supabaseKeyRole) {
    bad(
      `a chave configurada e a "${config.supabaseKeyRole}", nao a service_role`,
      'Supabase -> Project Settings -> API -> service_role (secreta)'
    );
  } else {
    console.log('  aviso  nao deu para identificar o tipo da chave (formato sb_secret_...?)');
  }

  // --- conexao e tabelas ---
  for (const table of ['users', 'webhook_logs']) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      bad(`tabela "${table}" inacessivel: ${error.message}`, 'rode migrations/001_init.sql no SQL Editor do Supabase');
    } else {
      ok(`tabela "${table}" acessivel`);
    }
  }

  // --- campo computado usado pela busca ---
  const { error: searchError } = await supabase
    .from('webhook_logs')
    .select('id')
    .ilike('body_text', '%__check__%')
    .limit(1);
  if (searchError) {
    bad('funcao body_text() ausente (busca do painel nao funciona)', 'rode a parte final de migrations/001_init.sql');
  } else {
    ok('funcao body_text() disponivel');
  }

  // --- usuario para login ---
  const { data: users, error: usersError } = await supabase.from('users').select('email');
  if (!usersError) {
    if (!users || users.length === 0) {
      console.log('  aviso  nenhum usuario cadastrado — o padrao sera criado no proximo boot');
    } else {
      ok(`${users.length} usuario(s) cadastrado(s): ${users.map((u) => u.email).join(', ')}`);
    }
  }

  // --- destino do reenvio ---
  ok(`DEST_URL: ${config.destUrl}`);
  const worstCase = (config.forward.maxRetries + 1) * config.forward.timeoutMs + 2000;
  console.log(`  info  pior caso do reenvio: ~${(worstCase / 1000).toFixed(1)}s`);

  console.log(problems ? `\n${problems} problema(s) encontrado(s).\n` : '\nTudo certo.\n');
  process.exit(problems ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFalha inesperada:', err.message, '\n');
  process.exit(1);
});

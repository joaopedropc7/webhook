#!/usr/bin/env node
'use strict';

/**
 * Cria (ou atualiza a senha de) um usuario admin no Supabase.
 *
 * Uso:
 *   node scripts/create-admin.js admin@dominio.com 'SenhaForte123'
 *   node scripts/create-admin.js admin@dominio.com        (pergunta a senha)
 *
 * A senha NUNCA e gravada em texto puro: apenas o hash bcrypt vai para o banco.
 */

const bcrypt = require('bcryptjs');
const readline = require('readline');
const supabase = require('../src/lib/supabase');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  // Aceita um email ou um usuario simples (o padrao da plataforma e "admin")
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (email.length < 3 || /\s/.test(email)) {
    console.error("Uso: node scripts/create-admin.js <usuario-ou-email> ['senha']");
    process.exit(1);
  }

  let password = process.argv[3];
  if (!password) password = await ask('Senha do admin: ');
  password = String(password || '');

  if (password.length < 8) {
    console.error('A senha precisa ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findErr) {
    console.error('Erro consultando users:', findErr.message);
    process.exit(1);
  }

  if (existing) {
    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', existing.id);
    if (error) {
      console.error('Erro ao atualizar a senha:', error.message);
      process.exit(1);
    }
    console.log(`Senha atualizada para o usuario existente: ${email}`);
  } else {
    const { error } = await supabase
      .from('users')
      .insert({ email, password_hash: passwordHash });
    if (error) {
      console.error('Erro ao criar o usuario:', error.message);
      process.exit(1);
    }
    console.log(`Usuario admin criado: ${email}`);
  }

  console.log('Pronto. Faca login no painel com esse email e senha.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha inesperada:', err.message);
  process.exit(1);
});

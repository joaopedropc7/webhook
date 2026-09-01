#!/usr/bin/env node
'use strict';

/**
 * Gera apenas o hash bcrypt de uma senha, para inserir manualmente no SQL Editor
 * do Supabase (sem precisar das credenciais Supabase no terminal).
 *
 *   node scripts/hash-password.js 'SenhaForte123'
 *
 * Depois rode no Supabase:
 *   insert into users (email, password_hash) values ('admin@dominio.com', '<hash>');
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error("Uso: node scripts/hash-password.js 'SuaSenha'");
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log('');
  console.log('Hash bcrypt:');
  console.log(hash);
  console.log('');
  console.log('SQL para rodar no Supabase:');
  console.log(`insert into users (email, password_hash) values ('admin@seudominio.com', '${hash}');`);
  console.log('');
});

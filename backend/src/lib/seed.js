'use strict';

const bcrypt = require('bcryptjs');
const supabase = require('./supabase');
const config = require('../config');
const log = require('./log');

let seeding = null;

/**
 * Cria o usuario padrao (admin / password) quando a tabela users esta vazia.
 *
 * - Roda uma unica vez por processo (e por cold start, no serverless).
 * - So insere se NAO existir nenhum usuario: nunca sobrescreve credenciais reais
 *   nem ressuscita um usuario que voce apagou de proposito.
 * - Pode ser desligado com SEED_DEFAULT_ADMIN=false.
 * - Nunca derruba a aplicacao: qualquer falha vira log.
 */
function ensureDefaultAdmin() {
  if (seeding) return seeding;

  seeding = (async () => {
    if (!config.defaultAdmin.enabled) return;

    try {
      const { data, error } = await supabase.from('users').select('id').limit(1);
      if (error) {
        log.warn('[seed] nao foi possivel verificar a tabela users:', error.message);
        return;
      }
      if (data && data.length > 0) return; // ja existe usuario: nada a fazer

      const { user, password } = config.defaultAdmin;
      const passwordHash = await bcrypt.hash(password, 12);

      const { error: insertError } = await supabase
        .from('users')
        .insert({ email: user.trim().toLowerCase(), password_hash: passwordHash });

      if (insertError) {
        // 23505 = outro processo criou o usuario ao mesmo tempo (cold starts simultaneos)
        if (insertError.code === '23505') return;
        log.warn('[seed] falha ao criar o usuario padrao:', insertError.message);
        return;
      }

      log.warn(
        `[seed] usuario padrao criado: "${user}" com a senha padrao. ` +
          'Troque em Configuracoes assim que entrar no painel.'
      );
    } catch (err) {
      log.warn('[seed] excecao ao criar o usuario padrao:', err && err.message);
    }
  })();

  return seeding;
}

module.exports = { ensureDefaultAdmin };

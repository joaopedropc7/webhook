'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const config = require('../config');
const log = require('../lib/log');
const { requireAuth, signSession, setSessionCookie } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MIN_PASSWORD_LENGTH = 8;

// Toda alteracao exige a senha atual: sem isso, uma sessao roubada trocaria
// as credenciais do painel sozinha.
async function loadUserAndVerify(userId, currentPassword) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user) return { user: null, ok: false };

  const ok = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
  return { user, ok };
}

// PATCH /api/settings/password  { currentPassword, newPassword }
router.patch('/password', async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'A nova senha deve ser diferente da atual' });
    }

    const { user, ok } = await loadUserAndVerify(req.user.id, currentPassword);
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);

    if (error) {
      log.error('[settings] erro ao trocar a senha:', error.message);
      return res.status(500).json({ error: 'Nao foi possivel salvar a nova senha' });
    }

    // Reemite o cookie: some a flag de senha padrao e a sessao continua valida
    const passwordIsDefault =
      config.defaultAdmin.enabled && newPassword === config.defaultAdmin.password;
    setSessionCookie(res, signSession(user, { passwordIsDefault }));

    log.info(`[settings] senha alterada para o usuario ${user.email}`);
    return res.json({ ok: true, user: { id: user.id, email: user.email, passwordIsDefault } });
  } catch (err) {
    log.error('[settings] excecao ao trocar a senha:', err.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/settings/account  { email, currentPassword }
router.patch('/account', async (req, res) => {
  try {
    const newEmail = String(req.body?.email || '').trim().toLowerCase();
    const currentPassword = String(req.body?.currentPassword || '');

    if (!newEmail || newEmail.length < 3) {
      return res.status(400).json({ error: 'Informe um usuario com pelo menos 3 caracteres' });
    }
    if (/\s/.test(newEmail)) {
      return res.status(400).json({ error: 'O usuario nao pode conter espacos' });
    }
    if (!currentPassword) {
      return res.status(400).json({ error: 'Informe a senha atual' });
    }

    const { user, ok } = await loadUserAndVerify(req.user.id, currentPassword);
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    if (newEmail === user.email) {
      return res.status(400).json({ error: 'O novo usuario e igual ao atual' });
    }

    const { error } = await supabase
      .from('users')
      .update({ email: newEmail })
      .eq('id', user.id);

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ja existe um usuario com esse nome' });
      }
      log.error('[settings] erro ao trocar o usuario:', error.message);
      return res.status(500).json({ error: 'Nao foi possivel salvar o novo usuario' });
    }

    // Reemite o cookie com o email novo dentro do token
    const updated = { id: user.id, email: newEmail };
    setSessionCookie(res, signSession(updated, { passwordIsDefault: req.user.passwordIsDefault }));

    log.info(`[settings] usuario alterado de ${user.email} para ${newEmail}`);
    return res.json({
      ok: true,
      user: { ...updated, passwordIsDefault: req.user.passwordIsDefault },
    });
  } catch (err) {
    log.error('[settings] excecao ao trocar o usuario:', err.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;

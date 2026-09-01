'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const config = require('../config');
const log = require('../lib/log');
const {
  requireAuth,
  signSession,
  setSessionCookie,
  clearSessionCookie,
} = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe usuario e senha' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      log.error('[auth] erro ao buscar usuario:', error.message);
      return res.status(500).json({ error: 'Erro interno' });
    }

    // Mesma mensagem para usuario inexistente e senha errada
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'Usuario ou senha invalidos' });

    // Ainda usando a senha padrao? O painel mostra um aviso ate ser trocada.
    const passwordIsDefault =
      config.defaultAdmin.enabled && password === config.defaultAdmin.password;

    setSessionCookie(res, signSession(user, { passwordIsDefault }));
    return res.json({ user: { id: user.id, email: user.email, passwordIsDefault } });
  } catch (err) {
    log.error('[auth] excecao no login:', err.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;

'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

// passwordIsDefault vai no proprio token: assim o /me nao paga um bcrypt
// a cada carregamento do painel so para saber se deve mostrar o aviso.
function signSession(user, { passwordIsDefault = false } = {}) {
  return jwt.sign(
    { sub: user.id, email: user.email, pwd_default: passwordIsDefault },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function setSessionCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });
}

// Middleware: exige cookie JWT valido
function requireAuth(req, res, next) {
  try {
    const token = req.cookies ? req.cookies[config.cookieName] : null;
    if (!token) return res.status(401).json({ error: 'Nao autenticado' });

    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
      passwordIsDefault: Boolean(payload.pwd_default),
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessao invalida ou expirada' });
  }
}

module.exports = { requireAuth, signSession, setSessionCookie, clearSessionCookie };

'use strict';

const express = require('express');
const supabase = require('../lib/supabase');
const log = require('../lib/log');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Escapa os curingas do LIKE para que o usuario busque texto literal
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

const LIST_COLUMNS =
  'id, gateway, source_ip, forwarded_url, forwarded_status, forwarded_at, success, error, created_at';

// GET /api/logs?page=1&limit=20&success=true|false&q=texto
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('webhook_logs')
      .select(LIST_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.success === 'true') query = query.eq('success', true);
    else if (req.query.success === 'false') query = query.eq('success', false);

    const q = String(req.query.q || '').trim();
    if (q) {
      // Busca textual no JSON recebido. O PostgREST nao aceita cast em filtro
      // (received_body::text), entao usamos o computed field body_text()
      // definido em migrations/001_init.sql.
      query = query.ilike('body_text', `%${escapeLike(q)}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      log.error('[logs] erro ao listar:', error.message);
      // 42883/42703: o computed field body_text() nao existe no banco
      if (q && /body_text/.test(error.message || '')) {
        return res.status(500).json({
          error: 'Busca textual indisponivel: rode migrations/001_init.sql (funcao body_text) no Supabase.',
        });
      }
      return res.status(500).json({ error: 'Erro ao consultar os logs' });
    }

    const total = count || 0;
    return res.json({
      data: data || [],
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    log.error('[logs] excecao ao listar:', err.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/logs/:id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID invalido' });

    const { data, error } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      log.error('[logs] erro ao buscar log:', error.message);
      return res.status(500).json({ error: 'Erro ao consultar o log' });
    }
    if (!data) return res.status(404).json({ error: 'Log nao encontrado' });

    return res.json({ data });
  } catch (err) {
    log.error('[logs] excecao ao buscar log:', err.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;

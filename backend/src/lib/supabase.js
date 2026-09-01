'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// SERVICE ROLE KEY: usada apenas no backend, bypassa RLS.
// Nunca deve ser exposta no frontend.
// Placeholders quando a config esta incompleta: o import nao pode lancar.
// Nenhuma requisicao chega ate aqui — o app responde 503 antes (veja app.js).
const supabase = createClient(
  config.supabaseUrl || 'https://placeholder.supabase.co',
  config.supabaseServiceRoleKey || 'placeholder',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

module.exports = supabase;

'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// SERVICE ROLE KEY: usada apenas no backend, bypassa RLS.
// Nunca deve ser exposta no frontend.
const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;

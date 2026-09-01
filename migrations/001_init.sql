-- =====================================================================
-- Axxon Pay Webhook Proxy - schema inicial
-- Rode no Supabase: Dashboard -> SQL Editor -> New query -> Run
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists webhook_logs (
  id bigint generated always as identity primary key,
  gateway text not null default 'axxon',
  source_ip text,
  received_headers jsonb,
  received_body jsonb,
  forwarded_url text,
  forwarded_status int,
  forwarded_response jsonb,
  forwarded_at timestamptz,
  success boolean default false,
  error text,
  created_at timestamptz default now()
);

create index if not exists idx_webhook_logs_created on webhook_logs(created_at desc);

-- O backend acessa com a service_role key (bypassa RLS de qualquer forma).
-- Nenhuma dessas tabelas e exposta ao cliente com a anon key.
alter table users disable row level security;
alter table webhook_logs disable row level security;

-- ---------------------------------------------------------------------
-- Campo computado usado pela busca textual do painel (GET /api/logs?q=).
-- O PostgREST NAO permite cast em filtro (received_body::text=ilike...),
-- entao expomos o JSON como texto atraves de um computed field.
-- Precisa estar no schema exposto (public) e usar parametro sem nome.
-- ---------------------------------------------------------------------
create or replace function public.body_text(webhook_logs)
returns text
language sql
stable
as $$
  select $1.received_body::text
$$;

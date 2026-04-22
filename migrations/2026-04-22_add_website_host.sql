-- =====================================================
-- Sikt — legger til felt for website host og én-gangs-endring
-- =====================================================
-- Kjør dette ÉN GANG i Supabase Dashboard → SQL Editor.
-- Idempotent: kan kjøres flere ganger uten å ødelegge data.
-- =====================================================

alter table public.clients
  add column if not exists website_host text,
  add column if not exists url_change_count integer not null default 0,
  add column if not exists host_change_count integer not null default 0;

-- Be PostgREST oppdatere schema-cachen sin slik at REST-API-et ser
-- de nye kolonnene umiddelbart (ellers får vi "column not found in schema cache").
notify pgrst, 'reload schema';

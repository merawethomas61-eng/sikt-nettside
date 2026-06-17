-- =====================================================================
-- clients.platform — deklarert plattform fra onboarding.
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- Brukes til å gi AI-bygde sider (Claude/Cursor/v0/Lovable) en ferdig
-- lim-inn-prompt i Verksted (Standard+), parallelt til WordPress-auto-push.
-- Verdier matcher plattform-id-ene i frontend (wordpress/shopify/webflow/
-- wix/squarespace/ghost/ai_built/other). Additivt — ingen RLS-endring;
-- clients har alt update-own-RLS som onboarding bruker.
-- =====================================================================

alter table public.clients
  add column if not exists platform text;

-- =====================================================================
-- audit_leads — leads fra den utloggede gratis-analysen på forsiden.
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- Mål: fange e-post + skannet URL + score for besøkende som kjører
-- gratis-analysen, slik at vi kan følge opp selv om de ikke kjøper.
-- Skrives KUN server-side av api/pagespeed.js (service-role) i mode:'public'.
-- =====================================================================

create table if not exists public.audit_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  url text not null,
  mobile_score smallint,
  desktop_score smallint,
  created_at timestamptz not null default now()
);

create index if not exists audit_leads_created_idx
  on public.audit_leads (created_at desc);
create index if not exists audit_leads_email_idx
  on public.audit_leads (email);

alter table public.audit_leads enable row level security;
-- Bevisst INGEN policy: kun service-role (api/pagespeed.js) skriver/leser.
-- Ingen anon/authenticated-tilgang til lead-listen.
revoke all on public.audit_leads from anon, authenticated;

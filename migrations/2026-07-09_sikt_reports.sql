-- =====================================================
-- Sikt — sikt_reports (månedsrapporten)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor. Idempotent.
--
-- Innfrir prissidens løfte om månedlig rapport (Premium: strategirapport
-- 10+ seksjoner; Basic/Standard: kortversjon). Genereres av
-- api/cron-scan-competitors.js?job=monthly_report (service-role);
-- kunden leser den i portalen (RLS select own) og skriver den ut som PDF.
-- =====================================================

create table if not exists public.sikt_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'YYYY-MM' — måneden rapporten dekker (forrige måned ved kjøring 1. i mnd)
  period text not null,
  tier text not null default 'basic',
  title text not null,
  -- Rapporten som typede seksjoner: [{ id, title, body, stats?, items? }]
  sections jsonb not null default '[]',
  -- Valgfri ferdig-rendret HTML (ikke i bruk ennå — portalen rendrer sections)
  html text,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  unique (user_id, period)
);

create index if not exists sikt_reports_user_period_idx
  on public.sikt_reports (user_id, period desc);

alter table public.sikt_reports enable row level security;

drop policy if exists "Users can read own reports" on public.sikt_reports;
create policy "Users can read own reports"
  on public.sikt_reports for select
  using (auth.uid() = user_id);

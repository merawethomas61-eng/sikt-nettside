-- =====================================================================
-- Basic-verdi-motoren: «Nesten på side 1», innholds-forfall og
-- «merk som gjort»-flyt. Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- 1) keyword_snapshots — ukentlig bilde av GSC-posisjoner, så
--    ?job=opportunities kan oppdage forfall (uke-over-uke-fall).
-- 2) sikt_actions.status — kunden kan markere forslag som «gjort»,
--    og kvitteringen kan si «Du har limt inn 4 av 7».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) keyword_snapshots
-- ---------------------------------------------------------------------
create table if not exists public.keyword_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  position numeric,
  clicks integer,
  impressions integer,
  captured_at timestamptz not null default now()
);

create index if not exists keyword_snapshots_user_captured_idx
  on public.keyword_snapshots (user_id, captured_at desc);

alter table public.keyword_snapshots enable row level security;

drop policy if exists "keyword_snapshots_select_own" on public.keyword_snapshots;
create policy "keyword_snapshots_select_own" on public.keyword_snapshots
  for select to authenticated using (auth.uid() = user_id);
-- Inserts kommer kun fra motoren (service-role) — ingen insert-policy for authenticated.

-- ---------------------------------------------------------------------
-- 2) sikt_actions: status for «merk som gjort»
-- ---------------------------------------------------------------------
alter table public.sikt_actions
  add column if not exists status text not null default 'open';

alter table public.sikt_actions
  drop constraint if exists sikt_actions_status_check;
alter table public.sikt_actions
  add constraint sikt_actions_status_check check (status in ('open', 'done', 'dismissed'));

alter table public.sikt_actions
  add column if not exists done_at timestamptz;

-- Kunden skal kunne oppdatere status på sine egne rader (merk som gjort/avvist).
drop policy if exists "sikt_actions_update_own_status" on public.sikt_actions;
create policy "sikt_actions_update_own_status" on public.sikt_actions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists sikt_actions_user_status_idx
  on public.sikt_actions (user_id, status, created_at desc);

-- ---------------------------------------------------------------------
-- 3) pg_cron (kjør manuelt ETTER at du har verifisert jobbene med dryRun=1):
--    Erstatt <CRON_SECRET> med samme secret som de andre jobbene.
--
-- select cron.schedule(
--   'sikt-opportunities-weekly', '0 5 * * 1',  -- mandag 05:00 UTC, før weekly-reports
--   $$ select net.http_get(
--        url := 'https://siktseo.com/api/cron-scan-competitors?job=opportunities',
--        headers := '{"x-cron-secret": "<CRON_SECRET>"}'::jsonb ) $$
-- );
-- select cron.schedule(
--   'sikt-gbp-monthly', '0 6 1 * *',  -- 1. i måneden 06:00 UTC
--   $$ select net.http_get(
--        url := 'https://siktseo.com/api/cron-scan-competitors?job=gbp',
--        headers := '{"x-cron-secret": "<CRON_SECRET>"}'::jsonb ) $$
-- );

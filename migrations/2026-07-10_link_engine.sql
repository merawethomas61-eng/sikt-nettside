-- =====================================================
-- Sikt — lenke-motor (ødelagte lenker + interne lenkeforslag)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor.
-- Idempotent: kan kjøres flere ganger uten å ødelegge data.
--
-- Begge tabellene skrives av cron-jobben job=site_scan:
--  * sikt_link_issues — lenker på kundens sider som svarer 404/410/DNS-feil.
--    Krever to kjøringer på rad (consecutive_failures >= 2) før de vises
--    som oppgave («open») — dreper transiente falske positive.
--  * sikt_link_suggestions — «siden X nevner frasen til side Y, men lenker
--    ikke dit». Hver ny artikkel gir nye mål → motoren drenerer aldri.
-- Fiksing/innsetting skjer godkjennings-gatet via api/wordpress-push.js
-- (action fix-link / insert-link) og logges i sikt_changes (rollback).
-- =====================================================

create table if not exists public.sikt_link_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Siden lenken står på (normalisert full URL)
  page_url text not null,
  -- Lenkemålet som er dødt
  target_url text not null,
  anchor_text text,
  kind text not null check (kind in ('broken_internal', 'broken_external')),
  http_status integer,
  consecutive_failures integer not null default 1,
  -- 'candidate' (1 feil) -> 'open' (2+ feil, vises som oppgave)
  --   -> 'fixed' (pushet til WP) | 'dismissed' (kunden avviser)
  --   -> 'resolved' (målet svarte igjen)
  state text not null default 'candidate'
    check (state in ('candidate', 'open', 'queued', 'fixed', 'dismissed', 'resolved')),
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- sikt_changes-raden for fiksen (rollback-spor)
  change_id uuid,
  unique (user_id, page_url, target_url)
);

create table if not exists public.sikt_link_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Siden som skal FÅ lenken
  source_url text not null,
  -- Siden det skal lenkes TIL
  target_url text not null,
  anchor_text text not null,
  -- ±80 tegn rundt frasen — vises i portalen så kunden ser sammenhengen
  context_snippet text,
  reason text,
  -- 'pending' -> 'applied' (satt inn i WP) | 'rejected' (kunden avviser)
  --   | 'failed' (frasen fantes ikke i rå-innholdet — manuell fallback)
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'applied', 'rejected', 'failed')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  change_id uuid,
  unique (user_id, source_url, target_url)
);

create index if not exists sikt_link_issues_user_state_idx
  on public.sikt_link_issues(user_id, state);

create index if not exists sikt_link_suggestions_user_status_idx
  on public.sikt_link_suggestions(user_id, status);

alter table public.sikt_link_issues enable row level security;
alter table public.sikt_link_suggestions enable row level security;

-- Kun cron/API (service-role) oppretter rader. Kunden leser sine egne og
-- kan endre status fra portalen (avvis; fixed/applied settes av API-et
-- med service-role, men update-own tillater også optimistisk UI-flyt).
drop policy if exists "Users can read own link issues" on public.sikt_link_issues;
create policy "Users can read own link issues"
  on public.sikt_link_issues for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own link issues" on public.sikt_link_issues;
create policy "Users can update own link issues"
  on public.sikt_link_issues for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own link suggestions" on public.sikt_link_suggestions;
create policy "Users can read own link suggestions"
  on public.sikt_link_suggestions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own link suggestions" on public.sikt_link_suggestions;
create policy "Users can update own link suggestions"
  on public.sikt_link_suggestions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

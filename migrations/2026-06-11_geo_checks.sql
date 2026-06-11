-- =====================================================================
-- geo_checks — ukentlige GEO-resultater (Premium): nevner ChatGPT/Gemini/
-- Perplexity bedriften? Én rad per spørsmål per provider, skrevet av
-- cron-scan-competitors?job=geo.
-- =====================================================================
create table if not exists public.geo_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('chatgpt', 'gemini', 'perplexity')),
  question text not null,
  mentioned boolean not null default false,
  answer_excerpt text,
  checked_at timestamptz not null default now()
);

create index if not exists geo_checks_user_checked_idx
  on public.geo_checks (user_id, checked_at desc);

alter table public.geo_checks enable row level security;

-- Kunden ser sine egne GEO-resultater. Inserts kommer fra motoren (service-role).
drop policy if exists "geo_checks_select_own" on public.geo_checks;
create policy "geo_checks_select_own" on public.geo_checks for select to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- GEO-action (Premium): gjør GEO fra måling til handling.
-- 1) geo_faqs — AI-genererte Q&A for spørsmål der bedriften IKKE ble nevnt.
--    Kunden godkjenner; godkjente svar mates inn i llms.txt + FAQPage-schema.
-- 2) geo_state — publisert llms.txt-innhold + tidsstempler (for GEO-score).
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) geo_faqs
-- ---------------------------------------------------------------------
create table if not exists public.geo_faqs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  source_provider text,             -- hvilken AI som ikke nevnte deg (chatgpt/gemini/perplexity)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists geo_faqs_user_status_idx
  on public.geo_faqs (user_id, status, created_at desc);

-- Unngå duplikate spørsmål per kunde
create unique index if not exists geo_faqs_user_question_uidx
  on public.geo_faqs (user_id, question);

alter table public.geo_faqs enable row level security;

drop policy if exists "geo_faqs_select_own" on public.geo_faqs;
create policy "geo_faqs_select_own" on public.geo_faqs for select to authenticated
  using (auth.uid() = user_id);

-- Kunden kan godkjenne/avvise egne FAQ.
drop policy if exists "geo_faqs_update_own" on public.geo_faqs;
create policy "geo_faqs_update_own" on public.geo_faqs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Inserts kommer fra motoren (service-role).

-- ---------------------------------------------------------------------
-- 2) geo_state — én rad per kunde
-- ---------------------------------------------------------------------
create table if not exists public.geo_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  llms_txt text,
  llms_published_at timestamptz,
  schema_published_at timestamptz,
  geo_score integer,
  updated_at timestamptz not null default now()
);

alter table public.geo_state enable row level security;

drop policy if exists "geo_state_select_own" on public.geo_state;
create policy "geo_state_select_own" on public.geo_state for select to authenticated
  using (auth.uid() = user_id);
-- Skrives kun av motoren (service-role).

-- =====================================================
-- Sikt — sikt_actions tabell
-- =====================================================
-- Denne tabellen logger alt Sikt gjør for brukeren:
-- funn, AI-tekstforslag, skanninger, auto-fikser osv.
--
-- Vises i "Ukens kvittering"-fanen i portalen.
--
-- Kjør dette i Supabase Dashboard → SQL Editor
-- (Én gang, helt uavhengig av eksisterende tabeller)
-- =====================================================

create table if not exists public.sikt_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Type handling Sikt gjorde
  -- 'analysis_run' = kjørte PageSpeed-test
  -- 'content_scan' = skannet alle sider
  -- 'link_scan' = kartla lenker
  -- 'keyword_added' = la til søkeord
  -- 'keyword_check' = sjekket rangeringer
  -- 'ai_text_generated' = AI skrev meta/alt-tekst
  -- 'auto_fix' = pushet endring til nettsiden (Standard+)
  -- 'alert' = e-postvarsel sendt
  action_type text not null,

  -- Kategori (driver farge + filtrering i UI)
  -- 'finding' = vi fant noe (alle pakker)
  -- 'suggestion' = AI-forslag du kan kopiere (Basic+)
  -- 'fix' = Sikt pushet endring (Standard+)
  -- 'alert' = varsel
  category text not null check (category in ('finding','suggestion','fix','alert')),

  -- Menneske-lesbar tittel, brukes rett i UI
  title text not null,

  -- Fritekst-detaljer (for "Alle endringer"-listen)
  details jsonb,

  -- URL-en handlingen gjelder (hvis relevant)
  page_url text,

  -- "Før"- og "etter"-verdier for diff-visning
  before_value text,
  after_value text,

  created_at timestamptz not null default now()
);

-- Indeks for rask "gi meg denne ukens kvittering"-spørring
create index if not exists sikt_actions_user_week_idx
  on public.sikt_actions (user_id, created_at desc);

-- =====================================================
-- Row Level Security — brukere ser bare egne handlinger
-- =====================================================
alter table public.sikt_actions enable row level security;

create policy "Users can read own actions"
  on public.sikt_actions for select
  using (auth.uid() = user_id);

create policy "Users can insert own actions"
  on public.sikt_actions for insert
  with check (auth.uid() = user_id);

-- Valgfritt: slett-policy hvis du vil la brukere skjule loggposter
create policy "Users can delete own actions"
  on public.sikt_actions for delete
  using (auth.uid() = user_id);

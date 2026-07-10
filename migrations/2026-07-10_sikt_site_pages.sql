-- =====================================================
-- Sikt — sikt_site_pages (ukentlig server-side side-skann)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor.
-- Idempotent: kan kjøres flere ganger uten å ødelegge data.
--
-- Én rad per side per bruker, upsertet av cron-jobben
-- api/cron-scan-competitors.js?job=site_scan (ukentlig re-skann).
-- Portalen hydrerer Verksted/innholds-fanen fra denne tabellen når
-- server-skannet er ferskere enn kundens lokale skann — dermed er
-- oppgavelisten aldri avhengig av at kunden selv trykker «Skann».
-- =====================================================

create table if not exists public.sikt_site_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Full URL, normalisert (uten hash/query/trailing slash)
  url text not null,
  -- Sti relativt til site-roten ('/', '/om-oss', …) — matcher ContentPage.url i portalen
  path text,
  title text,
  word_count integer,
  -- Tekstutdrag (≤1500 tegn): «Nåværende innhold» + AI-kontekst i Verksted
  text_sample text,
  -- Funn fra skannet: ['Tynt innhold (< 300 ord)', 'Mangler meta description', …]
  issues jsonb not null default '[]'::jsonb,
  -- 'Bra' | 'Advarsel' | 'Kritisk' (samme verdier som scan-website)
  status text,
  score integer,
  inlinks integer,
  outlinks integer,
  last_scanned_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  unique (user_id, url)
);

create index if not exists sikt_site_pages_user_scanned_idx
  on public.sikt_site_pages(user_id, last_scanned_at desc);

alter table public.sikt_site_pages enable row level security;

-- Kun cron-en (service-role, forbi RLS) skriver. Kunden leser sine egne rader.
drop policy if exists "Users can read own site pages" on public.sikt_site_pages;
create policy "Users can read own site pages"
  on public.sikt_site_pages for select
  using (auth.uid() = user_id);

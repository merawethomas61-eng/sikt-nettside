-- =====================================================
-- Sikt — Konkurrenter-tabeller
-- Kjør dette én gang i Supabase Dashboard → SQL Editor
-- =====================================================

-- =====================================================
-- 1. COMPETITORS
-- =====================================================
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  avg_position numeric,
  keyword_count integer not null default 0,
  competitor_type text not null default 'main' check (competitor_type in ('main', 'local', 'rising')),
  avatar_color text,
  created_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  unique (user_id, domain)
);

create index if not exists competitors_user_idx on public.competitors (user_id);

alter table public.competitors enable row level security;

create policy "Users can read own competitors"
  on public.competitors for select
  using (auth.uid() = user_id);

create policy "Users can insert own competitors"
  on public.competitors for insert
  with check (auth.uid() = user_id);

create policy "Users can update own competitors"
  on public.competitors for update
  using (auth.uid() = user_id);

create policy "Users can delete own competitors"
  on public.competitors for delete
  using (auth.uid() = user_id);

-- =====================================================
-- 2. KEYWORD OPPORTUNITIES
-- =====================================================
create table if not exists public.keyword_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  search_volume integer not null default 0,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  recommendation_type text not null default 'new_page' check (recommendation_type in ('new_page', 'faq', 'expand_existing')),
  recommendation_text text not null default '',
  estimated_traffic integer not null default 0,
  competitor_ids uuid[] not null default '{}',
  discovered_at timestamptz not null default now(),
  generated_at timestamptz
);

create index if not exists keyword_opp_user_idx on public.keyword_opportunities (user_id, estimated_traffic desc);

alter table public.keyword_opportunities enable row level security;

create policy "Users can read own keyword opportunities"
  on public.keyword_opportunities for select
  using (auth.uid() = user_id);

create policy "Users can insert own keyword opportunities"
  on public.keyword_opportunities for insert
  with check (auth.uid() = user_id);

create policy "Users can update own keyword opportunities"
  on public.keyword_opportunities for update
  using (auth.uid() = user_id);

create policy "Users can delete own keyword opportunities"
  on public.keyword_opportunities for delete
  using (auth.uid() = user_id);

-- =====================================================
-- 3. COMPETITOR KEYWORD RANKINGS
-- =====================================================
create table if not exists public.competitor_keyword_rankings (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  keyword text not null,
  position integer not null,
  url text not null default '',
  checked_at timestamptz not null default now(),
  unique (competitor_id, keyword)
);

create index if not exists ckr_competitor_idx on public.competitor_keyword_rankings (competitor_id, position);

alter table public.competitor_keyword_rankings enable row level security;

-- RLS via join til competitors-tabellen (bruker kan lese sine egne konkurrenters rangeringer)
create policy "Users can read own competitor rankings"
  on public.competitor_keyword_rankings for select
  using (
    exists (
      select 1 from public.competitors c
      where c.id = competitor_id and c.user_id = auth.uid()
    )
  );

create policy "Service role can manage competitor rankings"
  on public.competitor_keyword_rankings for all
  using (true)
  with check (true);

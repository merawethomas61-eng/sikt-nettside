-- =====================================================================
-- Sikt — komplett database-skjema
-- =====================================================================
-- Kjør dette ÉN GANG i Supabase Dashboard → SQL Editor på en ny instans.
-- Filen er idempotent: kan kjøres på nytt uten å ødelegge eksisterende data.
--
-- Tabeller:
--   1. clients                       — hovedtabellen (én rad per bruker)
--   2. client_hosts                  — tilkobling til kundens webhost
--   3. sites                         — registrerte nettsteder for analyse
--   4. health_checks                 — PageSpeed-resultat per scan
--   5. sikt_actions                  — logg over alt Sikt har gjort
--   6. competitors                   — konkurrenter brukeren følger
--   7. keyword_opportunities         — søkeord-forslag fra konkurrent-analyse
--   8. competitor_keyword_rankings   — rangeringer per konkurrent
--
-- RLS er aktivert på alle tabeller. Brukere ser bare sine egne rader.
-- =====================================================================

-- =====================================================================
-- 1. CLIENTS — hovedtabell
-- =====================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- Onboarding-skjema
  onboarding_completed boolean not null default false,
  company_name text,
  contact_person text,
  email text,
  phone text,
  website_url text,
  industry text,
  target_audience text,

  -- Pakke / abonnement
  package_name text,                            -- 'Basic Pakke' | 'Standard Pakke' | 'Premium Pakke'
  subscription_status text default 'inactive',  -- 'active' | 'canceled' | 'past_due' | 'inactive'
  stripe_customer_id text,
  stripe_subscription_id text,

  -- URL-lås (én endring per uke)
  url_last_changed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrer eksisterende instans (ALTER er idempotent via IF NOT EXISTS)
alter table public.clients add column if not exists onboarding_completed boolean not null default false;
alter table public.clients add column if not exists company_name text;
alter table public.clients add column if not exists contact_person text;
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists website_url text;
alter table public.clients add column if not exists industry text;
alter table public.clients add column if not exists target_audience text;
alter table public.clients add column if not exists package_name text;
alter table public.clients add column if not exists subscription_status text default 'inactive';
alter table public.clients add column if not exists stripe_customer_id text;
alter table public.clients add column if not exists stripe_subscription_id text;
alter table public.clients add column if not exists url_last_changed_at timestamptz;

-- Rydd opp i gamle kolonner som ikke lenger brukes
alter table public.clients drop column if exists website_host;
alter table public.clients drop column if exists url_change_count;
alter table public.clients drop column if exists host_change_count;

create index if not exists clients_user_idx on public.clients (user_id);
create index if not exists clients_stripe_customer_idx on public.clients (stripe_customer_id);

alter table public.clients enable row level security;

drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own" on public.clients for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own" on public.clients for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own" on public.clients for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own" on public.clients for delete to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 2. CLIENT_HOSTS — tilkobling til kundens webhost
-- =====================================================================
create table if not exists public.client_hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  platform text,
  connection_mode text not null default 'skipped'
    check (connection_mode in ('light', 'full', 'skipped')),

  repo_url text,
  admin_url text,
  notes text,

  oauth_provider text,
  oauth_account text,
  oauth_installation_id text,
  oauth_scope text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,

  last_changed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_hosts_user_idx on public.client_hosts (user_id);

alter table public.client_hosts enable row level security;

drop policy if exists "client_hosts_select_own" on public.client_hosts;
create policy "client_hosts_select_own" on public.client_hosts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "client_hosts_insert_own" on public.client_hosts;
create policy "client_hosts_insert_own" on public.client_hosts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "client_hosts_update_own" on public.client_hosts;
create policy "client_hosts_update_own" on public.client_hosts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "client_hosts_delete_own" on public.client_hosts;
create policy "client_hosts_delete_own" on public.client_hosts for delete to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 3. SITES — registrerte nettsteder
-- =====================================================================
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  homepage_url text not null,
  display_name text,
  created_at timestamptz not null default now(),
  unique (user_id, homepage_url)
);

create index if not exists sites_user_idx on public.sites (user_id);

alter table public.sites enable row level security;

drop policy if exists "sites_select_own" on public.sites;
create policy "sites_select_own" on public.sites for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "sites_insert_own" on public.sites;
create policy "sites_insert_own" on public.sites for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "sites_update_own" on public.sites;
create policy "sites_update_own" on public.sites for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sites_delete_own" on public.sites;
create policy "sites_delete_own" on public.sites for delete to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 4. HEALTH_CHECKS — PageSpeed-resultater
-- =====================================================================
create table if not exists public.health_checks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  mobile_score integer,
  desktop_score integer,
  raw_mobile jsonb,
  raw_desktop jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists health_checks_site_idx on public.health_checks (site_id, checked_at desc);

alter table public.health_checks enable row level security;

-- Bruker leser kun via join til sites
drop policy if exists "health_checks_select_own" on public.health_checks;
create policy "health_checks_select_own" on public.health_checks for select to authenticated
  using (
    exists (
      select 1 from public.sites s
      where s.id = site_id and s.user_id = auth.uid()
    )
  );

-- Service-role (Edge Function) skriver
drop policy if exists "health_checks_service_write" on public.health_checks;
create policy "health_checks_service_write" on public.health_checks for all
  using (true) with check (true);

-- =====================================================================
-- 5. SIKT_ACTIONS — handlingslogg
-- =====================================================================
create table if not exists public.sikt_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  action_type text not null,
  category text not null check (category in ('finding','suggestion','fix','alert')),
  title text not null,
  details jsonb,
  page_url text,
  before_value text,
  after_value text,

  created_at timestamptz not null default now()
);

create index if not exists sikt_actions_user_week_idx
  on public.sikt_actions (user_id, created_at desc);

alter table public.sikt_actions enable row level security;

drop policy if exists "sikt_actions_select_own" on public.sikt_actions;
create policy "sikt_actions_select_own" on public.sikt_actions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "sikt_actions_insert_own" on public.sikt_actions;
create policy "sikt_actions_insert_own" on public.sikt_actions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "sikt_actions_delete_own" on public.sikt_actions;
create policy "sikt_actions_delete_own" on public.sikt_actions for delete to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 6. COMPETITORS
-- =====================================================================
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

drop policy if exists "competitors_select_own" on public.competitors;
create policy "competitors_select_own" on public.competitors for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "competitors_insert_own" on public.competitors;
create policy "competitors_insert_own" on public.competitors for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "competitors_update_own" on public.competitors;
create policy "competitors_update_own" on public.competitors for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "competitors_delete_own" on public.competitors;
create policy "competitors_delete_own" on public.competitors for delete to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 7. KEYWORD_OPPORTUNITIES
-- =====================================================================
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

drop policy if exists "keyword_opp_select_own" on public.keyword_opportunities;
create policy "keyword_opp_select_own" on public.keyword_opportunities for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "keyword_opp_insert_own" on public.keyword_opportunities;
create policy "keyword_opp_insert_own" on public.keyword_opportunities for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "keyword_opp_update_own" on public.keyword_opportunities;
create policy "keyword_opp_update_own" on public.keyword_opportunities for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "keyword_opp_delete_own" on public.keyword_opportunities;
create policy "keyword_opp_delete_own" on public.keyword_opportunities for delete to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 8. USER_KEYWORDS — sporede søkeord med historikk og siste rangering
-- =====================================================================
create table if not exists public.user_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  location text not null default 'Oslo',
  -- Hele rangerings-objektet lagres som JSONB (posisjon, historikk, konkurrenter osv.)
  keyword_data jsonb,
  last_checked_at timestamptz default now(),
  created_at timestamptz not null default now(),
  unique (user_id, keyword, location)
);

create index if not exists user_keywords_user_idx on public.user_keywords (user_id);

alter table public.user_keywords enable row level security;

drop policy if exists "user_keywords_select_own" on public.user_keywords;
create policy "user_keywords_select_own" on public.user_keywords for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_keywords_insert_own" on public.user_keywords;
create policy "user_keywords_insert_own" on public.user_keywords for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_keywords_update_own" on public.user_keywords;
create policy "user_keywords_update_own" on public.user_keywords for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_keywords_delete_own" on public.user_keywords;
create policy "user_keywords_delete_own" on public.user_keywords for delete to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 9. COMPETITOR_KEYWORD_RANKINGS
-- =====================================================================
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

drop policy if exists "ckr_select_own" on public.competitor_keyword_rankings;
create policy "ckr_select_own" on public.competitor_keyword_rankings for select to authenticated
  using (
    exists (
      select 1 from public.competitors c
      where c.id = competitor_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "ckr_service_write" on public.competitor_keyword_rankings;
create policy "ckr_service_write" on public.competitor_keyword_rankings for all
  using (true) with check (true);

-- =====================================================================
-- Be PostgREST oppdatere skjema-cachen
-- =====================================================================
notify pgrst, 'reload schema';

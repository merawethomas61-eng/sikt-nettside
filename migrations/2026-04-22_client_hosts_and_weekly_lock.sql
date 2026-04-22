-- =====================================================
-- Sikt — client_hosts-tabell + ukentlig l\u00e5s p\u00e5 URL
-- =====================================================
-- Kj\u00f8r dette \u00c9N GANG i Supabase Dashboard \u2192 SQL Editor.
-- Idempotent: kan kj\u00f8res flere ganger uten \u00e5 \u00f8delegge data.
-- =====================================================

-- 1) Rydd opp i gamle kolonner p\u00e5 clients som ikke lenger brukes.
--    (Vi fjerner \u00e9n-gangs-telleren og host-feltet p\u00e5 clients;
--    host-data f\u00e5r sin egen tabell under.)
alter table public.clients drop column if exists website_host;
alter table public.clients drop column if exists url_change_count;
alter table public.clients drop column if exists host_change_count;

-- 2) Legg til tidsstempel for URL-endring slik at vi kan h\u00e5ndheve
--    "kan endres \u00e9n gang per uke"-regelen.
alter table public.clients
  add column if not exists url_last_changed_at timestamptz;

-- 3) Ny tabell: client_hosts \u2014 tilkobling til kundens webhost
--    (GitHub, Shopify, WordPress, Wix, Webflow, eget webhotell osv.)
create table if not exists public.client_hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- Plattform: 'github' | 'shopify' | 'wordpress' | 'wix' | 'webflow' | 'vercel' | 'custom'
  platform text,

  -- 'light'  = kunden har oppgitt URL/plattform (ingen ekte tilgang)
  -- 'full'   = OAuth/API-tilgang (kun Premium, kommer senere)
  -- 'skipped' = kunden valgte \u00e5 hoppe over
  connection_mode text not null default 'skipped'
    check (connection_mode in ('light', 'full', 'skipped')),

  -- Lett versjon: hvor ligger koden/admin-panelet
  repo_url text,           -- f.eks. github.com/user/repo
  admin_url text,          -- f.eks. myshop.myshopify.com/admin eller /wp-admin
  notes text,              -- fritekst (f.eks. "eget webhotell via one.com")

  -- Full versjon (OAuth) \u2014 fylles ut senere n\u00e5r OAuth-flyten bygges
  oauth_provider text,
  oauth_account text,
  oauth_installation_id text,
  oauth_scope text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,

  -- Endrings-l\u00e5s: maks \u00e9n endring per uke
  last_changed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Indeks for rask oppslag p\u00e5 user_id
create index if not exists client_hosts_user_idx
  on public.client_hosts (user_id);

-- 5) Row Level Security \u2014 brukere ser kun sin egen host-rad
alter table public.client_hosts enable row level security;

drop policy if exists "client_hosts_select_own" on public.client_hosts;
create policy "client_hosts_select_own"
  on public.client_hosts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "client_hosts_insert_own" on public.client_hosts;
create policy "client_hosts_insert_own"
  on public.client_hosts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "client_hosts_update_own" on public.client_hosts;
create policy "client_hosts_update_own"
  on public.client_hosts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "client_hosts_delete_own" on public.client_hosts;
create policy "client_hosts_delete_own"
  on public.client_hosts for delete to authenticated
  using (auth.uid() = user_id);

-- 6) Be PostgREST oppdatere schema-cachen sin
notify pgrst, 'reload schema';

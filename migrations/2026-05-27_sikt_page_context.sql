-- =====================================================
-- Sikt — sikt_page_context (sidekontekst for content-fix)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor.
-- Idempotent: kan kjøres flere ganger uten å ødelegge data.
-- =====================================================

create table if not exists public.sikt_page_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_host_id uuid references public.client_hosts(id) on delete set null,
  page_url text not null,
  answers jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, page_url)
);

create index if not exists sikt_page_context_user_idx
  on public.sikt_page_context(user_id);

alter table public.sikt_page_context enable row level security;

drop policy if exists "Users read own page context" on public.sikt_page_context;
create policy "Users read own page context"
  on public.sikt_page_context for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own page context" on public.sikt_page_context;
create policy "Users insert own page context"
  on public.sikt_page_context for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own page context" on public.sikt_page_context;
create policy "Users update own page context"
  on public.sikt_page_context for update
  using (auth.uid() = user_id);

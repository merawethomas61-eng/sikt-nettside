-- =====================================================
-- Sikt — sikt_changes (WordPress push audit + rollback)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor.
-- Idempotent: kan kjøres flere ganger uten å ødelegge data.
-- =====================================================

create table if not exists public.sikt_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_host_id uuid references public.client_hosts(id) on delete set null,
  page_url text not null,
  field text not null,
  old_value text,
  new_value text not null,
  pushed_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  rolled_back_value text,
  status text not null default 'active',
  notes text
);

create index if not exists sikt_changes_user_idx
  on public.sikt_changes(user_id);

create index if not exists sikt_changes_status_idx
  on public.sikt_changes(status);

alter table public.sikt_changes enable row level security;

drop policy if exists "Users can read own changes" on public.sikt_changes;
create policy "Users can read own changes"
  on public.sikt_changes for select
  using (auth.uid() = user_id);

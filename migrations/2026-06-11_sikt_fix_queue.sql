-- =====================================================================
-- sikt_fix_queue — kø for fikser som krever kundens godkjenning (hybrid-modell).
-- Auto-felter (meta-description, seo-title) pushes direkte; synlige felter
-- (h1, sideinnhold) legges her av cron-auto-fix og godkjennes i dashbordet.
-- =====================================================================
create table if not exists public.sikt_fix_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_url text not null,
  field text not null check (field in ('h1', 'content')),
  current_value text,
  suggested_value text not null,
  explanation text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'failed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists sikt_fix_queue_user_status_idx
  on public.sikt_fix_queue (user_id, status, created_at desc);

alter table public.sikt_fix_queue enable row level security;

-- Kunden ser sin egen kø.
drop policy if exists "fix_queue_select_own" on public.sikt_fix_queue;
create policy "fix_queue_select_own" on public.sikt_fix_queue for select to authenticated
  using (auth.uid() = user_id);

-- Kunden kan oppdatere status på egne rader (godkjenn/avvis).
drop policy if exists "fix_queue_update_own" on public.sikt_fix_queue;
create policy "fix_queue_update_own" on public.sikt_fix_queue for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Inserts kommer fra motoren (service-role, omgår RLS). Ingen insert-policy for vanlige brukere.

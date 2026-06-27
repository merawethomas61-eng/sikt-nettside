-- =====================================================================
-- Outreach-motor (del 2): sende-siden. Legger til send-felter på drafts,
-- 'failed'-status for permanente feil, og en avmeldings-tabell.
-- Kjøres i prod via Supabase MCP (apply_migration). Denne fila speiler
-- skjemaet i repoet — samme mønster som 2026-06-26_outreach.sql.
-- =====================================================================

-- Send-felter på outreach_drafts.
alter table public.outreach_drafts
  add column if not exists error text,
  add column if not exists resend_id text,                 -- Resend email_id (= email_events.message_id)
  add column if not exists unsub_token uuid not null default gen_random_uuid();

-- 'failed' = parkering for permanente feil (4xx/validering). Constraint ble
-- laget inline i del 1 og auto-navngitt outreach_drafts_status_check.
alter table public.outreach_drafts drop constraint if exists outreach_drafts_status_check;
alter table public.outreach_drafts
  add constraint outreach_drafts_status_check
  check (status in ('draft','approved','sent','skipped','failed'));

create index if not exists outreach_drafts_unsub_token_idx on public.outreach_drafts (unsub_token);

-- Avmeldte (én rad per e-post). Samme RLS-mønster som outreach_drafts:
-- RLS på, ingen policy → kun service-role (send-script + unsubscribe-fn) rører den.
create table if not exists public.outreach_optouts (
  email text primary key,
  source text,                                             -- 'link' | 'reply' | 'manual'
  created_at timestamptz not null default now()
);
alter table public.outreach_optouts enable row level security;

notify pgrst, 'reload schema';

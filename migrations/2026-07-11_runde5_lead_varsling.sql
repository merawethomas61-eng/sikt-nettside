-- Runde 5: lead-varsling («Ny henvendelse fra nettsiden»)
-- KJØRT i prod 2026-07-11 via MCP (apply_migration: runde5_lead_varsling).
--
-- notified: raden er varslet (instant skjema-varsel eller daglig digest).
--   track-lead setter true ved sendt instant-e-post; lead-digesten i
--   weekly-reports tar kun rader med notified=false og setter true etterpå.
-- clients.lead_alert_day/lead_alert_count: dagstak for instant-varsler (5/dag).
-- clients.last_lead_digest_at: 20-timers guard mot dobbel digest.

alter table public.sikt_leads add column if not exists notified boolean not null default false;

alter table public.clients
  add column if not exists lead_alert_day date,
  add column if not exists lead_alert_count integer not null default 0,
  add column if not exists last_lead_digest_at timestamptz;

create index if not exists sikt_leads_user_notified_idx
  on public.sikt_leads(user_id, notified, occurred_at desc);

notify pgrst, 'reload schema';

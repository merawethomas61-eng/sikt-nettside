-- =====================================================================
-- Aha-eksperimenter (Hacking Growth-runden 2026-07-08)
-- =====================================================================
-- 1) day0_report_log — server-side logg + atomisk engangs-port for dag-0-
--    e-posten («Første analyse er klar»). 50/50-holdout: BEGGE grupper
--    logges (variant 'send'/'holdout') slik at D1/D7-retur kan måles
--    server-side mot clients.last_active_at, uavhengig av PostHog-samtykke.
--    Unik indeks på user_id gjør innsettingen til selve idempotens-vakten:
--    to samtidige scans kan aldri sende dobbelt.
--
-- 2) audit_leads.email gjøres nullable — eksperiment «free_audit_gate»
--    variant B kjører gratis-analysen uten e-post og fanger adressen
--    ETTER at resultatet er vist. Radene uten e-post trengs for å måle
--    netto lead-volum (flere starter × lavere fangst-rate).
--    NB: outreach-motoren må hoppe over rader uten e-post (filter på
--    email is not null — verifiser i outreach-drafts før auto-sending).

-- ── 1. day0_report_log ───────────────────────────────────────────────
create table if not exists public.day0_report_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid,
  variant text not null check (variant in ('send', 'holdout')),
  email_sent boolean not null default false,
  findings smallint,
  url text,
  created_at timestamptz not null default now()
);

-- Én dag-0-avgjørelse per kunde, for alltid. Selve raden er porten.
create unique index if not exists day0_report_log_user_uniq
  on public.day0_report_log (user_id);

alter table public.day0_report_log enable row level security;
-- Bevisst INGEN policy: kun service-role (scan-pagespeed edge-fn) skriver/leser.
revoke all on public.day0_report_log from anon, authenticated;

-- ── 2. audit_leads uten e-post (variant B av gratis-analysen) ────────
alter table public.audit_leads alter column email drop not null;

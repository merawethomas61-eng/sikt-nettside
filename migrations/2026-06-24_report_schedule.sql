-- =====================================================================
-- Kunde-styrt rapport-e-post: tidsstempel for siste sendte rapport.
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- last_report_sent_at brukes av weekly-reports-dispatcheren til:
--   (a) dedup mot dobbel-fyring innen samme time (hourly cron),
--   (b) datavindu «siden forrige rapport» (i stedet for fast 7 dager),
--   (c) kadens-sjekk for annenhver-uke og månedlig.
-- notification_preferences (frekvens/klokkeslett/innhold) finnes allerede.
-- =====================================================================
alter table public.clients
  add column if not exists last_report_sent_at timestamptz;

notify pgrst, 'reload schema';

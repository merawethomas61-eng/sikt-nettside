-- Varsel-preferanser per kunde (styrer hvilke e-poster Sikt sender).
-- Lagres som JSON så vi kan legge til nye varseltyper uten ny migrasjon.
-- Nøkler i bruk:
--   weeklyReport   (ukerapport)        — opt-out: manglende nøkkel = PÅ
--   criticalAlerts (nettsiden nede)    — opt-out: manglende nøkkel = PÅ
--   rankChanges    (topp-10-kryssinger)— opt-in:  manglende nøkkel = AV
-- (UI-defaults i ClientPortal speiler dette: weekly/critical på, rank av.)
alter table clients
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

-- PostgREST må laste skjemaet på nytt for at den nye kolonnen blir synlig i API-et.
notify pgrst, 'reload schema';

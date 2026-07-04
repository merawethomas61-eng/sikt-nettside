-- =====================================================================
-- pg_cron-jobbene i prod — AUTORITATIV DOKUMENTASJON + DISASTER RECOVERY
-- =====================================================================
-- ALLE 8 JOBBENE UNDER ER ALLEREDE LIVE I PROD (verifisert mot cron.job
-- 2026-07-04, jobid 5–12). Denne filen er kilden til sannhet i repoet:
-- tidligere lå cron.schedule(...)-kallene bare som utkommenterte snutter
-- spredt i andre migrasjoner, og en gjenoppbygget database ville mistet
-- alle jobbene uten sjekkliste.
--
-- KJØRING: Trygg å kjøre på nytt (unschedule-hvis-finnes før hver schedule),
-- men de tre plassholderne må byttes ut med ekte verdier først:
--   <SERVICE_ROLE_KEY>          — Supabase service-role-nøkkel (Dashboard → API)
--   <CRON_SECRET>               — samme verdi som CRON_SECRET-secreten
--                                 (Supabase Edge Functions + Vercel env)
--   <VERCEL_PROTECTION_BYPASS>  — Vercel → Project → Deployment Protection →
--                                 Protection Bypass for Automation
--
-- Jobbene peker på to mål:
--   • Supabase edge-funksjoner (weekly-reports, review-followup)
--   • Vercel /api/cron-scan-competitors?job=… (autofix/geo/opportunities/
--     optimize/gbp/uptime — én funksjon, jobb-parameter styrer)
-- =====================================================================

-- Forutsetninger (allerede aktivert i prod):
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;

-- ── 1) weekly-reports — HVER TIME (time-basert Oslo-dispatcher) ────────
-- Funksjonen sjekker selv hvilke kunder som skal ha rapport denne timen
-- (kunde-styrt frekvens/dag/klokkeslett) + founder-digest mandag 08:00.
select cron.unschedule('weekly-reports') where exists (select 1 from cron.job where jobname = 'weekly-reports');
select cron.schedule('weekly-reports', '0 * * * *', $$
  select net.http_post(
    url    := 'https://zsoqyerqdxhqnqjvzmsu.supabase.co/functions/v1/weekly-reports',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body   := '{}'::jsonb
  );
$$);

-- ── 2) weekly-auto-fix — mandag 06:00 UTC ─────────────────────────────
select cron.unschedule('weekly-auto-fix') where exists (select 1 from cron.job where jobname = 'weekly-auto-fix');
select cron.schedule('weekly-auto-fix', '0 6 * * 1', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=autofix',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- ── 3) weekly-geo — mandag 05:00 UTC (Premium GEO-sjekker) ────────────
select cron.unschedule('weekly-geo') where exists (select 1 from cron.job where jobname = 'weekly-geo');
select cron.schedule('weekly-geo', '0 5 * * 1', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=geo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- ── 4) weekly-opportunities — mandag 04:00 UTC («Ukens mulighet») ─────
select cron.unschedule('weekly-opportunities') where exists (select 1 from cron.job where jobname = 'weekly-opportunities');
select cron.schedule('weekly-opportunities', '0 4 * * 1', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=opportunities',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- ── 5) monthly-gbp — 1. i måneden 06:30 UTC (Google Business Profile) ─
select cron.unschedule('monthly-gbp') where exists (select 1 from cron.job where jobname = 'monthly-gbp');
select cron.schedule('monthly-gbp', '30 6 1 * *', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=gbp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- ── 6) weekly-optimize — onsdag 03:00 UTC ─────────────────────────────
select cron.unschedule('weekly-optimize') where exists (select 1 from cron.job where jobname = 'weekly-optimize');
select cron.schedule('weekly-optimize', '0 3 * * 3', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=optimize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- ── 7) sikt-review-followup-daily — daglig 07:00 UTC ──────────────────
select cron.unschedule('sikt-review-followup-daily') where exists (select 1 from cron.job where jobname = 'sikt-review-followup-daily');
select cron.schedule('sikt-review-followup-daily', '0 7 * * *', $$
  select net.http_post(
    url := 'https://zsoqyerqdxhqnqjvzmsu.supabase.co/functions/v1/review-followup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
$$);

-- ── 8) sikt-uptime-30min — hvert 30. minutt (nedetid + kritiske varsler) ─
select cron.unschedule('sikt-uptime-30min') where exists (select 1 from cron.job where jobname = 'sikt-uptime-30min');
select cron.schedule('sikt-uptime-30min', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=uptime',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- Verifisering etter kjøring:
--   select jobid, jobname, schedule, active from cron.job order by jobid;
-- Forventet: 8 rader, alle active = true.

-- =====================================================================
-- pg_cron: månedsrapport-jobben (job=monthly_report)
-- =====================================================================
-- ALLEREDE LIVE I PROD (opprettet 2026-07-09 ved å kopiere kommandoen fra
-- monthly-gbp-jobben og bytte job-parameteren — hemmelighetene ble aldri
-- eksponert). Denne filen er disaster-recovery-dokumentasjon, samme stil
-- som migrations/2026-07-04_pg_cron_schedules.sql (bytt plassholderne).
--
-- Kjøreplan: hver time (xx:10) den 1. i måneden. runMonthlyReport tar
-- MR_MAX_CUSTOMERS (3) kunder per kjøring og hopper over de som allerede
-- har rapport for perioden — 24 kjøringer × 3 = kapasitet ~72 kunder/mnd.
-- =====================================================================

select cron.unschedule('monthly-report-day1') where exists (select 1 from cron.job where jobname = 'monthly-report-day1');
select cron.schedule('monthly-report-day1', '10 * 1 * *', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=monthly_report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- Verifisering: select jobid, jobname, schedule, active from cron.job order by jobid;
-- Forventet: monthly-report-day1 med schedule '10 * 1 * *', active = true.

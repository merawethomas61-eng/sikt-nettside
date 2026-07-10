-- =====================================================================
-- pg_cron: verdi-motor-jobbene (site_scan, content_plan, content_generate)
-- =====================================================================
-- Samme stil som migrations/2026-07-04_pg_cron_schedules.sql — bytt
-- plassholderne <CRON_SECRET> og <VERCEL_PROTECTION_BYPASS> før kjøring,
-- ELLER opprett jobbene i prod ved å kopiere kommandoen fra en eksisterende
-- cron.job-rad (f.eks. monthly-report-day1) og bytte jobname/schedule/url —
-- da eksponeres aldri hemmelighetene (mønsteret fra 2026-07-09).
--
--  * sikt-site-scan       — hver time. Selv-drenerende: tar 1 kunde per
--    kjøring, hopper over kunder skannet siste 6 dager → ukentlig re-skann
--    for alle betalende kunder (kapasitet 24 kunder/døgn). Crawler ≤15
--    sider, sjekker ≤12 lenkemål, regner interne lenkeforslag.
--  * sikt-content-plan    — hver time den 1. og 2. + daglig catch-up 03:15
--    (fanger midt-måned-signups/oppgraderinger). Tar 5 kunder per kjøring,
--    hopper over kunder som har plan for perioden.
--  * sikt-content-generate — hver time hele måneden. Genererer maks 2
--    artikler per kjøring (OpenAI-kostkontroll), early-exit når alle
--    plan-items er generert. Dobbelgenerering umulig (partiell unik
--    indeks sikt_articles_plan_item_uidx).
-- =====================================================================

select cron.unschedule('sikt-site-scan') where exists (select 1 from cron.job where jobname = 'sikt-site-scan');
select cron.schedule('sikt-site-scan', '45 * * * *', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=site_scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

select cron.unschedule('sikt-content-plan') where exists (select 1 from cron.job where jobname = 'sikt-content-plan');
select cron.schedule('sikt-content-plan', '15 * 1,2 * *', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=content_plan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

select cron.unschedule('sikt-content-plan-daily') where exists (select 1 from cron.job where jobname = 'sikt-content-plan-daily');
select cron.schedule('sikt-content-plan-daily', '15 3 * * *', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=content_plan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

select cron.unschedule('sikt-content-generate') where exists (select 1 from cron.job where jobname = 'sikt-content-generate');
select cron.schedule('sikt-content-generate', '25 * * * *', $$
  select net.http_post(
    url := 'https://sikt-nettside-merawethomas61-engs-projects.vercel.app/api/cron-scan-competitors?job=content_generate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>',
      'x-vercel-protection-bypass', '<VERCEL_PROTECTION_BYPASS>'
    )
  );
$$);

-- Verifisering: select jobid, jobname, schedule, active from cron.job order by jobid;
-- Forventet: sikt-site-scan '45 * * * *', sikt-content-plan '15 * 1,2 * *',
--            sikt-content-plan-daily '15 3 * * *', sikt-content-generate '25 * * * *'.

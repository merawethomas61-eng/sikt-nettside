-- =====================================================
-- Sikt — sikt_article_results (resultat-bevis-view)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor. Idempotent.
--
-- «Dette gjorde Sikt → dette skjedde»: parer hver pushet/publisert
-- artikkel med søkeordets posisjons- og klikk-utvikling ETTER at
-- artikkelen ble laget (keyword_snapshots skrives ukentlig av
-- job=opportunities). position_at_creation har vært skrevet siden
-- 2026-07-08 men aldri lest — dette er leseren.
--
-- security_invoker = on → spørrende rolles RLS gjelder på de
-- underliggende tabellene: kunden ser KUN egne artikler/snapshots
-- (begge har select-own-policyer); service-role (cron/edge) omgår RLS.
-- =====================================================

create or replace view public.sikt_article_results
with (security_invoker = on) as
select
  a.id as article_id,
  a.user_id,
  a.keyword,
  a.status,
  a.source,
  a.created_at,
  a.pushed_at,
  a.position_at_creation,
  latest.position   as latest_position,
  latest.clicks     as latest_clicks,
  latest.captured_at as latest_captured_at,
  best.best_position,
  first_snap.clicks as clicks_at_start
from public.sikt_articles a
left join lateral (
  select s.position, s.clicks, s.captured_at
  from public.keyword_snapshots s
  where s.user_id = a.user_id
    and lower(s.keyword) = lower(a.keyword)
    and s.captured_at >= a.created_at
  order by s.captured_at desc
  limit 1
) latest on true
left join lateral (
  select min(s.position) as best_position
  from public.keyword_snapshots s
  where s.user_id = a.user_id
    and lower(s.keyword) = lower(a.keyword)
    and s.captured_at >= a.created_at
) best on true
left join lateral (
  select s.clicks
  from public.keyword_snapshots s
  where s.user_id = a.user_id
    and lower(s.keyword) = lower(a.keyword)
    and s.captured_at >= a.created_at
  order by s.captured_at asc
  limit 1
) first_snap on true
where a.status in ('pushed_draft', 'published');

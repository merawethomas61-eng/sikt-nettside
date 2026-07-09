-- =====================================================
-- Sikt — fiks keyword_opportunities-constraints
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor. Idempotent.
--
-- Funn 2026-07-08: BEGGE kildene som skriver muligheter feilet stille
-- mot constraints, så tabellen har alltid vært tom i prod:
--   1) site_id er NOT NULL, men verken mulighets-cronen (job=opportunities)
--      eller konkurrent-gap (scan-competitor.js) sender site_id — koden er
--      user_id-basert (site_id ble arvet fra det gamle skjemaet).
--   2) recommendation_type-checken manglet 'gsc_near_miss' som cronen skriver.
--   (3. feil — difficulty: 30 (tall) mot text-check — fikses i koden.)
-- =====================================================

alter table public.keyword_opportunities
  alter column site_id drop not null;

alter table public.keyword_opportunities
  drop constraint if exists keyword_opportunities_recommendation_type_check;
alter table public.keyword_opportunities
  add constraint keyword_opportunities_recommendation_type_check
  check (recommendation_type in ('new_page', 'faq', 'expand_existing', 'gsc_near_miss'));

-- =====================================================================
-- Sikkerhets-herding (Batch 1) — kjør HELE filen i Supabase → SQL Editor.
--
-- Lukker to hull som lot en innlogget bruker eskalere egne rettigheter:
--
--   K1. clients: rollen `authenticated` hadde TABELL-nivå UPDATE, som
--       overstyrer RLS-kolonnebegrensninger. En hvilken som helst innlogget
--       bruker kunne PATCH-e sin egen rad direkte mot /rest/v1/clients og
--       sette package_name='Premium', subscription_status='active' eller
--       nullstille analyses_count/_month → gratis Premium + bypass av all
--       server-side plan-gating. (UI-en ruter prod-brukere til Stripe, men
--       REST-API-et gjorde ikke — RLS var eneste vakt, og den var utilstrekkelig.)
--
--   H2. health_checks / competitor_keyword_rankings hadde en
--       `for all using(true) with check(true)`-policy UTEN rollebegrensning.
--       Fordi RLS-policyer er permissive (OR), gjorde den at ALLE roller
--       (også `authenticated`/`anon`) kunne lese, endre og slette alle
--       kunders helse-/rank-data. service_role bypasser RLS uansett, så
--       write-policyen var både unødvendig og farlig.
--
-- Ingen prod-kodesti skriver de sensitive kolonnene fra klienten:
--   * Stripe-webhook (SERVICE_ROLE_KEY) setter package_name/subscription_status.
--   * scan-pagespeed (SERVICE_ROLE_KEY) setter analyses_count/_month.
--   service_role bypasser RLS + har egne grants → uberørt av endringene under.
-- =====================================================================

-- ---------------------------------------------------------------------
-- K1: fjern det brede tabell-nivå UPDATE på clients og gi tilbake
--     kolonne-nivå UPDATE på alt UNNTATT de plan-/betalings-/kvotefeltene
--     som kun service_role skal skrive.
-- ---------------------------------------------------------------------
do $$
declare
  col text;
  sensitive text[] := array[
    'package_name',
    'subscription_status',
    'stripe_customer_id',
    'stripe_subscription_id',
    'analyses_count',
    'analyses_month'
  ];
begin
  -- Tabell-nivå UPDATE overstyrer kolonne-nivå grants → må fjernes først.
  revoke update on public.clients from authenticated, anon;

  -- Gi tilbake UPDATE kun på ikke-sensitive kolonner (RLS clients_update_own
  -- begrenser fortsatt til egen rad via auth.uid() = user_id).
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name <> all (sensitive)
  loop
    execute format('grant update (%I) on public.clients to authenticated', col);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- H2: dropp de for vide write-policyene. service_role bypasser RLS, så
--     ingen write-policy trengs; _select_own-policyene beholdes for lesing.
-- ---------------------------------------------------------------------
drop policy if exists "health_checks_service_write" on public.health_checks;
drop policy if exists "ckr_service_write" on public.competitor_keyword_rankings;

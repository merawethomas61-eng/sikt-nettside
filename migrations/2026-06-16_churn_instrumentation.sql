-- =====================================================================
-- Churn-instrumentering — «mål først».
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- Mål: kunne svare på «hvem er i ferd med å falle av, og hvorfor sier
-- folk opp?» — i dag måler vi ingenting av dette.
--
-- 1) clients: last_active_at / last_login_at (skrives fra frontend).
-- 2) cancellation_feedback: hvorfor kunden sa opp (fanges i oppsigelses-flyten).
-- 3) email_events: åpnet/klikket på ukesrapporten (skrives av resend-webhook).
-- 4) client_health: utledet risikobånd (grønn/gul/rød) for eier-oversikt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) clients — aktivitets-tidsstempler
--    Skrives fra frontend via samme update-own-RLS som plan-bytte allerede
--    bruker (performPlanChange PATCHer clients). Ingen ny policy nødvendig.
-- ---------------------------------------------------------------------
alter table public.clients
  add column if not exists last_active_at timestamptz,
  add column if not exists last_login_at timestamptz;

-- ---------------------------------------------------------------------
-- 2) cancellation_feedback (én rad per oppsigelse)
--    Kunden inserter sin egen grunn rett før redirect til Stripe-portalen.
--    Ingen select-policy → kun service-role/eier leser (via SQL/health-view).
-- ---------------------------------------------------------------------
create table if not exists public.cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_name text,
  reason text not null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists cancellation_feedback_created_idx
  on public.cancellation_feedback (created_at desc);

alter table public.cancellation_feedback enable row level security;

drop policy if exists "cancellation_feedback_insert_own" on public.cancellation_feedback;
create policy "cancellation_feedback_insert_own" on public.cancellation_feedback
  for insert to authenticated with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3) email_events (én rad per Resend-hendelse)
--    Skrives KUN av edge-funksjonen resend-webhook (service-role). Ingen
--    RLS-policy = ingen klient-tilgang. user_id resolves via e-post når mulig.
-- ---------------------------------------------------------------------
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  email_type text,
  event text not null
    check (event in ('sent','delivered','opened','clicked','bounced','complained','delivery_delayed')),
  message_id text,
  created_at timestamptz not null default now()
);

create index if not exists email_events_user_idx
  on public.email_events (user_id, created_at desc);
create index if not exists email_events_message_idx
  on public.email_events (message_id);

alter table public.email_events enable row level security;
-- Bevisst INGEN policy: kun service-role (resend-webhook) skriver/leser.

-- ---------------------------------------------------------------------
-- 4) client_health — «hvem»-svaret (eier-oversikt)
--    Risikobånd fra siste aktivitet + abonnement-status. Spørres av eier
--    via service-role (SQL Editor / skjult /health-rute). Ikke for klienter.
--      🟢 green  = aktiv siste 7 d
--      🟡 yellow = stille 7–21 d
--      🔴 red    = stille >21 d, aldri aktiv >7 d etter signup, eller past_due/canceled
-- ---------------------------------------------------------------------
create or replace view public.client_health as
select
  c.user_id,
  c.email,
  c.package_name,
  c.subscription_status,
  c.created_at,
  c.last_login_at,
  c.last_active_at,
  la.last_action_at,
  greatest(
    coalesce(c.last_active_at, c.created_at),
    coalesce(la.last_action_at, c.created_at)
  ) as last_seen_at,
  case
    when c.subscription_status in ('past_due', 'canceled', 'unpaid') then 'red'
    when c.last_active_at is null and c.created_at < now() - interval '7 days' then 'red'
    when greatest(coalesce(c.last_active_at, c.created_at), coalesce(la.last_action_at, c.created_at))
         < now() - interval '21 days' then 'red'
    when greatest(coalesce(c.last_active_at, c.created_at), coalesce(la.last_action_at, c.created_at))
         < now() - interval '7 days' then 'yellow'
    else 'green'
  end as health
from public.clients c
left join lateral (
  select max(sa.created_at) as last_action_at
  from public.sikt_actions sa
  where sa.user_id = c.user_id
) la on true;

-- Eier-only: ikke eksponer helse-oversikten til klient-rollene.
revoke all on public.client_health from anon, authenticated;

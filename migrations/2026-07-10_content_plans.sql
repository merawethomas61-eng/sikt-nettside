-- =====================================================
-- Sikt — månedlig innholdsplan (proaktiv innholdsmotor)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor.
-- Idempotent: kan kjøres flere ganger uten å ødelegge data.
--
-- 1. i måneden lager cron-en (job=content_plan) en plan per
-- Standard/Premium-kunde: hvilke søkeord, hvilke artikler. Deretter
-- genererer job=content_generate utkastene automatisk opp til
-- månedskvoten (Standard 2 / Premium 8) — kunden godkjenner i portalen
-- (aldri auto-publisering; kun WordPress-UTKAST etter godkjenning).
-- =====================================================

create table if not exists public.sikt_content_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'YYYY-MM' (UTC-måned — samme månedsnøkkel som artikkel-kvoten)
  period text not null,
  -- 'planned' -> 'generating' -> 'ready' (alle utkast generert)
  status text not null default 'planned'
    check (status in ('planned', 'generating', 'ready')),
  -- Kort AI/heuristikk-begrunnelse for månedens valg (vises i portalen)
  rationale text,
  -- «X nye artikler klare til godkjenning»-e-posten sendes ÉN gang
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create table if not exists public.sikt_content_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.sikt_content_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  -- Løs referanse (ingen FK): opportunity-rader kan re-upsertes av cron.
  opportunity_id uuid,
  -- Hvorfor dette søkeordet ble valgt («nesten på side 1», «konkurrent-gap», …)
  reason text,
  sort integer not null default 0,
  -- Settes når artikkelen er generert (sikt_articles.id)
  article_id uuid,
  -- 'planned' -> 'generated' | 'dismissed' (kunden avviser)
  status text not null default 'planned'
    check (status in ('planned', 'generated', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (plan_id, keyword)
);

create index if not exists sikt_content_plans_user_idx
  on public.sikt_content_plans(user_id, period);

create index if not exists sikt_content_plan_items_plan_idx
  on public.sikt_content_plan_items(plan_id);

create index if not exists sikt_content_plan_items_user_status_idx
  on public.sikt_content_plan_items(user_id, status);

alter table public.sikt_content_plans enable row level security;
alter table public.sikt_content_plan_items enable row level security;

-- Kun cron-en (service-role) skriver planer. Kunden leser sine egne,
-- og kan KUN avvise items (status -> 'dismissed') fra portalen.
drop policy if exists "Users can read own content plans" on public.sikt_content_plans;
create policy "Users can read own content plans"
  on public.sikt_content_plans for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own plan items" on public.sikt_content_plan_items;
create policy "Users can read own plan items"
  on public.sikt_content_plan_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can dismiss own plan items" on public.sikt_content_plan_items;
create policy "Users can dismiss own plan items"
  on public.sikt_content_plan_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status = 'dismissed');

-- ---------------------------------------------------------------------
-- sikt_articles: plan-kobling + kilde ('manual' = kunden trykket selv,
-- 'plan' = generert av innholdsplan-cron-en).
-- ---------------------------------------------------------------------
alter table public.sikt_articles
  add column if not exists source text not null default 'manual';

alter table public.sikt_articles
  add column if not exists plan_item_id uuid;

-- Hard idempotens for generatoren: to cron-kjøringer kan ALDRI generere
-- to artikler for samme plan-item (unique_violation fanges i koden).
create unique index if not exists sikt_articles_plan_item_uidx
  on public.sikt_articles(plan_item_id)
  where plan_item_id is not null;

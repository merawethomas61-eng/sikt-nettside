-- =====================================================================
-- Anmeldelser Fase 2 — ekte review-motor (deeplink + e-post-utsending).
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- 1) review_settings — per klient: Google-profil/place-id + utledet
--    «skriv anmeldelse»-deeplink, så «be om anmeldelse» peker ekte.
-- 2) review_requests — én rad per kunde vi ber om anmeldelse fra,
--    med status (klar/sendt/åpnet/svart) for oppfølging.
--
-- Modell: deeplink-først (ingen Google API ennå). Lesing av ekte
-- anmeldelser (snitt/antall) og svar krever Google Places/Business
-- Profile API og kommer senere — disse tabellene er forberedt for det.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) review_settings (én rad per bruker)
-- ---------------------------------------------------------------------
create table if not exists public.review_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  -- Google place-id (utledes/limes inn). Brukes til deeplink + senere API.
  google_place_id text,
  -- Ferdig «skriv en anmeldelse»-deeplink (search.google.com/local/writereview).
  write_review_url text,
  -- Lenke til selve Google-profilen (kart/søk) — der man leser anmeldelser.
  profile_url text,
  -- Valgfri privat «hvordan gikk det?»-tilbakemelding FØR offentlig lenke.
  -- Google forbyr gating: offentlig lenke vises ALLTID uansett denne verdien.
  private_feedback_enabled boolean not null default false,
  -- Cache av ekte Google-data (Places API, read-only). Skrives av edge-
  -- funksjonen google-reviews; frontend leser herfra og kan be om oppdatering.
  cached_rating numeric,
  cached_count integer,
  cached_reviews jsonb,
  cached_at timestamptz,
  -- Nullpunkt: antall Google-anmeldelser da kunden koblet til. Lar oss vise
  -- «+N nye siden start» (ærlig aggregert effekt av å spørre — vi kan ikke
  -- knytte en enkelt forespørsel til en konkret anmeldelse).
  baseline_count integer,
  baseline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.review_settings enable row level security;

drop policy if exists "review_settings_select_own" on public.review_settings;
create policy "review_settings_select_own" on public.review_settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "review_settings_insert_own" on public.review_settings;
create policy "review_settings_insert_own" on public.review_settings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "review_settings_update_own" on public.review_settings;
create policy "review_settings_update_own" on public.review_settings
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2) review_requests (én rad per forespørsel)
-- ---------------------------------------------------------------------
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  -- Kontaktpunkt. I dag kun e-post; SMS kan legges til senere via 'channel'.
  email text,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  status text not null default 'ready'
    check (status in ('ready', 'sent', 'opened', 'responded', 'failed')),
  -- Ugjettelig token for åpnings-sporing / privat-tilbakemelding-redirect.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  error text,
  sent_at timestamptz,
  opened_at timestamptz,
  responded_at timestamptz,
  -- Når den ene auto-påminnelsen ble sendt (null = ikke sendt ennå).
  last_followup_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_requests_user_status_idx
  on public.review_requests (user_id, status, created_at desc);

-- For auto-oppfølging-skanningen (service-role): finn sendte uten respons.
create index if not exists review_requests_followup_idx
  on public.review_requests (status, sent_at)
  where status = 'sent' and last_followup_at is null;

alter table public.review_requests enable row level security;

-- Kunden ser sine egne forespørsler.
drop policy if exists "review_requests_select_own" on public.review_requests;
create policy "review_requests_select_own" on public.review_requests
  for select to authenticated using (auth.uid() = user_id);

-- Kunden oppretter forespørsler for egne kunder (status starter 'ready').
drop policy if exists "review_requests_insert_own" on public.review_requests;
create policy "review_requests_insert_own" on public.review_requests
  for insert to authenticated with check (auth.uid() = user_id);

-- Kunden kan oppdatere egne rader (f.eks. avbryte). Selve sendingen +
-- status→'sent'/'opened' settes av edge-funksjonen (service-role).
drop policy if exists "review_requests_update_own" on public.review_requests;
create policy "review_requests_update_own" on public.review_requests
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3) gbp_connections — Google Business Profile OAuth (svar på anmeldelser).
--    SCAFFOLD: står mørk til Google har godkjent Business Profile API-tilgang
--    + OAuth-klient er satt opp. Tokens krypteres og leses KUN av edge-
--    funksjonen gbp-reviews (service-role). Ingen RLS-policy for klienten →
--    frontend spør edge-funksjonen om status, leser aldri denne tabellen.
-- ---------------------------------------------------------------------
create table if not exists public.gbp_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  account_name text,   -- f.eks. "accounts/123456789"
  location_name text,  -- f.eks. "locations/987654321"
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gbp_connections enable row level security;
-- Bevisst INGEN policy: kun service-role (gbp-reviews) rører tokens.

-- ---------------------------------------------------------------------
-- 4) pg_cron — auto-oppfølging (fylles inn i Fase 2c).
--    Edge-funksjonen 'review-followup' sender én påminnelse til
--    forespørsler som er 'sent' for > 4 dager siden uten respons.
--    Kjør manuelt ETTER at edge-funksjonen er deployet og verifisert.
--
-- select cron.schedule(
--   'sikt-review-followup-daily', '0 7 * * *',  -- daglig 07:00 UTC
--   $$ select net.http_post(
--        url := 'https://<PROJECT-REF>.supabase.co/functions/v1/review-followup',
--        headers := '{"x-cron-secret": "<CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--        body := '{}'::jsonb ) $$
-- );
-- ---------------------------------------------------------------------

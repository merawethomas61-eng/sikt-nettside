-- =====================================================
-- Sikt — henvendelses-sporing (leads)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor. Idempotent.
--
-- Telefon-klikk, e-post-klikk og skjema-innsendinger på kundens side
-- rapporteres av connector-pluginens beacon (v1.3) / copy-paste-snippet
-- til den offentlige edge-funksjonen track-lead, som slår opp kunden på
-- lead_token og logger raden her. ALDRI PII — kun event-type + sti.
-- «SEO ga deg 9 henvendelser denne måneden» er tallet småbedrifter
-- faktisk bryr seg om.
-- =====================================================

-- Offentlig (ikke-hemmelig, men ugjettbar) token som identifiserer kunden
-- i beacon-kall. På clients (ikke client_hosts) så ALLE kunder har én —
-- også de uten WordPress (copy-paste-snippet).
alter table public.clients
  add column if not exists lead_token uuid not null default gen_random_uuid();

create unique index if not exists clients_lead_token_uidx
  on public.clients(lead_token);

create table if not exists public.sikt_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'tel' = telefon-klikk, 'mailto' = e-post-klikk, 'form' = skjema sendt
  kind text not null check (kind in ('tel', 'mailto', 'form')),
  -- Kun sti (location.pathname), aldri query/hash — ingen PII
  page_path text,
  occurred_at timestamptz not null default now()
);

create index if not exists sikt_leads_user_occurred_idx
  on public.sikt_leads(user_id, occurred_at desc);

alter table public.sikt_leads enable row level security;

-- Kun edge-funksjonen (service-role) skriver. Kunden leser sine egne.
drop policy if exists "Users can read own leads" on public.sikt_leads;
create policy "Users can read own leads"
  on public.sikt_leads for select
  using (auth.uid() = user_id);

-- =====================================================================
-- Outreach-motor (del 1): berik audit_leads + review-kø for AI-utkast.
-- Kjørt i prod 2026-06-26 (Supabase migration: outreach_enrichment_and_drafts).
-- Denne fila speiler skjemaet i repoet.
-- =====================================================================

-- Berikelse av audit_leads: lagre funn ved fangst (scan-pagespeed public-gren).
alter table public.audit_leads
  add column if not exists scores jsonb,
  add column if not exists issue_count int,
  add column if not exists top_issues jsonb,
  add column if not exists page_facts jsonb;

-- Review-kø for AI-genererte outreach-utkast. Founder-script skriver/leser via
-- service-role. Samme mønster som audit_leads/email_events: RLS på, ingen policy.
create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_email text not null,
  url text,
  subject text,
  body text,
  status text not null default 'draft'
    check (status in ('draft','approved','sent','skipped')),
  enriched jsonb,
  ai_model text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outreach_drafts_email_idx on public.outreach_drafts (lead_email);
create index if not exists outreach_drafts_status_idx on public.outreach_drafts (status, created_at desc);
alter table public.outreach_drafts enable row level security;
-- Bevisst ingen policy: kun service-role (founder-script) rører denne.
notify pgrst, 'reload schema';

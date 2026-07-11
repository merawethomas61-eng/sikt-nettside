-- =====================================================================
-- Klientverdi-runde 3 («uunnværlig»): tre små endringer.
-- 1) clients.lead_value_nok — kundens eget tall for hva en henvendelse
--    er verdt (verdi-kortet på Hjem). Null = ikke satt (8 kr/klikk-anslag).
-- 2) site_status: kunden får lese SIN EGEN oppetids-rad (uptime-strip på
--    Hjem). Skriving er fortsatt kun service-role (cron).
-- 3) clients.auto_approve_fixes — opt-in «La Sikt fikse selv»: trygge
--    fikser (meta/title/alt) pushes direkte i stedet for godkjenningskø.
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
-- =====================================================================

-- 1) Henvendelses-verdi
alter table public.clients add column if not exists lead_value_nok integer;

-- 2) Uptime: egen rad kan leses av kunden
drop policy if exists "site_status_select_own" on public.site_status;
create policy "site_status_select_own" on public.site_status
  for select to authenticated using (auth.uid() = user_id);

-- 3) Auto-fiks opt-in (av som standard; kunden slår selv på i Innstillinger)
alter table public.clients add column if not exists auto_approve_fixes boolean not null default false;

notify pgrst, 'reload schema';

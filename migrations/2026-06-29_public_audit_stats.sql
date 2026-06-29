-- =====================================================================
-- public_audit_stats — trygt, offentlig ANTALL gratis-analyser kjørt.
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- Mål: vise et ærlig sosialt-bevis-tall på forsiden («X sider analysert
-- med Sikt») UTEN å eksponere selve lead-listen. audit_leads har RLS som
-- blokkerer anon/authenticated (kun service-role skriver/leser radene).
--
-- Denne funksjonen kjører som SECURITY DEFINER (eier = postgres, som
-- bypasser RLS), men returnerer KUN ett tall — aldri e-post/URL/score.
-- Derfor er det trygt å gi anon EXECUTE: de får antallet, ikke dataene.
-- =====================================================================

create or replace function public.public_audit_stats()
  returns bigint
  language sql
  stable
  security definer
  set search_path = public
as $$
  select count(*) from public.audit_leads;
$$;

-- Lås ned: ingen får kalle den implisitt, så gir vi EXECUTE eksplisitt.
revoke all on function public.public_audit_stats() from public;
grant execute on function public.public_audit_stats() to anon, authenticated;

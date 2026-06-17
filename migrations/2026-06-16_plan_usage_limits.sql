-- =====================================================================
-- Plan-baserte bruksgrenser — antall analyser per måned.
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
--
-- Teller tekniske analyser («Kjør analyse» / runRealAnalysis) per kalender-
-- måned per kunde, så vi kan begrense etter plan (Basic < Standard < Premium)
-- og skape oppgraderingspress. Telleren håndheves klient-side (samme mønster
-- som søkeord-/konkurrent-cap), men lagres her så den er lik på tvers av
-- enheter og overlever reload.
--
-- analyses_month: 'YYYY-MM' for inneværende telleperiode (nullstilles ved ny mnd).
-- analyses_count: antall analyser brukt i den måneden.
-- =====================================================================
alter table public.clients
  add column if not exists analyses_month text,
  add column if not exists analyses_count integer not null default 0;

-- =============================================================================
-- Fiks: keyword_opportunities.user_id mangler + RLS på competitors / opportunities
-- Kjør HELE filen i Supabase → SQL Editor (én gang).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) keyword_opportunities: legg til user_id hvis den mangler
-- ---------------------------------------------------------------------------
ALTER TABLE public.keyword_opportunities
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill hvis tabellen har site_id (eldre skjema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'keyword_opportunities' AND column_name = 'site_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'user_id'
  ) THEN
    UPDATE public.keyword_opportunities ko
    SET user_id = s.user_id
    FROM public.sites s
    WHERE ko.site_id = s.id AND ko.user_id IS NULL;
  END IF;
END $$;

-- Hvis du har rader uten user_id etter backfill: slett dem eller sett user_id i Table Editor.
-- Kun kjør denne hvis du bevisst vil fjerne «løse» rader:
-- DELETE FROM public.keyword_opportunities WHERE user_id IS NULL;

-- Gjør kolonnen obligatorisk (feiler hvis noen rader fortsatt har NULL user_id — fiks dem først)
ALTER TABLE public.keyword_opportunities
ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS keyword_opp_user_idx ON public.keyword_opportunities (user_id, estimated_traffic DESC);

-- Unik kombinasjon brukt av API upsert (scan-competitor) — ignorer hvis den finnes
CREATE UNIQUE INDEX IF NOT EXISTS keyword_opportunities_user_keyword_uidx
ON public.keyword_opportunities (user_id, keyword);

-- ---------------------------------------------------------------------------
-- 2) Slett ALLE RLS-policyer på competitors og keyword_opportunities (rydde gammelt rot)
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'competitors'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.competitors', r.policyname);
  END LOOP;
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'keyword_opportunities'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.keyword_opportunities', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_opportunities ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) Standard policyer (authenticated + auth.uid() = user_id)
-- ---------------------------------------------------------------------------
CREATE POLICY competitors_select_own ON public.competitors
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY competitors_insert_own ON public.competitors
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY competitors_update_own ON public.competitors
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY competitors_delete_own ON public.competitors
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY keyword_opp_select_own ON public.keyword_opportunities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY keyword_opp_insert_own ON public.keyword_opportunities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY keyword_opp_update_own ON public.keyword_opportunities
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY keyword_opp_delete_own ON public.keyword_opportunities
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

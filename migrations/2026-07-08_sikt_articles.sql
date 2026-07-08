-- =====================================================
-- Sikt — sikt_articles (innholdsmotor: søkeord → artikkel)
-- =====================================================
-- Kjør ÉN GANG i Supabase Dashboard → SQL Editor.
-- Idempotent: kan kjøres flere ganger uten å ødelegge data.
--
-- Artikler generert fra keyword_opportunities. Kvoten per pakke
-- (Basic 0 / Standard 2 / Premium 8 per måned) håndheves server-side
-- ved å telle rader per bruker inneværende måned — ingen ekstra
-- kolonner i clients.
-- =====================================================

create table if not exists public.sikt_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Løs referanse (ingen FK): opportunity-rader kan re-upsertes av cron.
  opportunity_id uuid,
  keyword text not null,
  -- 'new_article' = ny side/artikkel, 'expand_existing' = utvid siden som nesten rangerer
  mode text not null default 'new_article',
  target_page_url text,
  -- Generert innhold
  title text not null,
  slug text not null,
  meta_description text not null,
  h1 text,
  content_html text not null,
  faq_jsonld text,
  -- 'generated' -> 'pushed_draft' | 'dismissed'
  status text not null default 'generated',
  wp_post_id integer,
  pushed_at timestamptz,
  -- Bevis-sløyfe: posisjonen søkeordet hadde da artikkelen ble laget
  position_at_creation numeric,
  created_at timestamptz not null default now()
);

create index if not exists sikt_articles_user_idx
  on public.sikt_articles(user_id);

create index if not exists sikt_articles_user_created_idx
  on public.sikt_articles(user_id, created_at desc);

alter table public.sikt_articles enable row level security;

-- Generering skjer i api/solve-problem.js med brukerens token (anon-nøkkel),
-- så både select, insert og update må gjennom RLS som brukeren selv.
drop policy if exists "Users can read own articles" on public.sikt_articles;
create policy "Users can read own articles"
  on public.sikt_articles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own articles" on public.sikt_articles;
create policy "Users can insert own articles"
  on public.sikt_articles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own articles" on public.sikt_articles;
create policy "Users can update own articles"
  on public.sikt_articles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

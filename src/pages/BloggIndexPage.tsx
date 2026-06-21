import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Sparkles } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { Container } from '../components/marketing/Container';
import { SectionHeading } from '../components/marketing/SectionHeading';
import { PillButton } from '../components/marketing/PillButton';
import { GradientCTA } from '../components/marketing/GradientCTA';
import { getAllPosts, formatDateNo, type BlogPost } from '../blog/loader';

const cardCls =
  'group block relative overflow-hidden rounded-[28px] sm:rounded-[36px] bg-white/80 backdrop-blur-sm border border-[#EBEBE6] ui-motion ui-lift-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl';

function Meta({ date, minutes }: { date: string; minutes: number }) {
  return (
    <div className="flex items-center gap-3 text-xs font-bold text-[#B3AD9F] uppercase tracking-wider">
      <span>{formatDateNo(date)}</span>
      <span className="w-1 h-1 rounded-full bg-[#EBEBE6]" />
      <span className="flex items-center gap-1.5">
        <Clock size={12} /> {minutes} min
      </span>
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.slice(0, 3).map((t) => (
        <span
          key={t}
          className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2.5 py-0.5"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// Rolig kuratering: temaene bloggen dekker (utledet fra faktiske tags).
function topicsFrom(posts: BlogPost[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const p of posts) {
    for (const t of p.tags) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        order.push(t);
      }
    }
  }
  return order.slice(0, 6);
}

export default function BloggIndexPage() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;
  const topics = topicsFrom(posts);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Sikt-bloggen',
    url: 'https://siktseo.com/blogg',
    description: 'Guider og innsikt om SEO, Google og AI-synlighet for norske bedrifter.',
  };

  return (
    <PageShell>
      <Seo
        title="Bloggen — SEO og AI-synlighet på plain norsk | Sikt"
        description="Guider og innsikt om SEO, Google og hvordan du blir synlig i AI-søk som ChatGPT — skrevet for norske bedrifter, uten sjargong."
        canonical="https://siktseo.com/blogg"
        image="https://siktseo.com/og/blogg.png"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="relative pt-4 sm:pt-8 pb-10 sm:pb-14 hero-gradient overflow-hidden">
        <Container size="md" className="text-center relative z-10">
          <RevealOnScroll direction="up">
            <SectionHeading
              as="h1"
              size="hero"
              align="center"
              title={<>Synlighet, <span className="text-violet-600">forklart enkelt.</span></>}
              intro="Praktiske guider om SEO, Google og AI-søk — for deg som vil bli funnet, ikke for SEO-eksperter."
            />
            {topics.length > 0 && (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                {topics.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-bold uppercase tracking-wider text-[#808080] bg-white/70 border border-[#EBEBE6] rounded-full px-3 py-1"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </RevealOnScroll>
        </Container>
      </section>

      <Container size="xl" className="pb-16 sm:pb-24">
        {posts.length === 0 ? (
          <p className="text-center text-[#808080]">Innlegg kommer snart.</p>
        ) : (
          <>
            {/* Fremhevet siste innlegg */}
            <RevealOnScroll direction="up">
              <Link to={`/blogg/${featured.slug}`} className={`${cardCls} p-7 sm:p-10 mb-6`}>
                <div className="pointer-events-none absolute -top-8 -right-8 text-violet-100/50">
                  <Sparkles size={130} />
                </div>
                <div className="relative z-10">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-4">
                    <Tags tags={featured.tags} />
                    <Meta date={featured.date} minutes={featured.readingMinutes} />
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#1A1A1A] leading-tight max-w-3xl [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-700 transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                    {featured.title}
                  </h2>
                  <p className="mt-4 text-[#808080] font-medium leading-relaxed text-base sm:text-lg max-w-2xl">
                    {featured.description}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-violet-700">
                    Les mer
                    <ArrowRight size={16} className="transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
                  </span>
                </div>
              </Link>
            </RevealOnScroll>

            {/* Resten */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {rest.map((post, i) => (
                  <RevealOnScroll key={post.slug} direction="up" delay={i * 80}>
                    <Link to={`/blogg/${post.slug}`} className={`${cardCls} p-6 sm:p-8 h-full`}>
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
                          <Tags tags={post.tags} />
                        </div>
                        <Meta date={post.date} minutes={post.readingMinutes} />
                        <h3 className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight text-[#1A1A1A] leading-snug [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-700 transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                          {post.title}
                        </h3>
                        <p className="mt-3 text-[#808080] font-medium leading-relaxed flex-1">{post.description}</p>
                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-700">
                          Les mer
                          <ArrowRight size={16} className="transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
                        </span>
                      </div>
                    </Link>
                  </RevealOnScroll>
                ))}
              </div>
            )}
          </>
        )}
      </Container>

      {/* CTA */}
      <GradientCTA
        eyebrow="Vil du bli funnet?"
        eyebrowIcon={<Sparkles size={13} />}
        title={<>Nok teori. <span className="text-violet-200">La oss sjekke siden din.</span></>}
        intro="Se hvor synlig nettsiden din er i dag — gratis, på plain norsk, på under et minutt."
        trust={['Ingen bindingstid', 'Plain norsk garantert']}
      >
        <PillButton to="/#gratis-analyse" variant="lightOnDark" size="lg">
          Ta en gratis analyse
          <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
        </PillButton>
      </GradientCTA>
    </PageShell>
  );
}

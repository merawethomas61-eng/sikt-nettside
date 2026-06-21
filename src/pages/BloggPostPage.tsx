import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, ArrowRight, Sparkles, ChevronRight, List } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { Container } from '../components/marketing/Container';
import { PillButton } from '../components/marketing/PillButton';
import { GradientCTA } from '../components/marketing/GradientCTA';
import { FaqList } from '../components/marketing/Faq';
import { getPostBySlug, getRelatedPosts, formatDateNo, type TocItem } from '../blog/loader';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 96;
  window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// Tynn lese-progresjon-stripe øverst (transform: scaleX → GPU/emil-vennlig).
function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-[60] pointer-events-none">
      <div
        className="h-full bg-violet-600 origin-left transition-transform duration-100 ease-out"
        style={{ transform: `scaleX(${p})` }}
      />
    </div>
  );
}

function useActiveHeading(ids: string[]): string {
  const key = ids.join('|');
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    if (!ids.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-100px 0px -66% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

function TocLinks({ headings, active }: { headings: TocItem[]; active: string }) {
  return (
    <ul className="space-y-2.5 border-l border-[#EBEBE6] pl-4">
      {headings.map((h) => {
        const on = h.id === active;
        return (
          <li key={h.id} className="-ml-4 pl-4 relative">
            {on && <span className="absolute left-[-1px] top-1 bottom-1 w-0.5 rounded-full bg-violet-600" />}
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(h.id);
              }}
              className={`block text-sm leading-snug ui-motion ${
                on ? 'text-violet-700 font-bold' : 'text-[#808080] font-medium [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]'
              }`}
            >
              {h.text}
            </a>
          </li>
        );
      })}
    </ul>
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

export default function BloggPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const headings = post?.headings ?? [];
  const active = useActiveHeading(headings.map((h) => h.id));

  if (!post) {
    return (
      <PageShell>
        <Seo title="Innlegg ikke funnet | Sikt" noindex />
        <Container size="sm" className="py-24 text-center">
          <h1 className="text-3xl font-black tracking-tight text-[#1A1A1A] mb-4">Innlegget finnes ikke</h1>
          <p className="text-[#808080] font-medium mb-8">Lenken er kanskje gammel, eller innlegget er flyttet.</p>
          <div className="flex justify-center">
            <PillButton to="/blogg" variant="dark">
              <ArrowLeft size={18} /> Til bloggen
            </PillButton>
          </div>
        </Container>
      </PageShell>
    );
  }

  const url = `https://siktseo.com/blogg/${post.slug}`;
  const ogImg = post.ogImage || `https://siktseo.com/og/blog-${post.slug}.png`;
  const related = getRelatedPosts(post.slug, 2);

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: { '@type': 'Organization', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'Sikt',
      url: 'https://siktseo.com',
      logo: { '@type': 'ImageObject', url: 'https://siktseo.com/og-image.png' },
    },
    mainEntityOfPage: url,
    inLanguage: 'nb-NO',
    keywords: post.tags.join(', '),
    image: ogImg,
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hjem', item: 'https://siktseo.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blogg', item: 'https://siktseo.com/blogg' },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };
  const faqLd =
    post.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : null;
  const jsonLd = faqLd ? [articleLd, breadcrumbLd, faqLd] : [articleLd, breadcrumbLd];

  return (
    <PageShell>
      <Seo
        title={`${post.title} | Sikt`}
        description={post.description}
        canonical={url}
        type="article"
        image={ogImg}
        jsonLd={jsonLd}
      />
      {/* scroll-offset for anker (blogg-scopet, rører ikke forsiden) */}
      <style>{`.blog-prose :is(h2,h3){scroll-margin-top:6rem}`}</style>
      <ReadingProgress />

      {/* Hero */}
      <section className="relative pt-2 pb-2 hero-gradient overflow-hidden">
        <Container size="lg" className="relative z-10">
          <RevealOnScroll direction="up">
            <nav className="flex items-center gap-2 text-xs font-bold text-[#B3AD9F] mb-6" aria-label="Brødsmuler">
              <Link to="/" className="[@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-700 transition-[color] duration-200">Hjem</Link>
              <ChevronRight size={12} />
              <Link to="/blogg" className="[@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-700 transition-[color] duration-200">Blogg</Link>
              <ChevronRight size={12} />
              <span className="text-[#808080] truncate max-w-[55%]">{post.title}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-5">
              <Tags tags={post.tags} />
              <div className="flex items-center gap-3 text-xs font-bold text-[#B3AD9F] uppercase tracking-wider">
                <span>{formatDateNo(post.date)}</span>
                <span className="w-1 h-1 rounded-full bg-[#EBEBE6]" />
                <span className="flex items-center gap-1.5">
                  <Clock size={12} /> {post.readingMinutes} min lesetid
                </span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#1A1A1A] leading-[1.1] mb-5 max-w-3xl">
              {post.title}
            </h1>
            <p className="text-lg text-[#808080] font-medium leading-relaxed max-w-2xl">{post.description}</p>
            <p className="mt-5 text-xs font-bold text-[#B3AD9F] uppercase tracking-wider">Av {post.author}</p>
          </RevealOnScroll>
        </Container>
      </section>

      {/* Innhold + TOC */}
      <Container size="lg" className="pt-8 pb-16 sm:pb-24">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12 xl:gap-16">
          {/* Artikkel */}
          <div className="min-w-0">
            {post.summary && (
              <RevealOnScroll direction="up">
                <div className="mb-8 rounded-2xl border border-violet-100 bg-violet-50/60 p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-2 text-violet-700">
                    <Sparkles size={15} />
                    <span className="text-xs font-black uppercase tracking-widest">Kort svar</span>
                  </div>
                  <p className="text-[#1A1A1A] font-semibold leading-relaxed text-base sm:text-lg">{post.summary}</p>
                </div>
              </RevealOnScroll>
            )}

            {/* Mobil-TOC */}
            {headings.length > 1 && (
              <details className="lg:hidden mb-8 group bg-white/80 border border-[#EBEBE6] rounded-2xl px-5">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none py-4 text-[#1A1A1A] font-bold [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><List size={16} className="text-violet-600" /> Innhold</span>
                  <ChevronRight size={18} className="text-[#808080] transition-transform duration-200 group-open:rotate-90" />
                </summary>
                <div className="pb-5">
                  <TocLinks headings={headings} active={active} />
                </div>
              </details>
            )}

            <article className="blog-prose" dangerouslySetInnerHTML={{ __html: post.html }} />

            {/* FAQ */}
            {post.faq.length > 0 && (
              <section className="mt-12 sm:mt-16">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A1A1A] mb-6">Vanlige spørsmål</h2>
                <FaqList items={post.faq.map((f) => ({ q: f.q, a: f.a }))} />
              </section>
            )}
          </div>

          {/* TOC (desktop, sticky) */}
          {headings.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <div className="text-[11px] font-black uppercase tracking-widest text-[#B3AD9F] mb-4">På denne siden</div>
                <TocLinks headings={headings} active={active} />
              </div>
            </aside>
          )}
        </div>

        {/* Relaterte innlegg */}
        {related.length > 0 && (
          <section className="mt-16 sm:mt-20 pt-10 border-t border-[#EBEBE6]">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A1A1A] mb-6">Les videre</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/blogg/${r.slug}`}
                  className="group block rounded-[24px] bg-white/80 backdrop-blur-sm border border-[#EBEBE6] p-6 ui-motion ui-lift-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl"
                >
                  <Tags tags={r.tags} />
                  <h3 className="mt-3 text-lg font-extrabold tracking-tight text-[#1A1A1A] leading-snug [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-700 transition-[color] duration-200">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#808080] font-medium leading-relaxed line-clamp-2">{r.description}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-violet-700">
                    Les mer
                    <ArrowRight size={15} className="transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>

      {/* CTA */}
      <GradientCTA
        eyebrow="Vil du se hvor du står?"
        eyebrowIcon={<Sparkles size={13} />}
        title={<>Sjekk siden din <span className="text-violet-200">på under et minutt.</span></>}
        intro="En gratis analyse viser hvor synlig du er på Google og i AI-søk i dag — og hva som stopper deg."
        trust={['Gratis', 'Ingen bindingstid', 'Plain norsk']}
      >
        <PillButton to="/#gratis-analyse" variant="lightOnDark" size="lg">
          Ta en gratis analyse
          <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
        </PillButton>
      </GradientCTA>
    </PageShell>
  );
}

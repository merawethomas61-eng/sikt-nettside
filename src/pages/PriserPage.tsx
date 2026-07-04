import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, ShieldCheck, CalendarClock } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { Pricing } from '../shared/Pricing';
import { track } from '../analytics';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { Container } from '../components/marketing/Container';
import { SectionHeading } from '../components/marketing/SectionHeading';
import { Badge } from '../components/marketing/Badge';
import { PillButton } from '../components/marketing/PillButton';
import { GradientCTA } from '../components/marketing/GradientCTA';
import { FeatureSplit } from '../components/marketing/FeatureSplit';
import { Frame } from '../components/marketing/Frame';
import { FaqList } from '../components/marketing/Faq';
// Tekstene bor i src/content/faqData.mjs — samme kilde som prerender.mjs
// bruker til FAQPage-schemaet, så markup og synlig tekst kan aldri spriker.
import { priserFaqs as faqs } from '../content/faqData.mjs';

/* Konkret «null binding»-mockup — viser løftet som et ekte abonnement-panel. */
function BillingMock() {
  const rows = [
    { l: 'Bindingstid', v: 'Ingen' },
    { l: 'Oppsigelse', v: 'Når som helst' },
    { l: 'Neste faktura', v: '1. juli' },
  ];
  return (
    <Frame url="app.siktseo.com/abonnement">
      <div className="bg-[#FBFBFA] p-4 sm:p-6 space-y-4">
        <div className="bg-white rounded-2xl border border-[#E9E4DA] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-[#5C574C] font-bold">Ditt abonnement</div>
              <div className="text-lg sm:text-xl font-black text-[#1A1A1A] mt-0.5">
                Standard <span className="text-sm font-bold text-[#5C574C]">· 1 690 kr/mnd</span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E8F1EB] border border-[#D6EEDF] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15795A] animate-pulse" />
              <span className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-wider">Aktiv</span>
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E9E4DA] divide-y divide-[#E9E4DA]">
          {rows.map((r) => (
            <div key={r.l} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs sm:text-sm text-[#5C574C] font-medium">{r.l}</span>
              <span className="text-xs sm:text-sm font-bold text-[#1A1A1A]">{r.v}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="flex-1 text-center text-xs font-bold text-[#1A1A1A] border border-[#E9E4DA] rounded-full py-2.5">Bytt plan</span>
          <span className="flex-1 text-center text-xs font-bold text-[#5C574C] border border-[#E9E4DA] rounded-full py-2.5">Si opp</span>
        </div>
      </div>
    </Frame>
  );
}

/* Ærlig forventningsstyring FØR kjøp — SEO tar tid. Setter realistiske
   forventninger så færre sier opp i skuffelse over at resultater ikke kom over
   natten (churn-demping). Tonen speiler FAQ-en «SEO tar tid …». */
const expectationSteps = [
  { when: 'Dag 1', what: 'Sikt kobler seg på og kjører første analyse. Du ser feilene og mulighetene med en gang.' },
  { when: 'Uke 1', what: 'De første fiksene pushes — meta-titler, beskrivelser, alt-tekster og tekniske feil. Du får første ukerapport på plain norsk.' },
  { when: 'Uke 2–6', what: 'Google rekker å lese siden på nytt. De første bevegelsene begynner å vise seg.' },
  { when: 'Måned 2–3', what: 'Effekten bygger seg opp. SEO tar tid — men du ser nøyaktig hva som er gjort hele veien, uten binding hvis du ombestemmer deg.' },
];

function ExpectationTimeline() {
  return (
    <section className="py-16 sm:py-24">
      <Container size="md">
        <RevealOnScroll direction="up">
          <SectionHeading
            align="center"
            badge={<Badge icon={<CalendarClock size={12} />}>Hva du kan forvente</Badge>}
            title={<>Resultater tar tid. <span className="text-violet-600">Innsyn gjør ikke det.</span></>}
            intro="SEO er ikke en bryter du skrur på. Her er et ærlig bilde av hva som skjer — uke for uke."
            className="mb-10 sm:mb-12 text-center"
          />
        </RevealOnScroll>
        <RevealOnScroll direction="up" delay={80}>
          <ol className="relative border-l border-[#E9E4DA] ml-2 sm:ml-3 space-y-7">
            {expectationSteps.map((s) => (
              <li key={s.when} className="relative pl-6 sm:pl-8">
                <span className="absolute -left-[6px] top-1.5 w-3 h-3 rounded-full bg-violet-600 ring-4 ring-[#F2EFE8]" />
                <div className="text-[11px] font-black uppercase tracking-widest text-violet-700 mb-1">{s.when}</div>
                <p className="text-[#1A1A1A] font-medium leading-relaxed">{s.what}</p>
              </li>
            ))}
          </ol>
        </RevealOnScroll>
      </Container>
    </section>
  );
}

export default function PriserPage() {
  const navigate = useNavigate();

  // Plan-valg går tilbake til hoved-appen, som eier hele checkout-flyten
  // (login → Stripe). Vi sender bare videre hvilken plan kunden valgte.
  const handleSelectPlan = (plan: string) => {
    // `plan_selected` fyres på forsiden når ?plan= plukkes opp av checkout-flyten,
    // så her sporer vi bare selve klikket (unngår dobbelttelling).
    track('cta_click', { location: 'priser_page', target: 'plan', plan });
    navigate(`/?plan=${encodeURIComponent(plan)}`);
  };

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Sikt — SEO og AI-synlighet',
    description: 'AI-drevet SEO for norske bedrifter. Tre planer fra 790 kr/mnd, ingen bindingstid.',
    brand: { '@type': 'Brand', name: 'Sikt' },
    offers: [
      { '@type': 'Offer', name: 'Basic', price: '790', priceCurrency: 'NOK' },
      { '@type': 'Offer', name: 'Standard', price: '1690', priceCurrency: 'NOK' },
      { '@type': 'Offer', name: 'Premium', price: '4990', priceCurrency: 'NOK' },
    ],
  };

  // FAQPage bygges fra SAMME `faqs`-array som rendres synlig under — Google
  // krever at markup matcher det brukeren faktisk ser på siden.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const jsonLd = [productJsonLd, faqJsonLd];

  return (
    <PageShell>
      <Seo
        title="Priser — fra 790 kr/mnd, ingen bindingstid | Sikt"
        description="Tre enkle planer for SEO og AI-synlighet. Basic 790, Standard 1690, Premium 4990 kr/mnd. Ingen skjulte kostnader, ingen bindingstid."
        canonical="https://siktseo.com/priser"
        image="https://siktseo.com/og/priser.png"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="relative pt-4 sm:pt-8 pb-8 sm:pb-12 hero-gradient overflow-hidden">
        <Container size="md" className="text-center relative z-10">
          <RevealOnScroll direction="up">
            <SectionHeading
              as="h1"
              size="hero"
              align="center"
              title={<>Enkle priser, <span className="text-violet-600">ingen overraskelser.</span></>}
              intro="Tre planer fra 790 kr/mnd. Rabattert de tre første månedene, og ingen bindingstid — si opp når du vil."
            />
            <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs sm:text-sm font-bold text-[#5C574C]">
              {['Ingen bindingstid', 'Si opp når som helst', 'Rabattert de 3 første månedene'].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <Check size={16} className="text-[#15795A]" /> {t}
                </span>
              ))}
            </div>
          </RevealOnScroll>
        </Container>
      </section>

      {/* Forsidens pris-komponent (matcher 100 %) */}
      <Pricing onSelectPlan={handleSelectPlan} />

      {/* Hjelp / usikker */}
      <Container size="md" className="pb-4 text-center">
        <RevealOnScroll direction="up">
          <p className="text-[#5C574C] font-medium">
            Usikker på hvilken plan som passer?{' '}
            <Link to="/kontakt" className="font-bold text-violet-700 underline decoration-violet-200 underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:decoration-violet-700">
              Ta kontakt
            </Link>
            , eller{' '}
            <Link to="/#gratis-analyse" className="font-bold text-violet-700 underline decoration-violet-200 underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:decoration-violet-700">
              ta en gratis analyse
            </Link>{' '}
            først.
          </p>
        </RevealOnScroll>
      </Container>

      {/* Ærlig forventningsstyring før kjøp — demper churn fra «så ikke resultater» */}
      <ExpectationTimeline />

      {/* Null binding — konkret trygghet */}
      <section className="py-16 sm:py-24">
        <Container size="xl">
          <FeatureSplit
            eyebrow={<Badge icon={<ShieldCheck size={12} />}>Null binding</Badge>}
            title={<>Du bestemmer. <span className="text-violet-600">Alltid.</span></>}
            body="Ingen bindingstid, ingen oppsigelsestid, ingen skjulte gebyrer. Du betaler per måned og kan si opp, oppgradere eller nedgradere når du vil."
            points={[
              'Si opp når som helst — du betaler kun for inneværende måned',
              'Bytt plan fritt, endringen gjelder fra neste faktura',
            ]}
            media={<BillingMock />}
          />
        </Container>
      </section>

      {/* FAQ */}
      <section className="pb-16 sm:pb-24">
        <Container size="md">
          <RevealOnScroll direction="up">
            <SectionHeading
              align="center"
              title="Spørsmål før du starter."
              className="mb-10 sm:mb-12 text-center"
            />
          </RevealOnScroll>
          <RevealOnScroll direction="up" delay={80}>
            <FaqList items={faqs} />
          </RevealOnScroll>
        </Container>
      </section>

      {/* CTA */}
      <GradientCTA
        eyebrow="Klar til å komme i gang?"
        eyebrowIcon={<Sparkles size={13} />}
        title={<>Gi Sikt en måned.<br /><span className="text-violet-200">Du kan alltid si opp.</span></>}
        intro="Rabattert de tre første månedene — 50 %, 30 %, 15 % — så du rekker å se resultater før fullpris. Start med Basic for 790 kr."
        trust={['Ingen bindingstid', 'Si opp når som helst', 'Plain norsk garantert']}
      >
        <PillButton to="/#gratis-analyse" variant="lightOnDark" size="lg">
          Sjekk siden din gratis
          <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
        </PillButton>
      </GradientCTA>
    </PageShell>
  );
}

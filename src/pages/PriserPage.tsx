import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { Pricing } from '../shared/Pricing';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { Container } from '../components/marketing/Container';
import { SectionHeading } from '../components/marketing/SectionHeading';
import { Badge } from '../components/marketing/Badge';
import { PillButton } from '../components/marketing/PillButton';
import { GradientCTA } from '../components/marketing/GradientCTA';
import { FeatureSplit } from '../components/marketing/FeatureSplit';
import { Frame } from '../components/marketing/Frame';
import { FaqList } from '../components/marketing/Faq';

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
        <div className="bg-white rounded-2xl border border-[#EBEBE6] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-[#808080] font-bold">Ditt abonnement</div>
              <div className="text-lg sm:text-xl font-black text-[#1A1A1A] mt-0.5">
                Standard <span className="text-sm font-bold text-[#808080]">· 1 690 kr/mnd</span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(63,143,56,0.09)] border border-[rgba(63,143,56,0.18)] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3F8F38] animate-pulse" />
              <span className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-wider">Aktiv</span>
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EBEBE6] divide-y divide-[#EBEBE6]">
          {rows.map((r) => (
            <div key={r.l} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs sm:text-sm text-[#808080] font-medium">{r.l}</span>
              <span className="text-xs sm:text-sm font-bold text-[#1A1A1A]">{r.v}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="flex-1 text-center text-xs font-bold text-[#1A1A1A] border border-[#EBEBE6] rounded-full py-2.5">Bytt plan</span>
          <span className="flex-1 text-center text-xs font-bold text-[#808080] border border-[#EBEBE6] rounded-full py-2.5">Si opp</span>
        </div>
      </div>
    </Frame>
  );
}

const faqs = [
  {
    q: 'Er det bindingstid?',
    a: 'Nei. Du kan si opp når som helst, og betaler bare for inneværende måned. Ingen oppsigelsestid, ingen gebyrer.',
  },
  {
    q: 'Hva skjer etter de tre rabatterte månedene?',
    a: 'Da går du over til ordinær pris for planen din — 790, 1 690 eller 4 990 kr/mnd. Du vet prisen på forhånd, så ingenting kommer som en overraskelse.',
  },
  {
    q: 'Kan jeg bytte plan senere?',
    a: 'Ja. Du kan oppgradere eller nedgradere når du vil, og endringen gjelder fra neste faktura.',
  },
  {
    q: 'Hva om jeg ikke ser resultater?',
    a: 'SEO tar tid, men du ser nøyaktig hva Sikt gjør hver uke — på plain norsk. Er du ikke fornøyd, sier du opp uten binding.',
  },
];

export default function PriserPage() {
  const navigate = useNavigate();

  // Plan-valg går tilbake til hoved-appen, som eier hele checkout-flyten
  // (login → Stripe). Vi sender bare videre hvilken plan kunden valgte.
  const handleSelectPlan = (plan: string) => {
    navigate(`/?plan=${encodeURIComponent(plan)}`);
  };

  const jsonLd = {
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
            <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs sm:text-sm font-bold text-[#808080]">
              {['Ingen bindingstid', 'Si opp når som helst', 'Rabattert de 3 første månedene'].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <Check size={16} className="text-[#3F8F38]" /> {t}
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
          <p className="text-[#808080] font-medium">
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

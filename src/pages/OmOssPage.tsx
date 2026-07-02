import React from 'react';
import { ArrowRight, Sparkles, Check } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { Container } from '../components/marketing/Container';
import { SectionHeading } from '../components/marketing/SectionHeading';
import { Badge } from '../components/marketing/Badge';
import { PillButton } from '../components/marketing/PillButton';
import { GradientCTA } from '../components/marketing/GradientCTA';
import { FeatureSplit } from '../components/marketing/FeatureSplit';

// Ærlig «founding-stage»-notat. Signaturen i font-script gir et menneskelig preg
// uten å navngi noen — vi holder en anonym «vi»-stemme.
function NoteCard() {
  return (
    <div className="relative rounded-[24px] sm:rounded-[28px] bg-white border border-[#EBEBE6] shadow-[0_30px_60px_-24px_rgba(26,26,26,0.15)] p-7 sm:p-9">
      <div className="flex items-center gap-2 mb-5 text-violet-700">
        <Sparkles size={15} />
        <span className="text-xs font-black uppercase tracking-widest">Ærlig talt</span>
      </div>
      <p className="text-lg sm:text-xl font-semibold text-[#1A1A1A] leading-relaxed">
        Vi er et lite, norsk team — og vi er nye. Det er vi ærlige om: ingen oppdiktede anmeldelser, ingen lange kontrakter, ingen sjargong. Bare ekte arbeid på siden din, forklart sånn at du forstår det — og et menneske du kan snakke med når du vil.
      </p>
      <p className="mt-6 font-script text-2xl sm:text-3xl text-violet-700">Teamet i Sikt</p>
    </div>
  );
}

const values = [
  {
    n: '01',
    title: 'Plain norsk, alltid',
    body: 'SEO er gjort unødvendig mystisk. Vi forklarer alt vi gjør på et språk du faktisk forstår — fordi du fortjener å vite hva du betaler for.',
  },
  {
    n: '02',
    title: 'Trygt på siden din',
    body: 'Alt Sikt gjør logges med før- og etterverdi og kan angres med ett klikk. Vi rører ikke noe vi ikke kan rulle tilbake.',
  },
  {
    n: '03',
    title: 'Bygget for de små',
    body: 'Vi er laget for norske småbedrifter uten markedsbyrå på lønningslista — men som fortjener å bli funnet like godt som de store.',
  },
];

export default function OmOssPage() {
  return (
    <PageShell>
      <Seo
        title="Om oss — hvorfor Sikt finnes | Sikt"
        description="Sikt er bygget for norske småbedrifter som vil bli funnet på Google og i AI-søk, uten teknisk sjargong. Les historien og verdiene våre."
        canonical="https://siktseo.com/om-oss"
        image="https://siktseo.com/og/om-oss.png"
      />

      {/* Hero */}
      <section className="relative pt-4 sm:pt-8 pb-12 sm:pb-16 hero-gradient overflow-hidden">
        <Container size="md" className="text-center relative z-10">
          <RevealOnScroll direction="up">
            <SectionHeading
              as="h1"
              size="hero"
              align="center"
              title={
                <>
                  Synlighet skal ikke være{' '}
                  <span className="text-violet-600">forbeholdt de store.</span>
                </>
              }
              intro="De fleste norske bedrifter gjetter på hvordan de blir synlige på nett. De store har byråer og budsjetter. De små har ofte ingenting. Sikt finnes for å rette opp den ubalansen."
            />
          </RevealOnScroll>
        </Container>
      </section>

      {/* Historien */}
      <section className="py-16 sm:py-24">
        <Container size="xl">
          <FeatureSplit
            eyebrow={<Badge tone="violet" icon={<Sparkles size={12} />}>Historien</Badge>}
            title={<>Laget for dem som <span className="text-violet-600">ellers gjetter.</span></>}
            body="SEO er gjort unødvendig mystisk: rapporter fulle av tall, dyre retainere og løfter som sjelden henger sammen med resultater. Samtidig endrer søk seg raskere enn noensinne — folk googler mindre og spør ChatGPT mer. Den som ikke henger med, blir usynlig, ikke bare på Google, men i hele den nye måten folk finner bedrifter på."
            media={<NoteCard />}
          />
        </Container>
      </section>

      {/* Mørkt manifest — rytmebrudd */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white py-20 sm:py-28 md:py-32">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[400px] sm:h-[560px] bg-gradient-to-tr from-violet-600/20 via-indigo-500/10 to-transparent rounded-full blur-[100px] sm:blur-[120px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <Container size="md" className="relative z-10 text-center">
          <RevealOnScroll direction="up">
            <div className="flex justify-center mb-6">
              <Badge tone="onDark" icon={<Sparkles size={12} />}>Det vi tror på</Badge>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
              Vi bygde det <span className="text-violet-300">motsatte</span> av et byrå.
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed font-medium">
              Ingen dyre retainere. Ingen rapporter fulle av tall du ikke forstår. Ingen gjetting. Bare AI som finner nøyaktig hva som stopper deg, fikser det automatisk — og forklarer alt på plain norsk.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {['Ingen binding', 'Plain norsk', 'Du eier alt'].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 text-sm font-bold text-white/80 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2"
                >
                  <Check size={14} className="text-violet-300" /> {t}
                </span>
              ))}
            </div>
          </RevealOnScroll>
        </Container>
      </section>

      {/* Verdier — redaksjonell nummerert liste (ikke ikon-kort) */}
      <section className="py-16 sm:py-24">
        <Container size="lg">
          <RevealOnScroll direction="up">
            <SectionHeading
              align="center"
              title={<>Tre ting vi <span className="text-violet-600">aldri tukler med.</span></>}
              className="mb-10 sm:mb-14 text-center"
            />
          </RevealOnScroll>
          <div className="border-t border-[#EBEBE6]">
            {values.map((v, i) => (
              <RevealOnScroll key={v.title} direction="up" delay={i * 80}>
                <div className="grid sm:grid-cols-[4rem_1fr] gap-2 sm:gap-8 py-7 sm:py-9 border-b border-[#EBEBE6]">
                  <div className="text-3xl sm:text-5xl font-black text-violet-600/25 leading-none">{v.n}</div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A1A1A]">{v.title}</h3>
                    <p className="mt-2 text-[#808080] font-medium leading-relaxed max-w-2xl">{v.body}</p>
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <GradientCTA
        eyebrow="Klar til å bli funnet?"
        eyebrowIcon={<Sparkles size={13} />}
        title={<>La oss gjøre deg <span className="text-violet-200">synlig.</span></>}
        intro="Sjekk hvor synlig siden din er i dag — helt gratis. Eller ta en prat med oss først, på plain norsk."
        trust={['Ingen bindingstid', 'Plain norsk garantert', 'Svar innen én dag']}
      >
        <PillButton to="/#gratis-analyse" variant="lightOnDark" size="lg">
          Sjekk siden din gratis
          <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
        </PillButton>
        <PillButton to="/kontakt" variant="ghostOnDark" size="lg">
          Ta kontakt
        </PillButton>
      </GradientCTA>
    </PageShell>
  );
}

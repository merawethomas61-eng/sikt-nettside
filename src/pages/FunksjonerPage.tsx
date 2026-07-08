import React from 'react';
import {
  ArrowRight,
  Wrench,
  FileText,
  BrainCircuit,
  Undo2,
  Sparkles,
  Check,
  X,
  Radar,
  TrendingUp,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { Container } from '../components/marketing/Container';
import { SectionHeading } from '../components/marketing/SectionHeading';
import { Badge } from '../components/marketing/Badge';
import { PillButton } from '../components/marketing/PillButton';
import { GradientCTA } from '../components/marketing/GradientCTA';
import { FeatureSplit } from '../components/marketing/FeatureSplit';
import { Frame } from '../components/marketing/Frame';
import { PanelHeader, LiveChip } from '../components/marketing/ProductMock';

/* ------------------------------------------------------------------ *
 * Små, side-spesifikke produkt-mockups. Satt sammen av delte primitiver
 * (Frame / FeatureSplit / ProductMock). Poenget: vise ekte UI, ikke ikon-pynt.
 * ------------------------------------------------------------------ */

// Hero-visuell: en kompakt «oversikt» som speiler forsidens dashboard uten å kopiere den.
function HeroPanel() {
  const kpis = [
    { l: 'Synlighet', v: '89%', g: '+4,1%' },
    { l: 'Ord du ranker på', v: '2 341', g: '+180' },
    { l: 'Feil igjen', v: '0', g: '−6' },
  ];
  const feed = [
    { t: 'Skrev ny meta-tittel på /rorlegger-oslo', a: '2 min siden' },
    { t: 'La til alt-tekst på 4 produktbilder', a: '1 time siden' },
    { t: 'Fikset en treg mobilside', a: '3 timer siden' },
  ];
  return (
    <div className="bg-[#FBFBFA]">
      <PanelHeader title="Din oversikt" right={<LiveChip />} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.l} className="bg-white rounded-xl border border-[#E9E4DA] p-3">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-[10px] text-[#5C574C] font-bold uppercase tracking-wide truncate">{k.l}</span>
                <span className="text-[9px] px-1 py-0.5 rounded-md font-bold bg-[#E8F1EB] text-[#15795A] shrink-0">{k.g}</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-[#1A1A1A] mt-1.5">{k.v}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#E9E4DA] p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-violet-600" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#5C574C]">Sikt jobber automatisk</span>
          </div>
          <ul className="space-y-3">
            {feed.map((f) => (
              <li key={f.t} className="flex items-center gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#E8F1EB] text-[#15795A] flex items-center justify-center">
                  <Check size={13} strokeWidth={2.5} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-[#1A1A1A] truncate">{f.t}</div>
                  <div className="text-[10px] text-[#B3AD9F] font-medium">{f.a}</div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-[#5C574C] border border-[#E9E4DA] rounded-full px-2 py-0.5">
                  <Undo2 size={11} /> Angre
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Ett Google-resultat (svakt «før» / sterkt «etter»).
function Serp({
  url,
  title,
  desc,
  tone,
}: {
  url: string;
  title: string;
  desc: string;
  tone: 'weak' | 'strong';
}) {
  const strong = tone === 'strong';
  return (
    <div className={`rounded-xl bg-white p-3.5 sm:p-4 border ${strong ? 'border-[#15795A]/40 shadow-sm' : 'border-[#E9E4DA]'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-full bg-[#F2EFE8] border border-[#E9E4DA] flex items-center justify-center text-[9px] font-black text-[#5C574C]">V</span>
        <div className="leading-tight min-w-0">
          <div className="text-[11px] font-semibold text-[#1A1A1A]">VVS Oslo</div>
          <div className="text-[10px] text-[#5C574C] truncate">{url}</div>
        </div>
      </div>
      <h5 className={`text-sm sm:text-[15px] font-bold leading-snug ${strong ? 'text-[#1a0dab]' : 'text-[#5C574C]'}`}>{title}</h5>
      <p className="text-xs text-[#5C574C] leading-relaxed mt-1">{desc}</p>
    </div>
  );
}

function FixMock() {
  return (
    <Frame url="google.com/søk?q=rørlegger+oslo">
      <div className="bg-[#FBFBFA] p-4 sm:p-6 space-y-3">
        <Serp
          tone="weak"
          url="vvsoslo.no"
          title="VVS Oslo – Hjem"
          desc="Velkommen til vår nettside. Vi tilbyr tjenester."
        />
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-600">
          <span className="h-px w-6 bg-[#E9E4DA]" />
          <Wrench size={12} /> Sikt skriver om
          <span className="h-px w-6 bg-[#E9E4DA]" />
        </div>
        <Serp
          tone="strong"
          url="vvsoslo.no › rorlegger-oslo"
          title="Rørlegger i Oslo – Døgnvakt & rask hjelp | VVS Oslo"
          desc="Trenger du rørlegger i Oslo? Vi rykker ut samme dag — fast pris, ingen overraskelser. Ring nå."
        />
        <div className="flex items-center justify-between pt-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-[#15795A]">
            <Check size={13} strokeWidth={2.5} /> Pushet live · 09:14
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-[#5C574C] border border-[#E9E4DA] rounded-full px-2.5 py-1">
            <Undo2 size={12} /> Angre
          </span>
        </div>
      </div>
    </Frame>
  );
}

function ArticleMock() {
  return (
    <Frame url="wp-admin › Innlegg › Utkast">
      <div className="bg-[#FBFBFA] p-4 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C574C] bg-[#F2EFE8] border border-[#E9E4DA] rounded-full px-2.5 py-0.5">Utkast — venter på deg</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-[#15795A]">
            <Sparkles size={12} /> Skrevet av Sikt
          </span>
        </div>
        <p className="text-sm sm:text-base font-bold text-[#1A1A1A] leading-snug">
          Varmepumpe i enebolig: pris, støtte og hva du bør vite
        </p>
        <div className="space-y-1.5" aria-hidden>
          <div className="h-2 rounded bg-[#E9E4DA] w-full" />
          <div className="h-2 rounded bg-[#E9E4DA] w-11/12" />
          <div className="h-2 rounded bg-[#E9E4DA] w-4/5" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-bold text-[#5C574C]">
          <span className="border border-[#E9E4DA] rounded-full px-2.5 py-1">1 240 ord</span>
          <span className="border border-[#E9E4DA] rounded-full px-2.5 py-1">FAQ-schema</span>
          <span className="border border-[#E9E4DA] rounded-full px-2.5 py-1">Meta klar</span>
        </div>
        <div className="flex items-center justify-between pt-1 gap-2">
          <span className="text-[10px] sm:text-xs font-bold text-[#5C574C]">Mål: «varmepumpe pris» — plass 14 i dag</span>
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-white bg-[#15795A] rounded-full px-2.5 py-1 shrink-0">
            <Check size={12} strokeWidth={2.5} /> Godkjenn
          </span>
        </div>
      </div>
    </Frame>
  );
}

function ReportMock() {
  const done = [
    { t: 'Skrev om 3 sidetitler', m: 'så Google forstår hva sidene handler om' },
    { t: 'La til alt-tekst på 12 bilder', m: 'bildene dine kan nå dukke opp i bildesøk' },
    { t: 'Fikset 2 ødelagte lenker', m: 'ingen blindveier for besøkende' },
  ];
  return (
    <Frame>
      <PanelHeader
        title="Ukerapport"
        right={<span className="text-[10px] font-bold uppercase tracking-wider text-[#5C574C] bg-[#F2EFE8] border border-[#E9E4DA] rounded-full px-2.5 py-0.5">Uke 24</span>}
      />
      <div className="bg-[#FBFBFA] p-4 sm:p-6 space-y-4">
        <div className="bg-white rounded-2xl border border-[#E9E4DA] p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#5C574C] font-bold">Synlighet</div>
              <div className="text-2xl font-black text-[#1A1A1A] mt-0.5">
                89% <span className="text-xs font-bold text-[#15795A] align-middle">+4,1%</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#15795A] bg-[#E8F1EB] border border-[#D6EEDF] rounded-full px-2 py-0.5">
              <TrendingUp size={12} /> Stigende
            </span>
          </div>
          <svg viewBox="0 0 120 32" preserveAspectRatio="none" className="w-full h-8">
            <polyline
              fill="none"
              stroke="#15795A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,28 20,24 40,26 60,16 80,18 100,8 120,5"
            />
          </svg>
        </div>

        <div className="bg-white rounded-2xl border border-[#E9E4DA] p-4 space-y-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#5C574C]">Gjort denne uka</div>
          {done.map((d) => (
            <div key={d.t} className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#E8F1EB] text-[#15795A] flex items-center justify-center">
                <Check size={12} strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-[#1A1A1A]">{d.t}</div>
                <div className="text-[11px] text-[#5C574C] leading-snug">{d.m}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// Mørk ChatGPT-mockup (matcher forsidens GeoShift-uttrykk).
function ChatMock() {
  return (
    <div className="relative rounded-[24px] sm:rounded-[28px] bg-white/[0.04] border border-white/10 backdrop-blur-md p-5 sm:p-7 shadow-2xl shadow-violet-950/40">
      <div className="flex justify-end mb-4">
        <div className="bg-white/10 border border-white/10 rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white/90 max-w-[85%]">
          Hvilken rørlegger i Oslo bør jeg velge?
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-white" />
        </div>
        <div className="flex-1 bg-white/[0.06] border border-white/10 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-white/80 leading-relaxed">
          Et godt valg er <span className="bg-violet-500/25 text-white font-bold px-1.5 py-0.5 rounded">VVS Oslo</span> — de har døgnvakt, faste priser og svært gode omtaler i Oslo-området.
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-300/90">
        <BrainCircuit size={13} /> Sikt gjør deg til svaret — ikke fotnoten
      </div>
    </div>
  );
}

function RadarMock() {
  const rows = [
    { icon: FileText, t: 'Rørleggern AS publiserte «Akutt rørlegger Oslo»', a: '2 timer siden' },
    { icon: Tag, t: 'VVS-Hjelp endret prisene på utrykning', a: 'I går' },
    { icon: Wrench, t: 'Oslo Rør fikset en treg mobilside', a: '3 dager siden' },
  ];
  return (
    <Frame>
      <PanelHeader
        title="Konkurrent-radar"
        right={<span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2.5 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> 3 nye</span>}
      />
      <div className="bg-[#FBFBFA] p-3 sm:p-4">
        <ul>
          {rows.map((r, i) => (
            <li
              key={r.t}
              className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-white border border-[#E9E4DA]' : ''}`}
            >
              <span className="shrink-0 w-8 h-8 rounded-lg bg-[#F2EFE8] border border-[#E9E4DA] text-[#5C574C] flex items-center justify-center">
                <r.icon size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-[#1A1A1A] leading-snug">{r.t}</div>
                <div className="text-[10px] text-[#B3AD9F] font-medium mt-0.5">{r.a}</div>
              </div>
              <ChevronRight size={15} className="text-[#B3AD9F] shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

function UndoMock() {
  return (
    <Frame>
      <PanelHeader
        title="Endringslogg"
        right={<span className="text-[10px] font-bold uppercase tracking-wider text-[#5C574C] bg-[#F2EFE8] border border-[#E9E4DA] rounded-full px-2.5 py-0.5">12 endringer</span>}
      />
      <div className="bg-[#FBFBFA] p-4 sm:p-6 space-y-3">
        <div className="bg-white rounded-2xl border border-[#E9E4DA] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wide text-[#5C574C] font-bold">Meta-tittel · /rorlegger-oslo</span>
            <span className="text-[10px] text-[#B3AD9F] font-medium">I dag 09:14</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <X size={14} className="text-rose-400 shrink-0" />
              <span className="text-xs text-[#B3AD9F] line-through truncate">VVS Oslo – Hjem</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={14} strokeWidth={2.5} className="text-[#15795A] shrink-0" />
              <span className="text-xs font-semibold text-[#1A1A1A] truncate">Rørlegger i Oslo – Døgnvakt | VVS Oslo</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E9E4DA]">
            <span className="text-[10px] text-[#5C574C] font-medium">Logget med før- og etterverdi</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1A1A1A] border border-[#E9E4DA] rounded-full px-3 py-1">
              <Undo2 size={12} /> Angre
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-1">
          <Check size={14} strokeWidth={2.5} className="text-[#15795A] shrink-0" />
          <span className="text-xs text-[#5C574C] font-medium">Alt-tekst lagt til på 3 bilder</span>
          <span className="text-[10px] text-[#B3AD9F] ml-auto">I går</span>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */

export default function FunksjonerPage() {
  return (
    <PageShell>
      <Seo
        title="Funksjoner — slik funker Sikt | Sikt"
        description="Sikt fikser SEO-feilene dine automatisk, rapporterer på plain norsk og gjør deg synlig i både Google og AI-søk som ChatGPT. Se hvordan det funker."
        canonical="https://siktseo.com/funksjoner"
        image="https://siktseo.com/og/funksjoner.png"
      />

      {/* Hero */}
      <section className="relative pt-4 sm:pt-8 pb-20 sm:pb-28 hero-gradient overflow-hidden">
        <Container size="md" className="text-center relative z-10">
          <RevealOnScroll direction="up">
            <SectionHeading
              as="h1"
              size="hero"
              align="center"
              title={
                <>
                  Mer synlig på Google,{' '}
                  <span className="text-violet-600">helt automatisk.</span>
                </>
              }
              intro="Koble til nettsiden din, så finner Sikt hva som stopper deg, fikser det automatisk og forklarer alt på et språk du forstår."
            />
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
              <PillButton to="/#gratis-analyse" variant="dark">
                Sjekk siden din gratis
                <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
              </PillButton>
              <PillButton to="/priser" variant="white">
                Se priser
              </PillButton>
            </div>
          </RevealOnScroll>
        </Container>
      </section>

      {/* Hero-produktvisuell — overlapper heroen som på forsiden */}
      <Container size="xl" className="-mt-12 sm:-mt-20 relative z-20">
        <RevealOnScroll direction="scale" delay={150}>
          <Frame glow url="app.siktseo.com">
            <HeroPanel />
          </Frame>
        </RevealOnScroll>
      </Container>

      {/* Plattform-rad */}
      <Container size="xl" className="pt-14 sm:pt-20 pb-6 sm:pb-10">
        <RevealOnScroll direction="up">
          <p className="text-center text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#B3AD9F] mb-6">
            Funker uansett hvor siden din er bygget
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-12 gap-y-4">
            {['WordPress', 'Shopify', 'Wix', 'Squarespace', 'Webflow'].map((name) => (
              <span
                key={name}
                className="text-lg sm:text-xl font-black tracking-tight text-[#1A1A1A]/35 ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]/70"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mt-7 text-center text-sm sm:text-base text-[#5C574C] font-medium max-w-xl mx-auto">
            Bygde du siden med AI — Claude, Cursor eller Lovable? Du får en ferdig lim-inn-prompt per problem.
          </p>
        </RevealOnScroll>
      </Container>

      {/* Walkthrough del 1 (lyst) */}
      <section className="py-16 sm:py-24">
        <Container size="xl">
          <RevealOnScroll direction="up">
            <SectionHeading
              align="center"
              badge={<Badge tone="violet" icon={<Sparkles size={12} />}>Funksjoner</Badge>}
              title="Alt du trenger for å bli funnet."
              intro="Ingen sjargong, ingen dashboards du må lære deg. Bare ekte arbeid på siden din — og en kvittering du faktisk forstår."
              className="mb-16 sm:mb-24 text-center"
            />
          </RevealOnScroll>

          <div className="space-y-20 sm:space-y-28 lg:space-y-32">
            <FeatureSplit
              eyebrow={<Badge icon={<Wrench size={12} />}>Automatisk</Badge>}
              title={<>Vi fikser feilene — <span className="text-violet-600">du gjør ingenting.</span></>}
              body="Koble til WordPress eller Shopify, så pusher Sikt forbedringene rett inn på siden din: meta-titler, beskrivelser, alt-tekster og tekniske fikser."
              points={[
                'Ekte endringer, pushet live — ikke bare en liste med forslag',
                'Bygde du siden med AI? Du får en ferdig lim-inn-prompt i stedet',
              ]}
              media={<FixMock />}
            />

            <FeatureSplit
              reverse
              eyebrow={<Badge icon={<Sparkles size={12} />}>Innholdsmotor</Badge>}
              title={<>Sikt skriver artiklene som <span className="text-violet-600">flytter deg opp.</span></>}
              body="Vi finner søkene du nesten vinner, skriver en komplett artikkel målrettet mot dem — basert på din egen bedrift — og legger den som utkast i WordPress. Du godkjenner og publiserer."
              points={[
                'Fra søkeord-mulighet til ferdig utkast på under ett minutt',
                'Ingenting publiseres uten at du har lest og godkjent det',
              ]}
              media={<ArticleMock />}
            />

            <FeatureSplit
              eyebrow={<Badge icon={<FileText size={12} />}>Plain norsk</Badge>}
              title={<>En kvittering, ikke en <span className="text-violet-600">vegg av tall.</span></>}
              body="Hver uke får du en kort rapport på hva som er gjort og hva det betyr — skrevet sånn at du forstår det uten å være SEO-ekspert."
              points={[
                'Hva som ble gjort, og hvorfor det hjelper deg',
                'Ingen grafer du må tolke selv',
              ]}
              media={<ReportMock />}
            />
          </div>
        </Container>
      </section>

      {/* Mørk GEO-seksjon — rytmebrudd */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white py-20 sm:py-28 md:py-32">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[400px] sm:h-[560px] bg-gradient-to-tr from-violet-600/20 via-indigo-500/10 to-transparent rounded-full blur-[100px] sm:blur-[120px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <Container size="xl" className="relative z-10">
          <FeatureSplit
            tone="dark"
            eyebrow={<Badge tone="onDark" icon={<BrainCircuit size={12} />}>Synlig i AI-søk (GEO)</Badge>}
            title={<>Kundene googler ikke alltid.<br />Noen spør <span className="text-violet-300">ChatGPT.</span></>}
            body="Sikt sjekker hver uke om ChatGPT, Gemini og Perplexity nevner bedriften din på spørsmålene som betyr noe — og bygger grunnmuren som gjør at du blir anbefalt."
            points={[
              'Ukentlig sjekk av om AI nevner deg',
              'Samme grunnmur løfter deg på Google også',
            ]}
            media={<ChatMock />}
          />
        </Container>
      </section>

      {/* Walkthrough del 2 (lyst) */}
      <section className="py-16 sm:py-24">
        <Container size="xl">
          <div className="space-y-20 sm:space-y-28 lg:space-y-32">
            <FeatureSplit
              eyebrow={<Badge icon={<Radar size={12} />}>Konkurrent-radar</Badge>}
              title={<>Du sover. <span className="text-violet-600">Sikt holder øye.</span></>}
              body="Få beskjed når konkurrentene dine publiserer nytt innhold, endrer priser eller fikser tekniske ting — så du aldri blir overrasket."
              points={[
                'Varsler samlet på ett sted, ikke i innboksen',
                'Vit hva du må svare på — før kundene merker det',
              ]}
              media={<RadarMock />}
            />

            <FeatureSplit
              reverse
              eyebrow={<Badge icon={<Undo2 size={12} />}>Trygt</Badge>}
              title={<>Alt kan angres <span className="text-violet-600">med ett klikk.</span></>}
              body="Hver endring logges med før- og etterverdi og kan rulles tilbake umiddelbart. Ingenting gjøres som ikke kan angres — derfor er det trygt å la Sikt jobbe."
              points={[
                'Full historikk over hva som er endret',
                'Ett klikk tilbake til slik det var',
              ]}
              media={<UndoMock />}
            />
          </div>
        </Container>
      </section>

      {/* CTA */}
      <GradientCTA
        eyebrow="Funker uansett plattform"
        eyebrowIcon={<Sparkles size={13} />}
        title={<>Klar til å bli funnet?<br /><span className="text-violet-200">Vi gjør jobben.</span></>}
        intro="WordPress, Shopify, Wix, Squarespace, Webflow — eller en side du bygde med Claude, Cursor eller Lovable. Sikt gir deg alltid en vei videre."
        trust={['Ingen bindingstid', 'Si opp når som helst', 'Plain norsk garantert']}
      >
        <PillButton to="/priser" variant="lightOnDark" size="lg">
          Se priser
          <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
        </PillButton>
        <PillButton to="/#gratis-analyse" variant="ghostOnDark" size="lg">
          Sjekk siden din gratis
        </PillButton>
      </GradientCTA>
    </PageShell>
  );
}

import React, { useState } from 'react';
import { HelpCircle, Check } from 'lucide-react';
import { RevealOnScroll } from './RevealOnScroll';
import { companyInfo } from './companyInfo';

// Pris-seksjon i redaksjonell handbook-stil. Rekkefølgen er bevisst HØY→LAV
// (Premium → Standard → Basic): den første prisen øyet treffer fungerer som
// anker for resten. Pakkene stables vertikalt som full-bredde «rader» — historie
// til venstre, funksjoner til høyre — slik at prisene linjerer i en kolonne ned
// venstre kant (anker + sammenligning), og hver pakke får puste.
//
// Standard er det ENE fokuspunktet (handbook §2 «+S»): den eneste løftede hvite
// flaten. Premium og Basic er flate, åpne rader rett på beige bakgrunn, så heltens
// kort vinner blikket uten å rope.
const Pricing = ({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) => {
  // Sporer hvilken feature-bullet som har detaljer åpne. Format: "kortIndex-featureIndex" eller null.
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  type PlanFeature = { text: string; detail?: string };
  type Plan = { title: string; price: string; tagline: string; who: string; desc: string; features: PlanFeature[]; highlighted?: boolean; ctaLabel?: string; ctaHref?: string; ctaNote?: string };

  const plans: Plan[] = [
    {
      title: "PREMIUM",
      price: "4 990",
      tagline: "Når én ny kunde er verdt titusener.",
      who: "For advokater, tannleger, klinikker og B2B.",
      ctaLabel: "Book en GEO-gjennomgang",
      ctaHref: `mailto:${companyInfo.supportEmail}?subject=GEO-gjennomgang%20(Premium)&body=Hei%20Sikt%2C%0A%0AJeg%20vil%20ha%20en%20GEO-gjennomgang%20og%20se%20om%20ChatGPT%2FGemini%2FPerplexity%20nevner%20bedriften%20min.%0A%0ABedrift%2Fnettside%3A%20%0ABransje%3A%20%0A`,
      ctaNote: "Én ny klient betaler hele året — vi går gjennom tallene sammen først.",
      desc: "Bygd for bedrifter der hver kunde teller mest — advokater, tannleger, klinikker, håndverkere og B2B. Full synlighet i både Google og AI-søk, så du fanger kundene konkurrentene dine går glipp av. Én ekstra kunde i måneden betaler hele abonnementet.",
      features: [
        { text: "Alt i Standard", detail: "Auto-fiks, ukentlig kvittering, AI-tekster, søkeord-sporing, konkurrent-radar og prioritert support er inkludert." },
        { text: "For høyverdi-bransjer der ett oppdrag betaler året", detail: "Tjenesten er priset for bedrifter med høy kundeverdi — advokat, tannlege, eiendomsmegler, entreprenør, B2B. Er marginen din lav per kunde, er Standard sannsynligvis riktigere for deg." },
        { text: "Ukentlig sjekk: anbefaler ChatGPT, Gemini og Perplexity deg?", detail: "Sikt stiller 20–50 bransjerelevante spørsmål til AI-assistentene hver uke og rapporterer om — og hvordan — bedriften din nevnes." },
        { text: "Søkeord-sporing i stort omfang — opptil 200 søkeord", detail: "Spor posisjonen på opptil 200 søkeord hver uke — mer enn nok til å dekke alt som er relevant for bedriften din." },
        { text: "Spør Sikt AI hva som helst — 24/7", detail: "AI-chat som kjenner dine egne SEO-data og svarer på alt du lurer på, når som helst." },
        { text: "Konkurrent-radar uten grenser + dyp AI-analyse", detail: "Overvåk så mange konkurrenter du vil. AI leser deres innhold, estimerer trafikken og sjekker om ChatGPT/Gemini/Perplexity nevner dem — så du vet nøyaktig hva du må gjøre for å gå forbi." },
        { text: "Månedlig strategirapport på 10+ sider", detail: "Grundig AI-generert analyse med GEO-konkurrentanalyse, vekststrategi og konkrete neste steg." },
        { text: "4-timers support på hverdager", detail: "Raskeste svartid vi tilbyr — svar innen 4 timer, mot 24 timer i Standard." }
      ]
    },
    {
      title: "STANDARD",
      price: "1 690",
      tagline: "Flere kunder — uten at du løfter en finger.",
      who: "Vi gjør jobben kontinuerlig — du får synligheten.",
      highlighted: true,
      desc: "Koble nettsiden din til Sikt, så fikser vi feilene og skriver inn forbedringene automatisk — kontinuerlig og uten grense, hver uke, ikke bare i oppstart. Du blir mer synlig og får flere kunder uten å gjøre jobben selv.",
      features: [
        { text: "Alt i Basic", detail: "Full teknisk analyse, søkeord-sporing, AI-tekstforslag, månedlig rapport og konkurrent-radar er inkludert." },
        { text: "Sikt fikser nettsiden din automatisk", detail: "WordPress og Shopify: Sikt pusher endringene rett inn — du løfter ikke en finger. Bygde du siden med AI (Claude, Cursor, v0, Lovable …)? Da får du en ferdig, lim-inn-klar prompt per problem som fikser det i din egen kodebase. Andre plattformer: ferdige forslag du limer inn." },
        { text: "1-klikks angre på alt — siden din kan aldri ødelegges", detail: "Hver eneste endring logges med før- og etterverdi, og kan reverseres med ett klikk. Du ser nøyaktig hva som ble endret, når, og kan rulle det tilbake når som helst. Ingenting gjøres som ikke kan angres — derfor er det trygt å la Sikt jobbe på siden din." },
        { text: "Ukentlig «Dette har Sikt fikset for deg»-kvittering (pushet til siden)", detail: "Hver mandag: «12 meta-titler oppdatert, 3 ødelagte lenker fikset, 1 ny redirect opprettet, 6 bilder komprimert til WebP.» I motsetning til Basic (hvor du limer inn selv), ligger disse endringene allerede live på siden din." },
        { text: "AI skriver og publiserer tekster, alt-tekster og schema", detail: "Meta-titler, beskrivelser, alt-tekster og strukturert data genereres og oppdateres automatisk på siden din." },
        { text: "Ukentlig rangeringssjekk på inntil 50 søkeord", detail: "Vi sporer posisjonen din hver uke — ikke bare hver måned — så du oppdager endringer tidlig." },
        { text: "Konkurrent-radar utvidet: 3 konkurrenter + innholdsanalyse", detail: "Som i Basic, men utvidet til 3 konkurrenter og med AI-drevet analyse av hva som faktisk virker for dem — så du kan slå tilbake raskt." },
        { text: "Prioritert e-post-support", detail: "Svar innen 24 timer på hverdager." }
      ]
    },
    {
      title: "BASIC",
      price: "790",
      tagline: "Vi fikser det viktigste — så viser vi deg resten.",
      who: "Lavterskel start — perfekt for å komme i gang.",
      desc: "Koble til siden din, så fikser Sikt de tre viktigste tingene automatisk i oppstart — du ser det skje. Deretter finner vi hva mer som stopper deg på Google og skriver ferdige løsninger du limer inn selv. Ikke tilkoblet? Du får alt som ferdig tekst.",
      features: [
        { text: "Sikt fikser de 3 viktigste tingene automatisk i oppstart", detail: "Koble til WordPress eller Shopify, så pusher Sikt de tre mest verdifulle meta-fiksene (titler og beskrivelser) rett inn på siden din i oppstart — så du ser med egne øyne at det funker. På andre plattformer får du dem som ferdig tekst klar til innliming." },
        { text: "AI skriver meta-tekster og alt-tekster — klar til innliming", detail: "Sikt finner hver manglende eller svake meta-tittel, beskrivelse og bilde-alt, og skriver ferdig teksten for deg. Du kopierer den rett inn i ditt eget system — ingen blank side, ingen gjetting." },
        { text: "Kopier-og-lim-inn kode for tekniske fikser", detail: "Når vi finner en teknisk feil, får du nøyaktig hvilken kode som må endres — forklart på plain norsk. Lim den rett inn der du redigerer, eller rett inn i AI-verktøyet ditt (Claude, Cursor, v0 …)." },
        { text: "Konkurrent-radar: varsel når 2 konkurrenter endrer seg", detail: "Du sover — Sikt holder øye. E-postvarsel når dine 2 hovedkonkurrenter publiserer nytt innhold, endrer priser eller fikser tekniske ting, så du aldri blir overrasket." },
        { text: "Funker uansett plattform — også AI-bygde sider", detail: "WordPress, Wix, Squarespace, Webflow, eller en side du bygde med Claude/Cursor/v0/Lovable. Sikt gir deg ferdige forslag du limer inn der du redigerer — eller rett inn i AI-verktøyet ditt." },
        { text: "Se hvor du står på Google — ubegrenset antall søkeord", detail: "Posisjon, klikk og visninger for alle søkeord du allerede rangerer på, hentet direkte fra Google Search Console." },
        { text: "Månedlig sjekk av hastighet og tekniske feil", detail: "Vi sjekker Core Web Vitals, mobilvennlighet, ødelagte lenker, SSL og redirect-kjeder hver måned." },
        { text: "Ukentlig «Dette har Sikt klargjort for deg»-kvittering", detail: "Hver mandag: konkret liste over funn og ferdige AI-forslag du kan lime inn selv. «3 meta-titler skrevet, 2 ødelagte lenker funnet, 4 alt-tekster generert.» Ingen abstrakte SEO-tall — bare konkret arbeid klart til bruk." },
        { text: "E-postvarsel når noe går galt", detail: "Øyeblikkelig varsel ved trafikkdropp, nye 404-feil eller nedetid." },
        { text: "Månedlig rapport på plain norsk", detail: "PDF som forklarer hva som har endret seg og hva du bør gjøre — uten SEO-jargon." }
      ]
    }
  ];

  // Felles funksjons-liste (høyre kolonne i hver rad). Detaljene utvides mykt via
  // grid-rows 0fr→1fr (CSS-transition, ikke keyframes → avbrytbar ved rask klikking).
  const renderFeatures = (plan: Plan, i: number) => (
    <ul className="space-y-3">
      {plan.features.map((feat, j) => {
        const detailKey = `${i}-${j}`;
        const isOpen = openDetail === detailKey;
        return (
          <li key={j} className="text-[#1A1A1A]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-[#E8F1EB] flex items-center justify-center text-[#15795A] shrink-0">
                <Check size={12} strokeWidth={3} />
              </div>
              <span className="text-sm font-medium flex-1">{feat.text}</span>
              {feat.detail && (
                <button
                  type="button"
                  onClick={() => setOpenDetail(isOpen ? null : detailKey)}
                  aria-label={isOpen ? "Skjul detaljer" : "Vis detaljer"}
                  aria-expanded={isOpen}
                  className={`mt-0.5 shrink-0 transition-colors ${isOpen ? 'text-[#1A1A1A]' : 'text-[#5C574C] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]'}`}
                >
                  <HelpCircle size={14} />
                </button>
              )}
            </div>
            {feat.detail && (
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'grid-rows-[1fr] mt-2' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden ml-8">
                  <div className="p-3 bg-[#F2EFE8] border border-[#E9E4DA] rounded-lg text-xs text-[#5C574C] leading-relaxed">
                    {feat.detail}
                  </div>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  // CTA: Basic/Standard → selvbetjent signup. Premium → samtale (vurdert kjøp),
  // med en sekundærlenke for den som vil starte direkte.
  const renderCta = (plan: Plan) => {
    const inkBtn =
      'w-full sm:w-auto inline-flex justify-center items-center px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base ui-motion bg-[#1A1A1A] text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 shadow-lg [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-200';
    return (
      <>
        {plan.ctaNote && (
          <p className="text-xs sm:text-sm font-semibold text-violet-700 mb-3 max-w-xs">{plan.ctaNote}</p>
        )}
        {plan.ctaHref ? (
          <>
            <a href={plan.ctaHref} className={inkBtn}>
              {plan.ctaLabel ?? `Velg ${plan.title}`}
            </a>
            <button
              type="button"
              onClick={() => onSelectPlan(plan.title)}
              className="mt-3 block text-xs sm:text-sm font-semibold text-[#5C574C] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] transition-colors"
            >
              eller start abonnementet direkte →
            </button>
          </>
        ) : (
          <button
            onClick={() => onSelectPlan(plan.title)}
            className={
              plan.highlighted
                ? inkBtn
                : 'w-full sm:w-auto inline-flex justify-center items-center px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base ui-motion bg-white border border-[#E9E4DA] text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#1A1A1A]/40'
            }
          >
            Velg {plan.title}
          </button>
        )}
        {/* Trust-mikrocopy rett ved kjøps-CTA — demper friksjon i kjøpsøyeblikket. */}
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold text-[#5C574C]">
          <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#15795A]" />14 dagers angrerett</span>
          <span className="text-[#8A8578]" aria-hidden>·</span>
          <span>Sikker betaling via Stripe</span>
          <span className="text-[#8A8578]" aria-hidden>·</span>
          <span>Si opp når som helst</span>
        </p>
      </>
    );
  };

  // Selve raden: historie (navn, pris, hvem-for, CTA) til venstre, funksjoner til høyre.
  // Lik indre padding på alle tre rader → prisene linjerer i en kolonne.
  const renderRow = (plan: Plan, i: number) => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-8 lg:gap-14 items-start px-6 sm:px-10 py-8 sm:py-10">
      {/* Historie */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#5C574C]">{plan.title}</h3>
          {plan.highlighted && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black uppercase tracking-wider">
              Mest valgt
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-4xl sm:text-5xl font-black text-[#1A1A1A] tracking-tight">{plan.price},-</span>
          <span className="text-[#5C574C] font-medium text-sm sm:text-base">/mnd</span>
        </div>
        <p className="mt-4 text-[15px] sm:text-base font-bold text-[#1A1A1A] leading-snug">{plan.tagline}</p>
        <p className="mt-2 text-sm text-[#5C574C] leading-relaxed">{plan.who}</p>
        <div className="mt-6">{renderCta(plan)}</div>
      </div>

      {/* Funksjoner */}
      {renderFeatures(plan, i)}
    </div>
  );

  return (
    <section id="priser" className="py-16 sm:py-24 md:py-32 bg-[#F2EFE8] relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10">

        <RevealOnScroll direction="up">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4 sm:mb-6">Velg din <span className="text-violet-600">vekstplan</span></h2>
            <p className="text-base sm:text-lg md:text-xl text-[#5C574C] max-w-2xl mx-auto px-2">Ingen skjulte kostnader. Ingen bindingstid. Trykk på <HelpCircle size={14} className="inline text-[#5C574C] -mt-0.5" /> for å se detaljer.</p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1A1A1A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15795A]" />
              Rabattert de 3 første månedene · 50 / 30 / 15 %
            </p>
          </div>
        </RevealOnScroll>

        <div className="space-y-8 sm:space-y-10">
          {plans.map((plan, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 110}>
              {plan.highlighted ? (
                <div className="relative bg-white rounded-[28px] border border-[#E9E4DA] border-l-2 border-l-violet-400 shadow-[0_30px_60px_-24px_rgba(26,26,26,0.18)] transition-shadow duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_40px_80px_-24px_rgba(26,26,26,0.24)]">
                  {renderRow(plan, i)}
                </div>
              ) : (
                <div className="relative bg-white/70 backdrop-blur-sm rounded-[28px] border border-[#E9E4DA] shadow-[0_12px_32px_-22px_rgba(26,26,26,0.13)] transition-shadow duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_18px_40px_-22px_rgba(26,26,26,0.18)]">
                  {renderRow(plan, i)}
                </div>
              )}
            </RevealOnScroll>
          ))}
        </div>

        {/* Lovpålagt før-kjøps-info (angrerettloven): tjenesten starter umiddelbart
            på kundens anmodning → forholdsmessig betaling ved angring. */}
        <p className="mt-8 text-center text-xs text-[#5C574C] max-w-2xl mx-auto">
          Ved kjøp starter tjenesten umiddelbart på din anmodning. Forbrukere har 14 dagers{' '}
          <a href="/angrerett" className="underline underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">angrerett</a>{' '}
          med forholdsmessig betaling for perioden som er brukt. Se{' '}
          <a href="/vilkar" className="underline underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">vilkårene</a>.
        </p>

      </div>
    </section>
  );
};

export { Pricing };
export default Pricing;

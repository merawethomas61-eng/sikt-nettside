import React, { useState } from 'react';
import { HelpCircle, Check } from 'lucide-react';
import { RevealOnScroll } from './RevealOnScroll';

// Legg merke til at vi nå tar imot "handleLogin" her
const Pricing = ({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) => {
  // Sporer hvilken feature-bullet som har detaljer åpne. Format: "kortIndex-featureIndex" eller null.
  // Zero cognitive load: default er lukket, detaljer er ett klikk unna.
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  type PlanFeature = { text: string; detail?: string };
  type Plan = { title: string; price: string; tagline: string; desc: string; features: PlanFeature[]; highlighted?: boolean; ctaLabel?: string; ctaHref?: string; ctaNote?: string };

  const plans: Plan[] = [
    {
      title: "BASIC",
      price: "790",
      tagline: "Vi fikser det viktigste — så viser vi deg resten.",
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
    },
    {
      title: "STANDARD",
      price: "1 690",
      tagline: "Flere kunder — uten at du løfter en finger.",
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
      title: "PREMIUM",
      price: "4 990",
      tagline: "Når én ny kunde er verdt titusener.",
      ctaLabel: "Book en GEO-gjennomgang",
      ctaHref: "mailto:siktseo@gmail.com?subject=GEO-gjennomgang%20(Premium)&body=Hei%20Sikt%2C%0A%0AJeg%20vil%20ha%20en%20GEO-gjennomgang%20og%20se%20om%20ChatGPT%2FGemini%2FPerplexity%20nevner%20bedriften%20min.%0A%0ABedrift%2Fnettside%3A%20%0ABransje%3A%20%0A",
      ctaNote: "Én ny klient betaler hele året — vi går gjennom tallene sammen først.",
      desc: "Bygd for bedrifter der hver kunde teller mest — advokater, tannleger, klinikker, håndverkere og B2B. Full synlighet i både Google og AI-søk, så du fanger kundene konkurrentene dine går glipp av. Én ekstra kunde i måneden betaler hele abonnementet.",
      features: [
        { text: "Alt i Standard", detail: "Auto-fiks, ukentlig kvittering, AI-tekster, 50-søkeord-sporing, konkurrent-radar og prioritert support er inkludert." },
        { text: "For høyverdi-bransjer der ett oppdrag betaler året", detail: "Tjenesten er priset for bedrifter med høy kundeverdi — advokat, tannlege, eiendomsmegler, entreprenør, B2B. Er marginen din lav per kunde, er Standard sannsynligvis riktigere for deg." },
        { text: "Ukentlig sjekk: anbefaler ChatGPT, Gemini og Perplexity deg?", detail: "Sikt stiller 20–50 bransjerelevante spørsmål til AI-assistentene hver uke og rapporterer om — og hvordan — bedriften din nevnes." },
        { text: "Ubegrenset søkeord-sporing", detail: "Ingen grense. Spor alle søkeord som er relevante for bedriften din." },
        { text: "Spør Sikt AI hva som helst — 24/7", detail: "AI-chat som kjenner dine egne SEO-data og svarer på alt du lurer på, når som helst." },
        { text: "Konkurrent-radar uten grenser + dyp AI-analyse", detail: "Overvåk så mange konkurrenter du vil. AI leser deres innhold, estimerer trafikken og sjekker om ChatGPT/Gemini/Perplexity nevner dem — så du vet nøyaktig hva du må gjøre for å gå forbi." },
        { text: "Månedlig strategirapport på 10+ sider", detail: "Grundig AI-generert analyse med GEO-konkurrentanalyse, vekststrategi og konkrete neste steg." },
        { text: "4-timers support på hverdager", detail: "Raskeste svartid vi tilbyr — svar innen 4 timer, mot 24 timer i Standard." }
      ]
    }
  ];

  return (
    <section id="priser" className="py-16 sm:py-24 md:py-32 bg-[#F5F5F0] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 relative z-10">

        <RevealOnScroll direction="up">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4 sm:mb-6">Velg din <span className="text-[#1A1A1A]">vekstplan</span></h2>
            <p className="text-base sm:text-lg md:text-xl text-[#808080] max-w-2xl mx-auto px-2">Ingen skjulte kostnader. Ingen bindingstid. Trykk på <HelpCircle size={14} className="inline text-[#808080] -mt-0.5" /> for å se detaljer.</p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {plans.map((plan, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 100}>
              <div className={`relative bg-white rounded-3xl sm:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-xl transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-2 border ${plan.highlighted ? 'border-violet-400 shadow-violet-200/50 md:scale-105 z-10' : 'border-[#EBEBE6]'}`}>

                <div className="absolute -top-3 -right-2 sm:-top-4 sm:-right-4 bg-[#1A1A1A] text-white text-[10px] sm:text-xs font-black px-2.5 py-1 sm:px-3 rounded-full shadow-lg shadow-violet-200 z-50 border-2 border-white transform rotate-12 whitespace-nowrap">
                  RABATTERT 3 MND
                </div>

                {plan.highlighted && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wide shadow-lg whitespace-nowrap">
                    Mest valgt
                  </div>
                )}

                <h3 className="text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-2 mt-2 sm:mt-0">{plan.title}</h3>
                <p className="text-[#1A1A1A] text-xs sm:text-sm font-bold mb-3 sm:mb-4 uppercase tracking-wider">{plan.tagline}</p>

                <div className="flex items-baseline gap-1 mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-black text-[#1A1A1A]">{plan.price},-</span>
                  <span className="text-[#808080] font-medium text-sm sm:text-base">/mnd</span>
                </div>
                <p className="text-sm sm:text-base text-[#808080] mb-6 sm:mb-8 leading-relaxed">{plan.desc}</p>

                <ul className="space-y-3 mb-6 sm:mb-8">
                  {plan.features.map((feat, j) => {
                    const detailKey = `${i}-${j}`;
                    const isOpen = openDetail === detailKey;
                    return (
                      <li key={j} className="text-[#1A1A1A]">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-5 h-5 rounded-full bg-[#F5F5F0] flex items-center justify-center text-[#1A1A1A] shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                          <span className="text-sm font-medium flex-1">{feat.text}</span>
                          {feat.detail && (
                            <button
                              type="button"
                              onClick={() => setOpenDetail(isOpen ? null : detailKey)}
                              aria-label={isOpen ? "Skjul detaljer" : "Vis detaljer"}
                              className={`mt-0.5 shrink-0 transition-colors ${isOpen ? 'text-[#1A1A1A]' : 'text-[#808080] hover:text-[#1A1A1A]'}`}
                            >
                              <HelpCircle size={14} />
                            </button>
                          )}
                        </div>
                        {isOpen && feat.detail && (
                          <div className="mt-2 ml-8 p-3 bg-[#F5F5F0] border border-[#EBEBE6] rounded-lg text-xs text-[#808080] leading-relaxed">
                            {feat.detail}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* CTA: Basic/Standard → selvbetjent signup. Premium → samtale (vurdert kjøp), med en sekundærlenke for den som vil starte direkte. */}
                {plan.ctaNote && (
                  <p className="text-center text-xs sm:text-sm font-semibold text-violet-700 mb-3">{plan.ctaNote}</p>
                )}
                {plan.ctaHref ? (
                  <>
                    <a
                      href={plan.ctaHref}
                      className="block text-center w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base ui-motion transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] bg-[#1A1A1A] text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 shadow-lg [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-200"
                    >
                      {plan.ctaLabel ?? `Velg ${plan.title}`}
                    </a>
                    <button
                      type="button"
                      onClick={() => onSelectPlan(plan.title)}
                      className="mt-3 w-full text-xs sm:text-sm font-semibold text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] transition-colors"
                    >
                      eller start abonnementet direkte →
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onSelectPlan(plan.title)}
                    className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base ui-motion transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${plan.highlighted
                      ? 'bg-[#1A1A1A] text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 shadow-lg [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-200'
                      : 'bg-[#F5F5F0] text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#EBEBE6]'
                      }`}
                  >
                    Velg {plan.title}
                  </button>
                )}
              </div>
            </RevealOnScroll>
          ))}
        </div>

      </div>
    </section>
  );
};

export { Pricing };
export default Pricing;

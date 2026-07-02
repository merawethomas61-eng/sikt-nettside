import React from 'react';
import { HelpCircle } from 'lucide-react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';
import { Badge } from '../../components/marketing/Badge';
import { FaqList } from '../../components/marketing/Faq';

/* ------------------------------------------------------------------ *
 * Forside-FAQ. 12-kolonners redaksjonell splitt (intro-rail + accordion)
 * med den delte, JS-frie <details>-lista fra Priser/bloggen.
 * SPEILES i scripts/prerender.mjs (homeFaqs) — endres tekstene her, MÅ
 * de endres der også, ellers matcher ikke FAQPage-schemaet synlig tekst.
 * ------------------------------------------------------------------ */

export const homeFaqs = [
  {
    q: 'Jeg skjønner ikke SEO. Må jeg lære det?',
    a: 'Nei. Det er hele poenget med Sikt. Vi tar oss av det tekniske og oversetter det til plain norsk i en månedlig rapport. Du trenger ikke vite hva en "meta-description" er — du trenger bare å vite at flere kunder finner deg. Hvis du lurer på noe, kan du spørre Sikt AI direkte på dashboardet og få svar som en 10-åring kan forstå.',
  },
  {
    q: 'Hvor lang tid tar det før jeg ser resultater?',
    a: 'Du ser forbedringer på det tekniske (hastighet, feilmeldinger, sidescore) allerede første uken. Flere besøkende på nettsiden merker du vanligvis etter 2–3 måneder. Topposisjoner på Google tar 6–12 måneder — det er ikke noen som kan love det raskere uten å lyve. Vi gir deg ærlige tall hver måned så du ser at det går riktig vei.',
  },
  {
    q: 'Hva skjer hvis det ikke fungerer?',
    a: 'Ingen bindingstid — du kan si opp når som helst. Og det er nesten alltid noe å hente: den første måneden handler om å fikse åpenbare ting mange har oversett — treg side, ødelagte lenker, manglende tekst. Ser du ikke verdi, sier du opp uten kostnad.',
  },
  {
    q: 'Hva er det med ChatGPT? Må jeg bry meg om det?',
    a: 'Ja, hvis du vil ha kunder om 2–3 år. I dag googler folk. I morgen spør de ChatGPT, Gemini og Perplexity. Disse AI-ene gir ett svar, ikke 10 lenker — så hvis de ikke nevner deg, er du borte. Det er dette vi kaller GEO, og det er inkludert i Premium-pakken. Du er tidlig ute — de fleste norske bedrifter tenker ikke på dette ennå.',
  },
  {
    q: 'Hvorfor skal jeg velge dere i stedet for et vanlig SEO-byrå?',
    a: 'Vanlige byråer sender deg månedsrapporter full av grafer og begreper du ikke forstår. Du aner ikke hva du betaler for. Sikt forteller deg hva vi har gjort, hva som har skjedd med bedriften din, og hva vi fokuserer på neste måned — på norsk du faktisk leser. I tillegg har du tilgang til et AI-dashboard 24/7 som svarer på spørsmålene dine med én gang.',
  },
  {
    q: 'Er det tekniske vanskelig å sette opp?',
    a: 'Nei. Vi trenger tilgang til Google Search Console og Google Analytics — to gratis verktøy de fleste bedrifter allerede har. Hvis du ikke har det, setter vi det opp for deg på 10 minutter. Etter det trenger du ikke gjøre noe selv. Vi overvåker og jobber i bakgrunnen.',
  },
] as const;

export const FaqSection = () => (
  <section className="py-16 sm:py-24 md:py-28 bg-transparent relative overflow-hidden">
    <div className="max-w-7xl mx-auto px-5 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
        <div className="lg:col-span-4">
          <RevealOnScroll direction="left">
            <div className="mb-6">
              <Badge icon={<HelpCircle size={11} />}>Det du lurer på</Badge>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#1A1A1A] mb-6 leading-tight tracking-tight">
              Spørsmål vi <br className="hidden lg:block" /> faktisk får.
            </h2>
            <p className="text-[#5C574C] font-medium text-sm sm:text-lg leading-relaxed max-w-md">
              Ærlige svar på det folk lurer på før de prøver Sikt. Ingen salgssnakk.
            </p>
          </RevealOnScroll>
        </div>

        <div className="lg:col-span-8">
          <RevealOnScroll direction="up" delay={100}>
            <FaqList items={homeFaqs.map((f) => ({ q: f.q, a: f.a }))} />
          </RevealOnScroll>
        </div>
      </div>
    </div>
  </section>
);

export default FaqSection;

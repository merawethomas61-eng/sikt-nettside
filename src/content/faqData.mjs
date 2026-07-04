// =====================================================================
// FAQ-innhold — ÉN kilde for både React-sidene og prerender/JSON-LD.
// =====================================================================
// Google krever at FAQPage-markup matcher synlig tekst. Tidligere lå disse
// tekstene duplisert i FaqSection.tsx / PriserPage.tsx OG scripts/prerender.mjs
// — én redigering det ene stedet gjorde structured data usann.
//
// Ren .mjs uten JSX/TS slik at Node (scripts/prerender.mjs kjører utenfor
// Vite) kan importere samme fil som React-komponentene.

/** Forside-FAQ (rendres i src/pages/home/FaqSection.tsx). */
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
];

/** Priser-FAQ (rendres i src/pages/PriserPage.tsx). */
export const priserFaqs = [
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

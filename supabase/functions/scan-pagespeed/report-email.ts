// =====================================================================
// Rapport-e-post for den utloggede gratis-analysen (mode: 'public').
// =====================================================================
// Forsiden lover «Vi sender deg rapporten og tips» — denne modulen holder
// det løftet. E-posten leverer MER enn teaseren på skjermen (alle on-page-
// funn + flere PSI-funn), så «full rapport»-løftet er ærlig.
//
// Funn-byggeren er en 1:1-port av buildPageFindings i App.tsx — samme
// vekting og samme plain-norsk-copy, så skjerm og e-post aldri spriker.
// =====================================================================

import {
  renderEmail,
  escapeHtml,
  statement,
  sectionHead,
  defList,
  railNote,
  note,
} from '../_shared/email.ts';

export type PageFacts = {
  title: string | null;
  titleLen: number;
  metaDescription: string | null;
  metaLen: number;
  h1Count: number;
  h1Text: string | null;
  imgTotal: number;
  imgMissingAlt: number;
  wordCount: number;
  hasOg: boolean;
  hasSchema: boolean;
  hasViewport: boolean;
};

export type AuditScores = {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
};

type PageFinding = { w: number; title: string; impact: string };

const GENERIC_TITLES = ['hjem', 'home', 'forside', 'startside', 'velkommen', 'min side', 'untitled', 'document', 'ny side'];

function buildPageFindings(f: PageFacts): PageFinding[] {
  const out: PageFinding[] = [];

  if (!f.title || f.titleLen === 0) {
    out.push({ w: 100, title: 'Siden din mangler en tittel', impact: 'Tittelen er det aller første Google viser i søkeresultatet. Uten den blir du nesten usynlig.' });
  } else if (f.titleLen < 15 || GENERIC_TITLES.includes(f.title.toLowerCase())) {
    out.push({ w: 90, title: `Tittelen din: «${f.title}»`, impact: 'Dette er det aller første Google og kundene ser. Den sier ikke hva du tilbyr — folk scroller forbi.' });
  } else if (f.titleLen > 60) {
    out.push({ w: 55, title: `Tittelen din er ${f.titleLen} tegn — Google kutter den midt i setningen`, impact: 'Det viktigste forsvinner bak «…». Hold den under ~60 tegn så hele budskapet vises.' });
  }

  if (!f.metaDescription || f.metaLen === 0) {
    out.push({ w: 85, title: 'Du mangler meta-beskrivelse', impact: 'Teksten under lenken i Google. Uten den gjetter Google selv — ofte feil, og færre klikker seg inn.' });
  } else if (f.metaLen < 50) {
    out.push({ w: 50, title: `Meta-beskrivelsen din er bare ${f.metaLen} tegn`, impact: 'Du lar verdifull plass i Google stå tom. 120–158 tegn gir flere klikk.' });
  } else if (f.metaLen > 160) {
    out.push({ w: 40, title: `Meta-beskrivelsen din er ${f.metaLen} tegn — Google kutter den`, impact: 'Slutten forsvinner bak «…». Hold den under ~158 tegn så hele teksten vises.' });
  }

  if (!f.hasViewport) {
    out.push({ w: 80, title: 'Siden er ikke satt opp for mobil', impact: 'Uten viewport-tag vises siden feil på telefon. Google rangerer mobil-først — dette straffer deg direkte.' });
  }

  if (f.h1Count === 0) {
    out.push({ w: 75, title: 'Forsiden mangler en H1-overskrift', impact: 'Google bruker H1 til å forstå hva siden handler om. Uten den famler den i blinde.' });
  } else if (f.h1Count > 1) {
    out.push({ w: 30, title: `Forsiden har ${f.h1Count} H1-overskrifter`, impact: 'Flere H1-er forvirrer Google om hva som er hovedbudskapet. Én tydelig H1 er best.' });
  }

  if (f.wordCount < 300) {
    out.push({ w: 70, title: `Forsiden leverer bare ${f.wordCount} ord til Google ved første lasting`, impact: 'Google belønner sider som svarer grundig. Under 300 ord oppfattes ofte som tynt — og rankes lavere.' });
  }

  if (f.imgMissingAlt > 0) {
    out.push({ w: 60, title: `${f.imgMissingAlt} av ${f.imgTotal} bilder mangler alt-tekst`, impact: 'Google «ser» ikke bilder uten alt-tekst — du taper Google Bilder-trafikk, og siden blir utilgjengelig for skjermlesere.' });
  }

  if (!f.hasSchema) {
    out.push({ w: 45, title: 'Google vet ikke at du er en bedrift', impact: 'Uten strukturert data (schema) går du glipp av rik visning — stjerner, åpningstider og kontaktinfo rett i søket.' });
  }

  if (!f.hasOg) {
    out.push({ w: 35, title: 'Lenken din ser kjedelig ut når den deles', impact: 'Uten Open Graph-bilde og -tittel blir delinger på Facebook og LinkedIn grå og tomme — nesten ingen klikker.' });
  }

  return out.sort((a, b) => b.w - a.w);
}

// Maks antall funn i e-posten — nok til å føles som «hele rapporten»,
// lite nok til at den fortsatt leses.
const MAX_FINDINGS = 12;

export function buildAuditReportEmail(opts: {
  url: string;
  scores: AuditScores;
  pageFacts: PageFacts | null;
  psiIssues: Array<{ title: string; displayValue: string }>;
  // 'lead' (default) = gratis-analysen på forsiden, med plan-pitch og /priser-CTA.
  // 'customer' = dag-0-rapporten til en NY betalende kunde rett etter onboarding —
  // samme funn, men null salg: CTA-en går til dashbordet, pitch-blokken byttes
  // ut med «hva skjer nå», og footeren sier kunde, ikke lead.
  audience?: 'lead' | 'customer';
}): { subject: string; html: string; findingsCount: number } {
  const isCustomer = opts.audience === 'customer';
  const host = (() => {
    try { return new URL(opts.url).hostname.replace(/^www\./, ''); } catch { return opts.url; }
  })();

  const available = [opts.scores.performance, opts.scores.seo, opts.scores.accessibility, opts.scores.bestPractices]
    .filter((n): n is number => typeof n === 'number');
  const overall = available.length ? Math.round(available.reduce((a, b) => a + b, 0) / available.length) : null;

  const pageFindings = opts.pageFacts ? buildPageFindings(opts.pageFacts) : [];
  const psiRoom = Math.max(0, MAX_FINDINGS - pageFindings.length);
  const findings: Array<{ title: string; body?: string }> = [
    ...pageFindings.map((f) => ({ title: f.title, body: f.impact })),
    ...opts.psiIssues.slice(0, psiRoom).map((i) => ({
      title: i.title,
      body: i.displayValue || undefined,
    })),
  ];

  // Samme ærlige anslag som på skjermen: synlig forutsetning (1 000 besøk/mnd),
  // 8 kr/besøk — aldri presentert som en måling.
  const perfForEstimate = opts.scores.performance ?? overall ?? 90;
  const uplift = Math.max(0, Math.min(0.3, (90 - perfForEstimate) / 100));
  const extraVisits = Math.round(1000 * uplift);
  const krLost = extraVisits * 8;

  const scoreParts = [
    ['Fart', opts.scores.performance],
    ['SEO', opts.scores.seo],
    ['Tilgjengelighet', opts.scores.accessibility],
    ['Teknisk', opts.scores.bestPractices],
  ] as const;
  const scoreLine = scoreParts
    .map(([label, v]) => `${label} ${typeof v === 'number' ? v : '–'}`)
    .join(' · ');

  const blocks: string[] = [];

  if (overall !== null) {
    blocks.push(statement({
      value: String(overall),
      label: 'samlet score av 100',
      sub: `${escapeHtml(scoreLine)}. Beste i bransjen ligger på 90+ på alle fire.`,
    }));
  }

  if (findings.length > 0) {
    blocks.push(sectionHead('Dette fant vi på siden din') + defList(findings));
  } else {
    blocks.push(note('Grunnmuren din ser solid ut — vi fant ingen alvorlige feil ved første lasting. Da handler neste steg om å vinne søkeord og bli synlig i AI-søk.', 'green'));
  }

  if (krLost > 0) {
    blocks.push(railNote({
      title: 'Hva det kan koste deg',
      body: `Et grovt anslag: en side med ~1 000 besøk i måneden kan tape i størrelsesorden ~${krLost.toLocaleString('nb-NO')} kr/mnd i tapt synlighet på denne scoren (≈ ${extraVisits.toLocaleString('nb-NO')} besøk · 8 kr/besøk). Dette er et anslag med en synlig forutsetning — ikke en måling av trafikken din.`,
      tone: 'accent',
    }));
  }

  if (isCustomer) {
    blocks.push(note(
      `<strong>Hva skjer nå?</strong> Alle funnene ligger allerede i dashbordet ditt, der Sikt prioriterer hva som bør fikses først. Du får rapporter på e-post etter hvert som arbeidet skjer — frekvensen styrer du selv i innstillingene.`,
    ));
  } else {
    blocks.push(note(
      `Vil du fikse det? <strong>Basic</strong> (790 kr/mnd) gir deg hele lista med ferdige oppskrifter du gjør selv. <strong>Standard</strong> (1 690 kr/mnd) kobler seg til siden din og fikser det meste automatisk. Ingen bindingstid — si opp når som helst.`,
    ));
  }

  const subject = isCustomer
    ? (findings.length > 0
        ? `Første analyse er klar: ${findings.length} funn på ${host}`
        : `Første analyse er klar: solid grunnmur på ${host}`)
    : (findings.length > 0
        ? `${findings.length} funn på ${host} — hele rapporten din fra Sikt`
        : `Rapporten for ${host}: solid grunnmur`);

  const html = renderEmail({
    preheader: isCustomer
      ? `Første analyse av ${host} er ferdig — alt ligger i dashbordet ditt.`
      : findings.length > 0
        ? `Hele rapporten for ${host}: ${findings.length} funn, uten noe holdt tilbake.`
        : `Rapporten for ${host} er klar.`,
    brand: 'sikt',
    kicker: new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }),
    heading: `Slik står ${escapeHtml(host)} i dag`,
    intro: isCustomer
      ? `Den første analysen av siden din er ferdig — den kjørte automatisk i det du fullførte oppstarten. Her er alt vi fant, og alt ligger også i dashbordet ditt.`
      : `Her er hele rapporten fra gratis-analysen du kjørte på siktseo.com — alt vi fant, uten noe holdt tilbake.`,
    blocks,
    cta: isCustomer
      ? { label: 'Åpne dashbordet', url: 'https://siktseo.com/portal' }
      : { label: 'Se hvordan Sikt fikser det', url: 'https://siktseo.com/priser' },
    secondary: isCustomer
      ? `Lurer du på noe? Svar på denne e-posten, så hjelper vi deg.`
      : `Vil du sjekke en annen side? <a href="https://siktseo.com/#gratis-analyse" style="color:inherit;text-decoration:underline">Kjør en ny gratis-analyse</a>.`,
    signoff: isCustomer ? 'Vi er i gang. Dette blir bra.' : 'Lykke til med siden — vi heier uansett.',
    footer: isCustomer
      ? `Sikt · siktseo.com — du får denne e-posten fordi du er kunde hos Sikt.`
      : `Sikt · siktseo.com — du får denne éne e-posten fordi du ba om rapporten på siktseo.com. Vil du ikke høre mer fra oss? Svar «nei takk», så stryker vi deg.`,
  });

  return { subject, html, findingsCount: findings.length };
}

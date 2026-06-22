// =====================================================================
// Preview-harness for den delte e-postmalen (docs/design-principles.md).
// Rendrer hver e-posttype med sample-data til HTML + en gallerivisning,
// så designet kan godkjennes FØR de fem funksjonene vris.
//
// Kjør:  node scripts/preview-emails.ts
//   (Node 24 kjører .ts via native type-stripping — ingen byggesteg.)
// Skriver til $CLAUDE_JOB_DIR/tmp (eller OS-temp) og skriver ut stiene.
// KUN et utviklingsverktøy — påvirker ikke produksjon.
// =====================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  renderEmail, escapeHtml, sectionHead, statement, winList, statRow,
  defList, railNote, note, TOKENS,
} from '../supabase/functions/_shared/email.ts';

const PORTAL = 'https://siktseo.com/portal';
const ink = TOKENS.color.ink;

// ---------------------------------------------------------------------
// 1) Ukesrapport (Sikt → kunde) — rikest. Ett fokus-tall (+S) = ROI.
// ---------------------------------------------------------------------
const weekly = renderEmail({
  preheader: 'Du klatret på 3 søkeord denne uken — og Google-trafikken din er verdt ~1 480 kr i måneden.',
  brand: 'sikt',
  kicker: 'Uke 25 · 16. juni',
  heading: 'Det går riktig vei denne uken',
  intro: `Hei <strong style="color:${ink}">Marit</strong> — her er hva Sikt gjorde for Bjørks Bakeri de siste sju dagene.`,
  blocks: [
    sectionHead('Seire denne uken') + winList([
      { keyword: 'konditori oslo', from: 14, to: 6, flag: 'side 1' },
      { keyword: 'bryllupskake bestille', from: 23, to: 11 },
      { keyword: 'glutenfri bakeri', from: 9, to: 3, flag: 'topp 3' },
    ]),

    sectionHead('Hva dette er verdt') + statement({
      value: '1 480 kr',
      label: 'Estimert verdi per måned',
      trend: '+12 % klikk mot forrige måned',
      sub: '185 klikk fra 4 200 visninger i Google siste 28 dager — verdsatt som hva tilsvarende annonseklikk ville kostet (~8 kr per klikk).',
    }),

    sectionHead('Fikset av Sikt') + defList([
      { title: 'La til meta-beskrivelse på /tjenester', body: 'Manglet helt — Google viste en tilfeldig setning fra siden.' },
      { title: 'Komprimerte 8 bilder på forsiden', body: 'Siden laster nå 1,2 sekunder raskere på mobil.' },
    ]),

    sectionHead('Konkurrentene dine') + railNote({
      title: 'Vi holder øye mens du jobber',
      body: 'Publiserer en konkurrent noe nytt, endrer priser eller klatrer på Google, får du beskjed. Du slipper å følge med selv.',
    }),

    sectionHead('Siden du startet med Sikt') + statRow([
      { value: 27, label: 'ting fikset' },
      { value: 41, label: 'funn oppdaget' },
      { value: 9, label: 'uker aktiv' },
    ]),
  ],
  signoff: 'Ha en god uke — vi sees neste mandag.',
  cta: { label: 'Åpne dashbordet', url: PORTAL },
  footer: `Sikt · Standard Pakke · bjorksbakeri.no &nbsp;·&nbsp; <a href="${PORTAL}" style="color:${TOKENS.color.faint};text-decoration:underline">Administrer varsler</a> &nbsp;·&nbsp; <a href="${PORTAL}" style="color:${TOKENS.color.faint};text-decoration:underline">Avslutt abonnement</a>`,
});

// ---------------------------------------------------------------------
// 2) Dunning (Sikt → kunde) — fokus = «Oppdater betaling».
// ---------------------------------------------------------------------
const dunning = renderEmail({
  preheader: 'Vi fikk ikke trukket den siste betalingen — som regel et utløpt kort. Oppdater så unngår du avbrudd.',
  brand: 'sikt',
  kicker: 'Abonnement',
  heading: 'Betalingen din gikk ikke gjennom',
  intro: 'Hei Marit, vi fikk ikke trukket den siste betalingen for Sikt-abonnementet ditt — som oftest et utløpt eller sperret kort.',
  blocks: [
    railNote({
      title: 'Sikt fortsetter å jobbe i mellomtiden',
      body: 'For å unngå avbrudd bør du oppdatere kortet snart. Det tar under ett minutt.',
      tone: 'accent',
    }),
  ],
  cta: { label: 'Oppdater betaling', url: 'https://invoice.stripe.com/i/eksempel' },
  signoff: 'Har du allerede ordnet det? Da kan du se bort fra denne e-posten.',
  footer: 'Spørsmål? Svar på denne e-posten, eller kontakt support@siktseo.com.',
});

// ---------------------------------------------------------------------
// 3) Anmeldelses-forespørsel (white-label: bedrift → sluttkunde).
//    Ingen Sikt-wordmark. Diskré «drevet av Sikt» i footer.
// ---------------------------------------------------------------------
const reviewRequest = renderEmail({
  preheader: 'Hadde du en god opplevelse med Bjørks Bakeri? Noen ord på Google tar under ett minutt.',
  brand: 'none',
  heading: 'Takk for at du valgte oss',
  intro: `Hei Anne, tusen takk for at du valgte <strong style="color:${ink}">Bjørks Bakeri</strong>. Var du fornøyd, ville det betydd mye om du ga oss noen ord på Google — det tar under ett minutt og hjelper andre med å finne oss.`,
  blocks: [
    note('Var det noe som ikke satt helt? Bare svar på denne e-posten, så hører vi fra deg direkte.'),
  ],
  cta: { label: 'Gi en vurdering på Google', url: 'https://g.page/r/eksempel/review' },
  secondary: 'Fungerer ikke knappen? Lim inn: <a href="https://g.page/r/eksempel/review" style="color:' + TOKENS.color.accent + ';text-decoration:underline;word-break:break-all">g.page/r/eksempel/review</a>',
  footer: 'Sendt på vegne av Bjørks Bakeri &nbsp;·&nbsp; drevet av Sikt',
});

// ---------------------------------------------------------------------
// 4) Anmeldelses-påminnelse (white-label) — enklere, én gang.
// ---------------------------------------------------------------------
const reviewFollowup = renderEmail({
  preheader: 'En liten påminnelse fra Bjørks Bakeri — noen ord på Google tar under ett minutt.',
  brand: 'none',
  intro: `Hei Anne, en liten påminnelse. Hadde du en god opplevelse med <strong style="color:${ink}">Bjørks Bakeri</strong>, setter vi stor pris på noen ord på Google. Det tar under ett minutt.`,
  cta: { label: 'Gi en vurdering på Google', url: 'https://g.page/r/eksempel/review' },
  signoff: 'Dette er den eneste påminnelsen vi sender.',
  footer: 'Sendt på vegne av Bjørks Bakeri &nbsp;·&nbsp; drevet av Sikt',
});

// ---------------------------------------------------------------------
// 5) Kontaktskjema (intern, Sikt). api/contact.js bruker en parallell
//    inline-mal (Node), men dette viser samme uttrykk.
// ---------------------------------------------------------------------
const contact = renderEmail({
  preheader: 'Ny henvendelse fra siktseo.com.',
  brand: 'sikt',
  kicker: 'Kontaktskjema',
  heading: 'Ny henvendelse',
  blocks: [
    note(
      `<strong style="color:${ink}">Kari Nordmann</strong> &nbsp;·&nbsp; kari@example.no<br><br>` +
      'Hei! Jeg driver en liten nettbutikk og lurer på om Sikt passer for Shopify. Kan dere ringe meg?',
    ),
  ],
  footer: 'Sikt · automatisk videresendt fra kontaktskjemaet',
});

// ---------------------------------------------------------------------
// Skriv filer + galleri-indeks.
// ---------------------------------------------------------------------
const emails: Array<{ file: string; title: string; desc: string; html: string }> = [
  { file: 'weekly.html', title: 'Ukesrapport', desc: 'Sikt → kunde · rik · fokus-tall (+S) = ROI', html: weekly },
  { file: 'dunning.html', title: 'Mislykket betaling', desc: 'Sikt → kunde · fokus = «Oppdater betaling»', html: dunning },
  { file: 'review-request.html', title: 'Anmeldelses-forespørsel', desc: 'White-label · ingen Sikt-logo', html: reviewRequest },
  { file: 'review-followup.html', title: 'Anmeldelses-påminnelse', desc: 'White-label · enklere', html: reviewFollowup },
  { file: 'contact.html', title: 'Kontaktskjema (intern)', desc: 'Sikt internt', html: contact },
];

const outDir = join(process.env.CLAUDE_JOB_DIR || tmpdir(), 'tmp', 'email-preview');
mkdirSync(outDir, { recursive: true });
for (const e of emails) writeFileSync(join(outDir, e.file), e.html, 'utf8');

const cards = emails.map((e) => `
  <section class="card">
    <header><h2>${e.title}</h2><p>${e.desc}</p>
      <a href="${e.file}" target="_blank">Åpne i egen fane →</a></header>
    <iframe src="${e.file}" title="${e.title}" loading="lazy"></iframe>
  </section>`).join('');

const index = `<!doctype html><html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sikt e-post — designforslag</title>
<style>
  :root{color-scheme:light}
  body{margin:0;background:#E6E3DA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A}
  .top{max-width:1200px;margin:0 auto;padding:44px 24px 8px}
  .top h1{font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:-0.5px;margin:0 0 8px;font-weight:700}
  .top p{color:#55514A;margin:0;max-width:64ch;line-height:1.7}
  .grid{max-width:1200px;margin:0 auto;padding:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:28px;align-items:start}
  .card{background:#fff;border:1px solid #E7E2D8;border-radius:18px;overflow:hidden}
  .card header{padding:16px 18px;border-bottom:1px solid #E7E2D8}
  .card h2{font-size:15px;margin:0 0 2px}
  .card p{font-size:12px;color:#8A857A;margin:0 0 6px}
  .card a{font-size:12px;color:#6D28D9;text-decoration:none;font-weight:600}
  .card iframe{width:100%;height:820px;border:0;background:#F1EFE8;display:block}
</style></head><body>
<div class="top"><h1>Sikt e-post — designforslag</h1>
<p>Alle fem e-postene i én redaksjonell mal etter <em>The Interior Design Handbook</em>: serif-display mot ren sans, hårstrek-linjer og luft i stedet for kort-stabler, ett stort fokus-tall (+S), og rolig ink-knapp. White-label-e-postene bærer ingen Sikt-logo.</p></div>
<div class="grid">${cards}</div>
</body></html>`;

writeFileSync(join(outDir, 'index.html'), index, 'utf8');

console.log('Skrev e-post-preview til:');
console.log('  ' + join(outDir, 'index.html'));
for (const e of emails) console.log('  ' + join(outDir, e.file));

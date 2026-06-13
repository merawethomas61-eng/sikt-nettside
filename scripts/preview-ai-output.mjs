// =============================================================================
// KVALITETS-TEST (#5): kjør de NØYAKTIGE AI-promptene fra motoren mot
// eksempeldata, så du ser hva Sikt faktisk ville skrevet — uten å koble til
// en eneste nettside. Promptene speiler api/cron-scan-competitors.js
// (afGenerateTargetedTitle/Meta/AltText, geoGenerateFaqAnswer, geoGenerateQuestions).
//
// BRUK (PowerShell):
//   $env:OPENAI_API_KEY="sk-..."; node scripts/preview-ai-output.mjs
//   $env:OPENAI_API_KEY="sk-..."; node scripts/preview-ai-output.mjs "Ditt Firma AS" "ditt søkeord"
//
// Første argument = bedriftsnavn, andre = søkeord (begge valgfrie).
// =============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Mangler OPENAI_API_KEY. Sett den først:  $env:OPENAI_API_KEY="sk-..."');
  process.exit(1);
}

const company = process.argv[2] || 'Bergen Bad & Flis';
const keyword = process.argv[3] || 'bad oppussing pris';

const NO_CLAIMS =
  'IKKE finn på fakta du ikke kan vite: ingen priser eller tall, ikke «gratis», ' +
  'ingen «befaring», «butikk», «showroom», åpningstider, antall år erfaring, ' +
  'sertifiseringer eller garantier. Hold deg generell og sannferdig om tjenesten.';

async function ai({ system, user, maxTokens = 120, temperature = 0.4 }) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY.trim()}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!r.ok) return `[FEIL ${r.status}: ${(await r.text()).slice(0, 120)}]`;
  const d = await r.json();
  return String(d?.choices?.[0]?.message?.content ?? '').replace(/\s+/g, ' ').replace(/^["'«»]+|["'«»]+$/g, '').trim();
}

function line(label, text) {
  const len = typeof text === 'string' ? text.length : 0;
  console.log(`\n── ${label} (${len} tegn) ──\n${text}`);
}

console.log(`\n=== Sikt AI-kvalitetstest ===\nBedrift: ${company}\nSøkeord: ${keyword}\nModell: gpt-4o-mini (samme som motoren)\n`);

const title = await ai({
  system: 'Du skriver SEO-titler (<title>) på korrekt, naturlig norsk. Krav: MÅL 50–60 tegn (fyll ut med en kort verdibeskrivelse hvis tittelen blir for kort). Få temaet fra søkeordet inn tidlig, men BØY og skriv det naturlig med stor forbokstav — ikke lim inn søkeordet rått i småbokstaver. Avslutt med «| Merkenavn». Ingen klisjeer. ' + NO_CLAIMS + ' Svar med KUN tittelen.',
  user: `Tema (fra søkeord): ${keyword}\nMerkenavn: ${company}`,
  maxTokens: 40,
});
line('SEO-tittel (near-miss/forfall)', title);

const meta = await ai({
  system: 'Du skriver SEO-meta-beskrivelser på korrekt, naturlig norsk. Krav: 120–158 tegn, aktiv stemme, konkret verdiløfte. Få temaet fra søkeordet naturlig inn tidlig, men BØY det grammatisk riktig — ikke lim inn søkeordet rått. Ingen klisjeer, ingen keyword-stuffing. ' + NO_CLAIMS + ' Svar med KUN beskrivelsen.',
  user: `Tema (fra søkeord): ${keyword}\nBedrift: ${company}`,
});
line('Meta-beskrivelse (near-miss/forfall)', meta);

const alt = await ai({
  system: 'Du skriver alt-tekst for bilder på norsk (tilgjengelighet + SEO). Krav: kort (maks ~120 tegn), beskriv hva bildet sannsynligvis viser ut fra filnavn og tittel, naturlig norsk, IKKE start med «bilde av». Svar med KUN alt-teksten.',
  user: `Filnavn: ferdig-bad-marmor-2024.jpg\nTittel: Nyoppusset bad\nBedrift: ${company}`,
  maxTokens: 60,
});
line('Alt-tekst (bilde)', alt);

const questions = await ai({
  system: 'Du lager realistiske norske søk en potensiell kunde ville stilt en AI-assistent (ChatGPT/Gemini/Perplexity) når de leter etter en leverandør i denne bransjen. IKKE nevn bedriftsnavnet i spørsmålene. Returner KUN en JSON-array med strenger.',
  user: `Bedrift: ${company}\nLag 4 korte kjøper-spørsmål (norsk) for å finne en slik leverandør.`,
  maxTokens: 300,
});
line('GEO-spørsmål (det vi spør ChatGPT/Gemini/Perplexity)', questions);

let firstQuestion = keyword;
try { const arr = JSON.parse((questions.match(/\[[\s\S]*\]/) || [])[0] || '[]'); if (arr[0]) firstQuestion = arr[0]; } catch { /* ignore */ }

const faq = await ai({
  system: 'Du skriver et kort, faktabasert FAQ-svar på norsk som posisjonerer bedriften som et godt svar på spørsmålet — slik en AI-assistent ville sitert. Krav: 2–4 setninger, konkret, nevn bedriften naturlig, ingen tomme superlativer. ' + NO_CLAIMS + ' Svar med KUN svarteksten.',
  user: `Bedrift: ${company}\nSpørsmål fra en potensiell kunde: ${firstQuestion}\nSkriv ett FAQ-svar.`,
  maxTokens: 200,
  temperature: 0.5,
});
line('FAQ-svar (GEO — mates til llms.txt + schema)', faq);

console.log('\n=== Ferdig. Vurder: er dette tekst du ville lagt på din egen forside? ===\n');

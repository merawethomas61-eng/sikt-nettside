#!/usr/bin/env node
// =====================================================================
// scripts/outreach-drafts.mjs — Outreach-motor, DEL 1 (berik + generer)
// =====================================================================
// Leser `audit_leads` (varme leads som SELV kjørte gratis-analysen), beriker
// hver med ekte SEO-funn, og genererer ett personlig norsk e-post-UTKAST per
// lead med Gemini (gemini-2.0-flash — billigste modellen du har nøkkel til).
// Skriver utkastene til `outreach_drafts` med status='draft'.
//
//   ⚠️ SENDER INGENTING. Du leser/redigerer utkastene og setter status='approved'
//   før noe i det hele tatt går ut (sending er del 2).
//
// Kjør:   node scripts/outreach-drafts.mjs
//         node scripts/outreach-drafts.mjs --force   (regenerer selv om utkast finnes)
//
// Krever (fra .env.local i repo-roten, eller miljøvariabler):
//   VITE_SUPABASE_URL (eller SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//   GOOGLE_PAGESPEED_API_KEY (eller PAGESPEED_API_KEY)
//   GEMINI_API_KEY
// =====================================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FORCE = process.argv.includes('--force');

// --- Enkel .env.local-laster (samme filer Vite leser i dev) ----------
function loadEnv() {
  // Nøkler satt i selve skallet vinner alltid. Ellers vinner SISTE ikke-tomme
  // verdi i fila — .env.local kan ha en tom plassholder først og ekte verdi senere.
  const shellKeys = new Set(Object.keys(process.env));
  for (const f of ['.env.local', '.env']) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
      if (!m || shellKeys.has(m[1])) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val !== '' || process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGESPEED_KEY = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.PAGESPEED_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Billigste tilgjengelige leverandør: Gemini Flash hvis nøkkelen finnes, ellers
// OpenAI gpt-4o-mini som fallback (så scriptet kan kjøres med det du har lokalt).
const PROVIDER = GEMINI_KEY ? 'gemini' : (OPENAI_KEY ? 'openai' : null);
const AI_MODEL = PROVIDER === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini';

const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE, GOOGLE_PAGESPEED_API_KEY: PAGESPEED_KEY })
  .filter(([, v]) => !v).map(([k]) => k);
if (!PROVIDER) missing.push('GEMINI_API_KEY eller OPENAI_API_KEY');
if (missing.length) {
  console.error(`Mangler env-variabler: ${missing.join(', ')}.\nLegg dem i .env.local i repo-roten eller sett dem i miljøet.`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// --- Berik: hent ekte SEO-funn for en URL via Google PSI (mobil) -----
// Brukes som backfill for eksisterende leads som ble fanget før scan-pagespeed
// begynte å lagre funnene. Nye leads har funnene lagret på raden allerede.
async function enrichViaPsi(url) {
  const cats = ['performance', 'seo', 'accessibility', 'best-practices']
    .map((c) => `category=${encodeURIComponent(c)}`).join('&');
  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${encodeURIComponent(PAGESPEED_KEY)}&strategy=mobile&${cats}`;
  const r = await fetch(psiUrl);
  if (!r.ok) throw new Error(`PSI HTTP ${r.status}`);
  const d = await r.json();
  const scoreOf = (cat) => (cat && typeof cat.score === 'number' ? Math.round(cat.score * 100) : null);
  const c = d.lighthouseResult?.categories ?? {};
  const scores = {
    performance: scoreOf(c.performance),
    seo: scoreOf(c.seo),
    accessibility: scoreOf(c.accessibility),
    bestPractices: scoreOf(c['best-practices']),
  };
  const audits = d.lighthouseResult?.audits ?? {};
  const failing = Object.values(audits)
    .filter((a) => a && typeof a.score === 'number' && a.score < 0.9 && a.title)
    .sort((a, b) => a.score - b.score);
  const topIssues = failing.slice(0, 5).map((a) => ({ title: a.title, displayValue: a.displayValue || '' }));
  return { scores, issueCount: failing.length, topIssues };
}

// --- Generer personlig utkast via Gemini -----------------------------
// Samme ærlighets-regel som auto-fiks-motoren (AF_NO_CLAIMS): AI-en vet ikke
// fakta om bedriften, så den skal ikke finne på noe.
const HONESTY =
  'IKKE finn på fakta du ikke kan vite: ingen priser, garantier, åpningstider, ' +
  'antall år erfaring, sertifiseringer eller påståtte resultater. Hold deg til ' +
  'funnene under og til hva Sikt er (automatisk SEO + AI-synlighet for norske ' +
  'bedrifter, forklart på vanlig norsk, ingen bindingstid).';

function buildPrompt(lead, enriched) {
  let domain = lead.url;
  try { domain = new URL(lead.url).hostname.replace(/^www\./, ''); } catch { /* behold url */ }
  const issues = enriched.topIssues
    .map((i) => i.title + (i.displayValue ? ` (${i.displayValue})` : ''))
    .join('; ') || 'ingen åpenbare';
  return `Skriv en kort, personlig e-post på NORSK fra "Sikt" til bedriften bak ${domain}. De kjørte SELV en gratis SEO-sjekk hos oss, så de forventer å høre fra oss.

STIL:
- Som en fagperson som faktisk har sett på siden deres — varm, konkret, uten salgs-floskler.
- Maks 80 ord i body. Korte setninger. ALDRI "Håper alt står bra til" eller "Vi i Sikt tilbyr ...".
- Oversett tekniske funn til PLAIN norsk en bedriftseier forstår (f.eks. "siden laster tregt på mobil", IKKE "Reduce unused JavaScript").

STRUKTUR:
- subject: kort, konkret, vekker nysgjerrighet — IKKE ordene "Tilbud" eller "Gratis". Gjerne med tallet eller domenet.
- body:
  1) Åpne rett på det viktigste funnet + hvorfor det koster dem kunder.
  2) Nevn maks ett funn til, kort.
  3) Én myk oppfordring: den fulle gratis-rapporten eller en kort prat (ingen press).
  4) Signatur "– Sikt", og DERETTER én diskré linje: "Vil du ikke høre mer, svar 'nei takk', så lar vi deg være."
- ${HONESTY}

DATA (bruk det som er relevant — ikke rems opp alt):
- Domene: ${domain}
- Ytelse på mobil: ${enriched.scores?.performance ?? 'ukjent'}/100 (90+ er bra)
- SEO: ${enriched.scores?.seo ?? 'ukjent'}/100
- Antall tekniske funn totalt: ${enriched.issueCount ?? 'ukjent'}
- Konkrete funn: ${issues}
- Sidefakta: ${lead.page_facts ? JSON.stringify(lead.page_facts) : 'ikke tilgjengelig'}

Svar KUN med gyldig JSON, ingen markdown, ingen forklaring: {"subject": "...", "body": "..."}`;
}

async function askGemini(prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') ?? '';
}

async function askOpenAI(prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  return d?.choices?.[0]?.message?.content ?? '';
}

async function generateDraft(lead, enriched) {
  const prompt = buildPrompt(lead, enriched);
  const text = PROVIDER === 'gemini' ? await askGemini(prompt) : await askOpenAI(prompt);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  }
  if (!parsed?.subject || !parsed?.body) throw new Error('AI ga ikke gyldig subject/body');
  return { subject: String(parsed.subject).slice(0, 200), body: String(parsed.body).slice(0, 4000) };
}

// --- Hovedløp --------------------------------------------------------
async function main() {
  const { data: leads, error } = await supabase
    .from('audit_leads')
    .select('email, url, mobile_score, scores, issue_count, top_issues, page_facts, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: existing } = await supabase.from('outreach_drafts').select('lead_email, url');
  const done = new Set((existing || []).map((d) => `${d.lead_email}|${d.url}`));

  let created = 0, skipped = 0, failed = 0;
  console.log(`Fant ${leads?.length ?? 0} leads i audit_leads. AI: ${PROVIDER} (${AI_MODEL}).\n`);

  for (const lead of leads || []) {
    if (!lead.email || !lead.url) { skipped++; continue; }
    if (!FORCE && done.has(`${lead.email}|${lead.url}`)) {
      console.log(`• Hopper over ${lead.email} (har allerede utkast)`);
      skipped++;
      continue;
    }
    // Dedup også INNEN kjøringen (audit_leads kan ha duplikat-rader for samme side).
    done.add(`${lead.email}|${lead.url}`);
    try {
      // Bruk lagrede funn hvis de finnes (nye leads), ellers PSI-backfill.
      let enriched;
      if (lead.top_issues && lead.scores) {
        enriched = { scores: lead.scores, issueCount: lead.issue_count ?? lead.top_issues.length, topIssues: lead.top_issues };
      } else {
        enriched = await enrichViaPsi(lead.url);
      }

      const draft = await generateDraft(lead, enriched);

      const { error: insErr } = await supabase.from('outreach_drafts').insert({
        lead_email: lead.email,
        url: lead.url,
        subject: draft.subject,
        body: draft.body,
        status: 'draft',
        enriched,
        ai_model: AI_MODEL,
      });
      if (insErr) throw insErr;

      created++;
      console.log(`\n─── ${lead.email}  ·  ${lead.url} ───`);
      console.log(`Emne: ${draft.subject}`);
      console.log(draft.body);
    } catch (e) {
      failed++;
      console.warn(`✗ ${lead.email}: ${e.message}`);
    }
  }

  console.log(`\n────────────────────────────────────`);
  console.log(`Utkast laget: ${created} · hoppet over: ${skipped} · feilet: ${failed}`);
  console.log(`Les/redigér i tabellen outreach_drafts og sett status='approved' på de du vil sende.`);
  console.log(`INGENTING er sendt.`);
}

main().catch((e) => { console.error('Uventet feil:', e); process.exit(1); });

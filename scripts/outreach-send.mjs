#!/usr/bin/env node
// =====================================================================
// scripts/outreach-send.mjs — Outreach-motor, DEL 2 (send godkjente utkast)
// =====================================================================
// Sender de utkastene du har godkjent i `outreach_drafts` (status='approved')
// som enkle, personlige e-poster via Resend. Speiler del 1-scriptet:
// founder kjører det for hånd, full kontroll.
//
//   TRYGT SOM STANDARD: uten --send gjør scriptet en DRY-RUN og sender
//   ingenting — det viser bare hva som VILLE blitt sendt.
//
//   ORG.NR-GATE: --send nekter å sende før `orgNr` er fylt i
//   src/shared/companyInfo.ts (avsender-identitet kreves i footeren).
//
// Kjør:
//   node scripts/outreach-send.mjs                  (dry-run — viser køen)
//   node scripts/outreach-send.mjs --send           (sender, maks --limit)
//   node scripts/outreach-send.mjs --send --limit=10
//   node scripts/outreach-send.mjs --optout kunde@bedrift.no   (manuell «nei takk»)
//
// Krever (fra .env.local i repo-roten, eller miljøvariabler):
//   VITE_SUPABASE_URL (eller SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY                         (kun for --send)
//   OUTREACH_FROM      (valgfri, default «Sikt <hei@siktseo.com>»)
//   OUTREACH_REPLY_TO  (valgfri, default companyInfo.supportEmail)
// =====================================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Argumenter ------------------------------------------------------
const ARGV = process.argv.slice(2);
const SEND = ARGV.includes('--send');
function argValue(name) {
  const eq = ARGV.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = ARGV.indexOf(name);
  return i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith('--') ? ARGV[i + 1] : null;
}
const LIMIT = Math.max(1, parseInt(argValue('--limit') || '25', 10) || 25);
const OPTOUT = argValue('--optout');

// --- Enkel .env.local-laster (samme som del 1) -----------------------
function loadEnv() {
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
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// --- Avsender-identitet: ÉN kilde til sannhet = src/shared/companyInfo.ts.
// Vi parser fila lett (plain `export const`) så footer + org.nr-gate følger
// nettsidens footer automatisk i det øyeblikket brukeren fyller den.
function readCompanyInfo() {
  const p = resolve(ROOT, 'src/shared/companyInfo.ts');
  const raw = existsSync(p) ? readFileSync(p, 'utf8') : '';
  // Fjern hele kommentar-linjer FØRST — companyInfo.ts har example-verdier
  // (f.eks. orgNr: '912 345 678') i kommentarer som ellers ville lurt gaten.
  const src = raw.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const field = (name) => {
    const m = src.match(new RegExp(`${name}\\s*:\\s*'([^']*)'`));
    return m ? m[1] : '';
  };
  const legalName = field('legalName') || 'Sikt';
  const orgNr = field('orgNr');
  const address = field('address');
  const supportEmail = field('supportEmail') || 'siktseo@gmail.com';
  const legalEntityLabel = orgNr ? `${legalName} (org.nr ${orgNr})` : legalName;
  return { legalName, orgNr, address, supportEmail, legalEntityLabel };
}
const COMPANY = readCompanyInfo();

const FROM = process.env.OUTREACH_FROM || 'Sikt <hei@siktseo.com>';
const REPLY_TO = process.env.OUTREACH_REPLY_TO || COMPANY.supportEmail;

// --- Forhåndssjekker -------------------------------------------------
const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE })
  .filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Mangler env-variabler: ${missing.join(', ')}.\nLegg dem i .env.local i repo-roten eller sett dem i miljøet.`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- Manuell avmelding («nei takk»-svar) -----------------------------
async function runOptout(email) {
  const e = String(email).trim().toLowerCase();
  if (!e.includes('@')) {
    console.error(`«${email}» ser ikke ut som en e-postadresse.`);
    process.exit(1);
  }
  const { error } = await supabase
    .from('outreach_optouts')
    .upsert({ email: e, source: 'manual' }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) { console.error('Kunne ikke lagre avmelding:', error.message); process.exit(1); }
  console.log(`✓ ${e} er meldt av. Send-scriptet hopper over den heretter.`);
}

// --- Bygg enkel, personlig e-post ------------------------------------
function buildEmail(draft, unsubUrl) {
  const bodyHtml = escapeHtml(draft.body)
    .split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`).join('');

  const footerBits = [COMPANY.legalEntityLabel, COMPANY.address].filter(Boolean).map(escapeHtml).join(' · ');
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1A1A1A;max-width:560px">
${bodyHtml}
<hr style="border:none;border-top:1px solid #E5E1D8;margin:24px 0 12px">
<p style="margin:0;font-size:12px;line-height:1.6;color:#8A877F">
${footerBits ? footerBits + '<br>' : ''}Vil du ikke høre mer fra oss? <a href="${escapeHtml(unsubUrl)}" style="color:#8A877F">Meld deg av</a>.
</p>
</div>`;

  const footerText = [COMPANY.legalEntityLabel, COMPANY.address].filter(Boolean).join(' · ');
  const text = `${draft.body}\n\n--\n${footerText ? footerText + '\n' : ''}Meld deg av: ${unsubUrl}`;

  return { html, text };
}

async function sendOne(draft, unsubUrl) {
  const { html, text } = buildEmail(draft, unsubUrl);
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [draft.lead_email],
      subject: draft.subject,
      html,
      text,
      reply_to: REPLY_TO,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  if (resp.ok) {
    const data = await resp.json().catch(() => ({}));
    return { ok: true, id: data?.id ?? null };
  }
  const detail = (await resp.text().catch(() => '')).slice(0, 200);
  // 4xx (utenom 429) = permanent feil (ugyldig adresse o.l.). Resten = retry senere.
  const permanent = resp.status >= 400 && resp.status < 500 && resp.status !== 429;
  return { ok: false, permanent, error: `Resend ${resp.status}: ${detail}` };
}

// --- Hovedløp --------------------------------------------------------
async function main() {
  if (OPTOUT) return runOptout(OPTOUT);

  if (SEND && !RESEND_API_KEY) {
    console.error('--send krever RESEND_API_KEY (sett den i .env.local eller miljøet).');
    process.exit(1);
  }
  if (SEND && !COMPANY.orgNr) {
    console.error('Stopper: orgNr er tomt i src/shared/companyInfo.ts.\n'
      + 'Fyll inn org.nr (etter ENK-registrering) før ekte utsending — det kreves i\n'
      + 'avsender-footeren. Dry-run (uten --send) virker fint i mellomtiden.');
    process.exit(1);
  }

  // Godkjente utkast, eldste først.
  const { data: drafts, error } = await supabase
    .from('outreach_drafts')
    .select('id, lead_email, url, subject, body, unsub_token, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Suppresjon: avmeldte + bounced/complained, hentet samlet på forhånd.
  const { data: optouts } = await supabase.from('outreach_optouts').select('email');
  const { data: bad } = await supabase
    .from('email_events').select('email').in('event', ['bounced', 'complained']);
  const suppressed = new Set([
    ...(optouts || []).map((r) => (r.email || '').toLowerCase()),
    ...(bad || []).map((r) => (r.email || '').toLowerCase()),
  ]);

  const mode = SEND ? 'EKTE SEND' : 'DRY-RUN (sender ingenting)';
  console.log(`${mode} · ${drafts?.length ?? 0} godkjente utkast · maks ${LIMIT} denne kjøringen.`);
  console.log(`Avsender: ${FROM} · svar-til: ${REPLY_TO} · ${COMPANY.legalEntityLabel}\n`);

  const sentThisRun = new Set();
  let sent = 0, skipped = 0, failed = 0, processed = 0;

  for (const draft of drafts || []) {
    if (processed >= LIMIT) break;
    const email = (draft.lead_email || '').toLowerCase();

    if (!email || !draft.subject || !draft.body) {
      console.log(`• Hopper over ${draft.id} (mangler e-post/emne/tekst)`); skipped++; continue;
    }
    if (suppressed.has(email)) {
      console.log(`• Hopper over ${email} (avmeldt eller bounced/complained)`); skipped++; continue;
    }
    if (sentThisRun.has(email)) {
      console.log(`• Hopper over ${email} (allerede sendt i denne kjøringen)`); skipped++; continue;
    }

    const unsubUrl = `${SUPABASE_URL}/functions/v1/outreach-unsubscribe?t=${encodeURIComponent(draft.unsub_token)}`;
    processed++;

    if (!SEND) {
      console.log(`\n─── ${email}  ·  ${draft.url || ''} ───`);
      console.log(`Emne: ${draft.subject}`);
      console.log(draft.body);
      sentThisRun.add(email);
      continue;
    }

    const res = await sendOne(draft, unsubUrl);
    if (res.ok) {
      await supabase.from('outreach_drafts')
        .update({ status: 'sent', sent_at: new Date().toISOString(), resend_id: res.id, error: null })
        .eq('id', draft.id);
      sent++; sentThisRun.add(email);
      console.log(`✓ Sendt → ${email}`);
    } else if (res.permanent) {
      await supabase.from('outreach_drafts')
        .update({ status: 'failed', error: res.error }).eq('id', draft.id);
      failed++;
      console.warn(`✗ ${email}: ${res.error} (markert 'failed')`);
    } else {
      // Forbigående: behold 'approved' så neste kjøring prøver igjen.
      await supabase.from('outreach_drafts').update({ error: res.error }).eq('id', draft.id);
      failed++;
      console.warn(`✗ ${email}: ${res.error} (beholdt 'approved' for ny forsøk)`);
    }

    await sleep(700); // skån domene-reputasjonen
  }

  console.log(`\n────────────────────────────────────`);
  if (SEND) {
    console.log(`Sendt: ${sent} · hoppet over: ${skipped} · feilet: ${failed}`);
  } else {
    console.log(`Ville sendt: ${processed} · hoppet over: ${skipped}`);
    console.log(`INGENTING er sendt. Kjør på nytt med --send når du er klar.`);
  }
}

main().catch((e) => { console.error('Uventet feil:', e); process.exit(1); });

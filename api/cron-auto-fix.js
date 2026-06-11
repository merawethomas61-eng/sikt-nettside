/**
 * POST/GET /api/cron-auto-fix
 *
 * Ukentlig autonom auto-fiks-motor (HYBRID-modell):
 *  - AUTO-PUSH (trygt, usynlig for besøkende): meta-description, seo-title
 *    → genereres med AI og pushes direkte via /api/wordpress-push (gjenbruker
 *      audit + rollback + sikt_actions-logging).
 *  - KØ (synlig tekst): h1 → legges i sikt_fix_queue (pending) for ett-klikks
 *    godkjenning i dashbordet. (Sideinnhold-omskriving er bevisst utsatt — for fuzzy/risikabelt.)
 *
 * Kjøres kun for Standard-/Premium-kunder med WordPress i 'full'-modus.
 * Sikkerhet: krever header x-cron-secret == CRON_SECRET.
 *
 * Motoren skrur IKKE seg selv på — den må trigges av en planlagt jobb (pg_cron).
 */

import { createClient } from '@supabase/supabase-js';
import { decrypt } from './_lib/crypto.js';
import { withSentry, Sentry } from './_lib/sentry.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

const MAX_FIXES_PER_CUSTOMER = 3; // auto-push-tak per kjøring (over alle felt)
const MAX_QUEUE_PER_CUSTOMER = 3; // antall kø-forslag per kjøring
const QUEUE_SCAN_LIMIT = 8; // hvor mange sider vi henter rendret HTML for (H1-sjekk)
const META_MIN_LENGTH = 70; // kortere/manglende meta regnes som svak → kandidat
const META_TARGET_MAX = 158; // Googles visningsgrense
const TITLE_MIN_LENGTH = 10; // svært kort/manglende tittel → kandidat (konservativt)
const WP_TIMEOUT_MS = 10_000;
const DEDUP_WINDOW_DAYS = 30; // ikke fiks samme side+felt på nytt innen denne perioden
const PAID_PLANS = new Set(['Standard Pakke', 'Premium Pakke']);

function buildBasicAuthHeader(wpUsername, appPassword) {
  return `Basic ${Buffer.from(`${wpUsername}:${appPassword}`, 'utf8').toString('base64')}`;
}

async function wpGet(url, authorization) {
  try {
    const response = await fetch(url, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });
    if (!response.url.startsWith('https://')) return { ok: false, data: null };
    let data = null;
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      data = await response.json().catch(() => null);
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, data: null };
  }
}

/** Lister publiserte sider + innlegg med Yoast-meta. */
async function listPages(adminUrl, authorization) {
  const pages = [];
  for (const collection of ['pages', 'posts']) {
    const url = `${adminUrl}/wp-json/wp/v2/${collection}?per_page=50&status=publish&_fields=id,link,title,yoast_head_json`;
    const { ok, data } = await wpGet(url, authorization);
    if (!ok || !Array.isArray(data)) continue;
    for (const item of data) {
      const link = typeof item?.link === 'string' ? item.link : null;
      if (!link || !link.startsWith('https://')) continue;
      const yoast = item?.yoast_head_json || {};
      const titleObj = item?.title;
      const titleText =
        titleObj && typeof titleObj === 'object' && typeof titleObj.rendered === 'string'
          ? titleObj.rendered
          : '';
      pages.push({
        link,
        title: titleText,
        currentMeta: typeof yoast.description === 'string' ? yoast.description.trim() : '',
        currentTitle: typeof yoast.title === 'string' ? yoast.title.trim() : '',
      });
    }
  }
  return pages;
}

/** Sjekker om den rendrede siden har en synlig <h1>. */
async function pageHasH1(pageUrl) {
  try {
    const response = await fetch(pageUrl, {
      headers: { Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });
    if (!response.ok) return true; // ukjent → ikke kø (unngå falske forslag)
    const html = await response.text();
    const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if (!m) return false;
    const inner = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return inner.length > 0;
  } catch {
    return true; // feil → ikke kø
  }
}

async function openAiText({ system, user, maxTokens = 120, temperature = 0.4 }) {
  if (!OPENAI_API_KEY) return null;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content ?? '';
    return String(text).replace(/\s+/g, ' ').replace(/^["'«»]+|["'«»]+$/g, '').trim();
  } catch {
    return null;
  }
}

async function generateMetaDescription({ pageTitle, pageUrl, companyName }) {
  const text = await openAiText({
    system:
      'Du skriver SEO-meta-beskrivelser på norsk. Krav: 120–158 tegn, aktiv stemme, ' +
      'konkret verdiløfte, viktigste søkeord naturlig tidlig, ingen klisjeer, ingen ' +
      'keyword-stuffing, ikke kopier sidetittelen ordrett. Svar med KUN beskrivelsen.',
    user: `Bedrift: ${companyName || 'ukjent'}\nSidetittel: ${pageTitle || 'ukjent'}\nURL: ${pageUrl}\n\nSkriv én meta-beskrivelse.`,
  });
  if (!text || text.length < 80 || text.length > META_TARGET_MAX + 12) return null;
  return text;
}

async function generateSeoTitle({ pageTitle, pageUrl, companyName }) {
  const text = await openAiText({
    system:
      'Du skriver SEO-titler (<title>) på norsk. Krav: 50–60 tegn, viktigste søkeord ' +
      'først, deretter «| Merkenavn», unik per side, ingen klisjeer. Svar med KUN tittelen.',
    user: `Bedrift: ${companyName || 'ukjent'}\nNåværende/foreslått emne: ${pageTitle || 'ukjent'}\nURL: ${pageUrl}\n\nSkriv én SEO-tittel.`,
    maxTokens: 40,
  });
  if (!text || text.length < 15 || text.length > 70) return null;
  return text;
}

async function generateH1({ pageTitle, pageUrl, companyName }) {
  const text = await openAiText({
    system:
      'Du skriver synlige sideoverskrifter (H1) på norsk. Krav: kort og tydelig (maks ~70 tegn), ' +
      'beskriver hva siden handler om, naturlig språk, ingen klisjeer. Svar med KUN overskriften.',
    user: `Bedrift: ${companyName || 'ukjent'}\nSidetittel: ${pageTitle || 'ukjent'}\nURL: ${pageUrl}\n\nSkriv én H1-overskrift.`,
    maxTokens: 40,
  });
  if (!text || text.length < 5 || text.length > 90) return null;
  return text;
}

/** Kaller det eksisterende push-endepunktet på vegne av kunden (cron-bypass). */
async function pushFix({ userId, pageUrl, field, newValue }) {
  const res = await fetch(`${APP_BASE_URL}/api/wordpress-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
    body: JSON.stringify({ userId, pageUrl, field, newValue }),
    signal: AbortSignal.timeout(WP_TIMEOUT_MS + 5_000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok === true, error: data?.error || null };
}

export default withSentry(async function handler(req, res) {
  const cronSecret = req.headers['x-cron-secret'];
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
  }
  if (!APP_BASE_URL) {
    return res.status(500).json({ error: 'APP_BASE_URL/VERCEL_URL mangler — vet ikke hvor /api/wordpress-push er.' });
  }

  const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: hosts, error: hostsErr } = await supabase
    .from('client_hosts')
    .select('user_id, admin_url, notes, access_token_encrypted, connection_mode, platform')
    .eq('platform', 'wordpress')
    .eq('connection_mode', 'full');

  if (hostsErr) {
    Sentry.captureException(hostsErr);
    return res.status(500).json({ error: 'Kunne ikke hente WordPress-tilkoblinger.' });
  }

  const summary = { customers: 0, autoFixed: 0, queued: 0, skipped: 0, errors: 0, dryRun };
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const host of hosts || []) {
    if (!host?.admin_url || !host?.notes || !host?.access_token_encrypted) continue;

    const { data: client } = await supabase
      .from('clients')
      .select('package_name, company_name')
      .eq('user_id', host.user_id)
      .maybeSingle();
    if (!client || !PAID_PLANS.has(client.package_name)) continue;

    summary.customers += 1;

    let appPassword;
    try {
      appPassword = decrypt(host.access_token_encrypted);
    } catch (e) {
      summary.errors += 1;
      console.warn('[cron-auto-fix] dekryptering feilet for', host.user_id, e?.message || e);
      continue;
    }
    const adminUrl = host.admin_url.trim();
    const authorization = buildBasicAuthHeader(host.notes.trim(), appPassword);
    const companyName = client.company_name;

    let pages;
    try {
      pages = await listPages(adminUrl, authorization);
    } catch (e) {
      summary.errors += 1;
      console.warn('[cron-auto-fix] kunne ikke liste sider for', host.user_id, e?.message || e);
      continue;
    }

    // Hjelpefunksjon: dedup mot nylige sikt_changes (auto-felt).
    const recentlyChanged = async (pageUrl, field) => {
      const { data } = await supabase
        .from('sikt_changes')
        .select('id')
        .eq('user_id', host.user_id)
        .eq('page_url', pageUrl)
        .eq('field', field)
        .gte('created_at', dedupSince)
        .limit(1);
      return Array.isArray(data) && data.length > 0;
    };

    // === AUTO-PUSH: meta-description + seo-title ===
    let autoCount = 0;
    for (const page of pages) {
      if (autoCount >= MAX_FIXES_PER_CUSTOMER) break;

      const jobs = [];
      if (page.currentMeta.length < META_MIN_LENGTH) {
        jobs.push({ field: 'meta-description', gen: generateMetaDescription });
      }
      if (page.currentTitle.length < TITLE_MIN_LENGTH) {
        jobs.push({ field: 'seo-title', gen: generateSeoTitle });
      }

      for (const job of jobs) {
        if (autoCount >= MAX_FIXES_PER_CUSTOMER) break;
        if (await recentlyChanged(page.link, job.field)) {
          summary.skipped += 1;
          continue;
        }
        const value = await job.gen({ pageTitle: page.title, pageUrl: page.link, companyName });
        if (!value) {
          summary.skipped += 1;
          continue;
        }
        if (dryRun) {
          summary.autoFixed += 1;
          autoCount += 1;
          continue;
        }
        const result = await pushFix({ userId: host.user_id, pageUrl: page.link, field: job.field, newValue: value });
        if (result.ok) {
          summary.autoFixed += 1;
          autoCount += 1;
        } else {
          summary.errors += 1;
          console.warn('[cron-auto-fix] push feilet:', job.field, page.link, result.error);
        }
      }
    }

    // === KØ: manglende H1 → forslag til godkjenning ===
    let queueCount = 0;
    for (const page of pages.slice(0, QUEUE_SCAN_LIMIT)) {
      if (queueCount >= MAX_QUEUE_PER_CUSTOMER) break;

      // Allerede i kø (pending/approved) eller nylig endret? Hopp over.
      const { data: existingQ } = await supabase
        .from('sikt_fix_queue')
        .select('id')
        .eq('user_id', host.user_id)
        .eq('page_url', page.link)
        .eq('field', 'h1')
        .in('status', ['pending', 'approved'])
        .limit(1);
      if (Array.isArray(existingQ) && existingQ.length > 0) continue;
      if (await recentlyChanged(page.link, 'h1')) continue;

      const hasH1 = await pageHasH1(page.link);
      if (hasH1) continue;

      const suggested = await generateH1({ pageTitle: page.title, pageUrl: page.link, companyName });
      if (!suggested) {
        summary.skipped += 1;
        continue;
      }
      if (dryRun) {
        summary.queued += 1;
        queueCount += 1;
        continue;
      }
      const { error: qErr } = await supabase.from('sikt_fix_queue').insert({
        user_id: host.user_id,
        page_url: page.link,
        field: 'h1',
        current_value: null,
        suggested_value: suggested,
        explanation: 'Siden mangler en synlig overskrift (H1). Google og besøkende bruker H1 til å forstå hva siden handler om.',
        status: 'pending',
      });
      if (qErr) {
        summary.errors += 1;
        console.warn('[cron-auto-fix] kunne ikke kø-lagre H1 for', page.link, qErr.message);
      } else {
        summary.queued += 1;
        queueCount += 1;
      }
    }
  }

  console.log('[cron-auto-fix] ferdig:', JSON.stringify(summary));
  return res.status(200).json(summary);
});

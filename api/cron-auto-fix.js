/**
 * POST/GET /api/cron-auto-fix
 *
 * Ukentlig autonom auto-fiks-motor (HYBRID-modell):
 *  - AUTO-PUSH (trygt, usynlig for besøkende): meta-description, seo-title
 *    → genereres med AI og pushes direkte via /api/wordpress-push (gjenbruker
 *      audit + rollback + sikt_actions-logging).
 *  - KØ (synlig tekst): h1 / sideinnhold → legges som forslag (category:'suggestion',
 *    details.pending_approval=true) for ett-klikks godkjenning (kø-UI = fase 2b).
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

const MAX_FIXES_PER_CUSTOMER = 3; // ikke hamre kundens side på én kjøring
const META_MIN_LENGTH = 70; // kortere/manglende meta regnes som svak → kandidat
const META_TARGET_MAX = 158; // Googles visningsgrense
const WP_TIMEOUT_MS = 10_000;
const DEDUP_WINDOW_DAYS = 30; // ikke fiks samme side+felt på nytt innen denne perioden
const PAID_PLANS = new Set(['Standard Pakke', 'Premium Pakke']);

const FIELD_LABELS = {
  'meta-description': 'Meta-beskrivelse',
  'seo-title': 'SEO-tittel',
};

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

/**
 * Lister sider + innlegg med Yoast-meta, og plukker ut de med manglende/svak
 * meta-beskrivelse.
 */
async function findWeakMetaPages(adminUrl, authorization) {
  const candidates = [];
  for (const collection of ['pages', 'posts']) {
    const url = `${adminUrl}/wp-json/wp/v2/${collection}?per_page=50&status=publish&_fields=id,link,title,yoast_head_json`;
    const { ok, data } = await wpGet(url, authorization);
    if (!ok || !Array.isArray(data)) continue;
    for (const item of data) {
      const link = typeof item?.link === 'string' ? item.link : null;
      if (!link || !link.startsWith('https://')) continue;
      const yoast = item?.yoast_head_json;
      const desc = yoast && typeof yoast.description === 'string' ? yoast.description.trim() : '';
      if (desc.length < META_MIN_LENGTH) {
        const titleObj = item?.title;
        const titleText =
          titleObj && typeof titleObj === 'object' && typeof titleObj.rendered === 'string'
            ? titleObj.rendered
            : '';
        candidates.push({ link, title: titleText, currentMeta: desc });
      }
    }
  }
  return candidates;
}

/**
 * Genererer en norsk meta-beskrivelse for en side. Returnerer ren tekst eller null.
 */
async function generateMetaDescription({ pageTitle, pageUrl, companyName }) {
  if (!OPENAI_API_KEY) return null;
  const system =
    'Du skriver SEO-meta-beskrivelser på norsk. Krav: 120–158 tegn, aktiv stemme, ' +
    'konkret verdiløfte, viktigste søkeord naturlig tidlig, ingen klisjeer, ingen ' +
    'keyword-stuffing, ikke kopier sidetittelen ordrett. Svar med KUN beskrivelsen — ' +
    'ingen anførselstegn, ingen forklaring.';
  const userMsg =
    `Bedrift: ${companyName || 'ukjent'}\n` +
    `Sidetittel: ${pageTitle || 'ukjent'}\n` +
    `URL: ${pageUrl}\n\n` +
    'Skriv én meta-beskrivelse for denne siden.';
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 120,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
      }),
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content ?? '';
    text = String(text).replace(/\s+/g, ' ').replace(/^["'«»]+|["'«»]+$/g, '').trim();
    // Guardrail: forkast hvis utenfor fornuftig lengde.
    if (text.length < 80 || text.length > META_TARGET_MAX + 12) return null;
    return text;
  } catch {
    return null;
  }
}

/** Kaller det eksisterende push-endepunktet på vegne av kunden (cron-bypass). */
async function pushFix({ userId, pageUrl, field, newValue }) {
  const res = await fetch(`${APP_BASE_URL}/api/wordpress-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': CRON_SECRET,
    },
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

  // Hent betalende kunder med WordPress i full-modus.
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

    // Plan-sjekk: kun Standard/Premium.
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
      console.warn('[cron-auto-fix] dekryptering feilet for user', host.user_id, e?.message || e);
      continue;
    }
    const adminUrl = host.admin_url.trim();
    const authorization = buildBasicAuthHeader(host.notes.trim(), appPassword);

    let candidates;
    try {
      candidates = await findWeakMetaPages(adminUrl, authorization);
    } catch (e) {
      summary.errors += 1;
      console.warn('[cron-auto-fix] kunne ikke liste sider for', host.user_id, e?.message || e);
      continue;
    }

    let fixedThisCustomer = 0;
    for (const page of candidates) {
      if (fixedThisCustomer >= MAX_FIXES_PER_CUSTOMER) break;

      // Dedup: hopp over hvis vi nylig har endret meta på denne siden.
      const { data: recent } = await supabase
        .from('sikt_changes')
        .select('id')
        .eq('user_id', host.user_id)
        .eq('page_url', page.link)
        .eq('field', 'meta-description')
        .gte('created_at', dedupSince)
        .limit(1);
      if (Array.isArray(recent) && recent.length > 0) {
        summary.skipped += 1;
        continue;
      }

      const newMeta = await generateMetaDescription({
        pageTitle: page.title,
        pageUrl: page.link,
        companyName: client.company_name,
      });
      if (!newMeta) {
        summary.skipped += 1;
        continue;
      }

      if (dryRun) {
        summary.autoFixed += 1;
        fixedThisCustomer += 1;
        continue;
      }

      const result = await pushFix({
        userId: host.user_id,
        pageUrl: page.link,
        field: 'meta-description',
        newValue: newMeta,
      });
      if (result.ok) {
        summary.autoFixed += 1;
        fixedThisCustomer += 1;
      } else {
        summary.errors += 1;
        console.warn('[cron-auto-fix] push feilet:', page.link, result.error);
      }
    }
  }

  console.log('[cron-auto-fix] ferdig:', JSON.stringify(summary));
  return res.status(200).json(summary);
});

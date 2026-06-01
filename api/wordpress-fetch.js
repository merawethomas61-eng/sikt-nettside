/**
 * POST /api/wordpress-fetch
 * Henter SEO-data for én WordPress-side (kun lesing via REST API).
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_lib/require-auth.js';
import { decrypt } from './_lib/crypto.js';
import { withSentry, Sentry } from './_lib/sentry.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WP_FETCH_TIMEOUT_MS = 10_000;

function parseJsonBody(req) {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * @param {string} wpUsername
 * @param {string} appPassword
 */
function buildBasicAuthHeader(wpUsername, appPassword) {
  const basic = Buffer.from(`${wpUsername}:${appPassword}`, 'utf8').toString('base64');
  return `Basic ${basic}`;
}

/**
 * @param {string} html
 */
function stripHtml(html) {
  if (typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * @param {unknown} pageUrl
 */
function validatePageUrl(pageUrl) {
  if (typeof pageUrl !== 'string' || !pageUrl.trim()) {
    return { ok: false, error: 'pageUrl må være en streng som starter med https://.' };
  }

  const trimmed = pageUrl.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return { ok: false, error: 'pageUrl må være en streng som starter med https://.' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { ok: false, error: 'pageUrl må være en streng som starter med https://.' };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: 'pageUrl er ikke en gyldig URL.' };
  }
}

/**
 * @param {string} pageUrl
 * @param {string} adminUrl
 */
function pageUrlMatchesConnectedHost(pageUrl, adminUrl) {
  try {
    const pageHost = new URL(pageUrl).hostname;
    const adminHost = new URL(adminUrl).hostname;
    return pageHost === adminHost;
  } catch {
    return false;
  }
}

/**
 * @param {string} pageUrl
 * @returns {string | null}
 */
function slugFromPageUrl(pageUrl) {
  try {
    const parsed = new URL(pageUrl);
    let path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '/') return null;
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] || null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} yoastHeadJson
 */
function parseYoast(yoastHeadJson) {
  if (!yoastHeadJson || typeof yoastHeadJson !== 'object') {
    return { installed: false };
  }

  const head = /** @type {Record<string, unknown>} */ (yoastHeadJson);
  const result = { installed: true };

  if (typeof head.title === 'string') result.title = head.title;
  if (typeof head.description === 'string') result.description = head.description;

  const ogTitle =
    typeof head.og_title === 'string'
      ? head.og_title
      : typeof head.ogTitle === 'string'
        ? head.ogTitle
        : undefined;
  if (ogTitle) result.ogTitle = ogTitle;

  const ogDescription =
    typeof head.og_description === 'string'
      ? head.og_description
      : typeof head.ogDescription === 'string'
        ? head.ogDescription
        : undefined;
  if (ogDescription) result.ogDescription = ogDescription;

  return result;
}

/**
 * @param {string} url
 * @param {string} authorization
 */
async function wpFetchJson(url, authorization) {
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(WP_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      String(err?.message || '').toLowerCase().includes('timeout');
    if (isTimeout) {
      console.error('[wordpress-fetch] fetch-timeout:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        cause: err?.cause,
        stack: err?.stack,
      });
      const e = new Error('WordPress-siden svarte ikke i tide (timeout). Prøv igjen.');
      e.statusCode = 502;
      throw e;
    }
    console.error('[wordpress-fetch] underliggende feil (fetch):', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      cause: err?.cause,
      stack: err?.stack,
    });
    const e = new Error('Kunne ikke nå WordPress REST API.');
    e.statusCode = 502;
    throw e;
  }

  if (!response.url.startsWith('https://')) {
    const e = new Error('Kun https er tillatt. WordPress omdirigerte til en usikker adresse.');
    e.statusCode = 400;
    throw e;
  }

  if (response.status === 401 || response.status === 403) {
    console.error('[wordpress-fetch] wp-auth-feil:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });
    const e = new Error(
      'WordPress avviste innloggingen. Koble til på nytt med gyldig Application Password.',
    );
    e.statusCode = 401;
    throw e;
  }

  if (response.status === 404) {
    return { ok: false, status: 404 };
  }

  if (!response.ok) {
    console.error('[wordpress-fetch] wp-response-not-ok:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });
    const e = new Error('WordPress returnerte en uventet feil.');
    e.statusCode = 502;
    throw e;
  }

  try {
    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    console.error('[wordpress-fetch] underliggende feil (json-parse):', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      cause: err?.cause,
      stack: err?.stack,
    });
    const e = new Error('Kunne ikke lese svar fra WordPress REST API.');
    e.statusCode = 502;
    throw e;
  }
}

/**
 * @param {string} adminUrl
 * @param {string} authorization
 * @param {string} pageUrl
 * @returns {Promise<{ id: number, type: 'page' | 'post' } | null>}
 */
async function findWordPressPost(adminUrl, authorization, pageUrl) {
  const searchUrl = `${adminUrl}/wp-json/wp/v2/search?search=${encodeURIComponent(pageUrl)}&type=post&subtype=any&per_page=1`;
  const searchResult = await wpFetchJson(searchUrl, authorization);

  if (searchResult.ok && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
    const hit = searchResult.data[0];
    const id = typeof hit?.id === 'number' ? hit.id : Number(hit?.id);
    if (Number.isFinite(id)) {
      const type = hit?.subtype === 'page' ? 'page' : 'post';
      return { id, type };
    }
  }

  const slug = slugFromPageUrl(pageUrl);
  if (!slug) return null;

  const pagesUrl = `${adminUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`;
  const pagesResult = await wpFetchJson(pagesUrl, authorization);
  if (pagesResult.ok && Array.isArray(pagesResult.data) && pagesResult.data.length > 0) {
    const page = pagesResult.data[0];
    const id = typeof page?.id === 'number' ? page.id : Number(page?.id);
    if (Number.isFinite(id)) return { id, type: 'page' };
  }

  const postsUrl = `${adminUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;
  const postsResult = await wpFetchJson(postsUrl, authorization);
  if (postsResult.ok && Array.isArray(postsResult.data) && postsResult.data.length > 0) {
    const post = postsResult.data[0];
    const id = typeof post?.id === 'number' ? post.id : Number(post?.id);
    if (Number.isFinite(id)) return { id, type: 'post' };
  }

  return null;
}

/**
 * @param {string} adminUrl
 * @param {string} authorization
 * @param {number} id
 * @param {'page' | 'post'} type
 */
async function fetchWordPressPost(adminUrl, authorization, id, type) {
  const collection = type === 'page' ? 'pages' : 'posts';
  const fields = 'id,title,slug,link,content,excerpt,yoast_head_json';
  const url = `${adminUrl}/wp-json/wp/v2/${collection}/${id}?_fields=${fields}`;
  const result = await wpFetchJson(url, authorization);

  if (!result.ok) {
    if (result.status === 404) {
      const e = new Error('Fant ikke siden på WordPress.');
      e.statusCode = 404;
      throw e;
    }
    const e = new Error('Kunne ikke hente siden fra WordPress.');
    e.statusCode = 502;
    throw e;
  }

  return result.data;
}

export default withSentry(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Kun POST er tillatt' });
  }

  let user;
  try {
    ({ user } = await requireAuth(req));
  } catch (err) {
    const status = err?.statusCode === 401 ? 401 : err?.statusCode || 500;
    return res.status(status).json({
      error: err?.message || 'Autentisering feilet',
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
  }

  const body = parseJsonBody(req);
  const pageUrlCheck = validatePageUrl(body.pageUrl);
  if (!pageUrlCheck.ok) {
    return res.status(400).json({ error: pageUrlCheck.error });
  }
  const pageUrl = pageUrlCheck.value;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: hostRow, error: fetchErr } = await supabase
      .from('client_hosts')
      .select('connection_mode, admin_url, notes, access_token_encrypted')
      .eq('user_id', user.id)
      .eq('platform', 'wordpress')
      .maybeSingle();

    if (fetchErr) {
      console.error('[wordpress-fetch] Kunne ikke lese client_hosts:', fetchErr.message);
      Sentry.captureException(fetchErr);
      return res.status(500).json({ error: 'Kunne ikke hente WordPress-tilkobling.' });
    }

    if (!hostRow) {
      return res.status(404).json({ error: 'WordPress er ikke tilkoblet.' });
    }

    if (hostRow.connection_mode !== 'full' || !hostRow.access_token_encrypted) {
      return res.status(404).json({ error: 'WordPress-tilkoblingen er ikke aktiv.' });
    }

    if (typeof hostRow.admin_url !== 'string' || !hostRow.admin_url.trim()) {
      return res.status(404).json({ error: 'WordPress-tilkoblingen er ikke aktiv.' });
    }

    if (typeof hostRow.notes !== 'string' || !hostRow.notes.trim()) {
      return res.status(404).json({ error: 'WordPress-tilkoblingen er ikke aktiv.' });
    }

    const adminUrl = hostRow.admin_url.trim();

    if (!pageUrlMatchesConnectedHost(pageUrl, adminUrl)) {
      return res.status(400).json({
        error: 'URL-en hører ikke til den tilkoblede WordPress-siden.',
      });
    }

    let appPassword;
    try {
      appPassword = decrypt(hostRow.access_token_encrypted);
    } catch (decErr) {
      console.error('[wordpress-fetch] Dekryptering feilet:', decErr?.message || decErr);
      Sentry.captureException(decErr);
      return res.status(500).json({ error: 'Serveren kan ikke lese lagret nøkkel (sjekk ENCRYPTION_KEY).' });
    }

    const authorization = buildBasicAuthHeader(hostRow.notes.trim(), appPassword);

    const found = await findWordPressPost(adminUrl, authorization, pageUrl);
    if (!found) {
      return res.status(404).json({ error: 'Fant ikke siden på WordPress.' });
    }

    const post = await fetchWordPressPost(adminUrl, authorization, found.id, found.type);

    const yoast = parseYoast(post?.yoast_head_json);

    return res.status(200).json({
      ok: true,
      page: {
        id: post.id,
        type: found.type,
        slug: post.slug,
        link: post.link,
        title: stripHtml(post?.title?.rendered ?? ''),
        content: typeof post?.content?.rendered === 'string' ? post.content.rendered : '',
        excerpt: stripHtml(post?.excerpt?.rendered ?? ''),
      },
      yoast,
    });
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error('[wordpress-fetch] Feil:', err?.message || err);
      Sentry.captureException(err);
    }
    return res.status(status).json({
      error: err?.message || 'Noe gikk galt',
    });
  }
});

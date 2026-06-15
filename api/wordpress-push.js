/**
 * POST /api/wordpress-push
 * Pusher Yoast meta-felter til WordPress etter audit-lagring i sikt_changes.
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_lib/require-auth.js';
import { decrypt } from './_lib/crypto.js';
import { withSentry, Sentry } from './_lib/sentry.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WP_PUSH_TIMEOUT_MS = 10_000;

const ALLOWED_FIELDS = new Set(['meta-description', 'seo-title', 'h1', 'content']);
const META_FIELDS = new Set(['meta-description', 'seo-title']);
const FIELD_MAX_LENGTH = {
  'meta-description': 500,
  'seo-title': 100,
  h1: 200,
  content: 20000,
};

// Lesbare norske navn for «Ukens kvittering»-loggen (sikt_actions).
const FIELD_LABELS = {
  'meta-description': 'Meta-beskrivelse',
  'seo-title': 'SEO-tittel',
  h1: 'Overskrift (H1)',
  content: 'Sideinnhold',
};

const PLUGIN_NOT_INSTALLED_MESSAGE =
  'Sikt Connector-plugin er ikke installert på siden din. Last ned fra Sikt-portalen og installer i WordPress-admin.';

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
 * @param {string} url
 * @param {string} authorization
 * @param {string} [method]
 * @param {unknown} [body]
 * @param {{ throwOnAuthErrors?: boolean }} [options]
 */
async function wpRequest(url, authorization, method = 'GET', body = undefined, options = {}) {
  const { throwOnAuthErrors = true } = options;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(WP_PUSH_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      String(err?.message || '').toLowerCase().includes('timeout');
    if (isTimeout) {
      console.error('[wordpress-push] fetch-timeout:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
      });
      const e = new Error('WordPress-siden svarte ikke i tide (timeout). Prøv igjen.');
      e.statusCode = 502;
      throw e;
    }
    console.error('[wordpress-push] underliggende feil (fetch):', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
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

  if (throwOnAuthErrors && (response.status === 401 || response.status === 403)) {
    console.error('[wordpress-push] wp-auth-feil:', {
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

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (err) {
      console.error('[wordpress-push] underliggende feil (json-parse):', {
        name: err?.name,
        message: err?.message,
      });
    }
  }

  return { response, data };
}

/**
 * @param {string} adminUrl
 * @param {string} authorization
 * @param {string} pageUrl
 * @returns {Promise<{ id: number, type: 'page' | 'post' } | null>}
 */
async function findWordPressPost(adminUrl, authorization, pageUrl) {
  const searchUrl = `${adminUrl}/wp-json/wp/v2/search?search=${encodeURIComponent(pageUrl)}&type=post&subtype=any&per_page=1`;
  const searchResult = await wpRequest(searchUrl, authorization);

  if (searchResult.response.ok && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
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
  const pagesResult = await wpRequest(pagesUrl, authorization);
  if (pagesResult.response.ok && Array.isArray(pagesResult.data) && pagesResult.data.length > 0) {
    const page = pagesResult.data[0];
    const id = typeof page?.id === 'number' ? page.id : Number(page?.id);
    if (Number.isFinite(id)) return { id, type: 'page' };
  }

  const postsUrl = `${adminUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;
  const postsResult = await wpRequest(postsUrl, authorization);
  if (postsResult.response.ok && Array.isArray(postsResult.data) && postsResult.data.length > 0) {
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
async function fetchWordPressPostYoast(adminUrl, authorization, id, type) {
  const collection = type === 'page' ? 'pages' : 'posts';
  const fields = 'id,yoast_head_json';
  const url = `${adminUrl}/wp-json/wp/v2/${collection}/${id}?_fields=${fields}`;
  const result = await wpRequest(url, authorization);

  if (result.response.status === 404) {
    const e = new Error('Fant ikke siden på WordPress.');
    e.statusCode = 404;
    throw e;
  }

  if (!result.response.ok) {
    console.error('[wordpress-push] wp-fetch-not-ok:', {
      status: result.response.status,
      statusText: result.response.statusText,
      url: result.response.url,
    });
    const e = new Error('Kunne ikke hente siden fra WordPress.');
    e.statusCode = 502;
    throw e;
  }

  return result.data;
}

/**
 * @param {string} adminUrl
 * @param {string} authorization
 * @param {number} id
 * @param {'page' | 'post'} type
 */
async function fetchWordPressPostTitle(adminUrl, authorization, id, type) {
  const collection = type === 'page' ? 'pages' : 'posts';
  const url = `${adminUrl}/wp-json/wp/v2/${collection}/${id}?_fields=id,title`;
  const result = await wpRequest(url, authorization);

  if (result.response.status === 404) {
    const e = new Error('Fant ikke siden på WordPress.');
    e.statusCode = 404;
    throw e;
  }

  if (!result.response.ok) {
    console.error('[wordpress-push] wp-title-fetch-not-ok:', {
      status: result.response.status,
      statusText: result.response.statusText,
      url: result.response.url,
    });
    const e = new Error('Kunne ikke hente siden fra WordPress.');
    e.statusCode = 502;
    throw e;
  }

  const titleObj = result.data?.title;
  const rendered = titleObj && typeof titleObj === 'object' ? titleObj.rendered : null;
  return typeof rendered === 'string' ? rendered : '';
}

/**
 * @param {string} adminUrl
 * @param {string} authorization
 * @param {number} id
 * @param {'page' | 'post'} type
 */
async function fetchWordPressPostContent(adminUrl, authorization, id, type) {
  const collection = type === 'page' ? 'pages' : 'posts';
  const url = `${adminUrl}/wp-json/wp/v2/${collection}/${id}?context=edit&_fields=id,content`;
  const result = await wpRequest(url, authorization);

  if (result.response.status === 404) {
    const e = new Error('Fant ikke siden på WordPress.');
    e.statusCode = 404;
    throw e;
  }

  if (!result.response.ok) {
    console.error('[wordpress-push] wp-content-fetch-not-ok:', {
      status: result.response.status,
      statusText: result.response.statusText,
      url: result.response.url,
    });
    const e = new Error('Kunne ikke hente siden fra WordPress.');
    e.statusCode = 502;
    throw e;
  }

  const contentObj = result.data?.content;
  if (contentObj && typeof contentObj === 'object' && typeof contentObj.raw === 'string') {
    return contentObj.raw;
  }
  if (contentObj && typeof contentObj === 'object' && typeof contentObj.rendered === 'string') {
    return contentObj.rendered;
  }
  return '';
}

/**
 * @param {string} html
 */
function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} html
 * @param {string} expectedText
 */
function pageHtmlContainsH1(html, expectedText) {
  const needle = expectedText.trim().toLowerCase();
  if (!needle) return false;

  const h1Regex = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
  let match;
  while ((match = h1Regex.exec(html)) !== null) {
    const inner = stripHtmlTags(match[1]).trim().toLowerCase();
    if (inner.includes(needle)) return true;
  }
  return false;
}

/**
 * @param {string} pageUrl
 * @param {string} expectedTitle
 */
async function verifyRenderedH1(pageUrl, expectedTitle) {
  try {
    const response = await fetch(pageUrl, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(WP_PUSH_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const html = await response.text();
    return pageHtmlContainsH1(html, expectedTitle);
  } catch (err) {
    console.warn('[wordpress-push] Kunne ikke verifisere rendret H1:', err?.message || err);
    return false;
  }
}

/**
 * @param {string} adminUrl
 * @param {string} authorization
 * @param {number} postId
 * @param {'meta-description' | 'seo-title' | 'h1' | 'content'} field
 * @param {string} newValue
 */
async function pushViaSiktConnector(adminUrl, authorization, postId, field, newValue) {
  const url = `${adminUrl}/wp-json/sikt/v1/update-meta`;
  const result = await wpRequest(
    url,
    authorization,
    'POST',
    { post_id: postId, field, value: newValue },
    { throwOnAuthErrors: false },
  );
  const { response, data } = result;

  if (response.status === 404) {
    const code = typeof data?.code === 'string' ? data.code : '';
    if (code === 'rest_no_route' || code === 'rest_not_found') {
      return { ok: false, pluginNotInstalled: true };
    }
    return { ok: false, postNotFound: true };
  }

  if (response.status === 401) {
    return { ok: false, authFailed: true };
  }

  if (response.status === 403) {
    return { ok: false, forbidden: true };
  }

  if (response.status === 500 && data?.code === 'write_failed') {
    return { ok: false, writeFailed: true };
  }

  if (response.status === 200 && data?.ok === true) {
    return {
      ok: true,
      oldValue: typeof data.old_value === 'string' ? data.old_value : null,
    };
  }

  console.error('[wordpress-push] sikt-connector-not-ok:', {
    status: response.status,
    statusText: response.statusText,
    code: data?.code,
    url: response.url,
  });

  return {
    ok: false,
    status: response.status,
    statusText: response.statusText,
  };
}

/**
 * Push (eller fjern, ved tom streng) site-wide JSON-LD via sikt-connector.
 * @param {string} adminUrl
 * @param {string} authorization
 * @param {string} jsonld
 */
async function pushSiteSchemaViaSiktConnector(adminUrl, authorization, jsonld) {
  const url = `${adminUrl}/wp-json/sikt/v1/set-site-schema`;
  const { response, data } = await wpRequest(
    url,
    authorization,
    'POST',
    { jsonld },
    { throwOnAuthErrors: false },
  );

  if (response.status === 404) {
    const code = typeof data?.code === 'string' ? data.code : '';
    if (code === 'rest_no_route' || code === 'rest_not_found') {
      return { ok: false, pluginNotInstalled: true };
    }
    return { ok: false, status: 404 };
  }
  if (response.status === 401) return { ok: false, authFailed: true };
  if (response.status === 403) return { ok: false, forbidden: true };
  if (response.status === 200 && data?.ok === true) {
    return { ok: true, oldValue: typeof data.old_value === 'string' ? data.old_value : null };
  }
  return { ok: false, status: response.status, statusText: response.statusText };
}

/**
 * @param {unknown} yoastHeadJson
 * @param {'meta-description' | 'seo-title'} field
 */
function readOldYoastValue(yoastHeadJson, field) {
  if (!yoastHeadJson || typeof yoastHeadJson !== 'object') {
    return null;
  }
  const head = /** @type {Record<string, unknown>} */ (yoastHeadJson);
  if (field === 'meta-description') {
    return typeof head.description === 'string' ? head.description : null;
  }
  return typeof head.title === 'string' ? head.title : null;
}

export default withSentry(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Kun POST er tillatt' });
  }

  // Server-kun bypass: den ukentlige auto-fiks-motoren (cron-auto-fix) pusher på
  // vegne av en kunde. Gated på CRON_SECRET (samme hemmelighet som weekly-reports).
  const cronSecret = req.headers['x-cron-secret'];
  const isCronCall = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  let user;
  if (isCronCall) {
    const earlyBody = parseJsonBody(req);
    const uid = typeof earlyBody.userId === 'string' ? earlyBody.userId.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(uid)) {
      return res.status(400).json({ error: 'Gyldig userId kreves for cron-kall.' });
    }
    user = { id: uid };
  } else {
    try {
      ({ user } = await requireAuth(req));
    } catch (err) {
      const status = err?.statusCode === 401 ? 401 : err?.statusCode || 500;
      return res.status(status).json({
        error: err?.message || 'Autentisering feilet',
      });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
  }

  const body = parseJsonBody(req);

  // --- Site-wide JSON-LD (anmeldelser-schema). Egen gren: ingen pageUrl/post. ---
  if (body.field === 'site-schema') {
    const jsonld = typeof body.jsonld === 'string' ? body.jsonld : '';
    if (jsonld.length > 12000) {
      return res.status(400).json({ error: 'JSON-LD er for langt (maks 12000 tegn).' });
    }
    if (jsonld.trim() !== '') {
      try { JSON.parse(jsonld); } catch { return res.status(400).json({ error: 'Ugyldig JSON-LD.' }); }
    }
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: hostRow, error: fetchErr } = await supabase
        .from('client_hosts')
        .select('connection_mode, admin_url, notes, access_token_encrypted')
        .eq('user_id', user.id)
        .eq('platform', 'wordpress')
        .maybeSingle();
      if (fetchErr) {
        Sentry.captureException(fetchErr);
        return res.status(500).json({ error: 'Kunne ikke hente WordPress-tilkobling.' });
      }
      if (!hostRow || hostRow.connection_mode !== 'full' || !hostRow.access_token_encrypted
          || typeof hostRow.admin_url !== 'string' || !hostRow.admin_url.trim()
          || typeof hostRow.notes !== 'string' || !hostRow.notes.trim()) {
        return res.status(404).json({ error: 'WordPress er ikke aktivt tilkoblet.' });
      }
      let appPassword;
      try {
        appPassword = decrypt(hostRow.access_token_encrypted);
      } catch (decErr) {
        Sentry.captureException(decErr);
        return res.status(500).json({ error: 'Serveren kan ikke lese lagret nøkkel (sjekk ENCRYPTION_KEY).' });
      }
      const authorization = buildBasicAuthHeader(hostRow.notes.trim(), appPassword);
      const result = await pushSiteSchemaViaSiktConnector(hostRow.admin_url.trim(), authorization, jsonld);
      if (!result.ok) {
        if (result.pluginNotInstalled) {
          return res.status(400).json({ error: 'Sikt-koblingen (plugin v1.1.0+) er ikke installert på WordPress.' });
        }
        if (result.authFailed) return res.status(401).json({ error: 'WordPress avviste innloggingen.' });
        if (result.forbidden) return res.status(403).json({ error: 'WordPress-brukeren mangler administrator-rettigheter.' });
        return res.status(502).json({ error: 'WordPress avviste schema-pushen.' });
      }
      return res.status(200).json({ ok: true, pushed: 'site-schema', removed: jsonld.trim() === '' });
    } catch (err) {
      console.error('[wordpress-push] site-schema-feil:', err?.message || err);
      Sentry.captureException(err);
      return res.status(500).json({ error: 'Noe gikk galt under schema-pushen.' });
    }
  }

  const pageUrlCheck = validatePageUrl(body.pageUrl);
  if (!pageUrlCheck.ok) {
    return res.status(400).json({ error: pageUrlCheck.error });
  }
  const pageUrl = pageUrlCheck.value;

  const field = body.field;
  if (typeof field !== 'string' || !ALLOWED_FIELDS.has(field)) {
    return res.status(400).json({
      error: "field må være 'meta-description', 'seo-title', 'h1' eller 'content'.",
    });
  }

  if (typeof body.newValue !== 'string') {
    return res.status(400).json({ error: 'newValue må være en streng.' });
  }
  const newValue = body.newValue;
  const maxLen = FIELD_MAX_LENGTH[field];
  if (maxLen != null && newValue.length > maxLen) {
    return res.status(400).json({
      error: `newValue er for lang (maks ${maxLen} tegn for ${field}).`,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: hostRow, error: fetchErr } = await supabase
      .from('client_hosts')
      .select('id, connection_mode, admin_url, notes, access_token_encrypted')
      .eq('user_id', user.id)
      .eq('platform', 'wordpress')
      .maybeSingle();

    if (fetchErr) {
      console.error('[wordpress-push] Kunne ikke lese client_hosts:', fetchErr.message);
      Sentry.captureException(fetchErr);
      return res.status(500).json({ error: 'Kunne ikke hente WordPress-tilkobling.' });
    }

    if (!hostRow || hostRow.connection_mode !== 'full' || !hostRow.access_token_encrypted) {
      return res.status(404).json({ error: 'WordPress er ikke aktivt tilkoblet.' });
    }

    if (typeof hostRow.admin_url !== 'string' || !hostRow.admin_url.trim()) {
      return res.status(404).json({ error: 'WordPress er ikke aktivt tilkoblet.' });
    }

    if (typeof hostRow.notes !== 'string' || !hostRow.notes.trim()) {
      return res.status(404).json({ error: 'WordPress er ikke aktivt tilkoblet.' });
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
      console.error('[wordpress-push] Dekryptering feilet:', decErr?.message || decErr);
      Sentry.captureException(decErr);
      return res.status(500).json({ error: 'Serveren kan ikke lese lagret nøkkel (sjekk ENCRYPTION_KEY).' });
    }

    const authorization = buildBasicAuthHeader(hostRow.notes.trim(), appPassword);

    const found = await findWordPressPost(adminUrl, authorization, pageUrl);
    if (!found) {
      return res.status(404).json({ error: 'Fant ikke siden på WordPress.' });
    }

    let oldValue = null;

    if (META_FIELDS.has(field)) {
      const post = await fetchWordPressPostYoast(adminUrl, authorization, found.id, found.type);

      if (!post?.yoast_head_json || typeof post.yoast_head_json !== 'object') {
        return res.status(400).json({
          error: 'Yoast SEO er ikke aktivt på siden. Installer Yoast for å pushe meta-felter.',
        });
      }

      oldValue = readOldYoastValue(post.yoast_head_json, field);
    } else if (field === 'h1') {
      oldValue = await fetchWordPressPostTitle(adminUrl, authorization, found.id, found.type);
    } else if (field === 'content') {
      oldValue = await fetchWordPressPostContent(adminUrl, authorization, found.id, found.type);
    }

    const { data: changeRow, error: insertErr } = await supabase
      .from('sikt_changes')
      .insert({
        user_id: user.id,
        client_host_id: hostRow.id,
        page_url: pageUrl,
        field,
        old_value: oldValue,
        new_value: newValue,
        status: 'active',
      })
      .select('id')
      .single();

    if (insertErr || !changeRow?.id) {
      console.error('[wordpress-push] Kunne ikke lagre sikt_changes:', insertErr?.message || insertErr);
      Sentry.captureException(insertErr || new Error('Kunne ikke lagre sikt_changes'));
      return res.status(500).json({ error: 'Kunne ikke lagre endringen. Ingenting ble skrevet til WordPress.' });
    }

    const changeId = changeRow.id;

    const wpResult = await pushViaSiktConnector(
      adminUrl,
      authorization,
      found.id,
      field,
      newValue,
    );

    if (!wpResult.ok) {
      let wpNote = `WP ${wpResult.status || 'unknown'}: ${wpResult.statusText || 'feil'}`;
      let clientError = 'WordPress avviste endringen.';

      if (wpResult.pluginNotInstalled) {
        wpNote = 'Sikt Connector-plugin er ikke installert eller aktivert.';
        clientError = PLUGIN_NOT_INSTALLED_MESSAGE;
      } else if (wpResult.postNotFound) {
        wpNote = 'WordPress fant ikke posten (post_not_found).';
        clientError = 'WordPress fant ikke siden. Den kan ha blitt slettet.';
      } else if (wpResult.forbidden) {
        wpNote = 'Application Password mangler redigeringstilgang (forbidden).';
        clientError =
          'WordPress-brukeren mangler tilgang til å redigere denne siden. Koble til med en konto som har redaktør- eller administrator-tilgang.';
      } else if (wpResult.writeFailed) {
        wpNote = 'WordPress lagret ikke feltet korrekt (write_failed).';
        clientError = 'WordPress klarte ikke å lagre endringen.';
      } else if (wpResult.authFailed) {
        wpNote = 'WordPress avviste innloggingen (401).';
        clientError =
          'WordPress avviste innloggingen. Koble til på nytt med gyldig Application Password.';
      }

      const { error: updateErr } = await supabase
        .from('sikt_changes')
        .update({ status: 'failed', notes: wpNote })
        .eq('id', changeId)
        .eq('user_id', user.id);

      if (updateErr) {
        console.error('[wordpress-push] Kunne ikke oppdatere sikt_changes etter WP-feil:', updateErr.message);
      }

      return res.status(wpResult.authFailed ? 401 : 502).json({ error: clientError });
    }

    const previousOldValue =
      wpResult.oldValue !== undefined && wpResult.oldValue !== null
        ? wpResult.oldValue
        : oldValue;

    let h1Rendered;
    if (field === 'h1') {
      h1Rendered = await verifyRenderedH1(pageUrl, newValue);
    }

    // Logg fiksen i sikt_actions slik at den ukentlige kvitteringen («Fikset av Sikt»)
    // faktisk viser ekte arbeid. Best-effort — skal aldri velte selve push-svaret.
    try {
      const label = FIELD_LABELS[field] || field;
      await supabase.from('sikt_actions').insert({
        user_id: user.id,
        action_type: 'wordpress_push',
        category: 'fix',
        title: `${label} oppdatert`,
        details: { explanation: `Sikt oppdaterte ${label.toLowerCase()} på siden din.`, field },
        page_url: pageUrl,
        before_value: typeof previousOldValue === 'string' ? previousOldValue : null,
        after_value: newValue,
      });
    } catch (logErr) {
      console.warn('[wordpress-push] Kunne ikke logge sikt_actions-fiks:', logErr?.message || logErr);
    }

    return res.status(200).json({
      ok: true,
      changeId,
      pushed: { field, newValue },
      previous: { field, oldValue: previousOldValue },
      ...(field === 'h1' ? { h1Rendered } : {}),
    });
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error('[wordpress-push] Feil:', err?.message || err);
      Sentry.captureException(err);
    }
    return res.status(status).json({
      error: err?.message || 'Noe gikk galt',
    });
  }
});

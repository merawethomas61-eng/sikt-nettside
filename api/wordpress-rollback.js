/**
 * POST /api/wordpress-rollback
 * Ruller tilbake en aktiv WordPress push via sikt_changes + Sikt Connector-plugin.
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_lib/require-auth.js';
import { decrypt } from './_lib/crypto.js';
import { withSentry, Sentry } from './_lib/sentry.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WP_ROLLBACK_TIMEOUT_MS = 10_000;

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
      signal: AbortSignal.timeout(WP_ROLLBACK_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      String(err?.message || '').toLowerCase().includes('timeout');
    if (isTimeout) {
      console.error('[wordpress-rollback] fetch-timeout:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
      });
      const e = new Error('WordPress-siden svarte ikke i tide (timeout). Prøv igjen.');
      e.statusCode = 502;
      throw e;
    }
    console.error('[wordpress-rollback] underliggende feil (fetch):', {
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
    console.error('[wordpress-rollback] wp-auth-feil:', {
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
      console.error('[wordpress-rollback] underliggende feil (json-parse):', {
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
 * @param {number} postId
 * @param {string} field
 * @param {string} value
 */
async function rollbackViaSiktConnector(adminUrl, authorization, postId, field, value) {
  const url = `${adminUrl}/wp-json/sikt/v1/update-meta`;
  const result = await wpRequest(
    url,
    authorization,
    'POST',
    { post_id: postId, field, value },
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

  if (response.status === 403) {
    return { ok: false, forbidden: true };
  }

  if (response.status === 200 && data?.ok === true) {
    return { ok: true };
  }

  console.error('[wordpress-rollback] sikt-connector-not-ok:', {
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
  const changeId = body.changeId;
  if (typeof changeId !== 'string' || !changeId.trim()) {
    return res.status(400).json({ error: 'changeId må være en streng.' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: changeRow, error: changeErr } = await supabase
      .from('sikt_changes')
      .select('id, user_id, client_host_id, page_url, field, old_value, status')
      .eq('id', changeId.trim())
      .eq('user_id', user.id)
      .maybeSingle();

    if (changeErr) {
      console.error('[wordpress-rollback] Kunne ikke lese sikt_changes:', changeErr.message);
      Sentry.captureException(changeErr);
      return res.status(500).json({ error: 'Kunne ikke hente endringen.' });
    }

    if (!changeRow) {
      return res.status(404).json({ error: 'Fant ikke endringen.' });
    }

    if (changeRow.status === 'rolled_back') {
      return res.status(400).json({ error: 'Denne endringen er allerede rullet tilbake.' });
    }

    if (changeRow.status === 'failed') {
      return res.status(400).json({ error: 'Denne endringen feilet og kan ikke rulles tilbake.' });
    }

    if (changeRow.status !== 'active') {
      return res.status(400).json({ error: 'Denne endringen kan ikke rulles tilbake.' });
    }

    if (!changeRow.client_host_id) {
      return res.status(400).json({ error: 'WordPress er ikke aktivt tilkoblet lenger.' });
    }

    const { data: hostRow, error: hostErr } = await supabase
      .from('client_hosts')
      .select('id, connection_mode, admin_url, notes, access_token_encrypted')
      .eq('id', changeRow.client_host_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (hostErr) {
      console.error('[wordpress-rollback] Kunne ikke lese client_hosts:', hostErr.message);
      Sentry.captureException(hostErr);
      return res.status(500).json({ error: 'Kunne ikke hente WordPress-tilkobling.' });
    }

    if (!hostRow || hostRow.connection_mode !== 'full' || !hostRow.access_token_encrypted) {
      return res.status(400).json({ error: 'WordPress er ikke aktivt tilkoblet lenger.' });
    }

    if (typeof hostRow.admin_url !== 'string' || !hostRow.admin_url.trim()) {
      return res.status(400).json({ error: 'WordPress er ikke aktivt tilkoblet lenger.' });
    }

    if (typeof hostRow.notes !== 'string' || !hostRow.notes.trim()) {
      return res.status(400).json({ error: 'WordPress er ikke aktivt tilkoblet lenger.' });
    }

    if (typeof changeRow.page_url !== 'string' || !changeRow.page_url.trim()) {
      return res.status(400).json({ error: 'Fant ikke siden på WordPress lenger. Den kan ha blitt slettet.' });
    }

    if (typeof changeRow.field !== 'string' || !changeRow.field.trim()) {
      return res.status(400).json({ error: 'WordPress kunne ikke rulle tilbake endringen.' });
    }

    const adminUrl = hostRow.admin_url.trim();
    const pageUrl = changeRow.page_url.trim();
    const field = changeRow.field.trim();
    const rollbackValue = changeRow.old_value ?? '';

    let appPassword;
    try {
      appPassword = decrypt(hostRow.access_token_encrypted);
    } catch (decErr) {
      console.error('[wordpress-rollback] Dekryptering feilet:', decErr?.message || decErr);
      Sentry.captureException(decErr);
      return res.status(500).json({ error: 'Serveren kan ikke lese lagret nøkkel (sjekk ENCRYPTION_KEY).' });
    }

    const authorization = buildBasicAuthHeader(hostRow.notes.trim(), appPassword);

    const found = await findWordPressPost(adminUrl, authorization, pageUrl);
    if (!found) {
      return res.status(404).json({
        error: 'Fant ikke siden på WordPress lenger. Den kan ha blitt slettet.',
      });
    }

    const wpResult = await rollbackViaSiktConnector(
      adminUrl,
      authorization,
      found.id,
      field,
      rollbackValue,
    );

    if (!wpResult.ok) {
      if (wpResult.pluginNotInstalled) {
        return res.status(502).json({
          error: 'Sikt Connector-plugin er ikke installert lenger på siden din.',
        });
      }

      if (wpResult.forbidden) {
        return res.status(502).json({
          error: 'Application Password mangler nødvendig tilgang.',
        });
      }

      return res.status(502).json({
        error: 'WordPress kunne ikke rulle tilbake endringen.',
      });
    }

    const { error: updateErr } = await supabase
      .from('sikt_changes')
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
        rolled_back_value: rollbackValue,
      })
      .eq('id', changeRow.id)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (updateErr) {
      console.error('[wordpress-rollback] Kunne ikke oppdatere sikt_changes:', updateErr.message);
      Sentry.captureException(updateErr);
      return res.status(500).json({ error: 'Endringen ble skrevet til WordPress, men kunne ikke markeres som rullet tilbake.' });
    }

    return res.status(200).json({
      ok: true,
      changeId: changeRow.id,
      rolledBackTo: rollbackValue,
    });
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error('[wordpress-rollback] Feil:', err?.message || err);
      Sentry.captureException(err);
    }
    return res.status(status).json({
      error: err?.message || 'Noe gikk galt',
    });
  }
});

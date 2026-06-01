/**
 * POST /api/wordpress-connect
 * Verifiserer WordPress Application Password og lagrer kryptert i client_hosts.
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_lib/require-auth.js';
import { encrypt } from './_lib/crypto.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WP_VERIFY_TIMEOUT_MS = 10_000;

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

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeSiteUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw badRequest('siteUrl må være en ikke-tom streng.');
  }

  let input = raw.trim();

  if (/^http:\/\//i.test(input)) {
    throw badRequest('Kun https er tillatt. Vi sender en hemmelig nøkkel — aldri over http.');
  }

  if (!/^https:\/\//i.test(input)) {
    input = `https://${input.replace(/^\/+/, '')}`;
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw badRequest('siteUrl er ikke en gyldig URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw badRequest('Kun https er tillatt. Vi sender en hemmelig nøkkel — aldri over http.');
  }

  let pathname = parsed.pathname.replace(/\/$/, '');
  if (pathname === '/') pathname = '';

  return `${parsed.protocol}//${parsed.host}${pathname}`;
}

function assertNonEmptyField(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${label} må være en ikke-tom streng.`);
  }
}

/**
 * @param {Record<string, unknown>} wpUser
 */
function canEditWordPress(wpUser) {
  const roles = Array.isArray(wpUser?.roles) ? wpUser.roles : [];
  if (roles.some((r) => r === 'administrator' || r === 'editor')) {
    return true;
  }

  const caps = wpUser?.capabilities;
  if (caps && typeof caps === 'object') {
    if (caps.edit_posts === true || caps.edit_pages === true) {
      return true;
    }
  }

  return false;
}

/**
 * @param {string} siteUrl
 * @param {string} wpUsername
 * @param {string} appPassword
 */
async function verifyWordPressCredentials(siteUrl, wpUsername, appPassword) {
  const verifyUrl = `${siteUrl}/wp-json/wp/v2/users/me?context=edit`;
  const basic = Buffer.from(`${wpUsername}:${appPassword}`, 'utf8').toString('base64');

  let response;
  try {
    response = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/json',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(WP_VERIFY_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      String(err?.message || '').toLowerCase().includes('timeout');
    if (isTimeout) {
      console.error('[wordpress-connect] fetch-timeout:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        cause: err?.cause,
        stack: err?.stack,
      });
      const e = new Error('WordPress-siden svarte ikke i tide (timeout). Sjekk adressen og prøv igjen.');
      e.statusCode = 502;
      throw e;
    }
    console.error('[wordpress-connect] underliggende feil (fetch):', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      cause: err?.cause,
      stack: err?.stack,
    });
    const e = new Error('Fant ikke WordPress REST API på denne adressen.');
    e.statusCode = 502;
    throw e;
  }

  if (!response.url.startsWith('https://')) {
    const e = new Error('Kun https er tillatt. WordPress omdirigerte til en usikker adresse.');
    e.statusCode = 400;
    throw e;
  }

  if (response.status === 401 || response.status === 403) {
    const e = new Error(
      'WordPress avviste innloggingen. Sjekk brukernavn og Application Password, og at brukeren har redigeringsrettigheter.',
    );
    e.statusCode = 401;
    throw e;
  }

  if (response.status === 404) {
    console.error('[wordpress-connect] wp-response-404:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });
    const e = new Error('Fant ikke WordPress REST API på denne adressen.');
    e.statusCode = 502;
    throw e;
  }

  if (!response.ok) {
    console.error('[wordpress-connect] wp-response-not-ok:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });
    const e = new Error('Fant ikke WordPress REST API på denne adressen.');
    e.statusCode = 502;
    throw e;
  }

  let wpUser;
  try {
    wpUser = await response.json();
  } catch (err) {
    console.error('[wordpress-connect] underliggende feil (json-parse):', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      cause: err?.cause,
      stack: err?.stack,
    });
    const e = new Error('Fant ikke WordPress REST API på denne adressen.');
    e.statusCode = 502;
    throw e;
  }

  if (!wpUser || typeof wpUser !== 'object' || !canEditWordPress(wpUser)) {
    const e = new Error(
      'WordPress-brukeren mangler rettigheter til å redigere innhold. Bruk en konto med redaktør- eller administrator-tilgang.',
    );
    e.statusCode = 403;
    throw e;
  }

  const displayName =
    typeof wpUser.name === 'string' && wpUser.name.trim()
      ? wpUser.name.trim()
      : wpUsername;

  return { displayName };
}

export default async function handler(req, res) {
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
  const { siteUrl: rawSiteUrl, wpUsername, appPassword } = body;

  try {
    assertNonEmptyField(wpUsername, 'wpUsername');
    assertNonEmptyField(appPassword, 'appPassword');

    const siteUrl = normalizeSiteUrl(rawSiteUrl);
    const { displayName } = await verifyWordPressCredentials(
      siteUrl,
      wpUsername.trim(),
      appPassword,
    );

    let encryptedPassword;
    try {
      encryptedPassword = encrypt(appPassword);
    } catch (encErr) {
      console.error('[wordpress-connect] Kryptering feilet:', encErr?.message || encErr);
      return res.status(500).json({ error: 'Serveren kan ikke kryptere nøkkelen (sjekk ENCRYPTION_KEY).' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date().toISOString();

    const row = {
      user_id: user.id,
      platform: 'wordpress',
      connection_mode: 'full',
      access_token_encrypted: encryptedPassword,
      admin_url: siteUrl,
      notes: wpUsername.trim(),
      last_changed_at: now,
      updated_at: now,
    };

    const { data: existing, error: fetchErr } = await supabase
      .from('client_hosts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[wordpress-connect] Kunne ikke lese client_hosts:', fetchErr.message);
      return res.status(500).json({ error: 'Kunne ikke lagre tilkoblingen.' });
    }

    const write = existing
      ? supabase.from('client_hosts').update(row).eq('user_id', user.id)
      : supabase.from('client_hosts').insert({ ...row, created_at: now });

    const { error: writeErr } = await write;
    if (writeErr) {
      console.error('[wordpress-connect] Kunne ikke lagre client_hosts:', writeErr.message);
      return res.status(500).json({ error: 'Kunne ikke lagre tilkoblingen.' });
    }

    return res.status(200).json({
      ok: true,
      connected: true,
      site: siteUrl,
      wpUser: displayName,
    });
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error('[wordpress-connect] Feil:', err?.message || err);
    }
    return res.status(status).json({
      error: err?.message || 'Noe gikk galt',
    });
  }
}

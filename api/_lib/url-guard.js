import dns from 'dns/promises';
import { isIP } from 'net';

const FETCH_TIMEOUT_MS = 20000;
const MAX_REDIRECT_HOPS = 5;
const DEFAULT_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SiktBot/1.0; +https://sikt.no)',
};

/**
 * @param {string} host
 */
export function normalizeHost(host) {
  let h = String(host || '').trim().toLowerCase();
  if (h.startsWith('www.')) h = h.slice(4);
  return h;
}

/**
 * @param {string} ip
 */
function isPrivateOrReservedIpv4(ip) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * @param {string} ip
 */
function isPrivateOrReservedIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  const first = lower.split(':')[0];
  if (first === 'fc' || first === 'fd' || first.startsWith('fc') || first.startsWith('fd')) {
    return true;
  }
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateOrReservedIpv4(v4Mapped[1]);
  return false;
}

/**
 * @param {string} address
 * @param {number} family
 */
function isBlockedResolvedAddress(address, family) {
  if (family === 4 || (typeof address === 'string' && isIP(address) === 4)) {
    return isPrivateOrReservedIpv4(address);
  }
  if (family === 6 || (typeof address === 'string' && isIP(address) === 6)) {
    return isPrivateOrReservedIpv6(address);
  }
  return true;
}

/**
 * @param {string} hostname
 */
function isBlockedHostnameLiteral(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0') return true;
  if (h.endsWith('.local')) return true;
  const ipKind = isIP(h);
  if (ipKind === 4) return isPrivateOrReservedIpv4(h);
  if (ipKind === 6) return isPrivateOrReservedIpv6(h);
  return false;
}

/**
 * @param {string} hostname
 */
async function assertResolvableHostSafe(hostname) {
  if (isBlockedHostnameLiteral(hostname)) {
    throw new Error('URL peker mot et ikke-tillatt vertsnavn eller nettverk.');
  }
  const ipKind = isIP(hostname);
  if (ipKind) return;

  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Kunne ikke slå opp vertsnavnet for URL-en.');
  }

  if (!records?.length) {
    throw new Error('Kunne ikke slå opp vertsnavnet for URL-en.');
  }

  for (const rec of records) {
    if (isBlockedResolvedAddress(rec.address, rec.family)) {
      throw new Error('URL peker mot et ikke-tillatt internt eller reservert nettverk.');
    }
  }
}

/**
 * @param {string | null | undefined} raw
 */
function hostFromUserWebsite(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Registrert nettside-URL er ugyldig.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Registrert nettside-URL må bruke http eller https.');
  }
  return normalizeHost(parsed.hostname);
}

/**
 * @param {string} rawUrl
 * @param {string | null | undefined} userWebsiteUrl
 * @returns {Promise<string>}
 */
export async function assertSafeUserUrl(rawUrl, userWebsiteUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    throw new Error('Mangler URL.');
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Ugyldig URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Kun http- og https-URL-er er tillatt.');
  }

  const port = parsed.port;
  if (port && port !== '80' && port !== '443') {
    throw new Error('Kun standardporter (80 og 443) er tillatt.');
  }

  const allowedHost = hostFromUserWebsite(userWebsiteUrl);
  if (!allowedHost) {
    throw new Error('Du må registrere nettsiden din i onboarding før du kan skanne den.');
  }

  const requestHost = normalizeHost(parsed.hostname);
  if (requestHost !== allowedHost) {
    throw new Error('URL-en må tilhøre nettsiden du har registrert.');
  }

  await assertResolvableHostSafe(parsed.hostname);

  return parsed.href;
}

/**
 * Som assertSafeUserUrl, men UTEN same-site-kravet: samme SSRF-vern
 * (kun http/https, standardporter, ingen private/reserverte nett), for
 * å HEAD/GET-sjekke eksterne lenkemål i ødelagte-lenker-motoren.
 * Skal ALDRI brukes til å hente innhold vi viser kunden — kun status-sjekk.
 * @param {string} rawUrl
 * @returns {Promise<string>}
 */
export async function assertSafePublicUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    throw new Error('Mangler URL.');
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Ugyldig URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Kun http- og https-URL-er er tillatt.');
  }

  const port = parsed.port;
  if (port && port !== '80' && port !== '443') {
    throw new Error('Kun standardporter (80 og 443) er tillatt.');
  }

  await assertResolvableHostSafe(parsed.hostname);

  return parsed.href;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function getUserWebsiteUrl(supabase, userId) {
  const { data, error } = await supabase
    .from('clients')
    .select('website_url')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Kunne ikke hente registrert nettside.');
  }

  return data?.website_url?.trim() || '';
}

/**
 * Server-side fetch med redirect: manual og re-validering av Location.
 * @param {string} validatedUrl — allerede godkjent av assertSafeUserUrl
 * @param {string | null | undefined} userWebsiteUrl
 * @param {RequestInit} [extra]
 */
export async function fetchHtmlSafe(validatedUrl, userWebsiteUrl, extra = {}) {
  let current = validatedUrl;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const signal =
      typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
        : undefined;

    const res = await fetch(current, {
      ...extra,
      redirect: 'manual',
      signal: extra.signal ?? signal,
      headers: { ...DEFAULT_FETCH_HEADERS, ...(extra.headers || {}) },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error('Nettsiden returnerte en omdirigering uten mål-URL.');
      }
      const nextRaw = new URL(location, current).href;
      current = await assertSafeUserUrl(nextRaw, userWebsiteUrl);
      continue;
    }

    return { response: res, finalUrl: current };
  }

  throw new Error('For mange omdirigeringer.');
}

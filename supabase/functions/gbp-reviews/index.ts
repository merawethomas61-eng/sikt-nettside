// gbp-reviews — Google Business Profile: svar på anmeldelser (SCAFFOLD).
//
// STÅR MØRK til (1) Google har godkjent Business Profile API-tilgang for
// prosjektet, (2) en OAuth-klient finnes (GOOGLE_CLIENT_ID/SECRET), og
// (3) GBP_TOKEN_SECRET er satt. Da slår den seg på uten mer bygging.
//
// Handlinger:
//   GET  ?code=…&state=…           → OAuth-callback (Google redirecter hit)
//   POST { action: 'auth-url' }    → returnerer samtykke-URL (bruker-JWT)
//   POST { action: 'status' }      → { connected, configured } (bruker-JWT)
//   POST { action: 'reviews' }     → liste ekte anmeldelser m/ svar-status
//   POST { action: 'reply', reviewId, comment } → publiser svar
//
// MÅ deployes med verify_jwt = false (callback har ingen JWT; POST verifiseres
// manuelt). Redirect-URI som må registreres i Google Cloud:
//   {SUPABASE_URL}/functions/v1/gbp-reviews

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const GBP_TOKEN_SECRET = Deno.env.get('GBP_TOKEN_SECRET') ?? ''; // base64, 32 byte
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://siktseo.com';

const SCOPE = 'https://www.googleapis.com/auth/business.manage';
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/gbp-reviews`;
const CONFIGURED = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GBP_TOKEN_SECRET);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── Krypto (Web Crypto, holdes helt i Deno — krysser aldri til Node) ──
const te = new TextEncoder();
const td = new TextDecoder();
function b64e(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...b));
}
function b64d(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function aesKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64d(GBP_TOKEN_SECRET), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), te.encode(plain));
  return `${b64e(iv)}:${b64e(ct)}`;
}
async function decryptToken(blob: string): Promise<string> {
  const [ivb, ctb] = blob.split(':');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(ivb) }, await aesKey(), b64d(ctb));
  return td.decode(pt);
}
async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64d(GBP_TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signState(userId: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), te.encode(userId));
  return `${userId}.${b64e(sig)}`;
}
async function verifyState(state: string): Promise<string | null> {
  const idx = state.lastIndexOf('.');
  if (idx < 0) return null;
  const userId = state.slice(0, idx);
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), b64d(state.slice(idx + 1)), te.encode(userId));
    return ok ? userId : null;
  } catch { return null; }
}

const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

function redirectTo(path: string) {
  return new Response(null, { status: 302, headers: { Location: `${APP_BASE_URL}${path}` } });
}

// ── OAuth-token-håndtering ──
async function exchangeCode(code: string) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    }),
  });
  if (!resp.ok) throw new Error(`Token-bytte feilet (${resp.status}).`);
  return resp.json();
}
async function refreshToken(refresh: string) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refresh, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) throw new Error(`Token-fornying feilet (${resp.status}).`);
  return resp.json();
}

/** Gyldig access-token (fornyer ved behov og lagrer). */
async function getValidToken(admin: any, conn: any): Promise<string> {
  const expMs = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token_encrypted && expMs > Date.now() + 60_000) {
    return decryptToken(conn.access_token_encrypted);
  }
  if (!conn.refresh_token_encrypted) throw new Error('Mangler refresh-token — koble til på nytt.');
  const refresh = await decryptToken(conn.refresh_token_encrypted);
  const tok = await refreshToken(refresh);
  const access = tok.access_token as string;
  const newExp = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString();
  await admin.from('gbp_connections').update({
    access_token_encrypted: await encryptToken(access),
    token_expires_at: newExp, updated_at: new Date().toISOString(),
  }).eq('user_id', conn.user_id);
  return access;
}

/** Finn (og cache) account + location. */
async function ensureLocation(admin: any, conn: any, accessToken: string): Promise<{ account: string; location: string }> {
  if (conn.account_name && conn.location_name) {
    return { account: conn.account_name, location: conn.location_name };
  }
  const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!accRes.ok) throw new Error(`Fant ikke Google-konto (${accRes.status}).`);
  const account = (await accRes.json())?.accounts?.[0]?.name;
  if (!account) throw new Error('Ingen Google Business-konto på denne brukeren.');

  const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations?readMask=name,title&pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!locRes.ok) throw new Error(`Fant ingen bedriftsplassering (${locRes.status}).`);
  const location = (await locRes.json())?.locations?.[0]?.name;
  if (!location) throw new Error('Ingen bedriftsplassering på kontoen.');

  await admin.from('gbp_connections').update({
    account_name: account, location_name: location, updated_at: new Date().toISOString(),
  }).eq('user_id', conn.user_id);
  return { account, location };
}

async function authedUser(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user } } = await anon.auth.getUser(token);
  return user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // ── OAuth-callback (GET fra Google) ──
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (url.searchParams.get('error')) return redirectTo('/?gbp=denied');
    if (!CONFIGURED || !code || !state) return redirectTo('/?gbp=error');
    const userId = await verifyState(state);
    if (!userId) return redirectTo('/?gbp=error');
    try {
      const tok = await exchangeCode(code);
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const now = new Date().toISOString();
      const row: Record<string, unknown> = {
        user_id: userId,
        access_token_encrypted: await encryptToken(tok.access_token),
        token_expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
        scope: SCOPE, connected_at: now, updated_at: now,
      };
      if (tok.refresh_token) row.refresh_token_encrypted = await encryptToken(tok.refresh_token);
      const { data: existing } = await admin.from('gbp_connections').select('user_id').eq('user_id', userId).maybeSingle();
      if (existing) await admin.from('gbp_connections').update(row).eq('user_id', userId);
      else await admin.from('gbp_connections').insert(row);
      return redirectTo('/?gbp=connected');
    } catch (err) {
      console.error('[gbp-reviews] callback-feil:', (err as Error)?.message);
      return redirectTo('/?gbp=error');
    }
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'Kun POST er tillatt' }, 405);

  const user = await authedUser(req);
  if (!user) return json({ ok: false, error: 'Du er ikke logget inn.' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = body?.action;

  // auth-url + status svarer ærlig selv når det ikke er konfigurert ennå.
  if (action === 'status') {
    if (!CONFIGURED) return json({ ok: true, configured: false, connected: false });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: conn } = await admin.from('gbp_connections')
      .select('user_id, location_name, refresh_token_encrypted').eq('user_id', user.id).maybeSingle();
    return json({ ok: true, configured: true, connected: !!conn?.refresh_token_encrypted, location: conn?.location_name ?? null });
  }

  if (!CONFIGURED) {
    return json({ ok: false, configured: false, error: 'Google Business Profile er ikke konfigurert ennå (kommer).' }, 503);
  }

  if (action === 'auth-url') {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code',
      scope: SCOPE, access_type: 'offline', prompt: 'consent', state: await signState(user.id),
    });
    return json({ ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }

  // Resten krever en lagret tilkobling.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: conn } = await admin.from('gbp_connections').select('*').eq('user_id', user.id).maybeSingle();
  if (!conn?.refresh_token_encrypted) return json({ ok: false, error: 'Google Business Profile er ikke koblet til.' }, 400);

  try {
    const accessToken = await getValidToken(admin, conn);
    const { account, location } = await ensureLocation(admin, conn, accessToken);
    const base = `https://mybusiness.googleapis.com/v4/${account}/${location}`;

    if (action === 'reviews') {
      const res = await fetch(`${base}/reviews?pageSize=20`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Kunne ikke hente anmeldelser (${res.status}).`);
      const data = await res.json();
      const reviews = (data?.reviews ?? []).map((r: any) => ({
        reviewId: r?.reviewId ?? '',
        author: r?.reviewer?.displayName ?? 'Google-bruker',
        rating: STAR[r?.starRating] ?? 0,
        text: r?.comment ?? '',
        when: r?.createTime ?? '',
        reply: r?.reviewReply?.comment ?? null,
      }));
      return json({ ok: true, reviews });
    }

    if (action === 'reply') {
      const reviewId = typeof body?.reviewId === 'string' ? body.reviewId : '';
      const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
      if (!reviewId || !comment) return json({ ok: false, error: 'Mangler anmeldelse eller svartekst.' }, 400);
      const res = await fetch(`${base}/reviews/${reviewId}/reply`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) throw new Error(`Kunne ikke publisere svaret (${res.status}).`);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Ukjent handling.' }, 400);
  } catch (err) {
    console.error('[gbp-reviews] feil:', (err as Error)?.message);
    return json({ ok: false, error: (err as Error)?.message || 'Noe gikk galt mot Google.' }, 502);
  }
});

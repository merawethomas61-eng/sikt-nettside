// google-reviews — leser EKTE Google-data via Places API (New), read-only.
//
// To handlinger (POST, brukerens JWT):
//   { action: 'search', query }  → finn bedriften → [{ placeId, name, address, rating, count }]
//   { action: 'details', placeId? } → snitt + antall + inntil 5 anmeldelser
//
// Krever secret GOOGLE_PLACES_API_KEY. Ingen OAuth. Svar på anmeldelser og
// «svart»-status krever Google Business Profile API (senere) — ikke her.
// Cacher resultatet i review_settings så vi ikke kaller Places ved hver visning.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? '';

const CACHE_FRESH_MS = 6 * 60 * 60 * 1000; // 6 timer

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type NormReview = { author: string; rating: number; text: string; when: string; photo: string | null };

function normalizeReviews(reviews: any[]): NormReview[] {
  if (!Array.isArray(reviews)) return [];
  return reviews.slice(0, 5).map((r) => ({
    author: r?.authorAttribution?.displayName ?? 'Google-bruker',
    rating: typeof r?.rating === 'number' ? r.rating : 0,
    text: r?.text?.text ?? r?.originalText?.text ?? '',
    when: r?.relativePublishTimeDescription ?? '',
    photo: r?.authorAttribution?.photoUri ?? null,
  }));
}

async function placesSearch(query: string) {
  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'no', regionCode: 'NO' }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Places-søk feilet (${resp.status}). ${detail.slice(0, 200)}`);
  }
  const data = await resp.json();
  return (data?.places ?? []).slice(0, 6).map((p: any) => ({
    placeId: p?.id ?? '',
    name: p?.displayName?.text ?? '',
    address: p?.formattedAddress ?? '',
    rating: typeof p?.rating === 'number' ? p.rating : null,
    count: typeof p?.userRatingCount === 'number' ? p.userRatingCount : null,
  })).filter((p: any) => p.placeId);
}

async function placesDetails(placeId: string) {
  const resp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews,displayName,googleMapsUri',
      'Accept-Language': 'no',
    },
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Places-detaljer feilet (${resp.status}). ${detail.slice(0, 200)}`);
  }
  const data = await resp.json();
  return {
    rating: typeof data?.rating === 'number' ? data.rating : null,
    count: typeof data?.userRatingCount === 'number' ? data.userRatingCount : null,
    reviews: normalizeReviews(data?.reviews),
    name: data?.displayName?.text ?? null,
    mapsUri: data?.googleMapsUri ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Kun POST er tillatt' }, 405);

  if (!PLACES_API_KEY) {
    return json({ ok: false, error: 'Google-data er ikke konfigurert (GOOGLE_PLACES_API_KEY mangler).' }, 500);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'Serveren mangler Supabase-konfigurasjon.' }, 500);
  }

  // Innlogget bruker.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'Du er ikke logget inn.' }, 401);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return json({ ok: false, error: 'Ugyldig sesjon.' }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Gating: Standard + Premium (samme som resten av motoren).
  const { data: client } = await admin
    .from('clients').select('package_name').eq('user_id', user.id).maybeSingle();
  if (!/standard|premium/i.test(client?.package_name ?? '')) {
    return json({ ok: false, error: 'Krever Standard eller Premium.' }, 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = body?.action === 'search' ? 'search' : 'details';

  try {
    if (action === 'search') {
      const query = typeof body?.query === 'string' ? body.query.trim() : '';
      if (query.length < 2) return json({ ok: false, error: 'Skriv inn minst to tegn.' }, 400);
      return json({ ok: true, results: await placesSearch(query) });
    }

    // details
    let placeId: string | null = typeof body?.placeId === 'string' ? body.placeId.trim() : null;
    const { data: settings } = await admin
      .from('review_settings')
      .select('google_place_id, cached_rating, cached_count, cached_reviews, cached_at, baseline_count, baseline_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!placeId) placeId = settings?.google_place_id ?? null;
    if (!placeId) return json({ ok: false, error: 'Mangler place-ID. Søk opp bedriften din først.' }, 400);

    // Fersk cache → svar uten å kalle Places (sparer kvote).
    const cachedAt = settings?.cached_at ? new Date(settings.cached_at).getTime() : 0;
    const force = body?.force === true;
    if (!force && cachedAt && Date.now() - cachedAt < CACHE_FRESH_MS && settings?.cached_rating != null) {
      return json({
        ok: true, cached: true,
        rating: settings.cached_rating, count: settings.cached_count,
        reviews: settings.cached_reviews ?? [], updatedAt: settings.cached_at,
        baselineCount: settings.baseline_count ?? null, baselineAt: settings.baseline_at ?? null,
      });
    }

    const details = await placesDetails(placeId);
    const now = new Date().toISOString();
    // Sett nullpunkt første gang vi har et ekte antall (for «+N nye siden start»).
    const setBaseline = settings?.baseline_count == null && details.count != null;
    const update: Record<string, unknown> = {
      cached_rating: details.rating, cached_count: details.count,
      cached_reviews: details.reviews, cached_at: now, updated_at: now,
    };
    if (setBaseline) { update.baseline_count = details.count; update.baseline_at = now; }
    await admin.from('review_settings').update(update).eq('user_id', user.id);

    return json({
      ok: true, cached: false,
      rating: details.rating, count: details.count,
      reviews: details.reviews, updatedAt: now, mapsUri: details.mapsUri,
      baselineCount: setBaseline ? details.count : (settings?.baseline_count ?? null),
      baselineAt: setBaseline ? now : (settings?.baseline_at ?? null),
    });
  } catch (err: any) {
    console.error('[google-reviews] Feil:', err?.message || err);
    return json({ ok: false, error: err?.message || 'Kunne ikke hente Google-data.' }, 502);
  }
});

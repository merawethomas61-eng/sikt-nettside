import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Lett URL-validering for den utloggede gratis-analysen. Google PSI henter
// selve siden (ikke oss), så SSRF-risikoen er minimal — vi avviser bare
// åpenbart interne/ugyldige adresser.
function normalizePublicUrl(raw: string): string {
  let candidate = (raw || '').trim();
  if (!candidate) throw new Error('Mangler URL.');
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error('Ugyldig URL.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Kun http- og https-URL-er er tillatt.');
  }
  const host = parsed.hostname.toLowerCase();
  const blocked =
    host === 'localhost' || host === '0.0.0.0' || host.endsWith('.local') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host);
  if (blocked) throw new Error('URL peker mot et ikke-tillatt nettverk.');
  return parsed.href;
}

// ── On-page-fakta for gratis-analysen ────────────────────────────────────
// Deterministisk uttrekk fra kundens faktiske HTML (det Google ser ved
// første lasting). Ingen ekstern parser-dependency — kun regex/streng — og
// alt er pakket i try/catch hos kalleren, så et mislykket HTML-hent aldri
// kan bryte PSI-resultatet (returnerer da pageFacts: null).
type PageFacts = {
  title: string | null;
  titleLen: number;
  metaDescription: string | null;
  metaLen: number;
  h1Count: number;
  h1Text: string | null;
  imgTotal: number;
  imgMissingAlt: number;
  wordCount: number;
  hasOg: boolean;
  hasSchema: boolean;
  hasViewport: boolean;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&aelig;/gi, 'æ').replace(/&oslash;/gi, 'ø').replace(/&aring;/gi, 'å');
}

function extractFacts(rawHtml: string): PageFacts {
  const html = rawHtml;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : null;

  let metaDescription: string | null = null;
  for (const tag of (html.match(/<meta\b[^>]*>/gi) || [])) {
    if (/name\s*=\s*["']description["']/i.test(tag)) {
      const c = tag.match(/content\s*=\s*["']([\s\S]*?)["']/i);
      if (c) { metaDescription = decodeEntities(c[1].replace(/\s+/g, ' ').trim()); break; }
    }
  }

  const h1s = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1Count = h1s.length;
  const h1Text = h1Count > 0
    ? decodeEntities(h1s[0].replace(/<h1\b[^>]*>/i, '').replace(/<\/h1>/i, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    : null;

  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const imgTotal = imgs.length;
  let imgMissingAlt = 0;
  for (const tag of imgs) {
    const alt = tag.match(/\balt\s*=\s*["']([\s\S]*?)["']/i);
    if (!alt || alt[1].trim() === '') imgMissingAlt++;
  }

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(stripped).replace(/\s+/g, ' ').trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    title, titleLen: title ? title.length : 0,
    metaDescription, metaLen: metaDescription ? metaDescription.length : 0,
    h1Count, h1Text,
    imgTotal, imgMissingAlt,
    wordCount,
    hasOg: /property\s*=\s*["']og:(title|image|description)["']/i.test(html),
    hasSchema: /application\/ld\+json/i.test(html) || /\bitemscope\b/i.test(html),
    hasViewport: /name\s*=\s*["']viewport["']/i.test(html),
  };
}

async function fetchPageFacts(targetUrl: string): Promise<PageFacts | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'SiktBot/1.0 (+https://sikt.no)', 'Accept': 'text/html,application/xhtml+xml' },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;
    if (!/html/i.test(res.headers.get('content-type') || '')) return null;
    let html = await res.text();
    if (html.length > 500_000) html = html.slice(0, 500_000);
    return extractFacts(html);
  } catch (err) {
    console.error('[scan-pagespeed] fetchPageFacts feilet:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('GOOGLE_PAGESPEED_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'PAGESPEED_API_KEY er ikke konfigurert i Supabase Edge Function secrets.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let targetUrl: string | null = null;
  let siteId: string | null = null;
  let userId: string | null = null;
  let mode: string | null = null;
  let email = '';

  try {
    const body = await req.json();
    targetUrl = body.url ?? null;
    siteId = body.site_id ?? null;
    userId = body.user_id ?? null;
    mode = body.mode ?? null;
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return new Response(
      JSON.stringify({ error: 'Ugyldig JSON i request body.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── Utlogget gratis-analyse (forsiden, e-post-gated) ────────────────
  // Kjører FØRST og isolert, før all site/limit-logikk, så den ikke kan
  // påvirke betalende kunders flyt. Returnerer KUN en teaser, aldri full rapport.
  if (mode === 'public') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Ugyldig e-postadresse.' }, 400);
    }
    let publicUrl: string;
    try {
      publicUrl = normalizePublicUrl(targetUrl ?? '');
    } catch (e) {
      return json({ error: (e as Error)?.message || 'URL er ikke tillatt.' }, 400);
    }

    const cats = ['performance', 'seo', 'accessibility', 'best-practices']
      .map((c) => `category=${encodeURIComponent(c)}`).join('&');
    const psi = (strategy: string) =>
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(publicUrl)}&key=${encodeURIComponent(apiKey)}&strategy=${strategy}&${cats}`;

    const [mRes, dRes] = await Promise.all([fetch(psi('mobile')), fetch(psi('desktop'))]);
    if (mRes.status === 429 || dRes.status === 429) {
      return json({ error: 'rate_limited', message: 'For mange forespørsler akkurat nå. Prøv igjen om litt.' }, 429);
    }
    if (!mRes.ok || !dRes.ok) {
      return json({ error: 'Kunne ikke analysere siden. Sjekk at URL-en er riktig.' }, 502);
    }
    const [m, d] = await Promise.all([mRes.json(), dRes.json()]);

    const scoreOf = (cat: any) => (cat && typeof cat.score === 'number' ? Math.round(cat.score * 100) : null);
    const mc = m.lighthouseResult?.categories ?? {};
    const scores = {
      performance: scoreOf(mc.performance),
      seo: scoreOf(mc.seo),
      accessibility: scoreOf(mc.accessibility),
      bestPractices: scoreOf(mc['best-practices']),
    };
    const audits = m.lighthouseResult?.audits ?? {};
    const failing = (Object.values(audits) as any[])
      .filter((a) => a && typeof a.score === 'number' && a.score < 0.9 && a.title)
      .sort((a, b) => a.score - b.score);
    const issueCount = failing.length;
    const topIssues = failing
      .slice(0, 3)
      .map((a) => ({ title: a.title, displayValue: a.displayValue || '' }));

    // On-page-fakta fra kundens faktiske HTML (det Google ser ved første
    // lasting). Isolert: feiler den, faller vi grasiøst tilbake til kun PSI.
    const pageFacts = await fetchPageFacts(publicUrl);

    // Lead-lagring (service-role) — skal aldri blokkere svaret til besøkende.
    try {
      const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await svc.from('audit_leads').insert({
        email,
        url: publicUrl,
        mobile_score: scores.performance,
        desktop_score: scoreOf(d.lighthouseResult?.categories?.performance),
      });
    } catch (err) {
      console.error('[scan-pagespeed] audit_leads insert feilet:', err);
    }

    return json({ teaser: true, url: publicUrl, scores, topIssues, issueCount, pageFacts }, 200);
  }

  // If no direct url, fetch homepage_url from database via site_id
  if (!targetUrl && siteId) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('sites')
      .select('homepage_url')
      .eq('id', siteId)
      .single();

    if (error || !data?.homepage_url) {
      return new Response(
        JSON.stringify({ error: `Fant ikke site med id ${siteId}.` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    targetUrl = data.homepage_url;
  }

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: 'Mangler url eller site_id i request body.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── Plan-grense (server-side håndhevet) ──────────────────────────────
  // Gjelder KUN bruker-initierte kall (user_id satt). System/cron-kall via
  // site_id hoppes over. Vi utleder ekte bruker fra JWT så kvoten ikke kan
  // forfalskes ved å sende et annet user_id; faller tilbake til body ved feil.
  const ANALYSIS_LIMIT_FOR = (pkg: string): number =>
    pkg.includes('premium') ? Infinity : pkg.includes('standard') ? 50 : 10;
  let usage: { used: number; limit: number; month: string } | null = null;
  let enforceUserId: string | null = null;

  if (userId) {
    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') || '';
    try {
      const asUser = createClient(supaUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await asUser.auth.getUser();
      enforceUserId = user?.id ?? userId;
    } catch {
      enforceUserId = userId;
    }

    const svc = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: client } = await svc
      .from('clients')
      .select('package_name, analyses_month, analyses_count')
      .eq('user_id', enforceUserId)
      .maybeSingle();

    const limit = ANALYSIS_LIMIT_FOR((client?.package_name || '').toLowerCase());
    const month = new Date().toISOString().slice(0, 7);
    const used = client?.analyses_month === month ? (client?.analyses_count ?? 0) : 0;

    if (limit !== Infinity && used >= limit) {
      return new Response(
        JSON.stringify({ error: 'analysis_limit_reached', usage: { used, limit, month } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (limit !== Infinity) usage = { used, limit, month };
  }

  const strategies = ['mobile', 'desktop'] as const;
  console.log(`[scan-pagespeed] Starter analyse for: ${targetUrl}`);

  const buildPsiUrl = (strategy: string) => {
    const params = new URLSearchParams({
      url: targetUrl!,
      key: apiKey,
      strategy,
      category: 'performance',
      category: 'seo',
      category: 'accessibility',
      category: 'best-practices',
    });
    // URLSearchParams deduplicates keys — build manually for multi-category
    const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    const cats = ['performance', 'seo', 'accessibility', 'best-practices']
      .map((c) => `category=${encodeURIComponent(c)}`)
      .join('&');
    return `${base}?url=${encodeURIComponent(targetUrl!)}&key=${encodeURIComponent(apiKey)}&strategy=${strategy}&${cats}`;
  };

  const [mobileRes, desktopRes] = await Promise.all(
    strategies.map((strategy) => {
      console.log(`[scan-pagespeed] Kaller Google PSI med strategy=${strategy}`);
      return fetch(buildPsiUrl(strategy));
    }),
  );

  // Surface quota / rate-limit errors directly so App.tsx retry logic kicks in
  if (mobileRes.status === 429 || desktopRes.status === 429) {
    const limitedRes = mobileRes.status === 429 ? mobileRes : desktopRes;
    const retryRaw = limitedRes.headers.get('retry-after');
    const retryAfterSeconds = retryRaw ? Math.max(1, parseInt(retryRaw, 10) || 60) : 60;
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        retryAfterSeconds,
        message: 'For mange forespørsler akkurat nå. Prøv igjen om litt.',
      }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!mobileRes.ok || !desktopRes.ok) {
    const failedRes = !mobileRes.ok ? mobileRes : desktopRes;
    const errBody = await failedRes.json().catch(() => ({}));
    const msg = errBody?.error?.message || `HTTP ${failedRes.status}`;
    return new Response(
      JSON.stringify({ error: msg, detail: errBody }),
      { status: failedRes.status >= 500 ? failedRes.status : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const [mobileData, desktopData] = await Promise.all([mobileRes.json(), desktopRes.json()]);

  // Optionally persist to health_checks when called with site_id
  if (siteId) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const mobileScore = Math.round((mobileData.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
      const desktopScore = Math.round((desktopData.lighthouseResult?.categories?.performance?.score ?? 0) * 100);

      await supabase.from('health_checks').insert({
        site_id: siteId,
        mobile_score: mobileScore,
        desktop_score: desktopScore,
        raw_mobile: mobileData,
        raw_desktop: desktopData,
        checked_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[scan-pagespeed] Kunne ikke lagre til health_checks:', err);
    }
  }

  // Tell opp analysen (kun bruker-initierte kall på begrensede planer).
  if (enforceUserId && usage) {
    try {
      const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const newCount = usage.used + 1;
      await svc.from('clients')
        .update({ analyses_month: usage.month, analyses_count: newCount })
        .eq('user_id', enforceUserId);
      usage = { ...usage, used: newCount };
    } catch (err) {
      console.error('[scan-pagespeed] Kunne ikke telle opp analyse:', err);
    }
  }

  return new Response(
    JSON.stringify({ mobile: mobileData, desktop: desktopData, usage }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

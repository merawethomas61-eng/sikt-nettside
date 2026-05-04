import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  try {
    const body = await req.json();
    targetUrl = body.url ?? null;
    siteId = body.site_id ?? null;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Ugyldig JSON i request body.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
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
    const errBody = await (mobileRes.status === 429 ? mobileRes : desktopRes).json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: errBody?.error?.message || 'quota exceeded' }),
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

  return new Response(
    JSON.stringify({ mobile: mobileData, desktop: desktopData }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

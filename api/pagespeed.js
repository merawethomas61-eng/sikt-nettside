import { createClient } from '@supabase/supabase-js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 10;
const ipTracker = new Map();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Kun POST tillatt' });
    }

    // --- FARTSDUMP ---
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'ukjent-ip';
    const now = Date.now();
    const requestData = ipTracker.get(ip) || { count: 0, firstRequest: now };
    if (now - requestData.firstRequest > rateLimitWindowMs) {
        requestData.count = 1;
        requestData.firstRequest = now;
    } else {
        requestData.count++;
    }
    ipTracker.set(ip, requestData);
    if (requestData.count > maxRequestsPerWindow) {
        return res.status(429).json({ error: 'For mange analyser. Vennligst vent ett minutt.' });
    }

    // --- AUTH ---
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Avvist: Du er ikke logget inn' });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: 'Avvist: Ugyldig bruker' });
    }

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'PAGESPEED_API_KEY mangler på serveren' });
    }

    const { url } = req.body || {};
    if (!url) {
        return res.status(400).json({ error: 'Mangler URL' });
    }

    let formattedUrl = String(url).trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

    try {
        new URL(formattedUrl);
    } catch {
        return res.status(400).json({ error: 'Ugyldig URL' });
    }

    const categories = 'category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES';
    const base = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&${categories}&locale=no&key=${apiKey}`;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchStrategy = async (strategy, attempt = 0) => {
        const url = `${base}&strategy=${strategy}`;
        const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
            ? AbortSignal.timeout(120000)
            : undefined;
        const r = await fetch(url, ctrl ? { signal: ctrl } : {});
        if ((r.status === 429 || r.status >= 500) && attempt < 2) {
            await sleep(1500 * (attempt + 1));
            return fetchStrategy(strategy, attempt + 1);
        }
        return r;
    };

    try {
        let lastDetail = '';
        for (let round = 0; round < 3; round++) {
            if (round > 0) await sleep(2000 * round);

            const [resMobile, resDesktop] = await Promise.all([
                fetchStrategy('mobile'),
                fetchStrategy('desktop'),
            ]);

            if (resMobile.ok && resDesktop.ok) {
                const [mobile, desktop] = await Promise.all([resMobile.json(), resDesktop.json()]);
                return res.status(200).json({ mobile, desktop });
            }

            lastDetail = !resMobile.ok ? await resMobile.text() : await resDesktop.text();
            const status = !resMobile.ok ? resMobile.status : resDesktop.status;
            if (status !== 429 && status < 500) {
                return res.status(502).json({ error: 'PageSpeed feilet', detail: lastDetail.slice(0, 500) });
            }
        }

        return res.status(502).json({ error: 'PageSpeed feilet etter flere forsøk', detail: lastDetail.slice(0, 500) });
    } catch (error) {
        console.error('pagespeed error:', error);
        return res.status(500).json({ error: 'Intern feil ved PageSpeed-analyse' });
    }
}

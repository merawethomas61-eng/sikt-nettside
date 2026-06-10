import { createClient } from '@supabase/supabase-js';
import { assertSafeUserUrl, getUserWebsiteUrl } from './_lib/url-guard.js';
import { withSentry, Sentry } from './_lib/sentry.js';
import {
    fetchExternalWithOptionalRetry429,
    respondRateLimited,
} from './_lib/external-rate-limit.js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 10;
const ipTracker = new Map();

export default withSentry(async function handler(req, res) {
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

    let formattedUrl;
    try {
        const websiteUrl = await getUserWebsiteUrl(supabase, user.id);
        formattedUrl = await assertSafeUserUrl(String(url).trim(), websiteUrl);
    } catch (urlGuardErr) {
        return res.status(400).json({ error: urlGuardErr?.message || 'URL er ikke tillatt.' });
    }

    const categories = 'category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES';
    const base = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&${categories}&locale=no&key=${apiKey}`;

    const fetchStrategy = async (strategy) => {
        const url = `${base}&strategy=${strategy}`;
        const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
            ? AbortSignal.timeout(120000)
            : undefined;
        return fetchExternalWithOptionalRetry429(url, ctrl ? { signal: ctrl } : {});
    };

    try {
        const [resMobile, resDesktop] = await Promise.all([
            fetchStrategy('mobile'),
            fetchStrategy('desktop'),
        ]);

        if (resMobile.status === 429 || resDesktop.status === 429) {
            return respondRateLimited(res, resMobile.status === 429 ? resMobile : resDesktop);
        }

        if (resMobile.ok && resDesktop.ok) {
            const [mobile, desktop] = await Promise.all([resMobile.json(), resDesktop.json()]);
            return res.status(200).json({ mobile, desktop });
        }

        const failedRes = !resMobile.ok ? resMobile : resDesktop;
        const lastDetail = await failedRes.text();
        if (failedRes.status < 500) {
            return res.status(502).json({ error: 'PageSpeed feilet', detail: lastDetail.slice(0, 500) });
        }

        return res.status(502).json({ error: 'PageSpeed feilet', detail: lastDetail.slice(0, 500) });
    } catch (error) {
        console.error('pagespeed error:', error);
        Sentry.captureException(error);
        return res.status(500).json({ error: 'Intern feil ved PageSpeed-analyse' });
    }
});

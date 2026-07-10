import { createClient } from '@supabase/supabase-js';
import { assertSafeUserUrl } from './_lib/url-guard.js';
import { crawlSite } from './_lib/site-scan.js';
import { withSentry, Sentry } from './_lib/sentry.js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 5;
const ipTracker = new Map();

export default withSentry(async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Kun POST tillatt' });
    }

    // --- FARTSDUMP START ---
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'ukjent-ip';
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
        return res.status(429).json({ error: 'For mange skanninger. Vennligst vent ett minutt.' });
    }
    // --- FARTSDUMP SLUTT ---

    // --- ID-KORT SJEKK START ---
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Avvist: Du er ikke logget inn' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return res.status(401).json({ error: 'Avvist: Ugyldig bruker' });
    }
    // --- ID-KORT SJEKK SLUTT ---

    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Mangler URL' });

    const { data: clientRow, error: clientErr } = await supabase
        .from('clients')
        .select('website_url')
        .eq('user_id', user.id)
        .maybeSingle();

    if (clientErr) {
        return res.status(500).json({ error: 'Kunne ikke hente registrert nettside.' });
    }

    const websiteUrl = typeof clientRow?.website_url === 'string' ? clientRow.website_url.trim() : '';
    if (!websiteUrl) {
        return res.status(400).json({
            error: 'Du må registrere nettsiden din i onboarding før du kan skanne den.',
        });
    }

    let safeStartUrl;
    try {
        safeStartUrl = await assertSafeUserUrl(url, websiteUrl);
    } catch (urlGuardErr) {
        return res.status(400).json({ error: urlGuardErr?.message || 'URL er ikke tillatt.' });
    }

    try {
        // Selve crawlen bor i _lib/site-scan.js og deles med den ukentlige
        // cron-skanningen (job=site_scan). Respons-formen er uendret.
        const { pages } = await crawlSite({ startUrl: safeStartUrl, websiteUrl });

        res.status(200).json({ pages });

    } catch (error) {
        console.error("Scraper Error:", error);
        Sentry.captureException(error);
        res.status(500).json({ error: 'Klarte ikke skanne nettsiden', details: error.message });
    }
});
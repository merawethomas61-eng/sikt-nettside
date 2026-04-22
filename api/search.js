import { createClient } from '@supabase/supabase-js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 5;
const ipTracker = new Map();

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Kun POST er tillatt' });
    }

    // --- FARTSDUMP START ---
    const ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress || 'ukjent-ip';
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
        return response.status(429).json({ error: 'For mange søk. Vennligst vent ett minutt.' });
    }
    // --- FARTSDUMP SLUTT ---

    // --- ID-KORT SJEKK START ---
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return response.status(401).json({ error: 'Avvist: Du er ikke logget inn' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return response.status(401).json({ error: 'Avvist: Ugyldig bruker' });
    }
    // --- ID-KORT SJEKK SLUTT ---

    const { keyword, location } = request.body;

    if (!keyword || !location) {
        return response.status(400).json({ error: 'Mangler søkeord eller sted' });
    }

    const apiKey = process.env.SERP_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'Mangler API-nøkkel på serveren' });
    }

    try {
        const targetUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&google_domain=google.no&gl=no&hl=no&location=${encodeURIComponent(location + ", Norway")}&num=20&device=desktop&api_key=${apiKey}`;

        const res = await fetch(targetUrl);
        const data = await res.json();

        return response.status(200).json(data);

    } catch (error) {
        return response.status(500).json({ error: 'Noe gikk galt på serveren', details: error.message });
    }
}
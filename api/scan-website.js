import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 5;
const ipTracker = new Map();

export default async function handler(req, res) {
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return res.status(401).json({ error: 'Avvist: Ugyldig bruker' });
    }
    // --- ID-KORT SJEKK SLUTT ---

    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Mangler URL' });

    if (!url.startsWith('http')) url = 'https://' + url;

    try {
        const baseUrl = new URL(url).origin;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Nettsiden svarte ikke: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const internalLinks = new Set();
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.startsWith('/') || href.startsWith(baseUrl))) {
                const fullUrl = href.startsWith('/') ? `${baseUrl}${href}` : href;
                if (!fullUrl.includes('#') && !fullUrl.includes('mailto:')) {
                    internalLinks.add(fullUrl);
                }
            }
        });

        const pagesToScan = [url, ...Array.from(internalLinks)].slice(0, 15);
        const scannedPages = [];

        for (const targetUrl of pagesToScan) {
            try {
                const pageRes = await fetch(targetUrl);
                if (!pageRes.ok) continue;
                const pageHtml = await pageRes.text();
                const page$ = cheerio.load(pageHtml);

                const title = page$('title').text() || targetUrl;
                const textContent = page$('body').text().replace(/\s+/g, ' ').trim();
                const wordCount = textContent.split(' ').length;
                const pageLinks = page$('a').length;

                let status = 'Bra';
                let score = 100;
                let issues = [];

                if (wordCount < 300) {
                    status = 'Advarsel';
                    score -= 20;
                    issues.push('Tynt innhold (< 300 ord)');
                }
                if (!page$('meta[name="description"]').attr('content')) {
                    status = 'Kritisk';
                    score -= 30;
                    issues.push('Mangler meta description');
                }
                if (page$('h1').length === 0) {
                    status = 'Kritisk';
                    score -= 25;
                    issues.push('Mangler H1-tag');
                }

                if (status === 'Advarsel') score -= 10;
                if (status === 'Kritisk') score -= 45;

                const path = targetUrl === baseUrl ? '/' : targetUrl.replace(baseUrl, '');

                scannedPages.push({
                    url: path,
                    fullUrl: targetUrl,
                    title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
                    wordCount,
                    status,
                    score,
                    issues,
                    inlinks: Math.floor(Math.random() * 10) + 1,
                    outlinks: pageLinks,
                    linkScore: score,
                    brokenLinks: 0,
                    readability: wordCount > 600 ? 'Middels' : 'Enkel',
                    topicCluster: 'Generell',
                    action: status === 'Bra' ? 'Fungerer optimalt' : 'Krever optimalisering',
                    lastUpdated: new Date().toLocaleDateString('no-NO')
                });
            } catch (err) {
                console.error(`Feil ved skanning av ${targetUrl}:`, err);
            }
        }

        res.status(200).json({ pages: scannedPages });

    } catch (error) {
        console.error("Scraper Error:", error);
        res.status(500).json({ error: 'Klarte ikke skanne nettsiden', details: error.message });
    }
}
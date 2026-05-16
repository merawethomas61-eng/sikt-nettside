/**
 * GET /api/cron-scan-competitors
 *
 * Kjøres automatisk av Vercel Cron (se vercel.json).
 * Skanner alle konkurrenter som er klare for skann basert på
 * deres scan_frequency-innstilling.
 *
 * Sikret med CRON_SECRET så kun Vercel kan trigge den.
 *
 * Plasser denne i: api/cron-scan-competitors.js
 */

import { createClient } from '@supabase/supabase-js';
import { detectSitemapChanges, detectRankingChanges } from './_lib/competitor-monitor.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const MAX_KEYWORDS_PER_SCAN = 20;
// Begrens hvor mange konkurrenter vi skanner per cron-kjøring
// (Vercel har 60s timeout på Hobby, 300s på Pro)
const MAX_COMPETITORS_PER_RUN = 15;

function frequencyToHours(freq) {
    if (freq === 'daily') return 20;          // ~1 dag
    if (freq === 'every_3_days') return 68;   // ~3 dager
    return 160;                                // weekly (~7 dager, med litt slack)
}

async function generateKeywordsForDomain(domain) {
    if (!ANTHROPIC_API_KEY) return [];
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 800,
                messages: [{
                    role: 'user',
                    content: `Analyser nettstedet "${domain}" og generer 20 relevante norske SEO-søkeord som dette nettstedet sannsynligvis rangerer på i Google Norge. Inkluder bransje-søkeord, lokasjons-søkeord, produkter/tjenester, long-tail spørsmål, og pris-relaterte søkeord. Returner KUN en gyldig JSON-array med 20 norske søkeord. Ingen forklaring, kun JSON. Eksempel: ["søkeord 1", "søkeord 2"]`,
                }],
            }),
        });
        if (!response.ok) return [];
        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\[[\s\S]*?\]/);
        if (!match) return [];
        const keywords = JSON.parse(match[0]);
        if (!Array.isArray(keywords)) return [];
        return [...new Set(
            keywords.filter(k => typeof k === 'string')
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0 && k.length < 80)
        )];
    } catch {
        return [];
    }
}

async function scanOneCompetitor(supabase, competitor) {
    const competitorDomain = competitor.domain.replace(/^www\./i, '').toLowerCase();

    // AI-søkeord
    const aiKeywords = await generateKeywordsForDomain(competitor.domain);

    // Brukerens søkeord
    const { data: userKeywordsRaw } = await supabase
        .from('user_keywords')
        .select('keyword, location')
        .eq('user_id', competitor.user_id);

    const userKeywords = userKeywordsRaw || [];
    const userKwSet = new Set(userKeywords.map(k => k.keyword.toLowerCase()));

    const allKeywords = [
        ...aiKeywords.filter(k => !userKwSet.has(k)).map(k => ({ keyword: k, location: 'Norway' })),
        ...userKeywords,
    ].slice(0, MAX_KEYWORDS_PER_SCAN);

    const results = [];

    for (const kw of allKeywords) {
        try {
            const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(kw.keyword)}&google_domain=google.no&gl=no&hl=no&location=${encodeURIComponent((kw.location || 'Norway') + ', Norway')}&num=20&device=desktop&api_key=${SERP_API_KEY}`;
            const serpRes = await fetch(serpUrl);
            if (!serpRes.ok) continue;
            const serpData = await serpRes.json();
            const organic = serpData.organic_results || [];

            let pos = null, url = '';
            for (const r of organic) {
                try {
                    const h = new URL(r.link || '').hostname.replace(/^www\./i, '').toLowerCase();
                    if (h === competitorDomain || h.endsWith('.' + competitorDomain)) {
                        pos = r.position;
                        url = r.link || '';
                        break;
                    }
                } catch { /* ignore */ }
            }
            if (pos == null) continue;

            results.push({
                competitor_id: competitor.id,
                keyword: kw.keyword,
                position: pos,
                url,
                checked_at: new Date().toISOString(),
            });
        } catch { /* ignore enkelt-søkeord */ }
    }

    // Rangeringsendringer (FØR vi upserter de nye)
    let rankingChanges = { changes: [] };
    if (results.length > 0) {
        try {
            rankingChanges = await detectRankingChanges(supabase, competitor, results);
        } catch (e) {
            console.warn(`[cron] Rangeringsendring feilet for ${competitor.domain}:`, e.message);
        }
    }

    // Sitemap-endringer
    let sitemapResult = { newPages: [], removedPages: [], sitemapFound: false };
    try {
        sitemapResult = await detectSitemapChanges(supabase, competitor);
    } catch (e) {
        console.warn(`[cron] Sitemap feilet for ${competitor.domain}:`, e.message);
    }

    // Lagre rangeringer
    if (results.length > 0) {
        await supabase
            .from('competitor_keyword_rankings')
            .upsert(results, { onConflict: 'competitor_id,keyword' });

        const avgPos = results.reduce((a, r) => a + r.position, 0) / results.length;
        await supabase
            .from('competitors')
            .update({
                avg_position: Math.round(avgPos * 10) / 10,
                keyword_count: results.length,
                last_scanned_at: new Date().toISOString(),
            })
            .eq('id', competitor.id);
    } else {
        await supabase
            .from('competitors')
            .update({ last_scanned_at: new Date().toISOString() })
            .eq('id', competitor.id);
    }

    return {
        domain: competitor.domain,
        rankings: results.length,
        newPages: sitemapResult.newPages?.length || 0,
        removedPages: sitemapResult.removedPages?.length || 0,
        rankingChanges: rankingChanges.changes?.length || 0,
    };
}

export default async function handler(req, res) {
    // --- Sikkerhet: kun Vercel Cron eller med riktig secret ---
    const authHeader = req.headers.authorization;
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Uautorisert' });
    }

    if (!SUPABASE_SERVICE_KEY || !SERP_API_KEY) {
        return res.status(500).json({ error: 'Server-konfigurasjon mangler' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // --- Hent konkurrenter som er klare for skann ---
    const { data: competitors, error } = await supabase
        .from('competitors')
        .select('id, domain, user_id, scan_frequency, auto_scan_enabled, last_scanned_at');

    if (error) {
        return res.status(500).json({ error: 'Kunne ikke hente konkurrenter', detail: error.message });
    }

    const now = Date.now();
    const due = (competitors || []).filter(c => {
        if (c.auto_scan_enabled === false) return false;
        if (!c.last_scanned_at) return true; // aldri skannet → skann nå
        const hoursSince = (now - new Date(c.last_scanned_at).getTime()) / 36e5;
        return hoursSince >= frequencyToHours(c.scan_frequency || 'weekly');
    }).slice(0, MAX_COMPETITORS_PER_RUN);

    if (due.length === 0) {
        return res.status(200).json({ message: 'Ingen konkurrenter klare for skann.', scanned: 0 });
    }

    const summary = [];
    for (const competitor of due) {
        try {
            const result = await scanOneCompetitor(supabase, competitor);
            summary.push(result);
        } catch (e) {
            console.error(`[cron] Skann feilet for ${competitor.domain}:`, e.message);
            summary.push({ domain: competitor.domain, error: e.message });
        }
    }

    return res.status(200).json({
        message: `Skannet ${summary.length} konkurrenter.`,
        scanned: summary.length,
        results: summary,
    });
}
/**
 * POST /api/scan-competitor
 * Body: { competitor_id: string }
 *
 * FASE 1+2+3 KOMPLETT:
 * 1. Henter konkurrenten fra Supabase.
 * 2. AI (Claude) genererer 20 relevante søkeord.
 * 3. Henter brukerens egne søkeord også.
 * 4. Sjekker konkurrentens posisjon via SerpAPI.
 * 5. NYTT: Henter sitemap → oppdager nye/fjernede sider.
 * 6. NYTT: Sammenligner rangeringer → oppdager nye søkeord/posisjonsendringer.
 * 7. Lagrer alt + lager varsler i competitor_changes.
 */

import { createClient } from '@supabase/supabase-js';
import { detectSitemapChanges, detectRankingChanges } from './_lib/competitor-monitor.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const MAX_KEYWORDS_PER_SCAN = 20;

function estimateDifficulty(competitorPos) {
    if (competitorPos <= 3) return 'hard';
    if (competitorPos <= 10) return 'medium';
    return 'easy';
}

function estimateTraffic(searchVolume, targetPos) {
    const ctr = targetPos <= 1 ? 0.28 : targetPos <= 3 ? 0.15 : targetPos <= 5 ? 0.08 : 0.04;
    return Math.round((searchVolume || 100) * ctr);
}

function buildRecommendationText(keyword, recType) {
    if (recType === 'faq') return `Lag en FAQ-seksjon som svarer på «${keyword}» — lavt innsats, høy relevans.`;
    if (recType === 'expand_existing') return `Utvid eksisterende innhold med en dedikert seksjon om «${keyword}».`;
    return `Lag en ny side optimalisert for «${keyword}» med 800–1200 ord og strukturerte data.`;
}

function guessRecommendationType(keyword) {
    if (/^(hva|how|hvad|was|what|why|hvorfor|when)\b/i.test(keyword)) return 'faq';
    if (keyword.split(/\s+/).length <= 2) return 'new_page';
    return 'expand_existing';
}

function parseJsonBody(req) {
    const raw = req.body;
    if (raw == null) return {};
    if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    if (Buffer.isBuffer(raw)) {
        try { return JSON.parse(raw.toString('utf8')); } catch { return {}; }
    }
    return {};
}

async function generateKeywordsForDomain(domain) {
    if (!ANTHROPIC_API_KEY) {
        console.warn('[generateKeywords] ANTHROPIC_API_KEY mangler');
        return [];
    }

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
                    content: `Analyser nettstedet "${domain}" og generer 20 relevante norske SEO-søkeord som dette nettstedet sannsynligvis rangerer på i Google Norge.

Inkluder en blanding av: generelle bransje-søkeord, lokasjons-baserte søkeord, spesifikke produkter/tjenester, long-tail spørsmål, og pris/medlemskap-relaterte søkeord.

Returner KUN en gyldig JSON-array med 20 søkeord på norsk. Ingen forklaring, ingen markdown, kun JSON-arrayen.

Eksempel: ["søkeord 1", "søkeord 2", "søkeord 3"]`,
                }],
            }),
        });

        if (!response.ok) {
            console.warn('[generateKeywords] Claude API feil:', response.status);
            return [];
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\[[\s\S]*?\]/);
        if (!match) return [];

        const keywords = JSON.parse(match[0]);
        if (!Array.isArray(keywords)) return [];

        return [...new Set(
            keywords
                .filter(k => typeof k === 'string')
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0 && k.length < 80)
        )];
    } catch (err) {
        console.warn('[generateKeywords] Feil:', err.message);
        return [];
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Kun POST er tillatt' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Avvist: ikke logget inn' });
    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Ugyldig bruker' });

    if (!SERP_API_KEY) return res.status(500).json({ error: 'SERP_API_KEY mangler på serveren' });
    if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler' });

    const body = parseJsonBody(req);
    const { competitor_id } = body;
    if (!competitor_id) return res.status(400).json({ error: 'Mangler competitor_id' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // --- 1. Hent konkurrenten ---
    const { data: competitor, error: compErr } = await supabase
        .from('competitors')
        .select('id, domain, user_id')
        .eq('id', competitor_id)
        .eq('user_id', user.id)
        .maybeSingle();

    if (compErr || !competitor) {
        return res.status(404).json({ error: 'Konkurrent ikke funnet' });
    }

    // --- 2. AI-søkeord ---
    const aiKeywords = await generateKeywordsForDomain(competitor.domain);

    // --- 3. Brukerens søkeord ---
    const { data: userKeywordsRaw } = await supabase
        .from('user_keywords')
        .select('keyword, location, keyword_data')
        .eq('user_id', user.id);

    const userKeywords = userKeywordsRaw || [];
    const userKeywordStrings = new Set(userKeywords.map(k => k.keyword.toLowerCase()));

    const aiKeywordObjs = aiKeywords
        .filter(k => !userKeywordStrings.has(k))
        .map(k => ({ keyword: k, location: 'Norway', keyword_data: null, _source: 'ai' }));

    const userKeywordObjs = userKeywords.map(k => ({ ...k, _source: 'user' }));
    const allKeywords = [...aiKeywordObjs, ...userKeywordObjs].slice(0, MAX_KEYWORDS_PER_SCAN);

    if (allKeywords.length === 0) {
        return res.status(200).json({
            message: 'Kunne ikke generere søkeord. Sjekk at ANTHROPIC_API_KEY er satt i Vercel.',
            scanned: 0,
        });
    }

    const results = [];
    const gapOpportunities = [];
    const competitorDomain = competitor.domain.replace(/^www\./i, '').toLowerCase();

    // --- 4. SerpAPI-sjekk ---
    for (const kw of allKeywords) {
        const keyword = kw.keyword;
        const location = kw.location || 'Norway';

        try {
            const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&google_domain=google.no&gl=no&hl=no&location=${encodeURIComponent(location + ', Norway')}&num=20&device=desktop&api_key=${SERP_API_KEY}`;
            const serpRes = await fetch(serpUrl);
            if (!serpRes.ok) continue;
            const serpData = await serpRes.json();
            const organicResults = serpData.organic_results || [];

            let competitorPos = null;
            let competitorUrl = '';
            for (const r of organicResults) {
                try {
                    const rHost = new URL(r.link || '').hostname.replace(/^www\./i, '').toLowerCase();
                    if (rHost === competitorDomain || rHost.endsWith('.' + competitorDomain)) {
                        competitorPos = r.position;
                        competitorUrl = r.link || '';
                        break;
                    }
                } catch { /* ignore */ }
            }

            if (competitorPos == null) continue;

            results.push({
                competitor_id: competitor.id,
                keyword,
                position: competitorPos,
                url: competitorUrl,
                checked_at: new Date().toISOString(),
            });

            if (kw._source === 'user') {
                const userPos = kw.keyword_data?.position ?? null;
                if (competitorPos <= 20 && (userPos == null || userPos > competitorPos + 3)) {
                    const recType = guessRecommendationType(keyword);
                    const searchVolume = kw.keyword_data?.competition || 100;
                    gapOpportunities.push({
                        user_id: user.id,
                        keyword,
                        search_volume: searchVolume,
                        difficulty: estimateDifficulty(competitorPos),
                        recommendation_type: recType,
                        recommendation_text: buildRecommendationText(keyword, recType),
                        estimated_traffic: estimateTraffic(searchVolume, Math.max(1, competitorPos - 2)),
                        competitor_ids: [competitor.id],
                        discovered_at: new Date().toISOString(),
                    });
                }
            }
        } catch (err) {
            console.warn(`[scan-competitor] SerpAPI feil for "${keyword}":`, err.message);
        }
    }

    // --- 5. NYTT: Sitemap-endringer (kjøres uansett om rangeringer ble funnet) ---
    let sitemapResult = { newPages: [], removedPages: [], sitemapFound: false };
    try {
        sitemapResult = await detectSitemapChanges(supabase, competitor);
    } catch (err) {
        console.warn('[scan-competitor] Sitemap-sjekk feilet:', err.message);
    }

    // --- 6. NYTT: Rangeringsendringer (sammenlign med forrige skann) ---
    let rankingChanges = { changes: [] };
    if (results.length > 0) {
        try {
            rankingChanges = await detectRankingChanges(supabase, competitor, results);
        } catch (err) {
            console.warn('[scan-competitor] Rangeringsendring feilet:', err.message);
        }
    }

    // --- 7. Lagre rangeringer ---
    if (results.length > 0) {
        await supabase
            .from('competitor_keyword_rankings')
            .upsert(results, { onConflict: 'competitor_id,keyword' });

        const avgPos = results.reduce((acc, r) => acc + r.position, 0) / results.length;
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

    // --- 8. Gap-muligheter ---
    if (gapOpportunities.length > 0) {
        await supabase
            .from('keyword_opportunities')
            .upsert(gapOpportunities, { onConflict: 'user_id,keyword' })
            .catch((e) => console.warn('[scan-competitor] Opportunity feil:', e.message));
    }

    // --- Bygg svar-melding ---
    const parts = [];
    if (results.length > 0) {
        parts.push(`Fant ${results.length} rangeringer`);
    }
    if (sitemapResult.sitemapFound) {
        if (sitemapResult.isFirstScan) {
            parts.push(`registrerte ${sitemapResult.totalPages} sider`);
        } else if (sitemapResult.newPages.length > 0) {
            parts.push(`${sitemapResult.newPages.length} nye sider`);
        }
    }
    if (gapOpportunities.length > 0) {
        parts.push(`${gapOpportunities.length} gap-muligheter`);
    }

    const message = parts.length > 0
        ? `Skann fullført: ${parts.join(', ')}.`
        : 'Skann fullført, men ingen rangeringer funnet enda.';

    return res.status(200).json({
        message,
        scanned: results.length,
        ai_keywords_generated: aiKeywordObjs.length,
        opportunities: gapOpportunities.length,
        sitemap_found: sitemapResult.sitemapFound,
        new_pages: sitemapResult.newPages?.length || 0,
        removed_pages: sitemapResult.removedPages?.length || 0,
        ranking_changes: rankingChanges.changes?.length || 0,
    });
}
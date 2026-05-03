/**
 * POST /api/scan-competitor
 * Body: { competitor_id: string }
 *
 * 1. Henter konkurrenten fra Supabase (domain + user_id).
 * 2. Henter brukerens sporede søkeord fra user_keywords.
 * 3. Sjekker konkurrentens posisjon på hvert søkeord via SerpAPI.
 * 4. Lagrer/oppdaterer competitor_keyword_rankings.
 * 5. Oppdaterer avg_position + keyword_count + last_scanned_at på competitors.
 * 6. Gap-analyse: finner søkeord der konkurrenten rangerer bedre enn brukeren
 *    og lagrer dem i keyword_opportunities.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;

// Maks antall søkeord vi sjekker per scan (begrenser SerpAPI-kvoter)
const MAX_KEYWORDS_PER_SCAN = 10;

function estimateDifficulty(competitorPos) {
    if (competitorPos <= 3) return 'hard';
    if (competitorPos <= 10) return 'medium';
    return 'easy';
}

function estimateTraffic(searchVolume, targetPos) {
    // CTR-kurve: pos 1=0.28, pos 3=0.10, pos 5=0.05, pos 10=0.02
    const ctr = targetPos <= 1 ? 0.28 : targetPos <= 3 ? 0.15 : targetPos <= 5 ? 0.08 : 0.04;
    return Math.round((searchVolume || 100) * ctr);
}

function buildRecommendationText(keyword, recType) {
    if (recType === 'faq') return `Lag en FAQ-seksjon som svarer på «${keyword}» — lavt innsats, høy relevans.`;
    if (recType === 'expand_existing') return `Utvid eksisterende innhold med en dedikert seksjon om «${keyword}».`;
    return `Lag en ny side optimalisert for «${keyword}» med 800–1200 ord og strukturerte data.`;
}

function guessRecommendationType(keyword) {
    if (/^(hva|how|hvad|was|what|why|hvorfor|when|when)\b/i.test(keyword)) return 'faq';
    if (keyword.split(/\s+/).length <= 2) return 'new_page';
    return 'expand_existing';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Kun POST er tillatt' });
    }

    // --- AUTH ---
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Avvist: ikke logget inn' });
    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Ugyldig bruker' });

    if (!SERP_API_KEY) return res.status(500).json({ error: 'SERP_API_KEY mangler på serveren' });
    if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });

    const { competitor_id } = req.body || {};
    if (!competitor_id) return res.status(400).json({ error: 'Mangler competitor_id' });

    // Service-role klient for å skrive til competitor_keyword_rankings
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // --- 1. Hent konkurrenten (validerer at den tilhører brukeren) ---
    const { data: competitor, error: compErr } = await supabase
        .from('competitors')
        .select('id, domain, user_id')
        .eq('id', competitor_id)
        .eq('user_id', user.id)
        .single();

    if (compErr || !competitor) {
        return res.status(404).json({ error: 'Konkurrent ikke funnet' });
    }

    // --- 2. Hent brukerens søkeord ---
    const { data: userKeywords } = await supabase
        .from('user_keywords')
        .select('keyword, location, keyword_data')
        .eq('user_id', user.id)
        .limit(MAX_KEYWORDS_PER_SCAN);

    if (!userKeywords || userKeywords.length === 0) {
        return res.status(200).json({
            message: 'Ingen søkeord å sjekke. Legg til søkeord under Søkeord-fanen først.',
            scanned: 0,
        });
    }

    const results = [];
    const gapOpportunities = [];
    const competitorDomain = competitor.domain.replace(/^www\./i, '').toLowerCase();

    // --- 3. SerpAPI-sjekk for hvert søkeord ---
    for (const kw of userKeywords) {
        const keyword = kw.keyword;
        const location = kw.location || 'Norway';

        try {
            const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&google_domain=google.no&gl=no&hl=no&location=${encodeURIComponent(location + ', Norway')}&num=20&device=desktop&api_key=${SERP_API_KEY}`;
            const serpRes = await fetch(serpUrl);
            if (!serpRes.ok) continue;
            const serpData = await serpRes.json();

            const organicResults = serpData.organic_results || [];

            // Finn konkurrentens posisjon
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

            if (competitorPos == null) continue; // Konkurrenten ranker ikke på dette søkeordet

            results.push({
                competitor_id: competitor.id,
                keyword,
                position: competitorPos,
                url: competitorUrl,
                checked_at: new Date().toISOString(),
            });

            // Finn brukerens posisjon fra eksisterende keyword_data
            const userPos = kw.keyword_data?.position ?? null;

            // Gap-analyse: konkurrenten rangerer på topp 20, brukeren er dårligere eller ikke der
            if (competitorPos <= 20 && (userPos == null || userPos > competitorPos + 3)) {
                const recType = guessRecommendationType(keyword);
                const searchVolume = kw.keyword_data?.competition || 100; // proxy for volume
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
        } catch (err) {
            console.warn(`[scan-competitor] SerpAPI feil for "${keyword}":`, err.message);
        }
    }

    if (results.length === 0) {
        // Oppdater last_scanned_at selv om ingen rangeringer ble funnet
        await supabase.from('competitors').update({ last_scanned_at: new Date().toISOString() }).eq('id', competitor.id);
        return res.status(200).json({ message: 'Konkurrenten rangerer ikke på noen av dine søkeord enda.', scanned: 0 });
    }

    // --- 4. Lagre/oppdater competitor_keyword_rankings (upsert på keyword) ---
    await supabase
        .from('competitor_keyword_rankings')
        .upsert(results, { onConflict: 'competitor_id,keyword' });

    // --- 5. Oppdater competitors: avg_position, keyword_count, last_scanned_at ---
    const avgPos = results.reduce((acc, r) => acc + r.position, 0) / results.length;
    await supabase
        .from('competitors')
        .update({
            avg_position: Math.round(avgPos * 10) / 10,
            keyword_count: results.length,
            last_scanned_at: new Date().toISOString(),
        })
        .eq('id', competitor.id);

    // --- 6. Lagre gap-muligheter (upsert på user_id + keyword) ---
    if (gapOpportunities.length > 0) {
        await supabase
            .from('keyword_opportunities')
            .upsert(gapOpportunities, { onConflict: 'user_id,keyword' })
            .catch((e) => console.warn('[scan-competitor] Opportunity upsert feil:', e.message));
    }

    return res.status(200).json({
        message: `Skannet ${results.length} søkeord. Fant ${gapOpportunities.length} gap-muligheter.`,
        scanned: results.length,
        opportunities: gapOpportunities.length,
    });
}

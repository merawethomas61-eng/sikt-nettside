/**
 * POST /api/scan-competitor
 * Body: { competitor_id: string }
 *
 * NY LOGIKK (med AI auto-oppdaging):
 * 1. Henter konkurrenten fra Supabase (domain + user_id).
 * 2. AI (Claude) genererer 20 relevante søkeord basert på konkurrentens domene.
 * 3. Henter brukerens egne søkeord også.
 * 4. Kombinerer alle (deduper).
 * 5. Sjekker konkurrentens posisjon på hvert søkeord via SerpAPI.
 * 6. Lagrer/oppdaterer competitor_keyword_rankings.
 * 7. Oppdaterer avg_position + keyword_count + last_scanned_at.
 * 8. Gap-analyse: finner søkeord der konkurrenten rangerer bedre enn brukeren.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Maks antall søkeord vi sjekker per scan (begrenser SerpAPI-kvoter)
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
    if (/^(hva|how|hvad|was|what|why|hvorfor|when|when)\b/i.test(keyword)) return 'faq';
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

/**
 * NY FUNKSJON: Generer relevante søkeord for konkurrentens domene via Claude AI.
 * Returnerer en liste med 20 norske søkeord som domenet sannsynligvis rangerer på.
 */
async function generateKeywordsForDomain(domain) {
    if (!ANTHROPIC_API_KEY) {
        console.warn('[generateKeywords] ANTHROPIC_API_KEY mangler — hopper over AI-generering');
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

Tenk gjennom:
- Hva slags bedrift/bransje er dette?
- Hva er deres produkter/tjenester?
- Hva ville norske kunder søke etter for å finne dem?

Inkluder en blanding av:
- Generelle søkeord i bransjen (f.eks. "treningssenter")
- Lokasjons-baserte søkeord (f.eks. "gym oslo")
- Spesifikke produkter/tjenester (f.eks. "personlig trener")
- Long-tail spørsmål (f.eks. "beste treningssenter i oslo")
- Pris/medlemskap-relaterte (f.eks. "gym medlemskap pris")

Returner KUN en gyldig JSON-array med 20 søkeord på norsk. Ingen forklaring, ingen markdown-formatering, kun JSON-arrayen.

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

        // Hent ut JSON-array fra svaret (selv om Claude legger til ekstra tekst)
        const match = text.match(/\[[\s\S]*?\]/);
        if (!match) {
            console.warn('[generateKeywords] Fant ikke JSON-array i Claude-svaret');
            return [];
        }

        const keywords = JSON.parse(match[0]);
        if (!Array.isArray(keywords)) return [];

        // Filtrer ut bare strenger, trim, dedup
        const cleaned = [...new Set(
            keywords
                .filter(k => typeof k === 'string')
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0 && k.length < 80)
        )];

        console.log(`[generateKeywords] Genererte ${cleaned.length} søkeord for ${domain}`);
        return cleaned;
    } catch (err) {
        console.warn('[generateKeywords] Feil:', err.message);
        return [];
    }
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
        console.error('[scan-competitor] Konkurrent-lookup feilet', {
            competitor_id, authUserId: user.id, supabaseMsg: compErr?.message,
        });
        return res.status(404).json({ error: 'Konkurrent ikke funnet' });
    }

    // --- 2. Generer AI-søkeord for konkurrentens domene (NYTT!) ---
    const aiKeywords = await generateKeywordsForDomain(competitor.domain);

    // --- 3. Hent brukerens egne søkeord ---
    const { data: userKeywordsRaw } = await supabase
        .from('user_keywords')
        .select('keyword, location, keyword_data')
        .eq('user_id', user.id);

    const userKeywords = userKeywordsRaw || [];

    // --- 4. Kombiner: AI-søkeord + brukerens søkeord (deduper) ---
    const userKeywordStrings = new Set(userKeywords.map(k => k.keyword.toLowerCase()));

    const aiKeywordObjs = aiKeywords
        .filter(k => !userKeywordStrings.has(k))
        .map(k => ({
            keyword: k,
            location: 'Norway',
            keyword_data: null,
            _source: 'ai',
        }));

    const userKeywordObjs = userKeywords.map(k => ({ ...k, _source: 'user' }));

    // Prioriter AI-keywords først (de er mer relevante for konkurrenten),
    // deretter brukerens egne. Begrens til MAX.
    const allKeywords = [...aiKeywordObjs, ...userKeywordObjs].slice(0, MAX_KEYWORDS_PER_SCAN);

    if (allKeywords.length === 0) {
        return res.status(200).json({
            message: 'Kunne ikke generere søkeord. Sjekk at ANTHROPIC_API_KEY er satt i Vercel.',
            scanned: 0,
        });
    }

    console.log(`[scan-competitor] Skanner ${allKeywords.length} søkeord (${aiKeywordObjs.length} AI + ${userKeywords.length} bruker) for ${competitor.domain}`);

    const results = [];
    const gapOpportunities = [];
    const competitorDomain = competitor.domain.replace(/^www\./i, '').toLowerCase();

    // --- 5. SerpAPI-sjekk for hvert søkeord ---
    for (const kw of allKeywords) {
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

            // Gap-analyse (kun for brukerens egne søkeord, ikke AI-genererte)
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

    if (results.length === 0) {
        await supabase.from('competitors').update({ last_scanned_at: new Date().toISOString() }).eq('id', competitor.id);
        return res.status(200).json({
            message: 'Skannet, men fant ingen rangeringer. Konkurrenten rangerer kanskje ikke på populære søkeord i bransjen.',
            scanned: 0,
        });
    }

    // --- 6. Lagre rangeringer ---
    await supabase
        .from('competitor_keyword_rankings')
        .upsert(results, { onConflict: 'competitor_id,keyword' });

    // --- 7. Oppdater competitors-tabellen ---
    const avgPos = results.reduce((acc, r) => acc + r.position, 0) / results.length;
    await supabase
        .from('competitors')
        .update({
            avg_position: Math.round(avgPos * 10) / 10,
            keyword_count: results.length,
            last_scanned_at: new Date().toISOString(),
        })
        .eq('id', competitor.id);

    // --- 8. Lagre gap-muligheter ---
    if (gapOpportunities.length > 0) {
        await supabase
            .from('keyword_opportunities')
            .upsert(gapOpportunities, { onConflict: 'user_id,keyword' })
            .catch((e) => console.warn('[scan-competitor] Opportunity upsert feil:', e.message));
    }

    return res.status(200).json({
        message: `Skannet ${allKeywords.length} søkeord (${aiKeywordObjs.length} AI-foreslåtte). Fant ${results.length} rangeringer og ${gapOpportunities.length} gap-muligheter.`,
        scanned: results.length,
        ai_keywords_generated: aiKeywordObjs.length,
        opportunities: gapOpportunities.length,
    });
}
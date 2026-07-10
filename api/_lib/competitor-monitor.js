/**
 * Delt hjelpemodul for konkurrent-overvåking.
 * Brukes av både scan-competitor.js og cron-scan-competitors.js
 *
 * Plasser denne i: api/_lib/competitor-monitor.js
 * (Underscore-prefiks gjør at Vercel ikke behandler den som et endpoint)
 */

/**
 * Henter og parser sitemap.xml for et domene.
 * Håndterer sitemap-index (nestede sitemaps) opptil 2 nivåer.
 * Returnerer en liste med absolutte URL-er (maks 500 for å begrense data).
 */
export async function fetchSitemapUrls(domain) {
    const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/$/, '').replace(/^www\./i, '');
    const candidates = [
        `https://${cleanDomain}/sitemap.xml`,
        `https://www.${cleanDomain}/sitemap.xml`,
        `https://${cleanDomain}/sitemap_index.xml`,
        `https://${cleanDomain}/sitemap-index.xml`,
    ];

    let xml = null;
    for (const url of candidates) {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'SiktBot/1.0 (+https://sikt.no)' },
                signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
                xml = await res.text();
                break;
            }
        } catch { /* prøv neste */ }
    }

    if (!xml) return [];

    const urls = new Set();

    // Sjekk om dette er en sitemap-index (peker til andre sitemaps)
    const sitemapMatches = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/gi)];

    if (sitemapMatches.length > 0) {
        // Hent opptil 5 under-sitemaps
        for (const m of sitemapMatches.slice(0, 5)) {
            const subUrl = m[1].trim();
            try {
                const subRes = await fetch(subUrl, {
                    headers: { 'User-Agent': 'SiktBot/1.0' },
                    signal: AbortSignal.timeout(10000),
                });
                if (subRes.ok) {
                    const subXml = await subRes.text();
                    extractLocs(subXml, urls);
                }
            } catch { /* ignore */ }
            if (urls.size >= 500) break;
        }
    } else {
        // Vanlig sitemap
        extractLocs(xml, urls);
    }

    return [...urls].slice(0, 500);
}

// =====================================================================
// MOTANGREPS-MOTOR: konkurrent-bevegelser → keyword_opportunities.
// Røret opportunities → innholdsplan (runContentPlan) finnes allerede;
// dette mater det. Insert med ignoreDuplicates — eksisterende muligheter
// (f.eks. near-miss med skreddersydd oppskrift) overskrives ALDRI.
// =====================================================================
const COUNTER_MAX_KEYWORDS = 3; // maks motangreps-muligheter fra rangeringer per skann
const COUNTER_MAX_PAGES = 2;    // maks fra nye konkurrent-sider per skann

// Junk-slugs som aldri er verdt et motsvar (nav/meta/arkiv-sider).
const SLUG_JUNK = new Set([
    'om-oss', 'om', 'kontakt', 'kontakt-oss', 'personvern', 'cookies', 'cookie',
    'blogg', 'blog', 'nyheter', 'nyhet', 'artikkel', 'aktuelt', 'category', 'kategori', 'tag', 'page',
    'author', 'feed', 'sitemap', 'search', 'sok', 'vilkar', 'betingelser',
    'privacy', 'terms', 'about', 'contact', 'home', 'hjem', 'index',
]);

// Deterministisk slug → søkefrase («/tjenester/varmepumpe-service-oslo» →
// «varmepumpe service oslo»). Returnerer null når sluggen ikke ligner et
// søk (junk, tall/datoer, for kort/langt). Ingen AI-kost.
export function slugToPhrase(url) {
    let path;
    try {
        path = new URL(url).pathname;
    } catch {
        return null;
    }
    const segments = path.split('/').filter(Boolean);
    if (!segments.length) return null;
    let slug = segments[segments.length - 1];
    try { slug = decodeURIComponent(slug); } catch { /* behold rå */ }
    slug = slug.replace(/\.(html?|php|aspx?)$/i, '').toLowerCase();
    if (SLUG_JUNK.has(slug) || segments.some((s) => s.startsWith('wp-'))) return null;

    const words = slug
        .split(/[-_]+/)
        // dropp rene tall-tokens (id-er, datoer: 2026, 07, 123456)
        .filter((w) => w && !/^\d+$/.test(w));
    if (!words.length) return null;
    const phrase = words.join(' ').replace(/\s+/g, ' ').trim();
    if (phrase.length < 5 || phrase.length > 60) return null;
    if (!/[a-zæøå]/i.test(phrase)) return null;
    if (SLUG_JUNK.has(phrase.replace(/ /g, '-'))) return null;
    return phrase;
}

// Samme enkle heuristikk som scan-competitor.js bruker for gap-søkeord.
function counterRecommendationType(keyword) {
    return /^(hva|hvordan|hvorfor|når|hvor|hvem|kan|bør|er det)\b/i.test(keyword) ? 'faq' : 'new_page';
}

// Insert motangreps-muligheter. ignoreDuplicates: eksisterende rad for
// (user_id, keyword) beholdes urørt. Feil logges og telles, aldri kastes
// — motangrepet skal aldri velte selve konkurrent-skannet.
async function insertCounterOpportunities(supabase, competitor, entries) {
    if (!entries.length) return 0;
    const domainLabel = competitor.domain.replace(/^www\./i, '');
    const rows = entries.map((e) => ({
        user_id: competitor.user_id,
        keyword: e.keyword,
        search_volume: 0,
        difficulty: 'medium',
        recommendation_type: e.type || counterRecommendationType(e.keyword),
        recommendation_text: e.text.replace('{domain}', domainLabel),
        estimated_traffic: 0,
        competitor_ids: [competitor.id],
        discovered_at: new Date().toISOString(),
    }));
    const { error } = await supabase
        .from('keyword_opportunities')
        .upsert(rows, { onConflict: 'user_id,keyword', ignoreDuplicates: true });
    if (error) {
        console.warn('[counter] opportunity-insert feilet:', error.message);
        return 0;
    }
    return rows.length;
}

function extractLocs(xml, urlSet) {
    const locMatches = [...xml.matchAll(/<url>[\s\S]*?<loc>(.*?)<\/loc>/gi)];
    for (const m of locMatches) {
        const url = m[1].trim();
        if (url && url.startsWith('http')) urlSet.add(url);
        if (urlSet.size >= 500) break;
    }
    // Fallback: hvis ingen <url><loc>, prøv bare <loc>
    if (locMatches.length === 0) {
        const bareLocs = [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)];
        for (const m of bareLocs) {
            const url = m[1].trim();
            if (url && url.startsWith('http')) urlSet.add(url);
            if (urlSet.size >= 500) break;
        }
    }
}

/**
 * Sammenligner ny sitemap med lagrede sider og oppdager endringer.
 * Oppdaterer competitor_pages og lager competitor_changes-rader.
 *
 * @param {object} supabase - Supabase service-role klient
 * @param {object} competitor - { id, domain, user_id }
 * @returns {object} { newPages: [], removedPages: [], changes: [] }
 */
export async function detectSitemapChanges(supabase, competitor) {
    const currentUrls = await fetchSitemapUrls(competitor.domain);

    if (currentUrls.length === 0) {
        return { newPages: [], removedPages: [], changes: [], sitemapFound: false };
    }

    // Hent eksisterende sider fra databasen
    const { data: existingPages } = await supabase
        .from('competitor_pages')
        .select('url, is_active')
        .eq('competitor_id', competitor.id);

    const existing = existingPages || [];
    const existingUrlSet = new Set(existing.map(p => p.url));
    const currentUrlSet = new Set(currentUrls);
    const isFirstScan = existing.length === 0;

    // Nye sider = i current, men ikke i existing
    const newPages = currentUrls.filter(u => !existingUrlSet.has(u));

    // Fjernede sider = var aktive i existing, men ikke i current
    const removedPages = existing
        .filter(p => p.is_active && !currentUrlSet.has(p.url))
        .map(p => p.url);

    const now = new Date().toISOString();

    // --- Oppdater competitor_pages ---

    // 1. Upsert alle nåværende URL-er (oppdater last_seen_at)
    if (currentUrls.length > 0) {
        const pageRows = currentUrls.map(url => ({
            competitor_id: competitor.id,
            url,
            last_seen_at: now,
            is_active: true,
        }));

        // Upsert i bolker à 100 for å unngå for store requests
        for (let i = 0; i < pageRows.length; i += 100) {
            const batch = pageRows.slice(i, i + 100);
            await supabase
                .from('competitor_pages')
                .upsert(batch, { onConflict: 'competitor_id,url' });
        }
    }

    // 2. Marker fjernede sider som inaktive
    if (removedPages.length > 0) {
        await supabase
            .from('competitor_pages')
            .update({ is_active: false })
            .eq('competitor_id', competitor.id)
            .in('url', removedPages);
    }

    // --- Lag endrings-varsler (IKKE på første skann - da er alt "nytt") ---
    const changes = [];

    if (!isFirstScan) {
        const domainLabel = competitor.domain.replace(/^www\./i, '');

        if (newPages.length > 0) {
            changes.push({
                competitor_id: competitor.id,
                user_id: competitor.user_id,
                change_type: 'new_page',
                title: `${domainLabel} la til ${newPages.length} ${newPages.length === 1 ? 'ny side' : 'nye sider'}`,
                detail: `Nye sider oppdaget i sitemap. Sjekk hva konkurrenten satser på.`,
                metadata: { urls: newPages.slice(0, 20) },
                created_at: now,
            });
        }

        if (removedPages.length > 0) {
            changes.push({
                competitor_id: competitor.id,
                user_id: competitor.user_id,
                change_type: 'removed_page',
                title: `${domainLabel} fjernet ${removedPages.length} ${removedPages.length === 1 ? 'side' : 'sider'}`,
                detail: `Sider som ikke lenger finnes i sitemap. Kan bety endret strategi.`,
                metadata: { urls: removedPages.slice(0, 20) },
                created_at: now,
            });
        }
    }

    // Lagre varsler i databasen
    let counterOpportunities = 0;
    if (changes.length > 0) {
        const { error: chErr } = await supabase.from('competitor_changes').insert(changes);
        if (chErr) console.warn('[monitor] competitor_changes-insert feilet:', chErr.message);

        // MOTANGREP: konkurrentens nye sider → innholds-muligheter (slug→frase).
        // Innholdsplanen plukker dem opp automatisk neste måned.
        const counterEntries = [];
        for (const url of newPages) {
            if (counterEntries.length >= COUNTER_MAX_PAGES) break;
            const phrase = slugToPhrase(url);
            if (!phrase) continue;
            counterEntries.push({
                keyword: phrase,
                text: 'Konkurrenten {domain} publiserte nettopp en side om dette — svar med bedre innhold før de rekker å sette seg.',
            });
        }
        counterOpportunities = await insertCounterOpportunities(supabase, competitor, counterEntries);
    }

    return {
        newPages,
        removedPages,
        changes,
        counterOpportunities,
        sitemapFound: true,
        totalPages: currentUrls.length,
        isFirstScan,
    };
}

/**
 * Sammenligner nye søkeord-rangeringer med forrige skann.
 * Lager varsler for nye rangeringer og store posisjonsendringer.
 *
 * @param {object} supabase - Supabase service-role klient
 * @param {object} competitor - { id, domain, user_id }
 * @param {array} newResults - Resultater fra denne skanningen [{ keyword, position }]
 */
export async function detectRankingChanges(supabase, competitor, newResults) {
    // Hent forrige rangeringer
    const { data: prevRankings } = await supabase
        .from('competitor_keyword_rankings')
        .select('keyword, position')
        .eq('competitor_id', competitor.id);

    const prev = prevRankings || [];
    const prevMap = new Map(prev.map(r => [r.keyword.toLowerCase(), r.position]));
    const isFirstScan = prev.length === 0;

    if (isFirstScan) return { changes: [] }; // Ikke varsle på første skann

    const domainLabel = competitor.domain.replace(/^www\./i, '');
    const now = new Date().toISOString();
    const changes = [];
    const newKeywords = [];
    const improved = [];
    const dropped = [];

    for (const r of newResults) {
        const key = r.keyword.toLowerCase();
        const oldPos = prevMap.get(key);

        if (oldPos == null) {
            newKeywords.push({ keyword: r.keyword, position: r.position });
        } else if (r.position < oldPos - 2) {
            improved.push({ keyword: r.keyword, from: oldPos, to: r.position });
        } else if (r.position > oldPos + 3) {
            dropped.push({ keyword: r.keyword, from: oldPos, to: r.position });
        }
    }

    if (newKeywords.length > 0) {
        changes.push({
            competitor_id: competitor.id,
            user_id: competitor.user_id,
            change_type: 'new_keyword',
            title: `${domainLabel} rangerer nå på ${newKeywords.length} ${newKeywords.length === 1 ? 'nytt søkeord' : 'nye søkeord'}`,
            detail: newKeywords.slice(0, 5).map(k => `«${k.keyword}» (#${k.position})`).join(', '),
            metadata: { keywords: newKeywords.slice(0, 20) },
            created_at: now,
        });
    }

    if (improved.length > 0) {
        changes.push({
            competitor_id: competitor.id,
            user_id: competitor.user_id,
            change_type: 'rank_improved',
            title: `${domainLabel} klatret på ${improved.length} ${improved.length === 1 ? 'søkeord' : 'søkeord'}`,
            detail: improved.slice(0, 5).map(k => `«${k.keyword}» ${k.from}→${k.to}`).join(', '),
            metadata: { keywords: improved.slice(0, 20) },
            created_at: now,
        });
    }

    if (dropped.length > 0) {
        changes.push({
            competitor_id: competitor.id,
            user_id: competitor.user_id,
            change_type: 'rank_dropped',
            title: `${domainLabel} falt på ${dropped.length} ${dropped.length === 1 ? 'søkeord' : 'søkeord'}`,
            detail: dropped.slice(0, 5).map(k => `«${k.keyword}» ${k.from}→${k.to}`).join(', '),
            metadata: { keywords: dropped.slice(0, 20) },
            created_at: now,
        });
    }

    let counterOpportunities = 0;
    if (changes.length > 0) {
        const { error: chErr } = await supabase.from('competitor_changes').insert(changes);
        if (chErr) console.warn('[monitor] competitor_changes-insert feilet:', chErr.message);

        // MOTANGREP: søkeord konkurrenten nettopp vant → innholds-muligheter.
        const counterEntries = [];
        for (const k of newKeywords) {
            if (counterEntries.length >= COUNTER_MAX_KEYWORDS) break;
            const kw = (k.keyword || '').trim();
            if (kw.length < 5 || kw.length > 80) continue;
            counterEntries.push({
                keyword: kw,
                text: `Konkurrenten {domain} rangerer nå på dette (plass ${Math.round(k.position)}) — skriv innholdet som svarer bedre.`,
            });
        }
        counterOpportunities = await insertCounterOpportunities(supabase, competitor, counterEntries);
    }

    return { changes, newKeywords, improved, dropped, counterOpportunities };
}
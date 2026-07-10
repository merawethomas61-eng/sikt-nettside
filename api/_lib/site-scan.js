import * as cheerio from 'cheerio';
import { assertSafeUserUrl, fetchHtmlSafe } from './url-guard.js';

// ============================================================
// SIDE-CRAWLER (delt kjerne)
// Brukes av BÅDE /api/scan-website (kunde-initiert skann i Verksted)
// og cron-jobben site_scan (ukentlig server-side re-skann).
// Crawler ≤ maxPages interne sider, finner innholds-problemer
// (tynt innhold / manglende meta / manglende H1), teller EKTE inlinks
// mellom de skannede sidene, og samler ALLE <a href> (interne + eksterne)
// til lenkemotorene (ødelagte lenker + interne lenkeforslag).
// ============================================================

// Normaliser URL-er slik at /om-oss, /om-oss/ og /om-oss#x teller som samme side
// når vi teller interne lenker mellom de skannede sidene.
export function normalizePageUrl(u) {
    try {
        const parsed = new URL(u);
        parsed.hash = '';
        parsed.search = '';
        const s = parsed.toString();
        return s.endsWith('/') ? s.slice(0, -1) : s;
    } catch {
        return null;
    }
}

/**
 * Crawler kundens side og returnerer sider + lenkegraf.
 *
 * @param {object} opts
 * @param {string} opts.startUrl — MÅ allerede være validert med assertSafeUserUrl
 * @param {string} opts.websiteUrl — kundens registrerte nettside (same-site-vakt)
 * @param {number} [opts.maxPages]
 * @returns {Promise<{
 *   pages: object[],
 *   outgoingByPage: Map<string, Set<string>>,
 *   collectedLinks: {sourceUrl: string, targetUrl: string, anchorText: string, isInternal: boolean}[],
 * }>}
 */
export async function crawlSite({ startUrl, websiteUrl, maxPages = 15 }) {
    const baseUrl = new URL(startUrl).origin;
    const { response } = await fetchHtmlSafe(startUrl, websiteUrl);
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

    const pagesToScan = [startUrl, ...Array.from(internalLinks)].slice(0, maxPages);
    const scannedPages = [];

    // normalisert side-URL -> Set av normaliserte interne lenkemål fra den siden
    const outgoingByPage = new Map();
    // Alle <a href> på tvers av skannede sider (til lenkemotorene), dedupet
    // per (kilde, mål). Hash strippes fra målet — lenkesjekk bryr seg ikke om anker.
    const collectedLinkMap = new Map();

    for (const targetUrl of pagesToScan) {
        try {
            const safeTargetUrl = await assertSafeUserUrl(targetUrl, websiteUrl);
            const { response: pageRes } = await fetchHtmlSafe(safeTargetUrl, websiteUrl);
            if (!pageRes.ok) continue;
            const pageHtml = await pageRes.text();
            const page$ = cheerio.load(pageHtml);

            const title = page$('title').text() || targetUrl;
            const textContent = page$('body').text().replace(/\s+/g, ' ').trim();
            const wordCount = textContent.split(' ').length;
            const pageLinks = page$('a').length;

            const sourceNorm = normalizePageUrl(safeTargetUrl);
            const internalTargets = new Set();
            page$('a').each((_, el) => {
                const href = page$(el).attr('href');
                if (!href) return;
                const trimmedHref = href.trim();
                if (!trimmedHref || trimmedHref.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(trimmedHref)) return;

                // Absolutt mål-URL (relative lenker løses mot siden de står på).
                let abs;
                try {
                    abs = new URL(trimmedHref, safeTargetUrl);
                } catch {
                    return;
                }
                if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;

                const isInternal = abs.origin === baseUrl;
                if (isInternal) {
                    const norm = normalizePageUrl(abs.href);
                    if (norm) internalTargets.add(norm);
                }

                // Samle til lenkemotorene (interne + eksterne, uten hash).
                abs.hash = '';
                const targetClean = abs.toString();
                const key = `${sourceNorm}|${targetClean}`;
                if (!collectedLinkMap.has(key)) {
                    collectedLinkMap.set(key, {
                        sourceUrl: sourceNorm,
                        targetUrl: targetClean,
                        anchorText: page$(el).text().replace(/\s+/g, ' ').trim().slice(0, 200),
                        isInternal,
                    });
                }
            });
            outgoingByPage.set(sourceNorm, internalTargets);

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
                // Tekstutdrag brukes som «Nåværende innhold» + AI-kontekst i Verksted
                // for rådgiver-plattformer (AI-bygd, Wix m.fl.) som ikke har fetch-API.
                textSample: textContent.slice(0, 1500),
                status,
                score,
                issues,
                // inlinks fylles inn etter loopen når alle sidenes lenker er samlet
                inlinks: 0,
                outlinks: pageLinks,
                readability: wordCount > 600 ? 'Middels' : 'Enkel',
                topicCluster: 'Generell',
                action: status === 'Bra' ? 'Fungerer optimalt' : 'Krever optimalisering',
                lastUpdated: new Date().toLocaleDateString('no-NO')
            });
        } catch (err) {
            console.error(`Feil ved skanning av ${targetUrl}:`, err);
        }
    }

    // Ekte inlinks: hvor mange av de ANDRE skannede sidene som lenker hit.
    for (const page of scannedPages) {
        const target = normalizePageUrl(page.fullUrl);
        if (!target) continue;
        let count = 0;
        for (const [source, targets] of outgoingByPage) {
            if (source !== target && targets.has(target)) count += 1;
        }
        page.inlinks = count;
    }

    return {
        pages: scannedPages,
        outgoingByPage,
        collectedLinks: Array.from(collectedLinkMap.values()),
    };
}

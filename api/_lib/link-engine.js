// ============================================================
// LENKE-MOTOR (ren logikk, ingen I/O)
// 1) classifyLinkCheck — tolker HTTP-status/feil fra lenkesjekk
// 2) computeLinkSuggestions — deterministiske interne lenkeforslag
// 3) applyLinkEditToHtml — kirurgisk unlink/replace/insert i rå
//    WordPress-innhold (Gutenberg-markører beholdes ordrett; vi gjør
//    KUN streng-kirurgi, aldri parse→serialize som kan ødelegge markup)
// ============================================================

/**
 * Tolker resultatet av en HEAD/GET-sjekk mot et lenkemål.
 * 'broken'  = målet finnes ikke (404/410/DNS-navn finnes ikke)
 * 'ok'      = målet svarer (2xx/3xx) eller er nåbart men bot-blokkert (401/403/405/429)
 * 'unknown' = transient (timeout, 5xx, DNS midlertidig) — teller IKKE som brudd
 * @param {number|null} statusCode
 * @param {Error|null} [err]
 */
export function classifyLinkCheck(statusCode, err) {
    if (err) {
        const msg = String(err?.message || err);
        // Domenet finnes ikke → reelt brudd. Timeout/EAI_AGAIN → transient.
        if (/ENOTFOUND|ERR_NAME_NOT_RESOLVED/i.test(msg)) return 'broken';
        return 'unknown';
    }
    if (statusCode === 404 || statusCode === 410) return 'broken';
    if (statusCode >= 200 && statusCode < 400) return 'ok';
    // Nåbart men avviser oss (bot-vern o.l.) — IKKE et brudd kunden skal fikse.
    if (statusCode === 401 || statusCode === 403 || statusCode === 405 || statusCode === 429) return 'ok';
    return 'unknown';
}

// Normaliser URL for lenkegraf-sammenlikning (host+path, uten protokoll/hash/
// trailing slash) — http/https og med/uten www skal telle som samme mål.
function normalizeForMatch(rawUrl, baseUrl) {
    try {
        const u = new URL(String(rawUrl || ''), baseUrl || undefined);
        u.hash = '';
        let host = u.host.toLowerCase();
        if (host.startsWith('www.')) host = host.slice(4);
        let s = `${host}${u.pathname}${u.search}`.toLowerCase();
        if (s.endsWith('/')) s = s.slice(0, -1);
        return s;
    } catch {
        return null;
    }
}

// Tittel → lenkbar frase: kutt «| Merkenavn»-halen og annet støy.
function titleToPhrase(title, brandName) {
    let t = String(title || '').split('|')[0].split(' – ')[0].split(' - ')[0].trim();
    if (brandName) {
        const brandRe = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
        t = t.replace(brandRe, '').trim();
    }
    t = t.replace(/\.{3}$/, '').trim();
    return t.length >= 5 ? t : null;
}

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deterministiske interne lenkeforslag: «siden X nevner frasen til side Y,
 * men lenker ikke dit». Hver ny artikkel gir nye mål → motoren drenerer aldri.
 *
 * @param {object} opts
 * @param {{url: string, title?: string, textSample?: string, inlinks?: number}[]} opts.pages
 *   — skannede sider (url = full URL)
 * @param {{sourceUrl: string, targetUrl: string}[]} opts.internalLinks
 *   — eksisterende interne lenker (fra crawlens collectedLinks)
 * @param {{url: string, title?: string, keyword?: string}[]} [opts.articles]
 *   — publiserte/pushede artikler med kjent URL (nye lenkemål)
 * @param {{keyword: string, url?: string, impressions?: number}[]} [opts.gscKeywords]
 *   — GSC-søkeord (gir målsider verdi + beste ankerfrase)
 * @param {string} [opts.brandName]
 * @param {number} [opts.maxNew]
 * @returns {{sourceUrl: string, targetUrl: string, anchorText: string, contextSnippet: string, reason: string, score: number}[]}
 */
export function computeLinkSuggestions({ pages, internalLinks, articles = [], gscKeywords = [], brandName = '', maxNew = 5 }) {
    const pageList = Array.isArray(pages) ? pages.filter((p) => p && p.url) : [];
    if (!pageList.length) return [];

    const existing = new Set(
        (Array.isArray(internalLinks) ? internalLinks : [])
            .map((l) => `${normalizeForMatch(l.sourceUrl)}|${normalizeForMatch(l.targetUrl)}`)
    );

    // GSC-verdi per målside: sum visninger + beste søkeord (høyest visninger).
    const gscByUrl = new Map();
    for (const k of Array.isArray(gscKeywords) ? gscKeywords : []) {
        const norm = normalizeForMatch(k?.url);
        if (!norm || typeof k?.keyword !== 'string' || !k.keyword.trim()) continue;
        const cur = gscByUrl.get(norm) || { impressions: 0, bestKeyword: null, bestImpressions: -1 };
        const imp = Number(k.impressions) || 0;
        cur.impressions += imp;
        if (imp > cur.bestImpressions) {
            cur.bestImpressions = imp;
            cur.bestKeyword = k.keyword.trim();
        }
        gscByUrl.set(norm, cur);
    }

    // Mål: kundens sider (verdsatt via GSC) + artikler (nye mål, vil ha lenker).
    const targets = new Map();
    for (const p of pageList) {
        const norm = normalizeForMatch(p.url);
        if (!norm) continue;
        const gsc = gscByUrl.get(norm);
        const phrase = (gsc?.bestKeyword && gsc.bestKeyword.length >= 5 ? gsc.bestKeyword : null)
            || titleToPhrase(p.title, brandName);
        if (!phrase) continue;
        targets.set(norm, { url: p.url, phrase, value: gsc?.impressions || 0, isArticle: false });
    }
    for (const a of Array.isArray(articles) ? articles : []) {
        const norm = normalizeForMatch(a?.url);
        if (!norm) continue;
        const phrase = (typeof a?.keyword === 'string' && a.keyword.trim().length >= 5 ? a.keyword.trim() : null)
            || titleToPhrase(a?.title, brandName);
        if (!phrase) continue;
        targets.set(norm, { url: a.url, phrase, value: 0, isArticle: true });
    }

    const suggestions = [];
    for (const source of pageList) {
        const sourceNorm = normalizeForMatch(source.url);
        const text = String(source.textSample || '');
        if (!sourceNorm || text.length < 100) continue;

        for (const [targetNorm, target] of targets) {
            if (targetNorm === sourceNorm) continue;
            if (existing.has(`${sourceNorm}|${targetNorm}`)) continue;

            const phraseRe = new RegExp(escapeRegExp(target.phrase), 'ig');
            const matches = [...text.matchAll(phraseRe)];
            if (!matches.length) continue;

            const first = matches[0];
            const idx = first.index ?? 0;
            const snippetStart = Math.max(0, idx - 80);
            const snippetEnd = Math.min(text.length, idx + first[0].length + 80);
            const contextSnippet = `${snippetStart > 0 ? '…' : ''}${text.slice(snippetStart, snippetEnd).trim()}${snippetEnd < text.length ? '…' : ''}`;

            suggestions.push({
                sourceUrl: source.url,
                targetUrl: target.url,
                anchorText: first[0],
                contextSnippet,
                reason: target.isArticle
                    ? `Den nye artikkelen om «${target.phrase}» trenger interne lenker for å rangere.`
                    : `Siden nevner «${target.phrase}», men lenker ikke til siden som rangerer på det.`,
                score: matches.length * 10
                    + (Number(source.inlinks) || 0) * 2
                    + Math.log10((target.value || 0) + 1) * 5
                    + (target.isArticle ? 8 : 0),
            });
        }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return suggestions.slice(0, Math.max(0, maxNew));
}

// Er posisjon i inne i et gitt tag-par? Grov men trygg heuristikk for
// streng-kirurgi: siste åpning før i vs. siste lukking før i.
function insideTag(lower, i, tag) {
    const lastClose = lower.lastIndexOf(`</${tag}>`, i);
    const openA = lower.lastIndexOf(`<${tag} `, i);
    const openB = lower.lastIndexOf(`<${tag}>`, i);
    const lastOpen = Math.max(openA, openB);
    return lastOpen > lastClose;
}

/**
 * Kirurgisk lenke-endring i rå (Gutenberg-)HTML. Ren streng-kirurgi —
 * ALDRI parse→serialize, så blokk-kommentarene overlever ordrett.
 *
 * Modes:
 *  - 'unlink':  fjern alle <a> som peker på targetUrl (behold innerteksten)
 *  - 'replace': bytt href på alle <a> som peker på targetUrl → replacementUrl
 *  - 'insert':  wrap første forekomst av anchorText (utenfor <a>/overskrifter/
 *               tags/kommentarer) i <a href="targetUrl">
 *
 * @param {string} rawContent — rå post_content (content.raw fra WP)
 * @param {object} opts
 * @param {string} opts.mode — 'unlink' | 'replace' | 'insert'
 * @param {string} opts.targetUrl
 * @param {string} [opts.replacementUrl] — kreves for 'replace'
 * @param {string} [opts.anchorText] — kreves for 'insert'
 * @param {string} [opts.baseUrl] — siden lenken står på (løser relative href)
 * @returns {{html: string|null, changed: number, reason?: string}}
 */
export function applyLinkEditToHtml(rawContent, { mode, targetUrl, replacementUrl, anchorText, baseUrl }) {
    const content = String(rawContent || '');
    if (!content) return { html: null, changed: 0, reason: 'empty_content' };

    if (mode === 'unlink' || mode === 'replace') {
        const targetNorm = normalizeForMatch(targetUrl, baseUrl);
        if (!targetNorm) return { html: null, changed: 0, reason: 'invalid_target' };
        if (mode === 'replace' && (typeof replacementUrl !== 'string' || !replacementUrl.trim())) {
            return { html: null, changed: 0, reason: 'missing_replacement' };
        }
        let changed = 0;
        const html = content.replace(
            /<a\b([^>]*?)href\s*=\s*(["'])([\s\S]*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
            (match, pre, q, href, post, inner) => {
                const norm = normalizeForMatch(href, baseUrl);
                if (!norm || norm !== targetNorm) return match;
                changed += 1;
                if (mode === 'unlink') return inner;
                return `<a${pre}href=${q}${replacementUrl.trim()}${q}${post}>${inner}</a>`;
            }
        );
        if (!changed) return { html: null, changed: 0, reason: 'not_found' };
        return { html, changed };
    }

    if (mode === 'insert') {
        const phrase = typeof anchorText === 'string' ? anchorText.trim() : '';
        if (phrase.length < 3) return { html: null, changed: 0, reason: 'invalid_anchor' };
        if (typeof targetUrl !== 'string' || !targetUrl.trim()) {
            return { html: null, changed: 0, reason: 'invalid_target' };
        }

        const lower = content.toLowerCase();
        const phraseRe = new RegExp(escapeRegExp(phrase), 'gi');
        let m;
        while ((m = phraseRe.exec(content)) !== null) {
            const i = m.index;

            // Inne i en HTML-tag (mellom < og >)? → hopp over.
            const lastLt = content.lastIndexOf('<', i);
            const lastGt = content.lastIndexOf('>', i);
            if (lastLt > lastGt) continue;

            // Inne i en HTML-kommentar (Gutenberg-blokkmarkør)? → hopp over.
            const lastCommentOpen = content.lastIndexOf('<!--', i);
            const lastCommentClose = content.lastIndexOf('-->', i);
            if (lastCommentOpen > lastCommentClose) continue;

            // Inne i eksisterende lenke, overskrift eller knapp? → hopp over.
            if (insideTag(lower, i, 'a')) continue;
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'script', 'style'].some((t) => insideTag(lower, i, t))) continue;

            const matched = m[0];
            const html = `${content.slice(0, i)}<a href="${targetUrl.trim()}">${matched}</a>${content.slice(i + matched.length)}`;
            return { html, changed: 1 };
        }
        return { html: null, changed: 0, reason: 'not_found' };
    }

    return { html: null, changed: 0, reason: 'invalid_mode' };
}

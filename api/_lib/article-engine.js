import { fetchExternalWithOptionalRetry, isOpenAiRateLimited } from './external-rate-limit.js';
import { Sentry } from './sentry.js';

// ============================================================
// ARTIKKEL-MOTOR (delt kjerne)
// Brukes av BÅDE /api/solve-problem (mode:'article', kunde-initiert med
// RLS-scopet klient) og cron-jobben content_generate (service-role).
// Kvote per pakke: Basic 0, Standard 2, Premium 8 per kalendermåned
// (telles på rader i sikt_articles, UTC-måned — samme månedsnøkkel som
// analyse-kvoten i portalen).
// ============================================================

// Felles SEO-kvalitetskrav for tekst kunden limer inn (meta, tittel, alt).
export const SEO_COPY_RULES = `

SEO-KVALITETSKRAV (gjelder all tekst kunden skal lime inn):
- META-BESKRIVELSE: 120–158 tegn. Aktiv stemme, konkret verdiløfte, gjerne en mild oppfordring. Plassér det viktigste søkeordet naturlig tidlig. IKKE kopier sidetittel/H1 ordrett. Unik per side.
- META-TITTEL / <title>: 50–60 tegn. Søkeord først, deretter «| Merkenavn». Unik per side.
- ALT-TEKST: beskriv hva bildet FAKTISK viser, maks ~125 tegn. Ikke start med «Bilde av». Ingen keyword-stuffing. Rent dekorative bilder = tom alt="".
- Skriv naturlig norsk for et menneske, ikke for en robot. Ingen klisjeer («markedsledende», «skreddersydde løsninger»).
- ALDRI plassholdere som «DIN_TEKST» eller «[sett inn …]» — lever ferdig tekst kunden kan lime rett inn.`;

// Plassholder-vakt: avvis copy-paste som ikke er ferdig utfylt.
export const PLACEHOLDER_RE = /DIN_TEKST|DITT_SØKEORD|PLACEHOLDER|LOREM IPSUM|\[\s*sett inn|\[\s*din |\bTODO\b|\bFIXME\b|\bXXXX+\b/i;

export function articleLimitForPackage(packageName) {
    if (/premium/i.test(packageName || '')) return 8;
    if (/standard/i.test(packageName || '')) return 2;
    return 0;
}

export function slugifyNo(text) {
    const slug = String(text || '')
        .toLowerCase()
        .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return slug || 'ny-side';
}

export function countWordsInHtml(html) {
    const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(' ').length : 0;
}

// Fjern script/style/iframe og inline event-handlere — innholdet skal rett
// inn i et WP-utkast og i forhåndsvisning i portalen.
export function sanitizeArticleHtml(html) {
    return String(html || '')
        .replace(/<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\s*(script|style|iframe)[^>]*\/?\s*>/gi, '')
        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
}

// Topp-3 fra Google for søkeordet — «dette skal du slå»-kontekst til modellen.
// Best effort: mangler SERP_API_KEY eller kallet feiler, genererer vi uten.
export async function fetchSerpTop3(keyword, location) {
    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) return null;
    try {
        const loc = location ? `${location}, Norway` : 'Norway';
        const targetUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&google_domain=google.no&gl=no&hl=no&location=${encodeURIComponent(loc)}&num=10&device=desktop&api_key=${apiKey}`;
        const serpRes = await fetch(targetUrl, { signal: AbortSignal.timeout(12000) });
        if (!serpRes.ok) return null;
        const data = await serpRes.json().catch(() => null);
        const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
        const top = organic
            .slice(0, 3)
            .map((r) => ({ title: typeof r?.title === 'string' ? r.title : '', snippet: typeof r?.snippet === 'string' ? r.snippet : '' }))
            .filter((r) => r.title);
        return top.length ? top : null;
    } catch {
        return null;
    }
}

// Typede feil slik at både HTTP-wrapperen (solve-problem) og cron-en kan
// oversette til riktig respons/logglinje uten å tolke meldingstekst.
export class ArticleEngineError extends Error {
    constructor(code, message, extra = {}) {
        super(message);
        this.name = 'ArticleEngineError';
        this.code = code;
        Object.assign(this, extra);
    }
}

// Hvor mange artikler brukeren har generert denne UTC-måneden.
export async function countArticlesThisMonth(supabase, userId) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count, error } = await supabase
        .from('sikt_articles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart);
    if (error) {
        throw new ArticleEngineError('quota_check_failed', 'Kunne ikke sjekke artikkel-kvoten. Prøv igjen.', { cause: error });
    }
    return count ?? 0;
}

// Normaliser URL for allowlist-sammenlikning (uten hash/query/trailing slash).
function normalizeUrlForAllowlist(rawHref, baseUrl) {
    try {
        const parsed = new URL(rawHref, baseUrl || undefined);
        parsed.hash = '';
        parsed.search = '';
        let s = parsed.toString();
        if (s.endsWith('/')) s = s.slice(0, -1);
        return s.toLowerCase();
    } catch {
        return null;
    }
}

// Guardrail: fjern alle <a href> som ikke peker på en godkjent intern URL —
// AI-en får ALDRI shippe hallusinerte lenkemål. Innerteksten beholdes.
export function enforceLinkAllowlist(html, allowedUrls, baseUrl) {
    const allowed = new Set(
        (Array.isArray(allowedUrls) ? allowedUrls : [])
            .map((u) => normalizeUrlForAllowlist(u, baseUrl))
            .filter(Boolean)
    );
    return String(html || '').replace(
        /<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
        (match, _q, href, inner) => {
            const norm = normalizeUrlForAllowlist(href, baseUrl);
            if (norm && allowed.has(norm)) return match;
            return inner;
        }
    );
}

/**
 * Genererer en komplett norsk artikkel og lagrer den i sikt_articles.
 *
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase —
 *   RLS-scopet bruker-klient (portal) ELLER service-role-klient (cron).
 * @param {string} opts.userId
 * @param {string} opts.keyword
 * @param {string|null} [opts.opportunityId] — keyword_opportunities-rad som kontekst
 * @param {number|null} [opts.currentPosition]
 * @param {string} [opts.businessContext]
 * @param {string|null} [opts.targetPageUrl]
 * @param {string} [opts.websiteUrl]
 * @param {string} opts.packageName — kvote-gaten (Basic 0 / Standard 2 / Premium 8)
 * @param {string} [opts.companyName]
 * @param {string[]} [opts.targetKeywords] — kundens ekte GSC-søk
 * @param {{url: string, title: string}[]} [opts.internalLinkTargets] —
 *   money pages artikkelen skal lenke til (2–4). Håndheves med allowlist.
 * @param {string} [opts.source] — 'manual' (default) | 'plan'
 * @param {string|null} [opts.planItemId] — sikt_content_plan_items-rad (idempotens-nøkkel)
 * @returns {Promise<{article: object, quota: {used: number, limit: number}, qualityNotes: string[], serpUsed: boolean}>}
 * @throws {ArticleEngineError} code: plan_locked | quota_check_failed | quota_exceeded
 *   | rate_limited (openAiResponse vedlagt) | generation_failed | incomplete | insert_failed
 */
export async function generateArticle(opts) {
    const {
        supabase, userId, keyword, opportunityId = null, currentPosition = null,
        businessContext = '', targetPageUrl = null, websiteUrl = '', packageName = '',
        companyName = '', targetKeywords = [], internalLinkTargets = [],
        source = 'manual', planItemId = null,
    } = opts;

    // --- Kvote-gate (server-side; frontend-sjekken er bare kosmetikk) ---
    const limit = articleLimitForPackage(packageName);
    if (limit === 0) {
        throw new ArticleEngineError(
            'plan_locked',
            'AI-artikler er inkludert fra Standard-pakken. Oppgrader for å få Sikt til å skrive for deg.'
        );
    }
    const used = await countArticlesThisMonth(supabase, userId);
    if (used >= limit) {
        throw new ArticleEngineError(
            'quota_exceeded',
            `Du har brukt ${used} av ${limit} AI-artikler denne måneden. Kvoten nullstilles ved månedsskiftet.`,
            { quota: { used, limit } }
        );
    }

    // --- Kontekst: mulighets-raden (hvis oppgitt) ---
    let opportunity = null;
    if (opportunityId) {
        const { data: oppRow } = await supabase
            .from('keyword_opportunities')
            .select('id, keyword, recommendation_type, recommendation_text, estimated_traffic')
            .eq('id', opportunityId)
            .eq('user_id', userId)
            .maybeSingle();
        if (oppRow) opportunity = oppRow;
    }
    // near_miss = kunden rangerer nesten (utvid dekningen); ellers ny side.
    const articleMode = opportunity?.recommendation_type === 'gsc_near_miss' ? 'expand_existing' : 'new_article';

    // --- Kontekst: kundens egne svar om sidene sine (onboarding/Verksted) ---
    let pageContextText = '';
    try {
        const { data: ctxRows } = await supabase
            .from('sikt_page_context')
            .select('page_url, answers')
            .eq('user_id', userId)
            .limit(3);
        if (Array.isArray(ctxRows) && ctxRows.length) {
            pageContextText = ctxRows
                .map((r) => `${r.page_url}: ${JSON.stringify(r.answers)}`)
                .join('\n')
                .slice(0, 800);
        }
    } catch { /* best effort */ }

    // --- Kontekst: sted (for SERP) fra sporede søkeord ---
    let serpLocation = null;
    try {
        const { data: kwRow } = await supabase
            .from('user_keywords')
            .select('location')
            .eq('user_id', userId)
            .eq('keyword', keyword)
            .limit(1)
            .maybeSingle();
        if (kwRow?.location) serpLocation = kwRow.location;
    } catch { /* best effort */ }

    const serpTop3 = await fetchSerpTop3(keyword, serpLocation);

    // --- Bygg prompt ---
    const linkTargets = (Array.isArray(internalLinkTargets) ? internalLinkTargets : [])
        .filter((t) => t && typeof t.url === 'string' && t.url.trim())
        .slice(0, 5);
    const allowLinks = linkTargets.length > 0;

    const systemPrompt = `Du er en erfaren norsk SEO-tekstforfatter for småbedrifter. Skriv en komplett, publiseringsklar artikkel/tjenesteside på norsk som skal rangere på Google for ett bestemt søkeord.

DU MÅ SVARE I STRENGT JSON-FORMAT:
{
  "title": "SEO-tittel, 50-60 tegn, søkeordet tidlig, deretter | Bedriftsnavn",
  "slug": "url-vennlig-slug-uten-aeoa",
  "meta_description": "120-158 tegn, aktiv stemme, søkeordet tidlig",
  "h1": "Overskriften på siden (kan avvike litt fra title)",
  "content_html": "Brødteksten som HTML",
  "faq": [{ "question": "…", "answer": "…" }]
}

REGLER FOR content_html:
1. Minst 1000 ord. Strukturér med 4–7 <h2>-seksjoner (gjerne <h3> under). ALDRI <h1> i brødteksten.
2. Bruk KUN disse taggene: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>${allowLinks ? ', <a href="…">' : ''}.
3. Skriv om KUNDENS bedrift og tjenester basert på konteksten du får. ALDRI finn på konkrete fakta: ingen priser, telefonnumre, adresser, åpningstider eller årstall du ikke har fått oppgitt.
4. Første avsnitt skal svare direkte på søke-intensjonen. Deretter utdyping og praktiske råd, og en naturlig avslutning som peker mot å ta kontakt med bedriften.
5. Avslutt med en FAQ-seksjon (<h2>Ofte stilte spørsmål</h2>) med de samme spørsmålene som i "faq"-listen.
6. "faq" skal ha 3–4 spørsmål folk faktisk stiller rundt søkeordet, med konkrete svar (2–4 setninger).${allowLinks ? `
7. Legg inn 2–4 interne lenker naturlig i brødteksten — KUN til URL-ene du får oppgitt under «Interne lenkemål». ALDRI finn på andre lenkemål.` : ''}${SEO_COPY_RULES}`;

    const userParts = [];
    // Dagens dato hindrer utdaterte års-/sesongreferanser i teksten.
    userParts.push(`I dag: ${new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    userParts.push(`Søkeord artikkelen skal rangere på: «${keyword}»`);
    userParts.push(`Bedrift: ${companyName || 'ukjent navn'} — ${websiteUrl || 'ukjent nettside'}`);
    if (articleMode === 'expand_existing') {
        const posText = currentPosition != null ? `plass ${Math.round(currentPosition)}` : 'like utenfor side 1';
        userParts.push(`Situasjon: Kunden rangerer allerede rundt ${posText} på dette søket${targetPageUrl ? ` med siden ${targetPageUrl}` : ''}. Skriv innhold som utvider og styrker dekningen slik at de tar side 1.`);
    } else {
        userParts.push('Situasjon: Kunden rangerer ikke på dette søket ennå. Skriv en ny, komplett side som kan rangere.');
    }
    if (opportunity?.recommendation_text) userParts.push(`Anbefaling fra analysen: ${opportunity.recommendation_text}`);
    if (Array.isArray(targetKeywords) && targetKeywords.length) {
        userParts.push(`Andre søk kunden faktisk finnes på (fra Search Console): ${targetKeywords.slice(0, 6).join(', ')}. Flett inn de som er naturlige.`);
    }
    if (businessContext) userParts.push(`Om bedriften (tekst fra deres egen nettside):\n${businessContext}`);
    if (pageContextText) userParts.push(`Kundens egne svar om sidene sine:\n${pageContextText}`);
    if (allowLinks) {
        userParts.push(`Interne lenkemål (lenk naturlig til 2–4 av disse i brødteksten):\n${linkTargets.map((t) => `- ${t.title ? `${t.title}: ` : ''}${t.url}`).join('\n')}`);
    }
    if (serpTop3) {
        userParts.push(`Topp 3 på Google i dag — dette skal du slå (skriv mer konkret og mer hjelpsomt enn disse):\n${serpTop3.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? ` — ${r.snippet}` : ''}`).join('\n')}`);
    }

    // --- Generer ---
    let aiResult;
    try {
        const response = await fetchExternalWithOptionalRetry('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userParts.join('\n\n') },
                ],
                temperature: 0.4,
                max_tokens: 4096,
            }),
        });
        if (isOpenAiRateLimited(response.status)) {
            throw new ArticleEngineError('rate_limited', 'OpenAI er midlertidig overbelastet. Prøv igjen om litt.', { openAiResponse: response });
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI sier: ${errorData.error?.message || response.statusText}`);
        }
        const data = await response.json();
        const rawContent = (data.choices?.[0]?.message?.content || '').replace(/```json/g, '').replace(/```/g, '').trim();
        aiResult = JSON.parse(rawContent);
    } catch (error) {
        if (error instanceof ArticleEngineError) throw error;
        console.error('[article] Generering feilet:', error);
        Sentry.captureException(error);
        throw new ArticleEngineError('generation_failed', `Klarte ikke å generere artikkelen: ${error.message}`, { cause: error });
    }

    // --- Guardrails ---
    const title = typeof aiResult.title === 'string' ? aiResult.title.trim() : '';
    const metaDescription = typeof aiResult.meta_description === 'string' ? aiResult.meta_description.trim() : '';
    const h1 = typeof aiResult.h1 === 'string' ? aiResult.h1.trim() : title;
    let contentHtml = sanitizeArticleHtml(typeof aiResult.content_html === 'string' ? aiResult.content_html.trim() : '');
    if (allowLinks) {
        contentHtml = enforceLinkAllowlist(contentHtml, linkTargets.map((t) => t.url), websiteUrl || undefined);
    }
    if (!title || !metaDescription || !contentHtml) {
        throw new ArticleEngineError('incomplete', 'AI-en leverte ikke en komplett artikkel. Prøv igjen.');
    }
    const slug = slugifyNo(aiResult.slug || title);

    const qualityNotes = [];
    const wordCount = countWordsInHtml(contentHtml);
    if (wordCount < 700) qualityNotes.push(`Artikkelen ble kortere enn planlagt (${wordCount} ord). Vurder å generere på nytt eller utvide selv.`);
    if (title.length < 40 || title.length > 65) qualityNotes.push(`SEO-tittelen er ${title.length} tegn — 50–60 er idealet.`);
    if (metaDescription.length < 110 || metaDescription.length > 165) qualityNotes.push(`Meta-beskrivelsen er ${metaDescription.length} tegn — 120–158 er idealet.`);
    if (PLACEHOLDER_RE.test(contentHtml)) qualityNotes.push('Teksten inneholder en plassholder du må fylle inn selv før publisering.');

    // FAQ-schema bygges deterministisk fra faq-listen (aldri AI-generert JSON-LD).
    const faqs = (Array.isArray(aiResult.faq) ? aiResult.faq : [])
        .filter((f) => f && typeof f.question === 'string' && typeof f.answer === 'string' && f.question.trim() && f.answer.trim())
        .slice(0, 5);
    const faqJsonld = faqs.length
        ? JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.question.trim(),
                acceptedAnswer: { '@type': 'Answer', text: f.answer.trim() },
            })),
        })
        : null;

    // --- Lagre (portal: RLS insert som brukeren selv; cron: service-role) ---
    const { data: articleRow, error: insertErr } = await supabase
        .from('sikt_articles')
        .insert({
            user_id: userId,
            opportunity_id: opportunity?.id || null,
            keyword,
            mode: articleMode,
            target_page_url: targetPageUrl || null,
            title,
            slug,
            meta_description: metaDescription,
            h1,
            content_html: contentHtml,
            faq_jsonld: faqJsonld,
            status: 'generated',
            position_at_creation: currentPosition,
            source,
            plan_item_id: planItemId,
        })
        .select('*')
        .single();
    if (insertErr || !articleRow) {
        console.error('[article] Lagring feilet:', insertErr?.message || insertErr);
        Sentry.captureException(insertErr || new Error('sikt_articles insert feilet'));
        throw new ArticleEngineError('insert_failed', 'Artikkelen ble generert, men kunne ikke lagres. Prøv igjen.', {
            cause: insertErr,
            // 23505 = unique_violation på plan_item_id-indeksen → allerede generert
            isUniqueViolation: insertErr?.code === '23505',
        });
    }

    return {
        article: articleRow,
        quota: { used: used + 1, limit },
        qualityNotes,
        serpUsed: !!serpTop3,
    };
}

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
import { decrypt } from './_lib/crypto.js';
import { withSentry, Sentry } from './_lib/sentry.js';
import {
    fetchExternalWithOptionalRetry429,
    isSerpApiRateLimitedResponse,
} from './_lib/external-rate-limit.js';
import { renderEmail, sectionHead, winList, railNote, escapeHtml } from './_lib/email.js';
import { crawlSite, normalizePageUrl } from './_lib/site-scan.js';
import { assertSafeUserUrl, assertSafePublicUrl } from './_lib/url-guard.js';
import { classifyLinkCheck, computeLinkSuggestions } from './_lib/link-engine.js';
import { generateArticle, ArticleEngineError, articleLimitForPackage } from './_lib/article-engine.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// --- Varsel-e-post (Resend; samme oppsett som weekly-reports / contact) ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'rapport@siktseo.com';
const UPTIME_MAX = 25;            // maks kunder per kjøring (Hobby 60s-timeout)
const UPTIME_TIMEOUT_MS = 8000;   // ping-timeout per side

// --- Auto-fiks-motor (slått sammen hit for å holde oss under Hobby-grensen på 12 functions) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const APP_BASE_URL =
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
const AF_MAX_FIXES_PER_CUSTOMER = 3;
const AF_MAX_QUEUE_PER_CUSTOMER = 3;
const AF_QUEUE_SCAN_LIMIT = 8;
const AF_META_MIN_LENGTH = 70;
const AF_META_TARGET_MAX = 158;
const AF_TITLE_MIN_LENGTH = 10;
const AF_WP_TIMEOUT_MS = 10_000;
const AF_DEDUP_WINDOW_DAYS = 30;
const AF_PAID_PLANS = new Set(['Basic Pakke', 'Standard Pakke', 'Premium Pakke']);
const AF_BASIC_PLAN = 'Basic Pakke';
const AF_BASIC_ONBOARDING_FIXES = 3; // Basic: engangs «wow» — 3 ekte meta/tittel-fikser i oppstart, så ikke mer

// Delt regel mot oppdiktede påstander — AI-en vet ikke disse fakta om kunden.
const AF_NO_CLAIMS =
    'IKKE finn på fakta du ikke kan vite: ingen priser eller tall, ikke «gratis», ' +
    'ingen «befaring», «butikk», «showroom», åpningstider, antall år erfaring, ' +
    'sertifiseringer eller garantier. Hold deg generell og sannferdig om tjenesten.';

// --- GEO-motor (job=geo): nevner ChatGPT/Gemini/Perplexity Premium-kunden? ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GEO_MAX_CUSTOMERS = 4;   // tak per kjøring (Hobby 60s-timeout)
const GEO_QUESTIONS = 4;       // antall bransjespørsmål per kunde
const GEO_DEDUP_DAYS = 6;      // én GEO-sjekk per kunde per uke
const GEO_TIMEOUT_MS = 12_000;
const GEO_FAQ_PER_RUN = 2;     // maks nye FAQ-utkast per kunde per kjøring (tapte spørsmål)

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
            const serpRes = await fetchExternalWithOptionalRetry429(serpUrl);
            if (serpRes.status === 429) {
                console.warn(`[cron] SerpAPI rate limited for ${competitor.domain} (${kw.keyword}) — hopper over søkeord`);
                Sentry.captureMessage(`[cron] SerpAPI rate limited: ${competitor.domain}`, 'warning');
                continue;
            }
            const serpData = await serpRes.json().catch(() => ({}));
            if (isSerpApiRateLimitedResponse(serpRes.status, serpData)) {
                console.warn(`[cron] SerpAPI throttle for ${competitor.domain} (${kw.keyword}) — hopper over søkeord`);
                Sentry.captureMessage(`[cron] SerpAPI throttle: ${competitor.domain}`, 'warning');
                continue;
            }
            if (!serpRes.ok) continue;
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

// =====================================================================
// AUTO-FIKS-MOTOR (job=autofix): hybrid ukentlig motor.
//  - AUTO-PUSH: meta-description, seo-title → /api/wordpress-push
//  - KØ: h1 → sikt_fix_queue (godkjennes i dashbordet)
// =====================================================================
function afBasicAuth(wpUsername, appPassword) {
    return `Basic ${Buffer.from(`${wpUsername}:${appPassword}`, 'utf8').toString('base64')}`;
}

async function afWpGet(url, authorization) {
    try {
        const response = await fetch(url, {
            headers: { Authorization: authorization, Accept: 'application/json' },
            redirect: 'follow',
            signal: AbortSignal.timeout(AF_WP_TIMEOUT_MS),
        });
        if (!response.url.startsWith('https://')) return { ok: false, data: null };
        let data = null;
        if ((response.headers.get('content-type') || '').includes('application/json')) {
            data = await response.json().catch(() => null);
        }
        return { ok: response.ok, status: response.status, data };
    } catch {
        return { ok: false, data: null };
    }
}

async function afListPages(adminUrl, authorization) {
    const pages = [];
    for (const collection of ['pages', 'posts']) {
        const url = `${adminUrl}/wp-json/wp/v2/${collection}?per_page=50&status=publish&_fields=id,link,title,yoast_head_json`;
        const { ok, data } = await afWpGet(url, authorization);
        if (!ok || !Array.isArray(data)) continue;
        for (const item of data) {
            const link = typeof item?.link === 'string' ? item.link : null;
            if (!link || !link.startsWith('https://')) continue;
            const yoast = item?.yoast_head_json || {};
            const titleObj = item?.title;
            const titleText =
                titleObj && typeof titleObj === 'object' && typeof titleObj.rendered === 'string'
                    ? titleObj.rendered
                    : '';
            pages.push({
                link,
                title: titleText,
                currentMeta: typeof yoast.description === 'string' ? yoast.description.trim() : '',
                currentTitle: typeof yoast.title === 'string' ? yoast.title.trim() : '',
            });
        }
    }
    return pages;
}

async function afPageHasH1(pageUrl) {
    try {
        const response = await fetch(pageUrl, {
            headers: { Accept: 'text/html' },
            redirect: 'follow',
            signal: AbortSignal.timeout(AF_WP_TIMEOUT_MS),
        });
        if (!response.ok) return true;
        const html = await response.text();
        const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
        if (!m) return false;
        const inner = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return inner.length > 0;
    } catch {
        return true;
    }
}

async function afOpenAiText({ system, user, maxTokens = 120, temperature = 0.4 }) {
    if (!OPENAI_API_KEY) return null;
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY.trim()}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature,
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            }),
            signal: AbortSignal.timeout(AF_WP_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const data = await response.json();
        let text = data?.choices?.[0]?.message?.content ?? '';
        return String(text).replace(/\s+/g, ' ').replace(/^["'«»]+|["'«»]+$/g, '').trim();
    } catch {
        return null;
    }
}

async function afGenerateMeta({ pageTitle, pageUrl, companyName }) {
    const text = await afOpenAiText({
        system:
            'Du skriver SEO-meta-beskrivelser på korrekt, naturlig norsk. Krav: 120–158 tegn, ' +
            'aktiv stemme, konkret verdiløfte, viktigste tema naturlig tidlig, ingen klisjeer, ' +
            'ingen keyword-stuffing, ikke kopier sidetittelen ordrett. ' + AF_NO_CLAIMS +
            ' Svar med KUN beskrivelsen.',
        user: `Bedrift: ${companyName || 'ukjent'}\nSidetittel: ${pageTitle || 'ukjent'}\nURL: ${pageUrl}\n\nSkriv én meta-beskrivelse.`,
    });
    if (!text || text.length < 80 || text.length > AF_META_TARGET_MAX + 12) return null;
    return text;
}

async function afGenerateTitle({ pageTitle, pageUrl, companyName }) {
    const text = await afOpenAiText({
        system:
            'Du skriver SEO-titler (<title>) på korrekt, naturlig norsk. Krav: MÅL 50–60 tegn, ' +
            'viktigste tema tidlig (naturlig formulert, ikke rått innlimt), deretter «| Merkenavn», ' +
            'unik per side, ingen klisjeer. ' + AF_NO_CLAIMS + ' Svar med KUN tittelen.',
        user: `Bedrift: ${companyName || 'ukjent'}\nEmne: ${pageTitle || 'ukjent'}\nURL: ${pageUrl}\n\nSkriv én SEO-tittel.`,
        maxTokens: 40,
    });
    if (!text || text.length < 15 || text.length > 70) return null;
    return text;
}

async function afGenerateH1({ pageTitle, pageUrl, companyName }) {
    const text = await afOpenAiText({
        system:
            'Du skriver synlige sideoverskrifter (H1) på norsk. Krav: kort og tydelig (maks ~70 tegn), ' +
            'beskriver hva siden handler om, naturlig språk, ingen klisjeer. Svar med KUN overskriften.',
        user: `Bedrift: ${companyName || 'ukjent'}\nSidetittel: ${pageTitle || 'ukjent'}\nURL: ${pageUrl}\n\nSkriv én H1-overskrift.`,
        maxTokens: 40,
    });
    if (!text || text.length < 5 || text.length > 90) return null;
    return text;
}

async function afPushFix({ userId, pageUrl, field, newValue }) {
    const res = await fetch(`${APP_BASE_URL}/api/wordpress-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
        body: JSON.stringify({ userId, pageUrl, field, newValue }),
        signal: AbortSignal.timeout(AF_WP_TIMEOUT_MS + 5_000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.ok === true, error: data?.error || null };
}

async function runAutoFix(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    if (!APP_BASE_URL) {
        return res.status(500).json({ error: 'APP_BASE_URL/VERCEL_URL mangler — vet ikke hvor /api/wordpress-push er.' });
    }

    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: hosts, error: hostsErr } = await supabase
        .from('client_hosts')
        .select('user_id, admin_url, notes, access_token_encrypted, connection_mode, platform')
        .eq('platform', 'wordpress')
        .eq('connection_mode', 'full');

    if (hostsErr) {
        Sentry.captureException(hostsErr);
        return res.status(500).json({ error: 'Kunne ikke hente WordPress-tilkoblinger.' });
    }

    const summary = { customers: 0, autoFixed: 0, queued: 0, skipped: 0, errors: 0, dryRun };
    const dedupSince = new Date(Date.now() - AF_DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    for (const host of hosts || []) {
        if (!host?.admin_url || !host?.notes || !host?.access_token_encrypted) continue;

        const { data: client } = await supabase
            .from('clients')
            .select('package_name, company_name')
            .eq('user_id', host.user_id)
            .maybeSingle();
        if (!client || !AF_PAID_PLANS.has(client.package_name)) continue;

        // Basic får kun en engangs «wow» (3 ekte meta/tittel-fikser i oppstart).
        // Standard/Premium får løpende fikser opp til AF_MAX_FIXES_PER_CUSTOMER per kjøring.
        const isBasic = client.package_name === AF_BASIC_PLAN;
        if (isBasic) {
            const { count: prevFixCount } = await supabase
                .from('sikt_changes')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', host.user_id);
            if ((prevFixCount ?? 0) >= AF_BASIC_ONBOARDING_FIXES) continue;
        }
        const maxFixes = isBasic ? AF_BASIC_ONBOARDING_FIXES : AF_MAX_FIXES_PER_CUSTOMER;

        summary.customers += 1;

        let appPassword;
        try {
            appPassword = decrypt(host.access_token_encrypted);
        } catch (e) {
            summary.errors += 1;
            console.warn('[autofix] dekryptering feilet for', host.user_id, e?.message || e);
            continue;
        }
        const adminUrl = host.admin_url.trim();
        const authorization = afBasicAuth(host.notes.trim(), appPassword);
        const companyName = client.company_name;

        let pages;
        try {
            pages = await afListPages(adminUrl, authorization);
        } catch (e) {
            summary.errors += 1;
            console.warn('[autofix] kunne ikke liste sider for', host.user_id, e?.message || e);
            continue;
        }

        const recentlyChanged = async (pageUrl, field) => {
            const { data } = await supabase
                .from('sikt_changes')
                .select('id')
                .eq('user_id', host.user_id)
                .eq('page_url', pageUrl)
                .eq('field', field)
                .gte('pushed_at', dedupSince)
                .limit(1);
            return Array.isArray(data) && data.length > 0;
        };

        // AUTO-PUSH: meta-description + seo-title
        let autoCount = 0;
        for (const page of pages) {
            if (autoCount >= maxFixes) break;
            const jobs = [];
            if (page.currentMeta.length < AF_META_MIN_LENGTH) jobs.push({ field: 'meta-description', gen: afGenerateMeta });
            if (page.currentTitle.length < AF_TITLE_MIN_LENGTH) jobs.push({ field: 'seo-title', gen: afGenerateTitle });

            for (const job of jobs) {
                if (autoCount >= maxFixes) break;
                if (await recentlyChanged(page.link, job.field)) { summary.skipped += 1; continue; }
                const value = await job.gen({ pageTitle: page.title, pageUrl: page.link, companyName });
                if (!value) { summary.skipped += 1; continue; }
                if (dryRun) { summary.autoFixed += 1; autoCount += 1; continue; }
                const result = await afPushFix({ userId: host.user_id, pageUrl: page.link, field: job.field, newValue: value });
                if (result.ok) { summary.autoFixed += 1; autoCount += 1; }
                else { summary.errors += 1; console.warn('[autofix] push feilet:', job.field, page.link, result.error); }
            }
        }

        // KØ: manglende H1 — kun Standard+ (Basic får bare engangs meta/tittel-fiksene i oppstart)
        if (!isBasic) {
        let queueCount = 0;
        for (const page of pages.slice(0, AF_QUEUE_SCAN_LIMIT)) {
            if (queueCount >= AF_MAX_QUEUE_PER_CUSTOMER) break;
            const { data: existingQ } = await supabase
                .from('sikt_fix_queue')
                .select('id')
                .eq('user_id', host.user_id)
                .eq('page_url', page.link)
                .eq('field', 'h1')
                .in('status', ['pending', 'approved'])
                .limit(1);
            if (Array.isArray(existingQ) && existingQ.length > 0) continue;
            if (await recentlyChanged(page.link, 'h1')) continue;
            if (await afPageHasH1(page.link)) continue;

            const suggested = await afGenerateH1({ pageTitle: page.title, pageUrl: page.link, companyName });
            if (!suggested) { summary.skipped += 1; continue; }
            if (dryRun) { summary.queued += 1; queueCount += 1; continue; }
            const { error: qErr } = await supabase.from('sikt_fix_queue').insert({
                user_id: host.user_id,
                page_url: page.link,
                field: 'h1',
                current_value: null,
                suggested_value: suggested,
                explanation: 'Siden mangler en synlig overskrift (H1). Google og besøkende bruker H1 til å forstå hva siden handler om.',
                status: 'pending',
            });
            if (qErr) { summary.errors += 1; console.warn('[autofix] kunne ikke kø-lagre H1:', page.link, qErr.message); }
            else { summary.queued += 1; queueCount += 1; }
        }
        } // /if (!isBasic) — Basic hopper over H1-køen
    }

    console.log('[autofix] ferdig:', JSON.stringify(summary));
    return res.status(200).json(summary);
}

// =====================================================================
// GEO-MOTOR (job=geo): spør ChatGPT/Gemini/Perplexity om bransjespørsmål og
// registrerer om Premium-kundens bedrift nevnes i svaret.
// =====================================================================
function geoDomainCore(url) {
    if (!url) return '';
    try {
        const u = String(url).startsWith('http') ? String(url) : `https://${url}`;
        const host = new URL(u).hostname.replace(/^www\./i, '');
        const parts = host.split('.');
        return (parts.length >= 2 ? parts[parts.length - 2] : parts[0]) || '';
    } catch {
        return String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0] || '';
    }
}

function geoMentioned(answer, company, domainCore) {
    if (!answer) return false;
    const hay = String(answer).toLowerCase();
    const needles = [];
    if (company && company.trim().length >= 3) needles.push(company.trim().toLowerCase());
    if (domainCore && domainCore.length >= 3) needles.push(domainCore.toLowerCase());
    return needles.some((n) => hay.includes(n));
}

async function geoGenerateQuestions(company, domainCore) {
    const text = await afOpenAiText({
        system:
            'Du lager realistiske norske søk en potensiell kunde ville stilt en AI-assistent ' +
            '(ChatGPT/Gemini/Perplexity) når de leter etter en leverandør i denne bransjen. ' +
            'IKKE nevn bedriftsnavnet i spørsmålene. Returner KUN en JSON-array med strenger.',
        user: `Bedrift: ${company || domainCore}\nDomene: ${domainCore || 'ukjent'}\nLag ${GEO_QUESTIONS} korte kjøper-spørsmål (norsk) for å finne en slik leverandør.`,
        maxTokens: 300,
    });
    if (!text) return [];
    try {
        const m = text.match(/\[[\s\S]*\]/);
        const arr = JSON.parse(m ? m[0] : text);
        if (!Array.isArray(arr)) return [];
        return arr.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim()).slice(0, GEO_QUESTIONS);
    } catch {
        return [];
    }
}

// GEO-action: skriv det ideelle svaret som ville fått bedriften sitert av en AI
// på et spørsmål den IKKE ble nevnt på. Mates (etter godkjenning) inn i llms.txt + FAQPage-schema.
async function geoGenerateFaqAnswer(question, company, domainCore) {
    const answer = await afOpenAiText({
        system:
            'Du skriver et kort, faktabasert FAQ-svar på norsk som posisjonerer bedriften som et godt ' +
            'svar på spørsmålet — slik en AI-assistent ville sitert. Krav: 2–4 setninger, konkret, ' +
            'nevn bedriften naturlig, ingen tomme superlativer. ' + AF_NO_CLAIMS +
            ' Svar med KUN svarteksten.',
        user: `Bedrift: ${company || domainCore}\nSpørsmål fra en potensiell kunde: ${question}\nSkriv ett FAQ-svar.`,
        maxTokens: 200,
        temperature: 0.5,
    });
    return answer && answer.length >= 40 ? answer : null;
}

async function geoAskChatGPT(question) {
    if (!OPENAI_API_KEY) return null;
    try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY.trim()}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 400, messages: [{ role: 'user', content: question }] }),
            signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
        });
        if (!r.ok) return null;
        const d = await r.json();
        return d?.choices?.[0]?.message?.content || null;
    } catch {
        return null;
    }
}

let geoGeminiStatus = null; // siste Gemini-status (diagnose, vises i summary)
async function geoAskGemini(question) {
    if (!GEMINI_API_KEY) return null;
    try {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: question }] }] }),
                signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
            },
        );
        if (!r.ok) {
            geoGeminiStatus = `HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`;
            return null;
        }
        geoGeminiStatus = 'ok';
        const d = await r.json();
        const parts = d?.candidates?.[0]?.content?.parts;
        return Array.isArray(parts) ? (parts.map((p) => p?.text || '').join(' ').trim() || null) : null;
    } catch {
        return null;
    }
}

async function geoAskPerplexity(question) {
    if (!PERPLEXITY_API_KEY) return null;
    try {
        const r = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PERPLEXITY_API_KEY.trim()}` },
            body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: question }] }),
            signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
        });
        if (!r.ok) return null;
        const d = await r.json();
        return d?.choices?.[0]?.message?.content || null;
    } catch {
        return null;
    }
}

async function runGeo(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await supabase
        .from('clients')
        .select('user_id, company_name, website_url')
        .eq('package_name', 'Premium Pakke');
    if (error) {
        Sentry.captureException(error);
        return res.status(500).json({ error: 'Kunne ikke hente Premium-kunder.' });
    }

    const providers = {
        chatgpt: !!OPENAI_API_KEY,
        gemini: !!GEMINI_API_KEY,
        perplexity: !!PERPLEXITY_API_KEY,
    };
    geoGeminiStatus = null;
    const summary = { providers, customers: 0, checks: 0, mentions: 0, skipped: 0, errors: 0, dryRun, faqSamples: [] };
    const since = new Date(Date.now() - GEO_DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let processed = 0;
    for (const client of clients || []) {
        if (processed >= GEO_MAX_CUSTOMERS) break;
        const company = (client.company_name || '').trim();
        const domainCore = geoDomainCore(client.website_url);
        if (!company && !domainCore) { summary.skipped += 1; continue; }

        const { data: recent } = await supabase
            .from('geo_checks')
            .select('id')
            .eq('user_id', client.user_id)
            .gte('checked_at', since)
            .limit(1);
        if (Array.isArray(recent) && recent.length) { summary.skipped += 1; continue; }

        const questions = await geoGenerateQuestions(company, domainCore);
        if (questions.length === 0) { summary.skipped += 1; continue; }
        processed += 1;
        summary.customers += 1;

        const rows = [];
        const lostQuestions = []; // spørsmål bedriften IKKE ble nevnt på (av noen)
        for (const q of questions) {
            const [cg, gm, px] = await Promise.all([
                providers.chatgpt ? geoAskChatGPT(q) : Promise.resolve(null),
                providers.gemini ? geoAskGemini(q) : Promise.resolve(null),
                providers.perplexity ? geoAskPerplexity(q) : Promise.resolve(null),
            ]);
            let anyMention = false;
            let anyAnswer = false;
            for (const [provider, ans] of [['chatgpt', cg], ['gemini', gm], ['perplexity', px]]) {
                if (ans == null) continue;
                anyAnswer = true;
                const mentioned = geoMentioned(ans, company, domainCore);
                summary.checks += 1;
                if (mentioned) { summary.mentions += 1; anyMention = true; }
                rows.push({ user_id: client.user_id, provider, question: q, mentioned, answer_excerpt: String(ans).slice(0, 300) });
            }
            if (anyAnswer && !anyMention) lostQuestions.push(q);
        }
        if (!dryRun && rows.length) {
            const { error: insErr } = await supabase.from('geo_checks').insert(rows);
            if (insErr) { summary.errors += 1; console.warn('[geo] insert feilet:', insErr.message); }
        }

        // GEO-action: lag FAQ-utkast for tapte spørsmål → kø for kundens godkjenning.
        summary.faqsDrafted = summary.faqsDrafted || 0;
        for (const q of lostQuestions.slice(0, GEO_FAQ_PER_RUN)) {
            const answer = await geoGenerateFaqAnswer(q, company, domainCore);
            if (!answer) continue;
            if (dryRun) {
                if (summary.faqSamples.length < 8) summary.faqSamples.push({ question: q, answer });
                summary.faqsDrafted += 1; continue;
            }
            const { error: faqErr } = await supabase
                .from('geo_faqs')
                .upsert(
                    { user_id: client.user_id, question: q, answer, source_provider: null, status: 'pending' },
                    { onConflict: 'user_id,question', ignoreDuplicates: true },
                );
            if (faqErr) { summary.errors += 1; console.warn('[geo] faq insert feilet:', faqErr.message); }
            else summary.faqsDrafted += 1;
        }
    }

    summary.geminiStatus = geoGeminiStatus;
    console.log('[geo] ferdig:', JSON.stringify(summary));
    return res.status(200).json(summary);
}

// =====================================================================
// MULIGHETS-MOTOR (job=opportunities): «Nesten på side 1» + innholds-forfall.
// Leser GSC-data (keywords-tabellen via sites), tar ukentlig snapshot i
// keyword_snapshots, og skriver forslag/varsler til sikt_actions +
// keyword_opportunities (som mater «Ukens mulighet» i kvitteringen).
// Kjører for ALLE betalende kunder — dette er Basic sin kjerneverdi.
// =====================================================================
const OPP_MAX_CUSTOMERS = 6;        // Hobby 60s-timeout
const OPP_NEAR_MISS_PER_RUN = 3;    // maks nye nesten-på-side-1 per kunde
const OPP_DECAY_PER_RUN = 2;        // maks forfall-varsler per kunde
const OPP_DEDUP_DAYS = 30;          // ikke gjenta samme nesten-på-side-1
const OPP_DECAY_DEDUP_DAYS = 14;    // ikke gjenta samme forfall-varsel
const OPP_MIN_DROP = 3;             // posisjonsfall som regnes som forfall
const OPP_SNAPSHOT_CAP = 100;       // maks søkeord i ukens snapshot
const OPP_GSC_REFRESH_DAYS = 3;     // hent fersk GSC-data hvis eldre enn dette
const OPP_GSC_TIMEOUT_MS = 15_000;  // budsjett per GSC-refresh (best effort)

// Fersk GSC-data ved kilden: kall scan-search-console-edge-funksjonen med
// service-role (den har en egen service-gren som tar user_id i body).
// Best effort — feiler den, kjører motoren videre på dataene vi har.
async function oppRefreshGscData(userId, siteId) {
    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/scan-search-console`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({ site_id: siteId, user_id: userId }),
            signal: AbortSignal.timeout(OPP_GSC_TIMEOUT_MS),
        });
        return resp.ok;
    } catch {
        return false;
    }
}

function oppEstimatedClicks(impressions) {
    // Grovt estimat: ~7 % CTR på posisjon 4–5 mot ~1–2 % på side 2.
    return Math.max(5, Math.round((impressions || 0) * 0.07));
}

async function oppGenerateRecipe({ keyword, position, companyName }) {
    const fallback =
        `Du er nr. ${Math.round(position)} på «${keyword}». Utvid siden som rangerer med et avsnitt ` +
        `som svarer direkte på søket, og få «${keyword}» inn i sidetittelen. Det er ofte nok til side 1.`;
    const text = await afOpenAiText({
        system:
            'Du er SEO-rådgiver for norske småbedrifter. Gi ÉN konkret, gjennomførbar oppskrift ' +
            '(2–3 setninger, plain norsk, ingen jargon) for å løfte et søkeord fra side 2 til side 1. ' +
            'Vær spesifikk: hva slags avsnitt/tittel/innhold de skal legge til. Svar med KUN oppskriften.',
        user: `Bedrift: ${companyName || 'ukjent'}\nSøkeord: ${keyword}\nNåværende posisjon: ${Math.round(position)}`,
        maxTokens: 160,
    });
    return text && text.length > 30 ? text : fallback;
}

async function oppGenerateRefresh({ keyword, prevPosition, position, companyName }) {
    const fallback =
        `«${keyword}» falt fra ${Math.round(prevPosition)} til ${Math.round(position)}. Oppdater siden med ` +
        `ferskt innhold (dato, priser, et nytt avsnitt) — Google belønner nylig oppdaterte sider.`;
    const text = await afOpenAiText({
        system:
            'Du er SEO-rådgiver for norske småbedrifter. En side har falt på Google. Gi ÉN konkret ' +
            'oppfriskings-oppskrift (2–3 setninger, plain norsk): hva de bør oppdatere/legge til for å ' +
            'ta tilbake posisjonen. Svar med KUN oppskriften.',
        user: `Bedrift: ${companyName || 'ukjent'}\nSøkeord: ${keyword}\nFalt fra posisjon ${Math.round(prevPosition)} til ${Math.round(position)}.`,
        maxTokens: 160,
    });
    return text && text.length > 30 ? text : fallback;
}

async function runOpportunities(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await supabase
        .from('clients')
        .select('user_id, company_name, package_name, email, contact_person, website_url, notification_preferences')
        .not('package_name', 'is', null);
    if (error) {
        Sentry.captureException(error);
        return res.status(500).json({ error: 'Kunne ikke hente kunder.' });
    }

    const summary = { customers: 0, nearMiss: 0, decay: 0, snapshots: 0, rankEmails: 0, skipped: 0, errors: 0, dryRun };
    const dedupSince = new Date(Date.now() - OPP_DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const decayDedupSince = new Date(Date.now() - OPP_DECAY_DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // Forrige snapshot: 4–10 dager gammelt (ukentlig kjøring med slack)
    const snapFrom = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const snapTo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

    let processed = 0;
    for (const client of clients || []) {
        if (processed >= OPP_MAX_CUSTOMERS) break;

        // GSC-data ligger i keywords-tabellen, nøklet på site_id
        const { data: site } = await supabase
            .from('sites')
            .select('id, last_scanned_at, google_search_console_connected')
            .eq('user_id', client.user_id)
            .maybeSingle();
        if (!site?.id) { summary.skipped += 1; continue; }

        // Fersk GSC-data FØR vi leser keywords — motoren skal ikke være
        // avhengig av at kunden trykker «Hent søkeord» i portalen.
        const gscStaleCutoff = new Date(Date.now() - OPP_GSC_REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
        if (site.google_search_console_connected &&
            (!site.last_scanned_at || site.last_scanned_at < gscStaleCutoff)) {
            const refreshed = await oppRefreshGscData(client.user_id, site.id);
            if (refreshed) summary.gscRefreshed = (summary.gscRefreshed || 0) + 1;
        }

        const { data: kws } = await supabase
            .from('keywords')
            .select('keyword, position, clicks, impressions')
            .eq('site_id', site.id)
            .order('impressions', { ascending: false })
            .limit(OPP_SNAPSHOT_CAP);
        if (!kws || kws.length === 0) { summary.skipped += 1; continue; }

        processed += 1;
        summary.customers += 1;

        // --- Forrige ukes snapshot (for forfall-sammenligning) — hentes FØR vi skriver nytt ---
        const { data: prevSnap } = await supabase
            .from('keyword_snapshots')
            .select('keyword, position, captured_at')
            .eq('user_id', client.user_id)
            .gte('captured_at', snapFrom)
            .lte('captured_at', snapTo)
            .order('captured_at', { ascending: false });
        const prevByKeyword = new Map();
        for (const row of prevSnap || []) {
            if (!prevByKeyword.has(row.keyword)) prevByKeyword.set(row.keyword, row.position);
        }

        // --- Ukentlig snapshot ---
        if (!dryRun) {
            const snapRows = kws.map(k => ({
                user_id: client.user_id,
                keyword: k.keyword,
                position: k.position,
                clicks: k.clicks,
                impressions: k.impressions,
            }));
            const { error: snapErr } = await supabase.from('keyword_snapshots').insert(snapRows);
            if (snapErr) { summary.errors += 1; console.warn('[opp] snapshot feilet:', snapErr.message); }
            else summary.snapshots += snapRows.length;
        }

        // --- Dedupe: hvilke søkeord har fått forslag nylig? ---
        const { data: recentActions } = await supabase
            .from('sikt_actions')
            .select('action_type, details, created_at')
            .eq('user_id', client.user_id)
            .in('action_type', ['near_miss', 'decay'])
            .gte('created_at', dedupSince);
        const recentNearMiss = new Set();
        const recentDecay = new Set();
        for (const a of recentActions || []) {
            const kw = a?.details?.keyword;
            if (!kw) continue;
            if (a.action_type === 'near_miss') recentNearMiss.add(kw);
            if (a.action_type === 'decay' && a.created_at >= decayDedupSince) recentDecay.add(kw);
        }

        // --- 1) Nesten på side 1: posisjon 11–20, høyest visninger først ---
        const nearMisses = kws
            .filter(k => typeof k.position === 'number' && k.position > 10.4 && k.position <= 20 && !recentNearMiss.has(k.keyword))
            .slice(0, OPP_NEAR_MISS_PER_RUN);

        for (const k of nearMisses) {
            const estClicks = oppEstimatedClicks(k.impressions);
            const recipe = await oppGenerateRecipe({ keyword: k.keyword, position: k.position, companyName: client.company_name });
            if (dryRun) { summary.nearMiss += 1; continue; }

            // Mat «Ukens mulighet» i kvitteringen (samme tabell som konkurrent-gap).
            // NB: difficulty er TEXT med check (easy/medium/hard) — pos 11–20 = medium.
            const { error: oppUpsertErr } = await supabase.from('keyword_opportunities').upsert({
                user_id: client.user_id,
                keyword: k.keyword,
                search_volume: k.impressions || 0,
                difficulty: 'medium',
                recommendation_type: 'gsc_near_miss',
                recommendation_text: recipe,
                estimated_traffic: estClicks,
                competitor_ids: [],
                discovered_at: new Date().toISOString(),
            }, { onConflict: 'user_id,keyword' });
            if (oppUpsertErr) { summary.errors += 1; console.warn('[opp] opportunity upsert feilet:', oppUpsertErr.message); }

            const { error: actErr } = await supabase.from('sikt_actions').insert({
                user_id: client.user_id,
                action_type: 'near_miss',
                category: 'suggestion',
                title: `Nesten på side 1: «${k.keyword}» (nr. ${Math.round(k.position)})`,
                details: {
                    keyword: k.keyword,
                    position: k.position,
                    impressions: k.impressions,
                    estimated_clicks: estClicks,
                    explanation: `Du er nr. ${Math.round(k.position)} — ${estClicks}+ ekstra besøk/mnd venter på side 1.`,
                    recipe,
                },
                page_url: null,
                status: 'open',
            });
            if (actErr) { summary.errors += 1; console.warn('[opp] near_miss insert feilet:', actErr.message); }
            else summary.nearMiss += 1;
        }

        // --- 2) Innholds-forfall: falt ≥3 plasser siden forrige snapshot ---
        const decays = kws
            .map(k => ({ ...k, prevPosition: prevByKeyword.get(k.keyword) }))
            .filter(k =>
                typeof k.position === 'number' &&
                typeof k.prevPosition === 'number' &&
                k.prevPosition <= 20 &&
                k.position - k.prevPosition >= OPP_MIN_DROP &&
                !recentDecay.has(k.keyword)
            )
            .sort((a, b) => (b.position - b.prevPosition) - (a.position - a.prevPosition))
            .slice(0, OPP_DECAY_PER_RUN);

        for (const k of decays) {
            const recipe = await oppGenerateRefresh({ keyword: k.keyword, prevPosition: k.prevPosition, position: k.position, companyName: client.company_name });
            if (dryRun) { summary.decay += 1; continue; }
            const { error: actErr } = await supabase.from('sikt_actions').insert({
                user_id: client.user_id,
                action_type: 'decay',
                category: 'alert',
                title: `«${k.keyword}» falt fra ${Math.round(k.prevPosition)} til ${Math.round(k.position)}`,
                details: {
                    keyword: k.keyword,
                    prev_position: k.prevPosition,
                    position: k.position,
                    explanation: 'Siden taper synlighet — oppfrisking nå tar den som regel tilbake.',
                    recipe,
                },
                page_url: null,
                status: 'open',
            });
            if (actErr) { summary.errors += 1; console.warn('[opp] decay insert feilet:', actErr.message); }
            else summary.decay += 1;
        }

        // --- Rangeringsvarsel: søkeord som krysset inn/ut av side 1 (topp 10) ---
        // Naturlig dedup: «kryssing» krever at forrige snapshot lå på motsatt
        // side av topp 10, så et stabilt søkeord trigger ikke uke etter uke.
        const crossings = [];
        for (const k of kws) {
            const prev = prevByKeyword.get(k.keyword);
            if (typeof k.position !== 'number' || typeof prev !== 'number') continue;
            const enteredTop10 = prev > 10 && k.position <= 10;
            const leftTop10 = prev <= 10 && k.position > 10;
            if (enteredTop10 || leftTop10) {
                crossings.push({
                    keyword: k.keyword,
                    from: Math.round(prev),
                    to: Math.round(k.position),
                    tone: enteredTop10 ? 'up' : 'down',
                    flag: enteredTop10 ? 'inn på side 1' : 'ut av side 1',
                });
            }
        }
        // rankChanges er opt-in (av som standard): send kun når kunden eksplisitt har
        // skrudd den på. Ukerapport + kritiske varsler er motsatt (opt-out, !== false).
        if (!dryRun && crossings.length > 0 && client.email &&
            client.notification_preferences?.rankChanges === true) {
            const ok = await sendSiktEmail({
                to: client.email,
                subject: crossings.some((c) => c.tone === 'up')
                    ? 'Du beveget deg på Google denne uken'
                    : 'Rangeringsendring på Google',
                html: buildRankEmail(client, crossings),
            });
            if (ok) summary.rankEmails += 1; else summary.errors += 1;
        }
    }

    console.log('[opp] ferdig:', JSON.stringify(summary));
    return res.status(200).json(summary);
}

// =====================================================================
// GBP-MOTOR (job=gbp): månedlig sjekk av Google Business-profilen via
// SerpAPI (Google Maps). Funn + AI-svarutkast på anmeldelser skrives til
// sikt_actions. For lokale bedrifter er Maps-profilen ofte viktigere enn
// nettsiden — dette er differensierende Basic-verdi.
// =====================================================================
const GBP_MAX_CUSTOMERS = 5;     // SerpAPI-budsjett + Hobby-timeout
const GBP_DEDUP_DAYS = 25;       // ~månedlig per kunde
const GBP_MAX_REVIEW_DRAFTS = 2; // maks svarutkast per kjøring

function gbpDomainOf(url) {
    if (!url) return '';
    try {
        const u = String(url).startsWith('http') ? String(url) : `https://${url}`;
        return new URL(u).hostname.replace(/^www\./i, '').toLowerCase();
    } catch { return ''; }
}

function gbpFindPlace(serpJson, companyName, websiteDomain) {
    if (serpJson?.place_results?.title) return serpJson.place_results;
    const locals = Array.isArray(serpJson?.local_results) ? serpJson.local_results : [];
    const nameLc = (companyName || '').toLowerCase();
    return locals.find(p => {
        const t = (p.title || '').toLowerCase();
        const w = gbpDomainOf(p.website);
        return (websiteDomain && w === websiteDomain) || (nameLc && (t.includes(nameLc) || nameLc.includes(t)));
    }) || null;
}

async function gbpDraftReply({ reviewText, rating, reviewer, companyName }) {
    return afOpenAiText({
        system:
            'Du skriver svar på Google-anmeldelser for norske småbedrifter. Krav: 2–4 setninger, ' +
            'varmt og profesjonelt, takk alltid, ved kritikk: beklag konkret og inviter til dialog — ' +
            'aldri defensivt. Ikke lov rabatter. Svar med KUN svarteksten.',
        user: `Bedrift: ${companyName}\nAnmelder: ${reviewer || 'kunde'}\nVurdering: ${rating || '?'} av 5\nAnmeldelse: ${String(reviewText || '').slice(0, 500)}`,
        maxTokens: 180,
        temperature: 0.6,
    });
}

async function runGbp(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    if (!SERP_API_KEY) {
        return res.status(500).json({ error: 'SERP_API_KEY mangler på serveren' });
    }
    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await supabase
        .from('clients')
        .select('user_id, company_name, website_url, package_name')
        .not('package_name', 'is', null)
        .not('company_name', 'is', null);
    if (error) {
        Sentry.captureException(error);
        return res.status(500).json({ error: 'Kunne ikke hente kunder.' });
    }

    const summary = { customers: 0, findings: 0, replyDrafts: 0, notFound: 0, skipped: 0, errors: 0, dryRun };
    const dedupSince = new Date(Date.now() - GBP_DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let processed = 0;
    for (const client of clients || []) {
        if (processed >= GBP_MAX_CUSTOMERS) break;
        const company = (client.company_name || '').trim();
        if (!company) { summary.skipped += 1; continue; }

        // Månedlig dedupe
        const { data: recent } = await supabase
            .from('sikt_actions')
            .select('id')
            .eq('user_id', client.user_id)
            .eq('action_type', 'gbp_check')
            .gte('created_at', dedupSince)
            .limit(1);
        if (Array.isArray(recent) && recent.length) { summary.skipped += 1; continue; }

        processed += 1;
        summary.customers += 1;

        // --- Slå opp bedriften på Google Maps ---
        let serpJson = null;
        try {
            const url = `https://serpapi.com/search.json?engine=google_maps&type=search&q=${encodeURIComponent(company)}&google_domain=google.no&hl=no&gl=no&api_key=${SERP_API_KEY}`;
            const r = await fetchExternalWithOptionalRetry429(url);
            const rData = await r.json().catch(() => ({}));
            // isSerpApiRateLimitedResponse tar (status, data) — ikke Response-objektet.
            if (isSerpApiRateLimitedResponse(r.status, rData)) { summary.errors += 1; break; }
            if (r.ok) serpJson = rData;
        } catch (e) {
            summary.errors += 1;
            console.warn('[gbp] SerpAPI feilet for', company, e?.message || e);
            continue;
        }

        const websiteDomain = gbpDomainOf(client.website_url);
        const place = serpJson ? gbpFindPlace(serpJson, company, websiteDomain) : null;
        const actions = [];

        if (!place) {
            summary.notFound += 1;
            actions.push({
                category: 'finding',
                title: 'Fant ikke bedriften din på Google Maps',
                details: {
                    explanation:
                        `Vi søkte etter «${company}» på Google Maps uten klart treff. Uten en Google ` +
                        'Business-profil er du usynlig i kart-søk — der mange lokale kunder leter først.',
                    recipe: 'Opprett (eller gjør krav på) profilen gratis på business.google.com. Det tar ca. 15 minutter og er noe av det mest verdifulle du kan gjøre for lokal synlighet.',
                },
            });
        } else {
            const rating = place.rating ?? null;
            const reviews = place.reviews ?? 0;
            const hasHours = !!(place.hours || place.operating_hours || place.open_state);
            const hasWebsite = !!place.website;

            if (!hasHours) {
                actions.push({
                    category: 'finding',
                    title: 'Google-profilen mangler åpningstider',
                    details: {
                        explanation: 'Kunder som ikke finner åpningstider, velger ofte konkurrenten som viser dem. Dette er 2 minutters jobb med stor effekt.',
                        recipe: 'Logg inn på business.google.com → Rediger profil → Åpningstider, og fyll inn alle dager.',
                    },
                });
            }
            if (!hasWebsite && client.website_url) {
                actions.push({
                    category: 'finding',
                    title: 'Google-profilen mangler lenke til nettsiden din',
                    details: {
                        explanation: 'Profilen din sender ingen besøkende til nettsiden — du går glipp av gratis trafikk fra kartsøk.',
                        recipe: `Logg inn på business.google.com → Rediger profil → Nettsted, og legg inn ${client.website_url}.`,
                    },
                });
            }
            if (reviews > 0 && reviews < 10) {
                actions.push({
                    category: 'suggestion',
                    title: `Kun ${reviews} Google-anmeldelser — be de beste kundene dine om flere`,
                    details: {
                        explanation: `Du har ${rating ? rating + '★ på ' : ''}${reviews} anmeldelser. Bedrifter med 10+ vinner ofte kartsøket. Send lenken til 5 fornøyde kunder denne uken.`,
                        recipe: 'Finn delingslenken på business.google.com → «Be om anmeldelser», og send den på SMS/e-post til de siste fornøyde kundene dine.',
                    },
                });
            }

            // --- Svarutkast på ubesvarte anmeldelser ---
            if (place.data_id && reviews > 0 && summary.replyDrafts < GBP_MAX_REVIEW_DRAFTS * GBP_MAX_CUSTOMERS) {
                try {
                    const rUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${encodeURIComponent(place.data_id)}&hl=no&sort_by=newestFirst&api_key=${SERP_API_KEY}`;
                    const rr = await fetchExternalWithOptionalRetry429(rUrl);
                    if (rr.ok) {
                        const rJson = await rr.json();
                        const unanswered = (rJson?.reviews || [])
                            .filter(rev => !rev?.response?.snippet && (rev?.snippet || '').length > 0)
                            .slice(0, GBP_MAX_REVIEW_DRAFTS);
                        for (const rev of unanswered) {
                            const reply = await gbpDraftReply({
                                reviewText: rev.snippet,
                                rating: rev.rating,
                                reviewer: rev?.user?.name,
                                companyName: company,
                            });
                            if (!reply) continue;
                            actions.push({
                                category: 'suggestion',
                                title: `Svarutkast klart: anmeldelse fra ${rev?.user?.name || 'en kunde'} (${rev.rating || '?'}★)`,
                                details: {
                                    explanation: `Ubesvart anmeldelse: «${String(rev.snippet).slice(0, 140)}…» Bedrifter som svarer på anmeldelser, oppfattes som mer til å stole på — av både kunder og Google.`,
                                    recipe: 'Kopier svaret under, logg inn på business.google.com → Anmeldelser, og lim inn.',
                                    reply,
                                },
                            });
                            summary.replyDrafts += 1;
                        }
                    }
                } catch (e) {
                    console.warn('[gbp] reviews feilet for', company, e?.message || e);
                }
            }

            // Alltid én månedlig status-rad (dedupe-anker + synlig i kvitteringen)
            actions.push({
                category: 'finding',
                title: rating
                    ? `Google-profil sjekket: ${rating}★ (${reviews} anmeldelser)`
                    : 'Google-profilen din er sjekket',
                details: {
                    explanation: 'Månedlig kontroll av Google Business-profilen: synlighet, åpningstider, nettside-lenke og anmeldelser.',
                    rating,
                    reviews,
                },
            });
        }

        if (dryRun) { summary.findings += actions.length; continue; }
        for (const a of actions) {
            const { error: actErr } = await supabase.from('sikt_actions').insert({
                user_id: client.user_id,
                action_type: 'gbp_check',
                category: a.category,
                title: a.title,
                details: a.details,
                page_url: null,
                status: 'open',
            });
            if (actErr) { summary.errors += 1; console.warn('[gbp] insert feilet:', actErr.message); }
            else summary.findings += 1;
        }
    }

    console.log('[gbp] ferdig:', JSON.stringify(summary));
    return res.status(200).json(summary);
}

// =====================================================================
// OPTIMALISERINGS-MOTOR (job=optimize): gjør Standard+ til en motor som
// ALDRI går tom for arbeid. Skifter fra reparasjon (endelig) til
// optimalisering (uendelig): near-miss-løft, forfall-oppfrisking,
// strukturert data (schema) og alt-tekster. Kun betalende kunder med
// WordPress-full — Basic får forslagene, Standard+ får dem UTFØRT.
// =====================================================================
const OPT_MAX_CUSTOMERS = 4;       // Hobby 60s-timeout
const OPT_NEAR_MISS_PER_RUN = 2;
const OPT_DECAY_PER_RUN = 1;
const OPT_ALT_PER_RUN = 3;
const OPT_DEDUP_DAYS = 30;         // ikke rør samme side+felt for ofte
const OPT_SCHEMA_DEDUP_DAYS = 120; // schema er stabilt — push sjelden

async function afGenerateTargetedTitle({ keyword, companyName }) {
    const t = await afOpenAiText({
        system:
            'Du skriver SEO-titler (<title>) på korrekt, naturlig norsk. Krav: ' +
            'MÅL 50–60 tegn (fyll ut med en kort verdibeskrivelse hvis tittelen blir for kort). ' +
            'Få temaet fra søkeordet inn tidlig, men BØY og skriv det naturlig med stor forbokstav ' +
            '— ikke lim inn søkeordet rått i småbokstaver. Avslutt med «| Merkenavn». ' +
            'Ingen klisjeer. ' + AF_NO_CLAIMS + ' Svar med KUN tittelen.',
        user: `Tema (fra søkeord): ${keyword}\nMerkenavn: ${companyName || 'ukjent'}`,
        maxTokens: 40,
    });
    return t && t.length >= 25 && t.length <= 70 ? t : null;
}

async function afGenerateTargetedMeta({ keyword, companyName }) {
    const t = await afOpenAiText({
        system:
            'Du skriver SEO-meta-beskrivelser på korrekt, naturlig norsk. Krav: 120–158 tegn, ' +
            'aktiv stemme, konkret verdiløfte. Få temaet fra søkeordet naturlig inn tidlig, ' +
            'men BØY det grammatisk riktig — ikke lim inn søkeordet rått. Ingen klisjeer, ingen ' +
            'keyword-stuffing. ' + AF_NO_CLAIMS + ' Svar med KUN beskrivelsen.',
        user: `Tema (fra søkeord): ${keyword}\nBedrift: ${companyName || 'ukjent'}`,
    });
    return t && t.length >= 80 && t.length <= AF_META_TARGET_MAX + 12 ? t : null;
}

async function afGenerateAltText({ filename, title, companyName }) {
    const t = await afOpenAiText({
        system:
            'Du skriver alt-tekst for bilder på norsk (tilgjengelighet + SEO). Krav: kort ' +
            '(maks ~120 tegn), beskriv hva bildet sannsynligvis viser ut fra filnavn og tittel, ' +
            'naturlig norsk, IKKE start med «bilde av». Svar med KUN alt-teksten.',
        user: `Filnavn: ${filename || 'ukjent'}\nTittel: ${title || 'ukjent'}\nBedrift: ${companyName || 'ukjent'}`,
        maxTokens: 60,
    });
    return t && t.length >= 3 && t.length <= 300 ? t : null;
}

function optNormalizeUrl(url) {
    if (!url) return '';
    let u = String(url).trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try {
        const parsed = new URL(u);
        return `https://${parsed.hostname}`;
    } catch {
        return '';
    }
}

// Bygger gyldig JSON-LD programmatisk fra kundedata (ingen LLM = ingen ugyldig JSON).
function optBuildSiteSchema(client) {
    const name = (client.company_name || '').trim();
    const url = optNormalizeUrl(client.website_url);
    if (!name || !url) return null;
    const phone = client.phone ? String(client.phone).trim() : '';
    const org = {
        '@type': phone ? 'LocalBusiness' : 'Organization',
        '@id': `${url}/#org`,
        name,
        url,
    };
    if (phone) org.telephone = phone;
    const website = {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        url,
        name,
        publisher: { '@id': `${url}/#org` },
    };
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, website] });
}

// Bygger llms.txt — den fremvoksende standarden som forteller AI-søkemotorer
// hva siden handler om og hva de bør sitere. Selskap + nøkkelsider + godkjente FAQ.
function geoBuildLlmsTxt(client, pages, faqs) {
    const name = (client.company_name || '').trim();
    const url = optNormalizeUrl(client.website_url);
    if (!name || !url) return '';
    const lines = [`# ${name}`, '', `> ${name} — se ${url} for tjenester og kontaktinfo.`, ''];
    if (Array.isArray(pages) && pages.length) {
        lines.push('## Viktige sider');
        for (const p of pages.slice(0, 10)) {
            const t = (p.title || '').replace(/\s+/g, ' ').trim() || p.link;
            lines.push(`- [${t}](${p.link})`);
        }
        lines.push('');
    }
    if (Array.isArray(faqs) && faqs.length) {
        lines.push('## Ofte stilte spørsmål');
        for (const f of faqs.slice(0, 20)) {
            lines.push(`### ${f.question}`);
            lines.push(String(f.answer || '').replace(/\s+/g, ' ').trim());
            lines.push('');
        }
    }
    return lines.join('\n').slice(0, 19000);
}

// Full JSON-LD: Organization/LocalBusiness + WebSite + FAQPage (godkjente FAQ).
function geoBuildFullSchema(client, faqs) {
    const base = optBuildSiteSchema(client);
    if (!base) return null;
    let graph;
    try { graph = JSON.parse(base)['@graph'] || []; } catch { graph = []; }
    if (Array.isArray(faqs) && faqs.length) {
        graph.push({
            '@type': 'FAQPage',
            '@id': `${optNormalizeUrl(client.website_url)}/#faq`,
            mainEntity: faqs.slice(0, 20).map(f => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: String(f.answer || '').slice(0, 1200) },
            })),
        });
    }
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

// Generisk POST til Sikt Connector-pluginen (schema/alt). Gammel plugin (uten
// ruten) gir 404/rest_no_route → vi behandler det som «hopp over», ikke feil.
async function afConnectorPost(adminUrl, authorization, route, body) {
    try {
        const r = await fetch(`${adminUrl}/wp-json/sikt/v1/${route}`, {
            method: 'POST',
            headers: { Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
            redirect: 'follow',
            signal: AbortSignal.timeout(AF_WP_TIMEOUT_MS),
        });
        if (!r.url.startsWith('https://')) return { ok: false, unsupported: false };
        const data = await r.json().catch(() => null);
        const unsupported = r.status === 404 && (data?.code === 'rest_no_route' || data?.code === 'rest_not_found');
        return { ok: r.ok && data?.ok === true, status: r.status, data, unsupported };
    } catch {
        return { ok: false, unsupported: false };
    }
}

// =====================================================================
// SHOPIFY auto-fiks: push SEO-tittel/-beskrivelse via Admin API.
// Token (custom app) er lagret kryptert i client_hosts (som WP app-passord).
// Støtter produkter og sider (de vanligste SEO-målene); andre URL-er hoppes over.
// =====================================================================
const SHOPIFY_API_VERSION = '2024-01';

async function shopifyReq(shopHost, token, method, path, body) {
    try {
        const r = await fetch(`https://${shopHost}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
            method,
            headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(AF_WP_TIMEOUT_MS),
        });
        const data = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data };
    } catch {
        return { ok: false, status: 0, data: null };
    }
}

function shopifyResourceFromUrl(url) {
    try {
        const parts = new URL(url).pathname.split('/').filter(Boolean);
        const i = parts.findIndex((s) => s === 'products' || s === 'pages');
        if (i >= 0 && parts[i + 1]) {
            return { type: parts[i] === 'products' ? 'product' : 'page', handle: decodeURIComponent(parts[i + 1]) };
        }
    } catch { /* ignore */ }
    return null;
}

// Resolve handle → id, og push SEO-tittel/-beskrivelse (global title_tag/description_tag).
async function shopifyPushSeoForUrl(shopHost, token, url, title, meta) {
    const resrc = shopifyResourceFromUrl(url);
    if (!resrc) return { ok: false, attempted: false };
    const coll = resrc.type === 'product' ? 'products' : 'pages';
    const lookup = await shopifyReq(shopHost, token, 'GET', `/${coll}.json?handle=${encodeURIComponent(resrc.handle)}&fields=id`);
    const id = lookup.ok && lookup.data ? (lookup.data[coll] || [])[0]?.id : null;
    if (!id) return { ok: false, attempted: false };
    const key = resrc.type;
    const payload = { [key]: { id } };
    if (title) payload[key].metafields_global_title_tag = title;
    if (meta) payload[key].metafields_global_description_tag = meta;
    const r = await shopifyReq(shopHost, token, 'PUT', `/${coll}/${id}.json`, payload);
    return { ok: r.ok, attempted: true };
}

// Logg en endring i sikt_changes (best-effort) — brukes til dedup (recentlyChanged)
// for plattformer som ikke går via /api/wordpress-push (Shopify).
async function optLogChange(supabase, userId, pageUrl, field, newValue) {
    try {
        await supabase.from('sikt_changes').insert({
            user_id: userId, page_url: pageUrl, field, new_value: newValue || '', status: 'active',
        });
    } catch { /* best-effort */ }
}

async function runOptimize(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    if (!APP_BASE_URL) {
        return res.status(500).json({ error: 'APP_BASE_URL/VERCEL_URL mangler — vet ikke hvor /api/wordpress-push er.' });
    }

    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: hosts, error: hostsErr } = await supabase
        .from('client_hosts')
        .select('user_id, admin_url, notes, access_token_encrypted, connection_mode, platform')
        .in('platform', ['wordpress', 'shopify'])
        .eq('connection_mode', 'full');
    if (hostsErr) {
        Sentry.captureException(hostsErr);
        return res.status(500).json({ error: 'Kunne ikke hente tilkoblinger.' });
    }

    const summary = { customers: 0, nearMiss: 0, decay: 0, schema: 0, altText: 0, geoPublished: 0, skipped: 0, errors: 0, dryRun, samples: [] };
    // #5 kvalitetsverifisering: i dryRun samler vi den faktiske AI-teksten motoren
    // ville publisert, så den kan inspiseres FØR noe skrives til en live side.
    const addSample = (type, page, content) => { if (summary.samples.length < 16) summary.samples.push({ type, page, content }); };
    const dedupSince = new Date(Date.now() - OPT_DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const schemaDedupSince = new Date(Date.now() - OPT_SCHEMA_DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let processed = 0;
    for (const host of hosts || []) {
        if (processed >= OPT_MAX_CUSTOMERS) break;
        if (!host?.admin_url || !host?.notes || !host?.access_token_encrypted) continue;

        const { data: client } = await supabase
            .from('clients')
            .select('package_name, company_name, website_url, phone')
            .eq('user_id', host.user_id)
            .maybeSingle();
        if (!client || !AF_PAID_PLANS.has(client.package_name)) continue;

        let appPassword;
        try {
            appPassword = decrypt(host.access_token_encrypted);
        } catch (e) {
            summary.errors += 1;
            console.warn('[optimize] dekryptering feilet for', host.user_id, e?.message || e);
            continue;
        }
        const isShopify = host.platform === 'shopify';
        const adminUrl = host.admin_url.trim();
        let shopHost = null;
        try { shopHost = isShopify ? new URL(adminUrl).host : null; } catch { /* ignore */ }
        const shopToken = isShopify ? appPassword : null;
        const authorization = isShopify ? null : afBasicAuth(host.notes.trim(), appPassword);
        const companyName = client.company_name;

        processed += 1;
        summary.customers += 1;

        const recentlyChanged = async (pageUrl, field) => {
            const { data } = await supabase
                .from('sikt_changes')
                .select('id')
                .eq('user_id', host.user_id)
                .eq('page_url', pageUrl)
                .eq('field', field)
                .gte('pushed_at', dedupSince)
                .limit(1);
            return Array.isArray(data) && data.length > 0;
        };

        // --- GSC-søkeord med URL (kilden til near-miss + forfall) ---
        let keywords = [];
        const { data: site } = await supabase
            .from('sites').select('id').eq('user_id', host.user_id).maybeSingle();
        if (site?.id) {
            const { data: kw } = await supabase
                .from('keywords')
                .select('keyword, url, position, previous_position, impressions')
                .eq('site_id', site.id)
                .order('impressions', { ascending: false })
                .limit(100);
            keywords = (kw || []).filter(k => typeof k.url === 'string' && k.url.startsWith('https://'));
        }

        // --- 1) NEAR-MISS: posisjon 11–20 → skriv om tittel + meta for søkeordet ---
        const nearMisses = keywords
            .filter(k => typeof k.position === 'number' && k.position >= 11 && k.position <= 20)
            .slice(0, OPT_NEAR_MISS_PER_RUN);
        for (const k of nearMisses) {
            if (await recentlyChanged(k.url, 'seo-title')) { summary.skipped += 1; continue; }
            const title = await afGenerateTargetedTitle({ keyword: k.keyword, companyName });
            const meta = await afGenerateTargetedMeta({ keyword: k.keyword, companyName });
            if (!title && !meta) { summary.skipped += 1; continue; }
            if (dryRun) {
                addSample('near-miss seo-title', k.url, title);
                addSample('near-miss meta', k.url, meta);
                summary.nearMiss += 1; continue;
            }
            let okAny = false;
            if (isShopify) {
                const sr = await shopifyPushSeoForUrl(shopHost, shopToken, k.url, title, meta);
                okAny = sr.ok;
                if (!sr.attempted) { summary.skipped += 1; }
                else if (!sr.ok) { summary.errors += 1; }
                else { await optLogChange(supabase, host.user_id, k.url, 'seo-title', title); }
            } else {
                if (title) { const r = await afPushFix({ userId: host.user_id, pageUrl: k.url, field: 'seo-title', newValue: title }); okAny = okAny || r.ok; if (!r.ok) summary.errors += 1; }
                if (meta) { const r = await afPushFix({ userId: host.user_id, pageUrl: k.url, field: 'meta-description', newValue: meta }); okAny = okAny || r.ok; if (!r.ok) summary.errors += 1; }
            }
            if (okAny) {
                summary.nearMiss += 1;
                await supabase.from('sikt_actions').insert({
                    user_id: host.user_id,
                    action_type: 'near_miss_autofix',
                    category: 'fix',
                    title: `Optimaliserte «${k.keyword}» for side 1 (var nr. ${Math.round(k.position)})`,
                    details: { keyword: k.keyword, position: k.position, explanation: 'Sikt skrev om tittel og meta for å målrette dette søkeordet — du var nær side 1.' },
                    page_url: k.url,
                    status: 'open',
                });
            }
        }

        // --- 2) FORFALL: falt ≥3 plasser → frisk opp tittel + meta ---
        const decays = keywords
            .filter(k => typeof k.position === 'number' && typeof k.previous_position === 'number' &&
                k.previous_position > 0 && k.previous_position <= 20 && (k.position - k.previous_position) >= OPP_MIN_DROP)
            .sort((a, b) => (b.position - b.previous_position) - (a.position - a.previous_position))
            .slice(0, OPT_DECAY_PER_RUN);
        for (const k of decays) {
            if (await recentlyChanged(k.url, 'meta-description')) { summary.skipped += 1; continue; }
            const title = await afGenerateTargetedTitle({ keyword: k.keyword, companyName });
            const meta = await afGenerateTargetedMeta({ keyword: k.keyword, companyName });
            if (!title && !meta) { summary.skipped += 1; continue; }
            if (dryRun) {
                addSample('forfall seo-title', k.url, title);
                addSample('forfall meta', k.url, meta);
                summary.decay += 1; continue;
            }
            let okAny = false;
            if (isShopify) {
                const sr = await shopifyPushSeoForUrl(shopHost, shopToken, k.url, title, meta);
                okAny = sr.ok;
                if (!sr.attempted) { summary.skipped += 1; }
                else if (!sr.ok) { summary.errors += 1; }
                else { await optLogChange(supabase, host.user_id, k.url, 'meta-description', meta); }
            } else {
                if (title) { const r = await afPushFix({ userId: host.user_id, pageUrl: k.url, field: 'seo-title', newValue: title }); okAny = okAny || r.ok; if (!r.ok) summary.errors += 1; }
                if (meta) { const r = await afPushFix({ userId: host.user_id, pageUrl: k.url, field: 'meta-description', newValue: meta }); okAny = okAny || r.ok; if (!r.ok) summary.errors += 1; }
            }
            if (okAny) {
                summary.decay += 1;
                await supabase.from('sikt_actions').insert({
                    user_id: host.user_id,
                    action_type: 'decay_autofix',
                    category: 'fix',
                    title: `Frisket opp «${k.keyword}» (falt fra ${Math.round(k.previous_position)} til ${Math.round(k.position)})`,
                    details: { keyword: k.keyword, position: k.position, prev_position: k.previous_position, explanation: 'Sikt oppdaterte tittel og meta for å ta tilbake posisjonen.' },
                    page_url: k.url,
                    status: 'open',
                });
            }
        }

        // --- 3) SCHEMA: forsidens strukturert data (kun WordPress; Premium får full
        //     schema m/FAQPage i GEO-fasen under, så hopp over her for Premium) ---
        const { data: recentSchema } = (isShopify || client.package_name === 'Premium Pakke')
            ? { data: [{ id: 'skip' }] }
            : await supabase
                .from('sikt_actions').select('id')
                .eq('user_id', host.user_id).eq('action_type', 'schema_push')
                .gte('created_at', schemaDedupSince).limit(1);
        if (!(Array.isArray(recentSchema) && recentSchema.length)) {
            const jsonld = optBuildSiteSchema(client);
            if (jsonld) {
                if (dryRun) { addSample('schema (JSON-LD)', optNormalizeUrl(client.website_url), jsonld); summary.schema += 1; }
                else {
                    const r = await afConnectorPost(adminUrl, authorization, 'set-site-schema', { jsonld });
                    if (r.ok) {
                        summary.schema += 1;
                        await supabase.from('sikt_actions').insert({
                            user_id: host.user_id,
                            action_type: 'schema_push',
                            category: 'fix',
                            title: 'La til strukturert data (schema) på forsiden',
                            details: { explanation: 'Sikt la til Organization/LocalBusiness- og WebSite-schema så Google forstår bedriften din bedre (rikere søkeresultater).' },
                            page_url: optNormalizeUrl(client.website_url),
                            status: 'open',
                        });
                    } else if (r.unsupported) { summary.skipped += 1; }
                    else { summary.errors += 1; }
                }
            }
        }

        // --- 4) ALT-TEKST: bilder uten alt → generer og sett (kun WordPress) ---
        const listed = isShopify
            ? { ok: false, data: null }
            : await afWpGet(`${adminUrl}/wp-json/sikt/v1/images-without-alt?limit=10`, authorization);
        if (listed.ok && Array.isArray(listed.data?.images)) {
            const imgs = listed.data.images.slice(0, OPT_ALT_PER_RUN);
            for (const img of imgs) {
                const alt = await afGenerateAltText({ filename: img.filename, title: img.title, companyName });
                if (!alt) { summary.skipped += 1; continue; }
                if (dryRun) { addSample('alt-tekst', img.filename || 'bilde', alt); summary.altText += 1; continue; }
                const r = await afConnectorPost(adminUrl, authorization, 'set-alt', { attachment_id: img.id, alt });
                if (r.ok) {
                    summary.altText += 1;
                    await supabase.from('sikt_actions').insert({
                        user_id: host.user_id,
                        action_type: 'alt_text',
                        category: 'fix',
                        title: `Alt-tekst lagt til på et bilde (${img.filename || 'bilde'})`,
                        details: { explanation: `Sikt skrev alt-tekst: «${alt}». Det hjelper både skjermlesere og Google bildesøk.` },
                        page_url: null,
                        status: 'open',
                    });
                } else if (r.unsupported) { summary.skipped += 1; }
                else { summary.errors += 1; }
            }
        }

        // --- 5) GEO-ACTION (Premium, kun WordPress): publiser llms.txt + FAQ-schema ---
        if (!isShopify && client.package_name === 'Premium Pakke') {
            const { data: approvedFaqs } = await supabase
                .from('geo_faqs').select('question, answer')
                .eq('user_id', host.user_id).eq('status', 'approved')
                .order('resolved_at', { ascending: false }).limit(20);
            const faqs = approvedFaqs || [];

            let pages = [];
            try { pages = await afListPages(adminUrl, authorization); } catch { /* best effort */ }
            const llms = geoBuildLlmsTxt(client, pages, faqs);

            const { data: stateRow } = await supabase
                .from('geo_state').select('llms_txt, llms_published_at').eq('user_id', host.user_id).maybeSingle();
            const changed = !!llms && llms !== (stateRow?.llms_txt || '');

            if (llms && changed) {
                if (dryRun) {
                    addSample('llms.txt', optNormalizeUrl(client.website_url), llms);
                    const fs = geoBuildFullSchema(client, faqs);
                    if (fs) addSample('GEO schema (m/FAQPage)', optNormalizeUrl(client.website_url), fs);
                    summary.geoPublished += 1;
                }
                else {
                    const r1 = await afConnectorPost(adminUrl, authorization, 'set-llms-txt', { content: llms });
                    const fullSchema = geoBuildFullSchema(client, faqs);
                    const r2 = fullSchema
                        ? await afConnectorPost(adminUrl, authorization, 'set-site-schema', { jsonld: fullSchema })
                        : { ok: false, unsupported: true };
                    if (r1.ok || r2.ok) {
                        summary.geoPublished += 1;
                        // GEO-score: nevne-rate (60%) + llms.txt (20) + godkjente FAQ (20)
                        const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
                        const { data: gc } = await supabase
                            .from('geo_checks').select('mentioned')
                            .eq('user_id', host.user_id).gte('checked_at', since);
                        const tot = (gc || []).length;
                        const men = (gc || []).filter(x => x.mentioned).length;
                        const mentionRate = tot > 0 ? (men / tot) * 100 : 0;
                        const score = Math.min(100, Math.round(mentionRate * 0.6 + (r1.ok ? 20 : 0) + (faqs.length > 0 ? 20 : 0)));
                        await supabase.from('geo_state').upsert({
                            user_id: host.user_id,
                            llms_txt: llms,
                            llms_published_at: r1.ok ? new Date().toISOString() : (stateRow?.llms_published_at ?? null),
                            schema_published_at: r2.ok ? new Date().toISOString() : null,
                            geo_score: score,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id' });
                        await supabase.from('sikt_actions').insert({
                            user_id: host.user_id,
                            action_type: 'geo_publish',
                            category: 'fix',
                            title: faqs.length
                                ? `AI-synlighet oppdatert: llms.txt + ${faqs.length} godkjente FAQ-svar publisert`
                                : 'AI-synlighet oppdatert: llms.txt og schema publisert',
                            details: { explanation: 'Sikt publiserte llms.txt og strukturert data (FAQPage) så ChatGPT, Gemini og Perplexity lettere finner og siterer bedriften din.' },
                            page_url: optNormalizeUrl(client.website_url),
                            status: 'open',
                        });
                    } else if (r1.unsupported) { summary.skipped += 1; }
                    else { summary.errors += 1; }
                }
            }
        }
    }

    console.log('[optimize] ferdig:', JSON.stringify(summary));
    return res.status(200).json(summary);
}

// =====================================================================
// VARSEL-E-POST: oppetids-varsel (job=uptime) + rangeringsvarsel (i
// runOpportunities). Sender via Resend, bygges med Node-tvillingen
// api/_lib/email.js. Begge gated på clients.notification_preferences.
// =====================================================================
async function sendSiktEmail({ to, subject, html }) {
    if (!RESEND_API_KEY || !to) return false;
    try {
        const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: `Sikt <${FROM_EMAIL}>`, to: [to], subject, html }),
        });
        if (!resp.ok) { console.warn('[email] Resend feilet:', resp.status); return false; }
        return true;
    } catch (err) { console.warn('[email] Resend kastet:', err?.message); return false; }
}

function notifFirstName(client) {
    return (client.contact_person || '').trim().split(/\s+/)[0] || '';
}

function buildRankEmail(client, crossings) {
    const hei = notifFirstName(client) ? `Hei ${escapeHtml(notifFirstName(client))}, ` : '';
    const anyUp = crossings.some((c) => c.tone === 'up');
    return renderEmail({
        preheader: 'Søkeord krysset inn eller ut av side 1 denne uken.',
        brand: 'sikt',
        kicker: 'Rangeringsendring',
        heading: anyUp ? 'Du beveget deg på Google' : 'Bevegelse på Google',
        intro: `${hei}her er søkeordene som krysset inn eller ut av side 1 (topp 10) siden forrige uke.`,
        blocks: [sectionHead('Inn og ut av side 1') + winList(crossings)],
        cta: { label: 'Se alle søkeord', url: 'https://siktseo.com/portal' },
        footer: 'Sikt · rangeringsvarsel · skru av i Innstillinger → Varsler.',
    });
}

function buildDownEmail(client, url) {
    const hei = notifFirstName(client) ? `Hei ${escapeHtml(notifFirstName(client))}, ` : '';
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return renderEmail({
        preheader: `Vi får ikke kontakt med ${url}. Siden kan være nede.`,
        brand: 'sikt',
        kicker: 'Kritisk varsel',
        heading: 'Nettsiden din svarer ikke',
        intro: `${hei}vi fikk ikke kontakt med <strong style="color:#1A1A1A">${escapeHtml(url)}</strong> da vi sjekket nå nettopp. Det kan bety at siden er nede for besøkende.`,
        blocks: [railNote({ title: 'Hva du bør gjøre', body: 'Sjekk om du får åpnet siden selv. Er den nede, kontakt webhotellet ditt — vi varsler deg igjen så snart den svarer.', tone: 'danger' })],
        cta: { label: 'Åpne siden', url: href },
        signoff: 'Vi følger med og sier fra når den er oppe igjen.',
        footer: 'Sikt · kritisk varsel · skru av i Innstillinger → Varsler.',
    });
}

function buildRecoveredEmail(client, url) {
    const hei = notifFirstName(client) ? `Hei ${escapeHtml(notifFirstName(client))}, ` : '';
    return renderEmail({
        preheader: `${url} svarer igjen.`,
        brand: 'sikt',
        kicker: 'Varsel',
        heading: 'Nettsiden din er oppe igjen',
        intro: `${hei}<strong style="color:#1A1A1A">${escapeHtml(url)}</strong> svarer normalt igjen. Alt ser bra ut.`,
        cta: { label: 'Åpne dashbordet', url: 'https://siktseo.com/portal' },
        footer: 'Sikt · varsel · skru av i Innstillinger → Varsler.',
    });
}

async function pingSite(url) {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPTIME_TIMEOUT_MS);
    try {
        const resp = await fetch(target, {
            method: 'GET', redirect: 'follow', signal: controller.signal,
            headers: { 'User-Agent': 'SiktUptime/1.0 (+https://siktseo.com)' },
        });
        return resp.status < 500; // 2xx/3xx/4xx = serveren svarer; 5xx = nede
    } catch {
        return false; // timeout / DNS / nettverksfeil = nede
    } finally {
        clearTimeout(timer);
    }
}

async function runUptime(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: clients, error } = await supabase
        .from('clients')
        .select('user_id, email, company_name, contact_person, website_url, notification_preferences')
        .not('package_name', 'is', null)
        .not('website_url', 'is', null);
    if (error) { Sentry.captureException(error); return res.status(500).json({ error: 'Kunne ikke hente kunder.' }); }

    const summary = { checked: 0, down: 0, recovered: 0, emails: 0, errors: 0 };
    let processed = 0;
    for (const client of clients || []) {
        if (processed >= UPTIME_MAX) break;
        const url = (client.website_url || '').trim();
        if (!url) continue;
        processed += 1;
        summary.checked += 1;

        const isUp = await pingSite(url);
        const { data: statusRow } = await supabase
            .from('site_status').select('is_up').eq('user_id', client.user_id).maybeSingle();
        const prevUp = statusRow ? statusRow.is_up : true; // første gang antas oppe → varsle kun ekte overgang
        const nowIso = new Date().toISOString();

        const patch = { user_id: client.user_id, url, is_up: isUp, last_status_at: nowIso };
        if (!isUp && prevUp) patch.last_down_email_at = nowIso;
        const { error: upErr } = await supabase.from('site_status').upsert(patch, { onConflict: 'user_id' });
        if (upErr) { summary.errors += 1; console.warn('[uptime] upsert feilet:', upErr.message); }

        const wantsCritical = client.notification_preferences?.criticalAlerts !== false;
        if (!client.email || !wantsCritical) continue;

        if (!isUp && prevUp) {
            summary.down += 1;
            const ok = await sendSiktEmail({ to: client.email, subject: 'Nettsiden din svarer ikke', html: buildDownEmail(client, url) });
            if (ok) summary.emails += 1; else summary.errors += 1;
        } else if (isUp && !prevUp) {
            summary.recovered += 1;
            const ok = await sendSiktEmail({ to: client.email, subject: 'Nettsiden din er oppe igjen', html: buildRecoveredEmail(client, url) });
            if (ok) summary.emails += 1; else summary.errors += 1;
        }
    }
    console.log('[uptime] ferdig:', JSON.stringify(summary));
    return res.status(200).json(summary);
}

// =====================================================================
// MÅNEDSRAPPORT (job=monthly_report): innfrir prissidens rapport-løfte.
// Kjøres av pg_cron hver time den 1. i måneden; hopper over kunder som
// alt har rapport for perioden, så køen tømmer seg selv i batcher.
// Premium: 10+ seksjoner (inkl. GEO + strategi); Basic/Standard: kortversjon.
// Alle TALL beregnes her fra DB — AI skriver kun prosa rundt ekte tall.
// =====================================================================
const MR_MAX_CUSTOMERS = 3; // AI-tung: hold godt under Hobby 60s-timeout

function mrTierForPackage(packageName) {
    if (/premium/i.test(packageName || '')) return 'premium';
    if (/standard/i.test(packageName || '')) return 'standard';
    return 'basic';
}

function mrMonthLabel(period) {
    try {
        const d = new Date(`${period}-01T12:00:00Z`);
        const label = d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
        return period;
    }
}

async function mrOpenAiJson({ system, user, maxTokens }) {
    if (!OPENAI_API_KEY) return null;
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY.trim()}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.4,
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        const raw = (data.choices?.[0]?.message?.content || '').replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(raw);
    } catch (err) {
        console.warn('[report] OpenAI-kall feilet:', err?.message);
        return null;
    }
}

// Samler månedens fakta for én kunde. Returnerer null hvis det ikke finnes
// nok data til en meningsfull rapport (helt fersk kunde).
async function mrGatherData(supabase, client, periodStartIso, periodEndIso) {
    const userId = client.user_id;

    const { data: siteRows } = await supabase.from('sites').select('id').eq('user_id', userId);
    const siteIds = (siteRows || []).map((s) => s.id);
    let gscKeywords = [];
    if (siteIds.length) {
        const { data: kwRows } = await supabase
            .from('keywords')
            .select('keyword, clicks, impressions, position')
            .in('site_id', siteIds)
            .order('clicks', { ascending: false })
            .limit(100);
        gscKeywords = kwRows || [];
    }

    // Posisjonsendring i perioden: første vs siste ukes-snapshot per søkeord.
    const { data: snaps } = await supabase
        .from('keyword_snapshots')
        .select('keyword, position, captured_at')
        .eq('user_id', userId)
        .gte('captured_at', periodStartIso)
        .lte('captured_at', periodEndIso)
        .order('captured_at', { ascending: true })
        .limit(400);
    const firstPos = new Map();
    const lastPos = new Map();
    for (const s of snaps || []) {
        if (typeof s.position !== 'number') continue;
        if (!firstPos.has(s.keyword)) firstPos.set(s.keyword, s.position);
        lastPos.set(s.keyword, s.position);
    }
    const movers = [];
    for (const [kw, from] of firstPos) {
        const to = lastPos.get(kw);
        if (typeof to !== 'number' || Math.abs(to - from) < 1) continue;
        movers.push({ keyword: kw, from: Math.round(from), to: Math.round(to), delta: from - to });
    }
    movers.sort((a, b) => b.delta - a.delta);
    const winners = movers.filter((m) => m.delta > 0).slice(0, 5);
    const losers = movers.filter((m) => m.delta < 0).slice(-5).reverse();

    const { data: actions } = await supabase
        .from('sikt_actions')
        .select('action_type, category, title, created_at')
        .eq('user_id', userId)
        .gte('created_at', periodStartIso)
        .lte('created_at', periodEndIso)
        .order('created_at', { ascending: false })
        .limit(100);

    const { data: articles } = await supabase
        .from('sikt_articles')
        .select('keyword, title, status, created_at')
        .eq('user_id', userId)
        .gte('created_at', periodStartIso)
        .lte('created_at', periodEndIso)
        .limit(20);

    // Resultat-bevis: parer artiklene med søkeordets utvikling ETTER publisering
    // (viewen sikt_article_results; service-role omgår RLS). Tar med alle pushede
    // artikler — også fra tidligere måneder — så «innhold → utfall» vises over tid.
    const { data: articleResults } = await supabase
        .from('sikt_article_results')
        .select('keyword, status, created_at, position_at_creation, latest_position, best_position')
        .eq('user_id', userId)
        .not('latest_position', 'is', null)
        .limit(20);

    // Henvendelser i perioden (telefon/e-post/skjema fra beacon-sporingen).
    const { count: leadCount } = await supabase
        .from('sikt_leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('occurred_at', periodStartIso)
        .lte('occurred_at', periodEndIso);

    const { data: opps } = await supabase
        .from('keyword_opportunities')
        .select('keyword, recommendation_text, estimated_traffic')
        .eq('user_id', userId)
        .order('estimated_traffic', { ascending: false })
        .limit(3);

    const { data: competitors } = await supabase
        .from('competitors')
        .select('domain, avg_position, keyword_count, last_scanned_at')
        .eq('user_id', userId)
        .limit(5);

    const { data: geoChecks } = await supabase
        .from('geo_checks')
        .select('provider, question, mentioned, checked_at')
        .eq('user_id', userId)
        .gte('checked_at', periodStartIso)
        .lte('checked_at', periodEndIso)
        .limit(60);

    const positions = gscKeywords.map((k) => k.position).filter((p) => typeof p === 'number');
    const onPage1 = positions.filter((p) => p <= 10).length;
    const avgPos = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
    const totalClicks = gscKeywords.reduce((a, k) => a + (k.clicks || 0), 0);
    const actionCount = (actions || []).length;
    const geoTotal = (geoChecks || []).length;
    const geoMentioned = (geoChecks || []).filter((g) => g.mentioned).length;

    // Ikke nok data til en ærlig rapport → hopp over (heller ingen rapport
    // enn en rapport full av nuller og AI-fyll).
    if (gscKeywords.length === 0 && actionCount === 0 && (articles || []).length === 0) {
        return null;
    }

    return {
        gscKeywords, winners, losers,
        actions: actions || [], articles: articles || [], opps: opps || [],
        competitors: competitors || [], geoChecks: geoChecks || [],
        articleResults: articleResults || [],
        stats: {
            totalKeywords: gscKeywords.length, onPage1,
            avgPos: avgPos != null ? Math.round(avgPos * 10) / 10 : null,
            totalClicks, actionCount, articleCount: (articles || []).length,
            geoTotal, geoMentioned,
            leads: leadCount ?? 0,
        },
    };
}

function mrBuildSections({ tier, monthLabel, data, ai }) {
    const { stats, winners, losers, opps, actions, articles, competitors, geoChecks, articleResults } = data;
    const aiSec = ai?.sections || {};
    const sections = [];

    sections.push({ id: 'intro', title: `Måneden som gikk — ${monthLabel}`, body: ai?.intro || '' });

    const statItems = [
        { label: 'Søkeord vi følger', value: String(stats.totalKeywords) },
        { label: 'På side 1 av Google', value: String(stats.onPage1) },
    ];
    if (stats.avgPos != null) statItems.push({ label: 'Snittplassering', value: String(stats.avgPos) });
    if (stats.totalClicks > 0) statItems.push({ label: 'Klikk fra Google (28 d)', value: String(stats.totalClicks) });
    statItems.push({ label: 'Ting Sikt gjorde', value: String(stats.actionCount) });
    if (stats.articleCount > 0) statItems.push({ label: 'Artikler skrevet', value: String(stats.articleCount) });
    if (stats.leads > 0) statItems.push({ label: 'Henvendelser fra siden', value: String(stats.leads) });
    sections.push({ id: 'stats', title: 'Måneden i tall', stats: statItems });

    const moverItems = [
        ...winners.map((m) => ({ text: `«${m.keyword}»`, value: `${m.from} → ${m.to}`, tone: 'up' })),
        ...losers.map((m) => ({ text: `«${m.keyword}»`, value: `${m.from} → ${m.to}`, tone: 'down' })),
    ];
    sections.push({ id: 'positions', title: 'Posisjonsutvikling', body: aiSec.positions || '', items: moverItems });

    if (opps.length) {
        sections.push({
            id: 'opportunities', title: 'Størst mulighet nå', body: aiSec.opportunities || '',
            items: opps.map((o) => ({ text: `«${o.keyword}»`, value: o.estimated_traffic ? `~${o.estimated_traffic} besøk/mnd` : '' })),
        });
    }

    sections.push({
        id: 'work', title: 'Dette gjorde Sikt for deg', body: aiSec.work || '',
        items: actions.slice(0, 8).map((a) => ({ text: a.title })),
    });

    if (articles.length) {
        sections.push({
            id: 'content', title: 'Nytt innhold', body: aiSec.content || '',
            items: articles.map((a) => ({ text: a.title, value: a.status === 'pushed_draft' ? 'Utkast i WordPress' : 'Klar til publisering' })),
        });
    }

    // Resultat-bevis: innhold PARET med utfall (ikke separate lister som før) —
    // vises kun når ekte snapshot-data finnes for artikkelens søkeord.
    if ((articleResults || []).length) {
        sections.push({
            id: 'results', title: 'Innholdet → resultatet',
            body: 'Slik har søkeordene til artiklene Sikt skrev utviklet seg på Google etter publisering.',
            items: articleResults.map((r) => ({
                text: `«${r.keyword}»`,
                value: r.position_at_creation != null
                    ? `plass ${Math.round(r.position_at_creation)} → ${Math.round(r.latest_position)}`
                    : `ny på Google — plass ${Math.round(r.latest_position)}`,
                tone: r.position_at_creation == null || r.latest_position < r.position_at_creation ? 'up' : 'down',
            })),
        });
    }

    if (tier === 'premium') {
        if (competitors.length) {
            sections.push({
                id: 'competitors', title: 'Konkurrentbildet', body: aiSec.competitors || '',
                items: competitors.map((c) => ({ text: c.domain, value: c.avg_position ? `snitt ${c.avg_position}` : '' })),
            });
        }
        if (stats.geoTotal > 0) {
            sections.push({
                id: 'geo', title: 'AI-synlighet (ChatGPT, Gemini, Perplexity)', body: aiSec.geo || '',
                stats: [
                    { label: 'Spørsmål sjekket', value: String(stats.geoTotal) },
                    { label: 'Der du ble nevnt', value: String(stats.geoMentioned) },
                ],
                items: geoChecks.filter((g) => !g.mentioned).slice(0, 4).map((g) => ({ text: g.question, value: `ikke nevnt (${g.provider})` })),
            });
        }
        if (ai?.strategy) {
            sections.push({ id: 'strategy', title: 'Vekststrategi for neste måned', body: ai.strategy });
        }
    }

    const nextSteps = Array.isArray(ai?.next_steps) ? ai.next_steps.filter((s) => typeof s === 'string' && s.trim()) : [];
    if (nextSteps.length) {
        sections.push({ id: 'next', title: 'Neste steg', items: nextSteps.map((t) => ({ text: t })) });
    }

    return sections.filter((s) => s.body || (s.items && s.items.length) || (s.stats && s.stats.length));
}

function mrBuildEmail(client, { monthLabel, intro, stats, portalUrl }) {
    const hei = notifFirstName(client) ? `Hei ${escapeHtml(notifFirstName(client))}, ` : '';
    return renderEmail({
        preheader: `Månedsrapporten for ${monthLabel} er klar i portalen.`,
        brand: 'sikt',
        kicker: 'Månedsrapport',
        heading: `Rapporten for ${escapeHtml(monthLabel)} er klar`,
        intro: `${hei}${escapeHtml(intro || 'her er oppsummeringen av måneden som gikk.')}`,
        blocks: [
            sectionHead('Måneden i tall') +
            `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:2;color:#55514A">` +
            `Søkeord på side 1: <strong style="color:#1A1A1A">${stats.onPage1}</strong> av ${stats.totalKeywords}<br>` +
            (stats.avgPos != null ? `Snittplassering: <strong style="color:#1A1A1A">${stats.avgPos}</strong><br>` : '') +
            `Ting Sikt gjorde for deg: <strong style="color:#1A1A1A">${stats.actionCount}</strong>` +
            `</div>`,
        ],
        cta: { label: 'Les hele rapporten', url: portalUrl },
        footer: 'Sikt · månedsrapport · styr e-poster i Innstillinger → Varsler.',
    });
}

async function runMonthlyReport(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';

    // Perioden = forrige kalendermåned (kjøres 1. i måneden), overstyrbar for test.
    let period = typeof req.query?.period === 'string' && /^\d{4}-\d{2}$/.test(req.query.period)
        ? req.query.period
        : null;
    if (!period) {
        const now = new Date();
        const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        period = prev.toISOString().slice(0, 7);
    }
    const periodStartIso = `${period}-01T00:00:00Z`;
    const startDate = new Date(periodStartIso);
    const periodEndIso = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)).toISOString();
    const monthLabel = mrMonthLabel(period);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: clients, error } = await supabase
        .from('clients')
        .select('user_id, email, company_name, contact_person, package_name, website_url, notification_preferences')
        .not('package_name', 'is', null);
    if (error) {
        Sentry.captureException(error);
        return res.status(500).json({ error: 'Kunne ikke hente kunder.' });
    }

    // Hopp over kunder som allerede har rapport for perioden (selv-drenerende kø).
    const { data: existing } = await supabase
        .from('sikt_reports').select('user_id').eq('period', period);
    const hasReport = new Set((existing || []).map((r) => r.user_id));

    const summary = { period, generated: 0, emailed: 0, skippedExisting: 0, skippedNoData: 0, errors: 0 };
    let processed = 0;

    for (const client of clients || []) {
        if (processed >= MR_MAX_CUSTOMERS) break;
        if (hasReport.has(client.user_id)) { summary.skippedExisting += 1; continue; }
        processed += 1;

        try {
            const data = await mrGatherData(supabase, client, periodStartIso, periodEndIso);
            if (!data) { summary.skippedNoData += 1; continue; }

            const tier = mrTierForPackage(client.package_name);
            const isPremium = tier === 'premium';

            const facts = {
                bedrift: client.company_name || 'ukjent',
                nettside: client.website_url || '',
                maaned: monthLabel,
                tall: data.stats,
                opp_i_posisjon: data.winners,
                ned_i_posisjon: data.losers,
                muligheter: data.opps.map((o) => ({ keyword: o.keyword, anbefaling: o.recommendation_text, estimert_trafikk: o.estimated_traffic })),
                sikt_gjorde: data.actions.slice(0, 10).map((a) => a.title),
                artikler: data.articles.map((a) => ({ title: a.title, status: a.status })),
                innhold_resultater: data.articleResults.map((r) => ({
                    keyword: r.keyword,
                    posisjon_ved_publisering: r.position_at_creation,
                    posisjon_naa: r.latest_position,
                })),
                henvendelser_fra_siden: data.stats.leads,
                ...(isPremium ? {
                    konkurrenter: data.competitors.map((c) => ({ domain: c.domain, snittposisjon: c.avg_position })),
                    geo: { sjekket: data.stats.geoTotal, nevnt: data.stats.geoMentioned },
                } : {}),
            };

            const wantedSections = isPremium
                ? '"positions", "opportunities", "work", "content", "competitors", "geo"'
                : '"positions", "opportunities", "work", "content"';
            const ai = await mrOpenAiJson({
                system: `Du er SEO-rådgiver for norske småbedrifter og skriver månedsrapporten deres. Plain norsk, ingen jargong, varm men presis tone. VIKTIG om perspektiv: omtal kunden som «du/dere» og nettsiden som «siden din» — «vi» betyr Sikt (rådgiveren) og brukes kun om arbeid Sikt har gjort. Aldri «våre sider» om kundens sider. Vær ærlig om svake tall, men konstruktiv: pek alltid på hva som gjøres videre. Bruk KUN tallene og listene du får — ALDRI finn på tall, navn eller fakta. 2–4 setninger per seksjon.

SVAR I STRENGT JSON-FORMAT:
{
  "intro": "3-4 setninger som oppsummerer måneden (les tallene, trekk den ærlige konklusjonen)",
  "sections": { ${wantedSections} — én kort prosatekst per nøkkel },
  "next_steps": ["3 konkrete, gjennomførbare anbefalinger for neste måned"]${isPremium ? ',\n  "strategy": "5-7 setninger vekststrategi for neste måned basert på tallene"' : ''}
}`,
                user: JSON.stringify(facts),
                maxTokens: isPremium ? 2200 : 1200,
            });

            const sections = mrBuildSections({ tier, monthLabel, data, ai });
            const title = `Månedsrapport — ${monthLabel}`;

            if (dryRun) { summary.generated += 1; continue; }

            const { error: insErr } = await supabase.from('sikt_reports').upsert({
                user_id: client.user_id,
                period,
                tier,
                title,
                sections,
            }, { onConflict: 'user_id,period' });
            if (insErr) { summary.errors += 1; console.warn('[report] lagring feilet:', insErr.message); continue; }
            summary.generated += 1;

            const wantsEmail = client.notification_preferences?.monthlyReport !== false;
            if (client.email && wantsEmail) {
                const ok = await sendSiktEmail({
                    to: client.email,
                    subject: `Månedsrapporten for ${monthLabel} er klar`,
                    html: mrBuildEmail(client, { monthLabel, intro: ai?.intro, stats: data.stats, portalUrl: 'https://siktseo.com/portal' }),
                });
                if (ok) {
                    summary.emailed += 1;
                    await supabase.from('sikt_reports')
                        .update({ emailed_at: new Date().toISOString() })
                        .eq('user_id', client.user_id).eq('period', period);
                }
            }
        } catch (err) {
            summary.errors += 1;
            console.warn('[report] feilet for kunde:', err?.message || err);
            Sentry.captureException(err);
        }
    }

    console.log('[report] ferdig:', JSON.stringify(summary));
    return res.status(200).json(summary);
}

// =====================================================================
// SIDE-SKANN-MOTOR (job=site_scan): ukentlig server-side re-skann.
// Verksted skal ALDRI gå tom — dette er påfylls-motoren:
//  1) Crawler kundens side (delt kjerne med /api/scan-website) og
//     persisterer sidene i sikt_site_pages → portalen hydrerer todos
//     fra DB, uavhengig av kundens egne skann.
//  2) Sjekker lenkemål (HEAD, lite budsjett) → sikt_link_issues.
//     Krever 2 kjøringer på rad før et brudd vises (falske positive).
//  3) Regner interne lenkeforslag → sikt_link_suggestions.
//  4) Publisert-deteksjon: WP-utkast som er publisert → sikt_articles.
// Selv-drenerende: 1 kunde per kjøring, hopper over kunder skannet
// siste 6 dager → hver time = ukentlig dekning for alle kunder.
// =====================================================================
const SS_MAX_CUSTOMERS = 1;      // crawl+lenkesjekk ≈ 30–35 s — hold under Hobby 60 s
const SS_DEDUP_DAYS = 6;         // ukentlig re-skann med slack
const SS_MAX_PAGES = 15;         // samme tak som /api/scan-website
const BL_CHECK_BUDGET = 12;      // maks lenkemål sjekket per kunde per kjøring
const BL_RECHECK_DAYS = 7;       // ikke re-sjekk samme mål oftere
const BL_TIMEOUT_MS = 4_000;
const BL_OPEN_AFTER_FAILURES = 2; // to kjøringer på rad før bruddet vises
const LS_MAX_NEW_PER_RUN = 5;    // maks nye interne lenkeforslag per kunde
const SS_PUBLISH_CHECK_MAX = 5;  // maks WP-statussjekker av pushede utkast

async function ssCheckLinkTarget(url) {
    const headers = { 'User-Agent': 'SiktLinkCheck/1.0 (+https://siktseo.com)' };
    try {
        let resp = await fetch(url, {
            method: 'HEAD', redirect: 'follow', headers,
            signal: AbortSignal.timeout(BL_TIMEOUT_MS),
        });
        if (resp.status === 405 || resp.status === 501) {
            resp = await fetch(url, {
                method: 'GET', redirect: 'follow', headers,
                signal: AbortSignal.timeout(BL_TIMEOUT_MS),
            });
        }
        return { status: resp.status, err: null };
    } catch (err) {
        return { status: null, err };
    }
}

async function runSiteScan(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await supabase
        .from('clients')
        .select('user_id, company_name, package_name, website_url')
        .not('package_name', 'is', null)
        .not('website_url', 'is', null);
    if (error) {
        Sentry.captureException(error);
        return res.status(500).json({ error: 'Kunne ikke hente kunder.' });
    }

    // Dedup: kunder med skann nyere enn SS_DEDUP_DAYS hoppes over.
    const dedupSince = new Date(Date.now() - SS_DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentRows } = await supabase
        .from('sikt_site_pages')
        .select('user_id')
        .gte('last_scanned_at', dedupSince);
    const recentlyScanned = new Set((recentRows || []).map((r) => r.user_id));

    const summary = {
        customers: 0, pagesScanned: 0, issuesFound: 0,
        linksChecked: 0, brokenFound: 0, newOpenIssues: 0, resolvedIssues: 0,
        suggestionsAdded: 0, articlesPublished: 0,
        skipped: 0, errors: 0, dryRun, samples: [],
    };

    let processed = 0;
    for (const client of clients || []) {
        if (processed >= SS_MAX_CUSTOMERS) break;
        if (!AF_PAID_PLANS.has(client.package_name)) continue;
        if (recentlyScanned.has(client.user_id)) { summary.skipped += 1; continue; }
        processed += 1;
        summary.customers += 1;
        const nowIso = new Date().toISOString();

        // --- 1) Crawl (delt kjerne med /api/scan-website) ---
        let pages, collectedLinks;
        try {
            const startUrl = await assertSafeUserUrl(client.website_url, client.website_url);
            const crawled = await crawlSite({ startUrl, websiteUrl: client.website_url, maxPages: SS_MAX_PAGES });
            pages = crawled.pages;
            collectedLinks = crawled.collectedLinks;
        } catch (e) {
            summary.errors += 1;
            console.warn('[site_scan] crawl feilet for', client.user_id, e?.message || e);
            continue;
        }
        if (!pages || pages.length === 0) { summary.skipped += 1; continue; }

        const issuesFound = pages.reduce((n, p) => n + (p.issues?.length || 0), 0);
        summary.pagesScanned += pages.length;
        summary.issuesFound += issuesFound;

        if (dryRun) {
            summary.samples.push({
                userId: client.user_id,
                pages: pages.map((p) => ({ url: p.url, status: p.status, issues: p.issues })),
                links: collectedLinks.length,
            });
        } else {
            // Upsert sider — dedupe på normalisert URL så batchen ikke kolliderer
            // med seg selv («cannot affect row a second time»).
            const rowByUrl = new Map();
            for (const p of pages) {
                const normUrl = normalizePageUrl(p.fullUrl) || p.fullUrl;
                rowByUrl.set(normUrl, {
                    user_id: client.user_id,
                    url: normUrl,
                    path: p.url,
                    title: p.title,
                    word_count: p.wordCount,
                    text_sample: p.textSample,
                    issues: p.issues || [],
                    status: p.status,
                    score: p.score,
                    inlinks: p.inlinks,
                    outlinks: p.outlinks,
                    last_scanned_at: nowIso,
                });
            }
            const { error: upsertErr } = await supabase
                .from('sikt_site_pages')
                .upsert(Array.from(rowByUrl.values()), { onConflict: 'user_id,url' });
            if (upsertErr) { summary.errors += 1; console.warn('[site_scan] side-upsert feilet:', upsertErr.message); }
        }

        // --- 2) Ødelagte lenker ---
        const aliveTargets = new Set(pages.map((p) => normalizePageUrl(p.fullUrl)).filter(Boolean));
        const { data: existingIssues } = await supabase
            .from('sikt_link_issues')
            .select('id, page_url, target_url, state, consecutive_failures, last_checked_at')
            .eq('user_id', client.user_id);
        const issueByKey = new Map((existingIssues || []).map((i) => [`${i.page_url}|${i.target_url}`, i]));
        const lastCheckedByTarget = new Map();
        for (const i of existingIssues || []) {
            const prev = lastCheckedByTarget.get(i.target_url);
            if (!prev || i.last_checked_at > prev) lastCheckedByTarget.set(i.target_url, i.last_checked_at);
        }

        // Mål som er i live-settet (skannet OK nå): løs opp eventuelle åpne brudd.
        if (!dryRun) {
            for (const i of existingIssues || []) {
                if (!aliveTargets.has(normalizePageUrl(i.target_url))) continue;
                if (!['candidate', 'open', 'queued'].includes(i.state)) continue;
                const { error: resErr } = await supabase
                    .from('sikt_link_issues')
                    .update({ state: 'resolved', resolved_at: nowIso, last_checked_at: nowIso })
                    .eq('id', i.id);
                if (resErr) summary.errors += 1; else summary.resolvedIssues += 1;
            }
        }

        // Kandidater: unike mål vi ikke har sjekket nylig og som ikke ble
        // crawlet i live nå. Mål med eksisterende candidate-rader først
        // (raskere promotering til 'open').
        const recheckCutoff = new Date(Date.now() - BL_RECHECK_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const linksByTarget = new Map();
        for (const l of collectedLinks) {
            if (aliveTargets.has(normalizePageUrl(l.targetUrl))) continue;
            if (!linksByTarget.has(l.targetUrl)) linksByTarget.set(l.targetUrl, []);
            linksByTarget.get(l.targetUrl).push(l);
        }
        const candidates = Array.from(linksByTarget.keys())
            .filter((t) => {
                const last = lastCheckedByTarget.get(t);
                return !last || last < recheckCutoff;
            })
            .sort((a, b) => {
                const aHas = (existingIssues || []).some((i) => i.target_url === a && i.state === 'candidate') ? 0 : 1;
                const bHas = (existingIssues || []).some((i) => i.target_url === b && i.state === 'candidate') ? 0 : 1;
                return aHas - bHas;
            })
            .slice(0, BL_CHECK_BUDGET);

        for (let i = 0; i < candidates.length; i += 4) {
            const batch = candidates.slice(i, i + 4);
            const results = await Promise.allSettled(batch.map(async (target) => {
                // SSRF-vakt for alle mål (interne som eksterne) — sjekk kun status.
                const safe = await assertSafePublicUrl(target);
                const { status, err } = await ssCheckLinkTarget(safe);
                return { target, verdict: classifyLinkCheck(status, err), status };
            }));

            for (const r of results) {
                if (r.status !== 'fulfilled') { continue; } // SSRF-avvist o.l. — ikke kundens problem
                summary.linksChecked += 1;
                const { target, verdict, status } = r.value;
                const links = linksByTarget.get(target) || [];

                if (verdict === 'broken') {
                    summary.brokenFound += 1;
                    if (dryRun) continue;
                    for (const link of links) {
                        const key = `${link.sourceUrl}|${target}`;
                        const existing = issueByKey.get(key);
                        if (existing) {
                            if (['fixed', 'dismissed'].includes(existing.state)) {
                                const { error: e1 } = await supabase.from('sikt_link_issues')
                                    .update({ last_checked_at: nowIso, http_status: status })
                                    .eq('id', existing.id);
                                if (e1) summary.errors += 1;
                                continue;
                            }
                            const failures = existing.state === 'resolved' ? 1 : (existing.consecutive_failures || 1) + 1;
                            const nextState = existing.state === 'resolved'
                                ? 'candidate'
                                : (existing.state === 'candidate' && failures >= BL_OPEN_AFTER_FAILURES ? 'open' : existing.state);
                            const { error: e2 } = await supabase.from('sikt_link_issues')
                                .update({
                                    consecutive_failures: failures,
                                    state: nextState,
                                    http_status: status,
                                    last_checked_at: nowIso,
                                    resolved_at: null,
                                })
                                .eq('id', existing.id);
                            if (e2) { summary.errors += 1; }
                            else if (nextState === 'open' && existing.state !== 'open') summary.newOpenIssues += 1;
                        } else {
                            const { error: e3 } = await supabase.from('sikt_link_issues').insert({
                                user_id: client.user_id,
                                page_url: link.sourceUrl,
                                target_url: target,
                                anchor_text: link.anchorText || null,
                                kind: link.isInternal ? 'broken_internal' : 'broken_external',
                                http_status: status,
                                consecutive_failures: 1,
                                state: 'candidate',
                                last_checked_at: nowIso,
                            });
                            if (e3) { summary.errors += 1; console.warn('[site_scan] issue-insert feilet:', e3.message); }
                        }
                    }
                } else if (verdict === 'ok') {
                    if (dryRun) continue;
                    for (const link of links) {
                        const existing = issueByKey.get(`${link.sourceUrl}|${target}`);
                        if (!existing || !['candidate', 'open', 'queued'].includes(existing.state)) continue;
                        const { error: e4 } = await supabase.from('sikt_link_issues')
                            .update({ state: 'resolved', resolved_at: nowIso, last_checked_at: nowIso, http_status: status })
                            .eq('id', existing.id);
                        if (e4) summary.errors += 1; else summary.resolvedIssues += 1;
                    }
                } else if (!dryRun) {
                    // 'unknown' (transient): oppdater kun last_checked_at så vi ikke hamrer.
                    for (const link of links) {
                        const existing = issueByKey.get(`${link.sourceUrl}|${target}`);
                        if (!existing) continue;
                        const { error: e5 } = await supabase.from('sikt_link_issues')
                            .update({ last_checked_at: nowIso })
                            .eq('id', existing.id);
                        if (e5) summary.errors += 1;
                    }
                }
            }
        }

        // --- 3) Interne lenkeforslag (deterministisk, ingen AI-kost) ---
        let gscKws = [];
        try {
            const { data: siteRow } = await supabase
                .from('sites').select('id').eq('user_id', client.user_id).maybeSingle();
            if (siteRow?.id) {
                const { data: kwRows } = await supabase
                    .from('keywords')
                    .select('keyword, impressions')
                    .eq('site_id', siteRow.id)
                    .order('impressions', { ascending: false })
                    .limit(50);
                gscKws = kwRows || [];
            }
        } catch { /* best effort */ }

        const suggestions = computeLinkSuggestions({
            pages: pages.map((p) => ({ url: p.fullUrl, title: p.title, textSample: p.textSample, inlinks: p.inlinks })),
            internalLinks: collectedLinks.filter((l) => l.isInternal).map((l) => ({ sourceUrl: l.sourceUrl, targetUrl: l.targetUrl })),
            gscKeywords: gscKws,
            brandName: client.company_name || '',
            maxNew: LS_MAX_NEW_PER_RUN,
        });
        if (!dryRun && suggestions.length) {
            const { error: sugErr } = await supabase.from('sikt_link_suggestions').upsert(
                suggestions.map((s) => ({
                    user_id: client.user_id,
                    source_url: normalizePageUrl(s.sourceUrl) || s.sourceUrl,
                    target_url: normalizePageUrl(s.targetUrl) || s.targetUrl,
                    anchor_text: s.anchorText,
                    context_snippet: s.contextSnippet,
                    reason: s.reason,
                    status: 'pending',
                })),
                { onConflict: 'user_id,source_url,target_url', ignoreDuplicates: true }
            );
            if (sugErr) { summary.errors += 1; console.warn('[site_scan] forslag-upsert feilet:', sugErr.message); }
            else summary.suggestionsAdded += suggestions.length;
        }

        // --- 4) Publisert-deteksjon: er WP-utkastene våre publisert? ---
        if (!dryRun) {
            try {
                const { data: pushedArticles } = await supabase
                    .from('sikt_articles')
                    .select('id, wp_post_id')
                    .eq('user_id', client.user_id)
                    .eq('status', 'pushed_draft')
                    .not('wp_post_id', 'is', null)
                    .limit(SS_PUBLISH_CHECK_MAX);
                if (pushedArticles?.length) {
                    const { data: host } = await supabase
                        .from('client_hosts')
                        .select('admin_url, notes, access_token_encrypted')
                        .eq('user_id', client.user_id)
                        .eq('platform', 'wordpress')
                        .eq('connection_mode', 'full')
                        .maybeSingle();
                    if (host?.admin_url && host?.notes && host?.access_token_encrypted) {
                        const authorization = afBasicAuth(host.notes.trim(), decrypt(host.access_token_encrypted));
                        for (const art of pushedArticles) {
                            const { ok, data } = await afWpGet(
                                `${host.admin_url.trim()}/wp-json/wp/v2/posts/${art.wp_post_id}?context=edit&_fields=id,status`,
                                authorization
                            );
                            if (ok && data?.status === 'publish') {
                                const { error: pubErr } = await supabase
                                    .from('sikt_articles')
                                    .update({ status: 'published' })
                                    .eq('id', art.id);
                                if (pubErr) summary.errors += 1; else summary.articlesPublished += 1;
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[site_scan] publisert-sjekk feilet:', e?.message || e);
            }
        }

        // --- Kvitterings-spor: én oppsummeringsrad i aktivitetsloggen ---
        if (!dryRun) {
            const parts = [`${pages.length} sider sjekket`];
            if (issuesFound > 0) parts.push(`${issuesFound} innholds-funn`);
            if (summary.newOpenIssues > 0) parts.push(`${summary.newOpenIssues} ødelagte lenker`);
            if (suggestions.length > 0) parts.push(`${suggestions.length} lenkeforslag`);
            const { error: actErr } = await supabase.from('sikt_actions').insert({
                user_id: client.user_id,
                action_type: 'site_scan',
                category: 'finding',
                title: `Ukentlig sidesjekk: ${parts.join(', ')}`,
                details: {
                    pages: pages.length,
                    issues: issuesFound,
                    broken_links_open: summary.newOpenIssues,
                    link_suggestions: suggestions.length,
                },
                page_url: null,
                status: 'done',
            });
            if (actErr) { summary.errors += 1; console.warn('[site_scan] actions-insert feilet:', actErr.message); }
        }
    }

    console.log('[site_scan] ferdig:', JSON.stringify({ ...summary, samples: summary.samples.length }));
    return res.status(200).json(summary);
}

// =====================================================================
// INNHOLDSPLAN-MOTOR (job=content_plan + job=content_generate):
// den proaktive innholdsmotoren. 1.–2. hver måned lages en plan per
// Standard/Premium-kunde (hvilke søkeord, hvorfor), deretter genererer
// content_generate utkastene automatisk opp til månedskvoten (2/8) —
// kunden godkjenner i portalen (ALDRI auto-publisering, kun WP-UTKAST).
// Dette er anti-churn-kjernen: hver måned står det ferdige artikler og
// venter — slutter kunden å betale, stopper maskinen.
// =====================================================================
const PLAN_MAX_CUSTOMERS = 5;        // kunder per kjøring (selv-drenerende)
const PLAN_OPP_POOL = 20;            // muligheter vi velger fra
const CG_MAX_ARTICLES_PER_RUN = 2;   // OpenAI-kostkontroll (24 kjøringer/døgn)

function planCurrentPeriod() {
    return new Date().toISOString().slice(0, 7);
}

// Premium-fyll: AI foreslår innholds-gap når muligheter/GSC ikke fyller kvoten.
// Sesong-bevisst: modellen får dagens dato og bes ligge I FORKANT av kommende
// sesong/høytid — Google trenger 4–8 uker på å rangere nytt innhold.
async function planAiGapTopics({ companyName, websiteUrl, count, existingKeywords }) {
    const todayLabel = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
    const text = await afOpenAiText({
        system:
            'Du er SEO-rådgiver for norske småbedrifter. Foreslå søkeord bedriften bør lage innhold for ' +
            '(kommersiell verdi, realistisk konkurranse, norsk språk). Tenk sesong: innhold må publiseres ' +
            '4–8 uker FØR folk begynner å søke, så foreslå det som er relevant for KOMMENDE sesong/høytider ' +
            'i Norge — ikke det som var relevant forrige måned. ' + AF_NO_CLAIMS +
            ' Svar med KUN en gyldig JSON-array av strenger, ingen forklaring.',
        user:
            `Dato i dag: ${todayLabel}\n` +
            `Bedrift: ${companyName || 'ukjent'}\nNettside: ${websiteUrl || 'ukjent'}\n` +
            `Har allerede innhold/planer for: ${existingKeywords.slice(0, 20).join(', ') || 'ingenting'}\n\n` +
            `Foreslå ${count} nye søkeord (gjerne 1–2 sesongaktuelle hvis bransjen har sesong).`,
        maxTokens: 200,
        temperature: 0.5,
    });
    if (!text) return [];
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    try {
        const arr = JSON.parse(match[0]);
        if (!Array.isArray(arr)) return [];
        return [...new Set(arr.filter((k) => typeof k === 'string').map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 3 && k.length <= 80))];
    } catch {
        return [];
    }
}

async function runContentPlan(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const period = typeof req.query?.period === 'string' && /^\d{4}-\d{2}$/.test(req.query.period)
        ? req.query.period
        : planCurrentPeriod();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await supabase
        .from('clients')
        .select('user_id, company_name, package_name, website_url')
        .not('package_name', 'is', null);
    if (error) {
        Sentry.captureException(error);
        return res.status(500).json({ error: 'Kunne ikke hente kunder.' });
    }

    // Selv-drenerende: hopp over kunder som allerede har plan for perioden.
    const { data: existingPlans } = await supabase
        .from('sikt_content_plans').select('user_id').eq('period', period);
    const hasPlan = new Set((existingPlans || []).map((p) => p.user_id));

    const summary = { period, plans: 0, items: 0, skippedExisting: 0, skippedNoKeywords: 0, errors: 0, dryRun, samples: [] };
    let processed = 0;

    for (const client of clients || []) {
        if (processed >= PLAN_MAX_CUSTOMERS) break;
        const quota = articleLimitForPackage(client.package_name);
        if (quota === 0) continue; // Basic: ingen artikler — teaser i portalen i stedet
        if (hasPlan.has(client.user_id)) { summary.skippedExisting += 1; continue; }
        processed += 1;

        // Søkeord vi allerede har dekket (artikler alle perioder) — aldri duplikat.
        const { data: artRows } = await supabase
            .from('sikt_articles').select('keyword').eq('user_id', client.user_id);
        const covered = new Set((artRows || []).map((a) => (a.keyword || '').toLowerCase()));

        const picks = [];
        const pushPick = (keyword, opportunityId, reason) => {
            const kw = (keyword || '').trim();
            if (!kw || kw.length > 120) return false;
            if (covered.has(kw.toLowerCase())) return false;
            if (picks.some((p) => p.keyword.toLowerCase() === kw.toLowerCase())) return false;
            picks.push({ keyword: kw, opportunity_id: opportunityId || null, reason });
            return true;
        };

        // 1) Åpne muligheter (near-miss + konkurrent-gap), størst trafikk først.
        const { data: opps } = await supabase
            .from('keyword_opportunities')
            .select('id, keyword, recommendation_type, estimated_traffic')
            .eq('user_id', client.user_id)
            .order('estimated_traffic', { ascending: false })
            .limit(PLAN_OPP_POOL);
        for (const o of opps || []) {
            if (picks.length >= quota) break;
            pushPick(
                o.keyword,
                o.id,
                o.recommendation_type === 'gsc_near_miss'
                    ? 'Nesten på side 1 — utvid dekningen og ta plassen'
                    : 'Konkurrentene rangerer her — du mangler innholdet'
            );
        }

        // 2) GSC-posisjon 11–25 (nesten synlig, høyest visninger først).
        if (picks.length < quota) {
            const { data: siteRow } = await supabase
                .from('sites').select('id').eq('user_id', client.user_id).maybeSingle();
            if (siteRow?.id) {
                const { data: kws } = await supabase
                    .from('keywords')
                    .select('keyword, position, impressions')
                    .eq('site_id', siteRow.id)
                    .order('impressions', { ascending: false })
                    .limit(100);
                for (const k of kws || []) {
                    if (picks.length >= quota) break;
                    if (typeof k.position !== 'number' || k.position < 11 || k.position > 25) continue;
                    pushPick(k.keyword, null, `Du er nr. ${Math.round(k.position)} på Google — innhold kan løfte deg til side 1`);
                }
            }
        }

        // 3) Premium-fyll: AI-foreslåtte innholds-gap (ETT kall, kun ved behov).
        if (picks.length < quota && /premium/i.test(client.package_name || '')) {
            const gapTopics = await planAiGapTopics({
                companyName: client.company_name,
                websiteUrl: client.website_url,
                count: quota - picks.length,
                existingKeywords: [...covered, ...picks.map((p) => p.keyword)],
            });
            for (const t of gapTopics) {
                if (picks.length >= quota) break;
                pushPick(t, null, 'Innholds-gap/sesong — foreslått ut fra bransjen din og tiden på året');
            }
        }

        if (picks.length === 0) { summary.skippedNoKeywords += 1; continue; }

        if (dryRun) {
            summary.plans += 1;
            summary.items += picks.length;
            summary.samples.push({ userId: client.user_id, quota, keywords: picks.map((p) => ({ keyword: p.keyword, reason: p.reason })) });
            continue;
        }

        const { data: planRow, error: planErr } = await supabase
            .from('sikt_content_plans')
            .insert({
                user_id: client.user_id,
                period,
                status: 'planned',
                rationale: `Valgt fra ${(opps || []).length} søkeord-muligheter og Google-posisjonene dine denne måneden.`,
            })
            .select('id')
            .single();
        if (planErr || !planRow) {
            summary.errors += 1;
            console.warn('[content_plan] plan-insert feilet:', planErr?.message);
            continue;
        }

        const { error: itemsErr } = await supabase.from('sikt_content_plan_items').insert(
            picks.map((p, idx) => ({
                plan_id: planRow.id,
                user_id: client.user_id,
                keyword: p.keyword,
                opportunity_id: p.opportunity_id,
                reason: p.reason,
                sort: idx,
                status: 'planned',
            }))
        );
        if (itemsErr) {
            summary.errors += 1;
            console.warn('[content_plan] items-insert feilet:', itemsErr.message);
            continue;
        }
        summary.plans += 1;
        summary.items += picks.length;
    }

    console.log('[content_plan] ferdig:', JSON.stringify({ ...summary, samples: summary.samples.length }));
    return res.status(200).json(summary);
}

function buildArticlesReadyEmail(client, { count, keywords, monthLabel }) {
    const hei = notifFirstName(client) ? `Hei ${escapeHtml(notifFirstName(client))}, ` : '';
    const rows = keywords.map((k, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:${i === 0 ? '0' : '1px solid #EAE6DE'}"><tr>
      <td style="padding:13px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;color:#1A1A1A">${escapeHtml(k)}</td>
    </tr></table>`).join('');
    return renderEmail({
        preheader: `${count} nye artikler venter på godkjenning i portalen.`,
        brand: 'sikt',
        kicker: 'Innholdsplan',
        heading: count === 1 ? 'En ny artikkel er klar til godkjenning' : `${count} nye artikler er klare til godkjenning`,
        intro: `${hei}Sikt har skrevet ferdig månedens artikler for ${escapeHtml(monthLabel)}. Les gjennom, godkjenn, og de legges som utkast rett i WordPress — ingenting publiseres uten deg.`,
        blocks: [sectionHead('Månedens artikler') + rows],
        cta: { label: 'Les og godkjenn i portalen', url: 'https://siktseo.com/portal' },
        footer: 'Sikt · innholdsplan · styr e-poster i Innstillinger → Varsler.',
    });
}

async function runContentGenerate(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
    }
    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OPENAI_API_KEY mangler på serveren' });
    }
    const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const period = typeof req.query?.period === 'string' && /^\d{4}-\d{2}$/.test(req.query.period)
        ? req.query.period
        : planCurrentPeriod();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const summary = { period, generated: 0, dismissed: 0, plansReady: 0, emailed: 0, skippedQuota: 0, errors: 0, dryRun, samples: [] };

    // Neste ugenererte items for perioden (eldste plan først).
    const { data: items, error: itemsErr } = await supabase
        .from('sikt_content_plan_items')
        .select('id, plan_id, user_id, keyword, opportunity_id, sort, sikt_content_plans!inner(period)')
        .eq('status', 'planned')
        .is('article_id', null)
        .eq('sikt_content_plans.period', period)
        .order('created_at', { ascending: true })
        .limit(20);
    if (itemsErr) {
        Sentry.captureException(itemsErr);
        return res.status(500).json({ error: 'Kunne ikke hente plan-items.' });
    }

    let generated = 0;
    let rateLimited = false;
    for (const item of items || []) {
        if (generated >= CG_MAX_ARTICLES_PER_RUN || rateLimited) break;

        const { data: client } = await supabase
            .from('clients')
            .select('user_id, company_name, package_name, website_url, email, contact_person, notification_preferences')
            .eq('user_id', item.user_id)
            .maybeSingle();
        if (!client) { summary.errors += 1; continue; }

        // Kontekst: GSC-søkeord + posisjon for akkurat dette søket.
        let targetKeywords = [];
        let currentPosition = null;
        try {
            const { data: siteRow } = await supabase
                .from('sites').select('id').eq('user_id', item.user_id).maybeSingle();
            if (siteRow?.id) {
                const { data: kwRows } = await supabase
                    .from('keywords')
                    .select('keyword, clicks, position')
                    .eq('site_id', siteRow.id)
                    .order('clicks', { ascending: false })
                    .limit(100);
                targetKeywords = (kwRows || []).slice(0, 8)
                    .map((k) => (typeof k?.keyword === 'string' ? k.keyword.trim() : ''))
                    .filter(Boolean);
                const match = (kwRows || []).find((k) => (k.keyword || '').toLowerCase() === item.keyword.toLowerCase());
                if (match && typeof match.position === 'number') currentPosition = match.position;
            }
        } catch { /* best effort */ }

        // Kontekst fra ukesskannet: forsidetekst + money pages (interne lenkemål).
        let businessContext = '';
        let internalLinkTargets = [];
        try {
            const { data: sitePages } = await supabase
                .from('sikt_site_pages')
                .select('url, path, title, text_sample, inlinks')
                .eq('user_id', item.user_id)
                .order('inlinks', { ascending: false })
                .limit(10);
            const home = (sitePages || []).find((p) => p.path === '/') || (sitePages || [])[0];
            if (home?.text_sample) businessContext = home.text_sample.slice(0, 1500);
            internalLinkTargets = (sitePages || [])
                .filter((p) => p.url && p.title)
                .slice(0, 5)
                .map((p) => ({ url: p.url, title: p.title }));
        } catch { /* best effort */ }

        if (dryRun) {
            summary.generated += 1;
            generated += 1;
            summary.samples.push({ userId: item.user_id, keyword: item.keyword, hasContext: !!businessContext, linkTargets: internalLinkTargets.length });
            continue;
        }

        try {
            const result = await generateArticle({
                supabase,
                userId: item.user_id,
                keyword: item.keyword,
                opportunityId: item.opportunity_id,
                currentPosition,
                businessContext,
                targetPageUrl: null,
                websiteUrl: client.website_url || '',
                packageName: client.package_name || '',
                companyName: client.company_name || '',
                targetKeywords,
                internalLinkTargets,
                source: 'plan',
                planItemId: item.id,
            });
            const { error: updErr } = await supabase
                .from('sikt_content_plan_items')
                .update({ status: 'generated', article_id: result.article.id })
                .eq('id', item.id);
            if (updErr) { summary.errors += 1; console.warn('[content_generate] item-update feilet:', updErr.message); }
            generated += 1;
            summary.generated += 1;
        } catch (err) {
            if (err instanceof ArticleEngineError) {
                if (err.code === 'quota_exceeded') {
                    // Kvoten (delt med manuelle generering) er brukt opp — prøv
                    // igjen senere/neste måned uten å brenne OpenAI-kall.
                    summary.skippedQuota += 1;
                    continue;
                }
                if (err.code === 'plan_locked') {
                    // Nedgradert til Basic midt i måneden → ikke prøv igjen.
                    const { error: disErr } = await supabase
                        .from('sikt_content_plan_items')
                        .update({ status: 'dismissed' })
                        .eq('id', item.id);
                    if (disErr) summary.errors += 1; else summary.dismissed += 1;
                    continue;
                }
                if (err.code === 'insert_failed' && err.isUniqueViolation) {
                    // Racet mot en annen kjøring — artikkelen finnes. Koble den.
                    const { data: existing } = await supabase
                        .from('sikt_articles').select('id').eq('plan_item_id', item.id).maybeSingle();
                    if (existing?.id) {
                        const { error: linkErr } = await supabase
                            .from('sikt_content_plan_items')
                            .update({ status: 'generated', article_id: existing.id })
                            .eq('id', item.id);
                        if (linkErr) summary.errors += 1;
                    }
                    continue;
                }
                if (err.code === 'rate_limited') {
                    rateLimited = true;
                    continue;
                }
            }
            summary.errors += 1;
            console.warn('[content_generate] generering feilet for', item.keyword, err?.message || err);
        }
    }

    // Finaliser planer: alle items ferdige (generert/avvist) → 'ready' + e-post.
    if (!dryRun) {
        const { data: plans } = await supabase
            .from('sikt_content_plans')
            .select('id, user_id, status, emailed_at')
            .eq('period', period)
            .neq('status', 'ready');
        for (const plan of plans || []) {
            const { count: remaining } = await supabase
                .from('sikt_content_plan_items')
                .select('id', { count: 'exact', head: true })
                .eq('plan_id', plan.id)
                .eq('status', 'planned');
            if ((remaining ?? 0) > 0) continue;

            const { data: doneItems } = await supabase
                .from('sikt_content_plan_items')
                .select('keyword, status')
                .eq('plan_id', plan.id)
                .eq('status', 'generated')
                .order('sort', { ascending: true });
            const generatedItems = doneItems || [];

            const { error: readyErr } = await supabase
                .from('sikt_content_plans')
                .update({ status: 'ready' })
                .eq('id', plan.id);
            if (readyErr) { summary.errors += 1; continue; }
            summary.plansReady += 1;

            if (generatedItems.length === 0 || plan.emailed_at) continue;
            const { data: client } = await supabase
                .from('clients')
                .select('email, contact_person, notification_preferences')
                .eq('user_id', plan.user_id)
                .maybeSingle();
            const wantsEmail = client?.notification_preferences?.contentPlan !== false;
            if (!client?.email || !wantsEmail) continue;
            const ok = await sendSiktEmail({
                to: client.email,
                subject: generatedItems.length === 1
                    ? 'En ny artikkel er klar til godkjenning'
                    : `${generatedItems.length} nye artikler er klare til godkjenning`,
                html: buildArticlesReadyEmail(client, {
                    count: generatedItems.length,
                    keywords: generatedItems.map((i) => i.keyword),
                    monthLabel: mrMonthLabel(period),
                }),
            });
            if (ok) {
                summary.emailed += 1;
                const { error: emErr } = await supabase
                    .from('sikt_content_plans')
                    .update({ emailed_at: new Date().toISOString() })
                    .eq('id', plan.id);
                if (emErr) summary.errors += 1;
            } else {
                summary.errors += 1;
            }
        }
    }

    console.log('[content_generate] ferdig:', JSON.stringify({ ...summary, samples: summary.samples.length }));
    return res.status(200).json(summary);
}

export default withSentry(async function handler(req, res) {
    // --- Sikkerhet: aksepter både Bearer-secret og x-cron-secret ---
    const authHeader = req.headers.authorization;
    const xCronSecret = req.headers['x-cron-secret'];
    const authed = CRON_SECRET && (authHeader === `Bearer ${CRON_SECRET}` || xCronSecret === CRON_SECRET);
    if (!authed) {
        return res.status(401).json({ error: 'Uautorisert' });
    }

    // Dispatch: ukentlig auto-fiks-motor
    if (req.query?.job === 'autofix') {
        return await runAutoFix(req, res);
    }

    // Dispatch: ukentlig GEO-sjekk (AI-synlighet)
    if (req.query?.job === 'geo') {
        return await runGeo(req, res);
    }

    // Dispatch: ukentlig mulighets-motor (nesten-på-side-1 + innholds-forfall)
    if (req.query?.job === 'opportunities') {
        return await runOpportunities(req, res);
    }

    // Dispatch: månedlig Google Business-profil-sjekk
    if (req.query?.job === 'gbp') {
        return await runGbp(req, res);
    }

    // Dispatch: oppetids-sjekk (kritiske varsler — nettsiden nede)
    if (req.query?.job === 'uptime') {
        return await runUptime(req, res);
    }

    // Dispatch: månedsrapport (innfrir «månedlig rapport»-løftet på prissiden)
    if (req.query?.job === 'monthly_report') {
        return await runMonthlyReport(req, res);
    }

    // Dispatch: optimaliserings-motor (Standard+: near-miss, forfall, schema, alt)
    if (req.query?.job === 'optimize') {
        return await runOptimize(req, res);
    }

    // Dispatch: ukentlig side-skann (påfylls-motoren — Verksted går aldri tom)
    if (req.query?.job === 'site_scan') {
        return await runSiteScan(req, res);
    }

    // Dispatch: månedlig innholdsplan (Standard/Premium)
    if (req.query?.job === 'content_plan') {
        return await runContentPlan(req, res);
    }

    // Dispatch: generer plan-artikler opp til kvoten (selv-drenerende)
    if (req.query?.job === 'content_generate') {
        return await runContentGenerate(req, res);
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
});
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

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
const AF_PAID_PLANS = new Set(['Standard Pakke', 'Premium Pakke']);

// --- GEO-motor (job=geo): nevner ChatGPT/Gemini/Perplexity Premium-kunden? ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GEO_MAX_CUSTOMERS = 4;   // tak per kjøring (Hobby 60s-timeout)
const GEO_QUESTIONS = 4;       // antall bransjespørsmål per kunde
const GEO_DEDUP_DAYS = 6;      // én GEO-sjekk per kunde per uke
const GEO_TIMEOUT_MS = 12_000;

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
            'Du skriver SEO-meta-beskrivelser på norsk. Krav: 120–158 tegn, aktiv stemme, ' +
            'konkret verdiløfte, viktigste søkeord naturlig tidlig, ingen klisjeer, ingen ' +
            'keyword-stuffing, ikke kopier sidetittelen ordrett. Svar med KUN beskrivelsen.',
        user: `Bedrift: ${companyName || 'ukjent'}\nSidetittel: ${pageTitle || 'ukjent'}\nURL: ${pageUrl}\n\nSkriv én meta-beskrivelse.`,
    });
    if (!text || text.length < 80 || text.length > AF_META_TARGET_MAX + 12) return null;
    return text;
}

async function afGenerateTitle({ pageTitle, pageUrl, companyName }) {
    const text = await afOpenAiText({
        system:
            'Du skriver SEO-titler (<title>) på norsk. Krav: 50–60 tegn, viktigste søkeord ' +
            'først, deretter «| Merkenavn», unik per side, ingen klisjeer. Svar med KUN tittelen.',
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
                .gte('created_at', dedupSince)
                .limit(1);
            return Array.isArray(data) && data.length > 0;
        };

        // AUTO-PUSH: meta-description + seo-title
        let autoCount = 0;
        for (const page of pages) {
            if (autoCount >= AF_MAX_FIXES_PER_CUSTOMER) break;
            const jobs = [];
            if (page.currentMeta.length < AF_META_MIN_LENGTH) jobs.push({ field: 'meta-description', gen: afGenerateMeta });
            if (page.currentTitle.length < AF_TITLE_MIN_LENGTH) jobs.push({ field: 'seo-title', gen: afGenerateTitle });

            for (const job of jobs) {
                if (autoCount >= AF_MAX_FIXES_PER_CUSTOMER) break;
                if (await recentlyChanged(page.link, job.field)) { summary.skipped += 1; continue; }
                const value = await job.gen({ pageTitle: page.title, pageUrl: page.link, companyName });
                if (!value) { summary.skipped += 1; continue; }
                if (dryRun) { summary.autoFixed += 1; autoCount += 1; continue; }
                const result = await afPushFix({ userId: host.user_id, pageUrl: page.link, field: job.field, newValue: value });
                if (result.ok) { summary.autoFixed += 1; autoCount += 1; }
                else { summary.errors += 1; console.warn('[autofix] push feilet:', job.field, page.link, result.error); }
            }
        }

        // KØ: manglende H1
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

async function geoAskGemini(question) {
    if (!GEMINI_API_KEY) return null;
    try {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: question }] }] }),
                signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
            },
        );
        if (!r.ok) return null;
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
    const summary = { providers, customers: 0, checks: 0, mentions: 0, skipped: 0, errors: 0, dryRun };
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
        for (const q of questions) {
            const [cg, gm, px] = await Promise.all([
                providers.chatgpt ? geoAskChatGPT(q) : Promise.resolve(null),
                providers.gemini ? geoAskGemini(q) : Promise.resolve(null),
                providers.perplexity ? geoAskPerplexity(q) : Promise.resolve(null),
            ]);
            for (const [provider, ans] of [['chatgpt', cg], ['gemini', gm], ['perplexity', px]]) {
                if (ans == null) continue;
                const mentioned = geoMentioned(ans, company, domainCore);
                summary.checks += 1;
                if (mentioned) summary.mentions += 1;
                rows.push({ user_id: client.user_id, provider, question: q, mentioned, answer_excerpt: String(ans).slice(0, 300) });
            }
        }
        if (!dryRun && rows.length) {
            const { error: insErr } = await supabase.from('geo_checks').insert(rows);
            if (insErr) { summary.errors += 1; console.warn('[geo] insert feilet:', insErr.message); }
        }
    }

    console.log('[geo] ferdig:', JSON.stringify(summary));
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
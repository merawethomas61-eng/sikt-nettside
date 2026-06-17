import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { assertSafeUserUrl, fetchHtmlSafe } from './_lib/url-guard.js';
import { withSentry, Sentry } from './_lib/sentry.js';
import {
    fetchExternalWithOptionalRetry,
    isOpenAiRateLimited,
    respondRateLimited,
} from './_lib/external-rate-limit.js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 10;
const ipTracker = new Map();

// Henter HTML-en fra kundens side og trekker ut en relevant bit
// (maks ~8000 tegn) basert på hvilken type problem AI skal løse.
async function fetchRelevantHtml(pageUrl, problemTitle, userWebsiteUrl) {
    if (!pageUrl) return null;

    try {
        const safeUrl = await assertSafeUserUrl(pageUrl, userWebsiteUrl);
        const { response: res } = await fetchHtmlSafe(safeUrl, userWebsiteUrl);
        if (!res.ok) return { error: `Nettsiden svarte med HTTP ${res.status}` };
        const html = await res.text();

        const $ = cheerio.load(html);
        const title = (problemTitle || '').toLowerCase();

        // Velger de mest relevante nodene basert på problem-tittel.
        let relevant = '';
        const pushBlock = (label, content) => {
            if (!content) return;
            relevant += `\n<!-- ${label} -->\n${content.trim()}\n`;
        };

        // Alltid: head med meta / title / lenker (viktigst for SEO/ytelse)
        pushBlock('HEAD', $.html($('head')));

        if (/css|stilark|render-blocking|unused css|ubrukt css/.test(title)) {
            const styles = $('link[rel="stylesheet"], style').map((_, el) => $.html(el)).get().join('\n');
            pushBlock('STYLES', styles);
        }
        if (/javascript|script|render-blocking|ubrukt javascript|unused js/.test(title)) {
            const scripts = $('script').map((_, el) => $.html(el)).get().slice(0, 30).join('\n');
            pushBlock('SCRIPTS', scripts);
        }
        if (/image|bilde|lcp|next-gen|modern image/.test(title)) {
            const imgs = $('img').map((_, el) => $.html(el)).get().slice(0, 30).join('\n');
            pushBlock('IMAGES', imgs);
        }
        if (/meta|description|title|seo/.test(title)) {
            const metas = $('meta').map((_, el) => $.html(el)).get().join('\n');
            const h1 = $('h1').map((_, el) => $.html(el)).get().join('\n');
            pushBlock('META', metas);
            pushBlock('H1', h1);
        }
        if (/alt[- ]tekst|alt text|tilgjengelighet|accessibility/.test(title)) {
            const imgs = $('img').map((_, el) => $.html(el)).get().slice(0, 30).join('\n');
            const buttons = $('button, a').map((_, el) => $.html(el)).get().slice(0, 20).join('\n');
            pushBlock('IMAGES', imgs);
            pushBlock('INTERACTIVE', buttons);
        }

        // Fallback: toppen av <body> hvis vi ikke matchet noe spesifikt.
        if (relevant.trim().length < 500) {
            const body = $.html($('body')).slice(0, 4000);
            pushBlock('BODY (forkortet)', body);
        }

        // Trunker til 8000 tegn slik at vi ikke sprenger OpenAI-konteksten.
        if (relevant.length > 8000) relevant = relevant.slice(0, 8000) + '\n<!-- ...trunkert... -->';
        return { html: relevant, fullLength: html.length };
    } catch (err) {
        return { error: err?.message || 'Klarte ikke hente HTML' };
    }
}

export default withSentry(async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode ikke tillatt' });
    }

    // --- FARTSDUMP ---
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'ukjent-ip';
    const now = Date.now();
    const requestData = ipTracker.get(ip) || { count: 0, firstRequest: now };
    if (now - requestData.firstRequest > rateLimitWindowMs) {
        requestData.count = 1;
        requestData.firstRequest = now;
    } else {
        requestData.count++;
    }
    ipTracker.set(ip, requestData);
    if (requestData.count > maxRequestsPerWindow) {
        return res.status(429).json({ error: 'For mange kall. Vennligst vent ett minutt.' });
    }

    // --- AUTH ---
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Avvist: Du er ikke logget inn' });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Send brukerens token videre slik at RLS-spørringene (auth.uid() = user_id)
    // mot clients/sites/keywords faktisk returnerer kundens egne rader.
    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: 'Avvist: Ugyldig bruker' });
    }

    const { url, problemTitle, problemDetails, category } = req.body || {};

    if (!problemTitle) {
        return res.status(400).json({ error: 'Mangler problemTitle' });
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
            steps: [{ title: 'Mangler API-nøkkel', description: 'OPENAI_API_KEY er ikke lagt inn i Vercel.' }],
            codePatch: null
        });
    }

    // Hent host-tilkobling fra client_hosts — vi stoler ikke på frontend for dette
    // siden det avgjør om vi bruker betalt AI-kontekst eller ikke.
    let hostConnection = null;
    try {
        const { data: hostRow } = await supabase
            .from('client_hosts')
            .select('platform, connection_mode, repo_url, admin_url')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
        if (hostRow && (hostRow.connection_mode === 'light' || hostRow.connection_mode === 'full')) {
            hostConnection = hostRow;
        }
    } catch (hostErr) {
        console.warn('[solve-problem] Kunne ikke hente client_hosts:', hostErr?.message || hostErr);
    }

    let websiteUrl = '';
    let packageName = '';
    let declaredPlatform = null;
    try {
        const { data: clientRow } = await supabase
            .from('clients')
            .select('website_url, websiteUrl, package_name, platform')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
        websiteUrl = (clientRow?.website_url || clientRow?.websiteUrl || '').trim();
        packageName = (clientRow?.package_name || '').toString();
        declaredPlatform = clientRow?.platform || null;
    } catch (urlErr) {
        console.warn('[solve-problem] Kunne ikke hente website_url:', urlErr?.message || urlErr);
    }

    // Koblet host (client_hosts) vinner over deklarert plattform (onboarding).
    const effectivePlatform = hostConnection?.platform || declaredPlatform || null;
    const isStandardPlus = /standard|premium/i.test(packageName);
    const isAiBuilt = effectivePlatform === 'ai_built';

    // Finn URL server-side også (fallback) slik at vi ikke er avhengig av at frontend
    // alltid sender riktig adresse i body.
    let effectiveUrl = typeof url === 'string' ? url.trim() : '';
    if (!effectiveUrl) {
        effectiveUrl = websiteUrl;
    }

    // Hent kundens FAKTISKE Google-søk (Search Console) slik at AI-en kan målrette
    // meta-tittel/-beskrivelse mot søkene folk virkelig bruker — ikke gjette.
    let targetKeywords = [];
    try {
        const { data: siteRow } = await supabase
            .from('sites')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
        if (siteRow?.id) {
            const { data: kwRows } = await supabase
                .from('keywords')
                .select('keyword, clicks, impressions, position')
                .eq('site_id', siteRow.id)
                .order('clicks', { ascending: false })
                .limit(8);
            if (Array.isArray(kwRows)) {
                targetKeywords = kwRows
                    .map((k) => (typeof k?.keyword === 'string' ? k.keyword.trim() : ''))
                    .filter(Boolean);
            }
        }
    } catch (kwErr) {
        console.warn('[solve-problem] Kunne ikke hente GSC-søkeord:', kwErr?.message || kwErr);
    }
    const keywordHint = targetKeywords.length
        ? `\n\nKUNDENS EKTE GOOGLE-SØK (fra Search Console, viktigst først):\n${targetKeywords.map((k) => `- ${k}`).join('\n')}\nNår du skriver meta-titler, beskrivelser eller tekst: målrett mot disse søkene der det er naturlig. Ikke keyword-stuff.`
        : '';

    // Vi leser ALLTID den faktiske siden (read-only HTTP GET) — det krever ingen
    // host-tilkobling. Slik får også Basic-kunder sidespesifikke forslag i stedet
    // for generiske gjetninger. Host-tilkobling brukes kun til å SKRIVE/pushe.
    const websiteHost = hostConnection?.platform || null;
    const hasHost = !!hostConnection;
    let htmlContext = null;
    let htmlError = null;
    if (effectiveUrl) {
        try {
            await assertSafeUserUrl(effectiveUrl, websiteUrl);
            const fetched = await fetchRelevantHtml(effectiveUrl, problemTitle, websiteUrl);
            if (fetched?.html) htmlContext = fetched.html;
            if (fetched?.error) htmlError = fetched.error;
        } catch (urlGuardErr) {
            return res.status(400).json({
                error: urlGuardErr?.message || 'URL er ikke tillatt.',
                steps: [{ title: 'Ugyldig URL', description: urlGuardErr?.message || 'URL er ikke tillatt.' }],
                codePatch: null,
            });
        }
    }

    // Felles SEO-kvalitetskrav for tekst kunden limer inn (meta, tittel, alt).
    const SEO_COPY_RULES = `

SEO-KVALITETSKRAV (gjelder all tekst kunden skal lime inn):
- META-BESKRIVELSE: 120–158 tegn. Aktiv stemme, konkret verdiløfte, gjerne en mild oppfordring. Plassér det viktigste søkeordet naturlig tidlig. IKKE kopier sidetittel/H1 ordrett. Unik per side.
- META-TITTEL / <title>: 50–60 tegn. Søkeord først, deretter «| Merkenavn». Unik per side.
- ALT-TEKST: beskriv hva bildet FAKTISK viser, maks ~125 tegn. Ikke start med «Bilde av». Ingen keyword-stuffing. Rent dekorative bilder = tom alt="".
- Skriv naturlig norsk for et menneske, ikke for en robot. Ingen klisjeer («markedsledende», «skreddersydde løsninger»).
- ALDRI plassholdere som «DIN_TEKST» eller «[sett inn …]» — lever ferdig tekst kunden kan lime rett inn.`;

    // Bygg instruks: strengere struktur når vi faktisk har HTML å peke på.
    const systemPrompt = (htmlContext
        ? `Du er en sylskarp teknisk ekspert på webutvikling. Du har fått HTML-en fra siden kunden vil forbedre, og du skal finne NØYAKTIG hvilken kode som forårsaker problemet og hva den skal erstattes med.

DU MÅ SVARE I ET STRENGT JSON-FORMAT:
{
  "steps": [
    { "title": "Kort handlingsrettet overskrift", "description": "Forklaring på norsk, 1-2 setninger" }
  ],
  "originalCode": "EKSAKT kode-biten fra kundens HTML som må fjernes/endres — copy-paste fra HTML-en du fikk",
  "codePatch": "Den NYE koden som skal erstatte originalCode — ren, kommentert på norsk, copy-paste klar",
  "fileHint": "Hvilken fil/plass i ${websiteHost || 'CMS-et'} kunden finner denne koden (f.eks. 'header.liquid', 'functions.php', 'theme header', '<head>-seksjonen')",
  "replacementExplanation": "Kort forklaring (1-2 setninger) på HVORFOR erstatningen er bedre"
}

REGLER:
1. originalCode SKAL være hentet ordrett fra HTML-en nedenfor. Ikke finn på kode.
2. Hvis du ikke finner en eksakt match for problemet, sett originalCode til null og forklar hvorfor i steps.
3. codePatch skal være klar til copy-paste — ingen plassholdere.
4. Svar på norsk.`
        : `Du er en sylskarp teknisk ekspert på webutvikling. Din oppgave er å analysere feilmeldinger og levere nøyaktige løsninger. DU MÅ SVARE I ET STRENGT JSON-FORMAT. Svaret ditt SKAL ha nøyaktig denne strukturen:
{
  "steps": [
    {
      "title": "Kort, handlingsrettet overskrift",
      "description": "En til to setninger med presis forklaring på norsk."
    }
  ],
  "codePatch": "Faktisk kode"
}

VIKTIGE REGLER FOR KODE (COPY-PASTE):
1. Du SKAL nesten alltid levere noe i 'codePatch'. Kundene våre betaler for copy-paste-kode!
2. Hvis feilen er generell (f.eks. "Ubrukt JavaScript" eller "Ubrukt CSS"), skriv et kode-eksempel på hvordan man utsetter innlasting i React/Next.js eller en standard HTML defer-tag.
3. Koden skal være ren, kommentert på norsk, og klar til å limes rett inn i prosjektet.`) + SEO_COPY_RULES;

    const problemDesc = typeof problemDetails === 'string' ? problemDetails : JSON.stringify(problemDetails || {}).slice(0, 800);
    const userContent = htmlContext
        ? `URL: ${effectiveUrl}\nWebhost/plattform: ${websiteHost || 'ukjent (kunden har ikke koblet til host)'}\nKategori: ${category || 'generell'}\nTittel: ${problemTitle}\nBeskrivelse: ${problemDesc}${keywordHint}\n\nHTML-UTDRAG FRA SIDEN (bruk denne som kilde for originalCode):\n\`\`\`html\n${htmlContext}\n\`\`\``
        : `URL: ${effectiveUrl || 'ukjent'}\nKategori: ${category || 'generell'}\nTittel: ${problemTitle}\nBeskrivelse: ${problemDesc}${keywordHint}`;

    try {
        const response = await fetchExternalWithOptionalRetry('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent },
                ],
                temperature: 0.2
            })
        });

        if (isOpenAiRateLimited(response.status)) {
            return respondRateLimited(res, response);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI sier: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        let rawContent = data.choices[0].message.content;
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResult = JSON.parse(rawContent);

        // --- GUARDRAILS på AI-output (kunden betaler for ferdig, sann copy-paste) ---
        let steps = Array.isArray(aiResult.steps)
            ? aiResult.steps.filter((s) => s && (s.title || s.description))
            : [];
        if (steps.length === 0) {
            steps = [{ title: 'AI Formateringsfeil', description: 'AI-en klarte ikke å formatere listen riktig. Prøv igjen.' }];
        }

        let codePatch = typeof aiResult.codePatch === 'string' ? aiResult.codePatch.trim() : null;
        let originalCode = typeof aiResult.originalCode === 'string' ? aiResult.originalCode.trim() : null;

        // 1) Forkast hallusinert originalCode: den SKAL finnes ordrett i HTML-en vi hentet.
        //    Ellers viser vi kunden falsk «slik ser koden din ut nå».
        let originalCodeVerified = false;
        if (originalCode && htmlContext) {
            const norm = (s) => s.replace(/\s+/g, ' ').trim();
            originalCodeVerified = norm(htmlContext).includes(norm(originalCode));
            if (!originalCodeVerified) originalCode = null;
        }

        // 2) Plassholder-vakt: avvis copy-paste som ikke er ferdig utfylt.
        const PLACEHOLDER_RE = /DIN_TEKST|DITT_SØKEORD|PLACEHOLDER|LOREM IPSUM|\[\s*sett inn|\[\s*din |\bTODO\b|\bFIXME\b|\bXXXX+\b/i;
        if (codePatch && PLACEHOLDER_RE.test(codePatch)) {
            steps = [...steps, {
                title: 'Dobbeltsjekk før du limer inn',
                description: 'Forslaget inneholdt en plassholder du må fylle inn selv — se teksten i klammer/hermetegn.',
            }];
        }

        // 3) Meta-beskrivelse: valider lengde mot Googles visningsgrense (~158 tegn).
        let qualityNote = null;
        if (/meta|beskrivelse|description/i.test(problemTitle || '') && codePatch) {
            const m = codePatch.match(/content\s*=\s*["']([^"']+)["']/i);
            const metaText = m && m[1] ? m[1].trim() : null;
            if (metaText) {
                if (metaText.length < 110) qualityNote = `Meta-beskrivelsen er litt kort (${metaText.length} tegn). 120–158 tegn utnytter plassen i Google bedre.`;
                else if (metaText.length > 165) qualityNote = `Meta-beskrivelsen er litt lang (${metaText.length} tegn). Google kutter rundt 158 tegn.`;
            }
        }

        // --- AI-PROMPT for AI-bygde sider (Standard+) ---
        // «Gjort-for-deg»-ekvivalenten for kode-bygde sider (Claude/Cursor/v0):
        // en ferdig instruks kunden limer inn i AI-verktøyet sitt, som så endrer
        // deres EGEN kildekode. Utledes fra det vi alt har — ingen nytt AI-kall.
        const buildAiPrompt = () => {
            const stepLines = (steps || [])
                .map((s, i) => `${i + 1}. ${s.title || ''}${s.description ? ` — ${s.description}` : ''}`)
                .join('\n');
            const parts = [];
            parts.push('Du er en senior webutvikler med tilgang til kildekoden til nettsiden min. Jeg vil fikse et konkret SEO-/ytelsesproblem.');
            parts.push(`\nSide: ${effectiveUrl || websiteUrl || '(min nettside)'}\nProblem: ${problemTitle}`);
            if (problemDesc) parts.push(`Detaljer: ${problemDesc}`);
            if (stepLines) parts.push(`\nSlik skal det løses:\n${stepLines}`);
            if (originalCode) parts.push(`\nI den rendrede HTML-en ser det omtrent slik ut i dag (kildekoden din kan se annerledes ut — finn det tilsvarende):\n${originalCode}`);
            if (codePatch) parts.push(`\nØnsket slutt-tilstand / hva det skal bli:\n${codePatch}`);
            if (aiResult.fileHint) parts.push(`\nSannsynlig sted: ${aiResult.fileHint}`);
            parts.push('\nOppgave: Gjør endringen i de RIKTIGE kildefilene mine (ikke lim inn rendret HTML blindt). Behold eksisterende design og funksjonalitet. Forklar kort hva du endret til slutt.');
            parts.push(SEO_COPY_RULES.trim());
            return parts.join('\n');
        };
        const aiPrompt = (isAiBuilt && isStandardPlus) ? buildAiPrompt() : null;
        const aiPromptLocked = isAiBuilt && !isStandardPlus;

        return res.status(200).json({
            steps,
            codePatch: codePatch || null,
            originalCode: originalCode || null,
            originalCodeVerified,
            qualityNote,
            fileHint: aiResult.fileHint || null,
            replacementExplanation: aiResult.replacementExplanation || null,
            usedHtmlContext: !!htmlContext,
            htmlFetchError: htmlError,
            effectiveUrl: effectiveUrl || null,
            hostConnected: hasHost,
            hostPlatform: websiteHost,
            aiPrompt,
            aiPromptLocked,
            effectivePlatform,
        });

    } catch (error) {
        console.error('solve-problem error:', error);
        Sentry.captureException(error);
        return res.status(500).json({
            steps: [{ title: 'Feil ved AI-kall', description: error.message }],
            codePatch: null
        });
    }
});

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 10;
const ipTracker = new Map();

// Henter HTML-en fra kundens side og trekker ut en relevant bit
// (maks ~8000 tegn) basert på hvilken type problem AI skal løse.
async function fetchRelevantHtml(pageUrl, problemTitle) {
    if (!pageUrl) return null;
    let normalized = pageUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

    try {
        const res = await fetch(normalized, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SiktBot/1.0; +https://sikt.no)'
            },
        });
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

export default async function handler(req, res) {
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
    const supabase = createClient(supabaseUrl, supabaseKey);
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

    // Hvis kunden har koblet til webhost, henter vi faktisk HTML fra siden.
    // Dette lar AI-en peke på KONKRET kode i stedet for å gi generiske svar.
    const websiteHost = hostConnection?.platform || null;
    const hasHost = !!hostConnection;
    let htmlContext = null;
    let htmlError = null;
    if (hasHost && url) {
        const fetched = await fetchRelevantHtml(url, problemTitle);
        if (fetched?.html) htmlContext = fetched.html;
        if (fetched?.error) htmlError = fetched.error;
    }

    // Bygg instruks: strengere struktur når vi faktisk har HTML å peke på.
    const systemPrompt = hasHost && htmlContext
        ? `Du er en sylskarp teknisk ekspert på webutvikling. Kunden har gitt deg tilgang til HTML-en fra siden sin, og du skal finne NØYAKTIG hvilken kode som forårsaker problemet og hva den skal erstattes med.

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
3. Koden skal være ren, kommentert på norsk, og klar til å limes rett inn i prosjektet.`;

    const userContent = hasHost && htmlContext
        ? `URL: ${url}\nWebhost/plattform: ${websiteHost}\nKategori: ${category || 'generell'}\nTittel: ${problemTitle}\nBeskrivelse: ${typeof problemDetails === 'string' ? problemDetails : JSON.stringify(problemDetails || {}).slice(0, 800)}\n\nHTML-UTDRAG FRA SIDEN (bruk denne som kilde for originalCode):\n\`\`\`html\n${htmlContext}\n\`\`\``
        : `URL: ${url || 'ukjent'}\nKategori: ${category || 'generell'}\nTittel: ${problemTitle}\nBeskrivelse: ${typeof problemDetails === 'string' ? problemDetails : JSON.stringify(problemDetails || {}).slice(0, 800)}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI sier: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        let rawContent = data.choices[0].message.content;
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResult = JSON.parse(rawContent);

        return res.status(200).json({
            steps: Array.isArray(aiResult.steps) ? aiResult.steps : [{ title: 'AI Formateringsfeil', description: 'AI-en klarte ikke å formatere listen riktig.' }],
            codePatch: aiResult.codePatch || null,
            originalCode: aiResult.originalCode || null,
            fileHint: aiResult.fileHint || null,
            replacementExplanation: aiResult.replacementExplanation || null,
            usedHtmlContext: !!htmlContext,
            htmlFetchError: htmlError,
        });

    } catch (error) {
        console.error('solve-problem error:', error);
        return res.status(500).json({
            steps: [{ title: 'Feil ved AI-kall', description: error.message }],
            codePatch: null
        });
    }
}

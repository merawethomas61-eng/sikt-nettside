import { createClient } from '@supabase/supabase-js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 10;
const ipTracker = new Map();

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
                    {
                        role: 'system',
                        content: `Du er en sylskarp teknisk ekspert på webutvikling. Din oppgave er å analysere feilmeldinger og levere nøyaktige løsninger. DU MÅ SVARE I ET STRENGT JSON-FORMAT. Svaret ditt SKAL ha nøyaktig denne strukturen:
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
3. Koden skal være ren, kommentert på norsk, og klar til å limes rett inn i prosjektet.`
                    },
                    {
                        role: 'user',
                        content: `URL: ${url || 'ukjent'}\nKategori: ${category || 'generell'}\nTittel: ${problemTitle}\nBeskrivelse: ${problemDetails || ''}`
                    }
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
            codePatch: aiResult.codePatch || null
        });

    } catch (error) {
        console.error('solve-problem error:', error);
        return res.status(500).json({
            steps: [{ title: 'Feil ved AI-kall', description: error.message }],
            codePatch: null
        });
    }
}

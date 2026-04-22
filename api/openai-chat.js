import { createClient } from '@supabase/supabase-js';

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 20;
const ipTracker = new Map();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Kun POST tillatt' });
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
        return res.status(429).json({ error: 'For mange AI-kall. Vennligst vent ett minutt.' });
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

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OPENAI_API_KEY mangler på serveren' });
    }

    const {
        prompt,
        model = 'gpt-4o-mini',
        maxTokens = 300,
        temperature = 0.7,
        jsonMode = false,
        systemPrompt,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Mangler prompt' });
    }

    // Begrens promptens størrelse for å hindre misbruk
    if (prompt.length > 8000) {
        return res.status(400).json({ error: 'Prompt er for lang (maks 8000 tegn)' });
    }

    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: String(systemPrompt).slice(0, 2000) });
    }
    messages.push({ role: 'user', content: prompt });

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: Math.min(Number(maxTokens) || 300, 1000),
                temperature: Math.max(0, Math.min(Number(temperature) || 0.7, 1.5)),
                ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(502).json({
                error: `OpenAI feilet: ${errorData.error?.message || response.statusText}`,
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? '';
        return res.status(200).json({ content });
    } catch (error) {
        console.error('openai-chat error:', error);
        return res.status(500).json({ error: 'Intern feil ved AI-kall' });
    }
}

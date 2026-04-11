export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode ikke tillatt' });
    }

    const { url, problemTitle, problemDetails } = req.body;

    if (!process.env.OPENAI_API_KEY) {
        return res.status(200).json({
            steps: [{ title: "Mangler API-nøkkel", description: "OPENAI_API_KEY er ikke lagt inn i Vercel." }],
            codePatch: null
        });
    }

    try {
        const response = await fetch('[https://api.openai.com/v1/chat/completions](https://api.openai.com/v1/chat/completions)', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: "Du er en webekspert. Svar KUN med JSON. Formatet SKAL nøyaktig være: {\"steps\": [{\"title\": \"Overskrift\", \"description\": \"Kort forklaring\"}], \"codePatch\": null}. Arrayen 'steps' er obligatorisk. Aldri bruk markdown-formatering rundt svaret."
                    },
                    {
                        role: "user",
                        content: `Problem på nettsiden: ${url}\nTittel: ${problemTitle}\nDetaljer: ${JSON.stringify(problemDetails)}`
                    }
                ],
                temperature: 0.2
            })
        });

        if (!response.ok) {
            throw new Error("Kunne ikke koble til OpenAI sitt API.");
        }

        const data = await response.json();
        let rawContent = data.choices[0].message.content;

        // SIKKERHET 1: Fjern irriterende markdown-ticks hvis AI-en er ulydig
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

        const aiResult = JSON.parse(rawContent);

        // SIKKERHET 2: Tving formatet til å være riktig før vi sender det til React
        return res.status(200).json({
            steps: Array.isArray(aiResult.steps) ? aiResult.steps : [{ title: "AI Formateringsfeil", description: "AI-en klarte ikke å formatere listen riktig." }],
            codePatch: aiResult.codePatch || null
        });

    } catch (error) {
        console.error("Kritisk feil:", error);
        // SIKKERHET 3: Returner feilen som et "steg", så frontenden alltid klarer å tegne sirklene
        return res.status(200).json({
            steps: [
                {
                    title: "AI-motoren krasjet",
                    description: "Det oppstod en teknisk feil på serveren under analysen. Prøv igjen om litt."
                }
            ],
            codePatch: null
        });
    }
}
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
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // .trim() fjerner eventuelle usynlige mellomrom du kan ha fått med deg
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
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

        // DETEKTIVEN: Hvis OpenAI nekter å svare, henter vi ut den nøyaktige grunnen
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI sier: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        let rawContent = data.choices[0].message.content;

        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

        const aiResult = JSON.parse(rawContent);

        return res.status(200).json({
            steps: Array.isArray(aiResult.steps) ? aiResult.steps : [{ title: "AI Formateringsfeil", description: "AI-en klarte ikke å formatere listen riktig." }],
            codePatch: aiResult.codePatch || null
        });

    } catch (error) {
        console.error("Feil:", error);
        // Vi sender den EKTE feilmeldingen fra OpenAI rett til grensesnittet ditt
        return res.status(200).json({
            steps: [
                {
                    title: "Avslørt Feilmelding",
                    description: error.message
                }
            ],
            codePatch: null
        });
    }
}
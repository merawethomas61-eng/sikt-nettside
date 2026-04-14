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
                        role: "user",
                        content: `Kategori: ${kategori}\nTittel: ${tittel}\nBeskrivelse: ${beskrivelse}`
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
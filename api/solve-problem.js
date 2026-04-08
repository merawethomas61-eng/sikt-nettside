export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Kun POST er tillatt' });
    }

    const { url, problemTitle, problemDetails } = req.body;
    const openAiKey = process.env.OPENAI_API_KEY; // Hentes fra Vercel / .env senere

    // SIKKERHETSNETT: Hvis du ikke har lagt inn nøkkel enda, sender vi et realistisk testsvar
    if (!openAiKey) {
        console.log("Ingen OpenAI-nøkkel funnet. Kjører i Test-modus.");
        return res.status(200).json({
            explanation: `(TEST MODUS) Jeg har analysert kildekoden for feilen "${problemTitle}" på domenet ditt (${url}). Problemet oppstår fordi et tungt script blokkerer hovedtråden. Hvis vi utsetter lastingen av dette, vil ytelsen øke drastisk.`,
            codePatch: {
                old: `<script src="/assets/tung-fil.js"></script>`,
                new: `<script src="/assets/tung-fil.js" defer></script>`
            },
            manualSteps: [
                "Logg inn i ditt CMS (f.eks. WordPress eller Shopify).",
                "Gå til header.php, eller bruk en utvidelse som 'Insert Headers and Footers'.",
                "Bytt ut den gamle koden med den nye for å fjerne blokkeringen."
            ]
        });
    }

    // --- DEN EKTE AI-MOTOREN ---
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // Bruker den raskeste og smarteste modellen
                messages: [
                    {
                        role: "system",
                        content: `Du er en Senior SEO-tekniker og Web-utvikler. Din jobb er å gi kunden en skreddersydd kode-fiks for problemet deres. 
            Svar ALLTID i gyldig JSON-format med nøyaktig denne strukturen:
            {
              "explanation": "En pedagogisk forklaring på hva som er feil og hvorfor det skader nettsiden",
              "codePatch": {
                "old": "Koden som skaper problemet (bruk null hvis ikke relevant)",
                "new": "Den eksakte nye koden kunden skal lime inn (bruk null hvis ikke relevant)"
              },
              "manualSteps": ["Steg 1...", "Steg 2...", "Steg 3..."]
            }
            Skriv alltid på norsk.`
                    },
                    {
                        role: "user",
                        content: `Nettside som analyseres: ${url}\nProblem oppdaget: ${problemTitle}\nEkstra detaljer: ${JSON.stringify(problemDetails)}`
                    }
                ],
                response_format: { type: "json_object" } // Tvinger OpenAI til å kun sende tilbake JSON, ikke masse overflødig tekst
            })
        });

        const aiData = await response.json();
        const result = JSON.parse(aiData.choices[0].message.content);

        return res.status(200).json(result);

    } catch (error) {
        console.error("AI Feil:", error);
        return res.status(500).json({ error: 'Klarte ikke å generere AI-løsning.' });
    }
}
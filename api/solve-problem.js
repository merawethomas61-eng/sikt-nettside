export default async function handler(req, res) {
    // 1. Sjekk at forespørselen er riktig type (POST)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode ikke tillatt' });
    }

    // 2. Hent dataene frontenden din sendte over
    const { url, problemTitle, problemDetails } = req.body;

    // 3. Sikkerhetssjekk: Mangler vi API-nøkkelen?
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
            explanation: "Systemfeil: Mangler OPENAI_API_KEY på Vercel.",
            codePatch: null
        });
    }

    try {
        // 4. Send problemet til gpt-4o-mini
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                // Tvinger AI-en til å alltid svare med et maskinlesbart JSON-format
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `Du er en sylskarp teknisk ekspert på webutvikling. Din oppgave er å analysere feilmeldinger og levere nøyaktige løsninger.

DU MÅ SVARE I ET STRENGT JSON-FORMAT. Du har ikke lov til å skrive noe annen tekst utenfor JSON-objektet. Svaret ditt SKAL ha nøyaktig denne strukturen:
{
  "steps": [
    {
      "title": "Kort, handlingsrettet overskrift",
      "description": "En til to setninger med presis forklaring på norsk."
    }
  ],
  "codePatch": null
}

VIKTIGE REGLER:
1. 'steps' MÅ ALLTID være en Array (liste) med opptil 4 objekter. 
2. Du må aldri samle alt i én tekststreng med bindestreker.
3. Hvis problemet krever en spesifikk kodeendring, legg koden som en tekststreng i 'codePatch'. Hvis ikke kode kreves, la den være null.`
                    },
                    {
                        role: "user",
                        content: `Kunden har et problem på nettsiden sin: ${url}\nProblemets tittel: ${problemTitle}\nTekniske detaljer fra analysen: ${JSON.stringify(problemDetails)}`
                    }
                ],
                // Temperature på 0.2 gjør AI-en logisk og analytisk, fremfor "kreativ"
                temperature: 0.2
            })
        });

        if (!response.ok) {
            throw new Error("Fikk ikke kontakt med OpenAI sitt API.");
        }

        // 5. Pakk ut svaret fra AI-en
        const data = await response.json();
        const aiResult = JSON.parse(data.choices[0].message.content);

        // 6. Send det perfekte JSON-svaret tilbake til Verksted-knappen din
        return res.status(200).json({
            steps: aiResult.explanation,
            codePatch: aiResult.codePatch || null
        });

    } catch (error) {
        console.error("Kritisk feil i AI-generering:", error);
        return res.status(500).json({
            explanation: "Beklager, AI-hjernen klarte ikke å prosessere dette problemet akkurat nå. Prøv igjen om litt.",
            codePatch: null
        });
    }
}
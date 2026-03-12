// Denne koden kjører på Vercel sin server, helt skjult for brukeren.

export default async function handler(request, response) {
    // 1. Tillat kun POST for sikker og stabil dataoverføring
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Kun POST er tillatt' });
    }

    // 2. Hent søkeord og sted fra frontend
    const { keyword, location } = request.body;

    if (!keyword || !location) {
        return response.status(400).json({ error: 'Mangler søkeord eller sted' });
    }

    // 3. HENT NØKKELEN TRYGT (Uten VITE_ for å hindre at den lekker til frontend)
    const apiKey = process.env.SERP_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'Mangler API-nøkkel på serveren' });
    }

    try {
        // 4. Bygg den komplette URL-en med lokasjon og desktop-søk
        const targetUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&google_domain=google.no&gl=no&hl=no&location=${encodeURIComponent(location + ", Norway")}&num=20&device=desktop&api_key=${apiKey}`;

        const res = await fetch(targetUrl);
        const data = await res.json();

        // 5. Send resultatet tilbake til din React-app
        return response.status(200).json(data);

    } catch (error) {
        console.error("Serverfeil:", error);
        return response.status(500).json({ error: 'Noe gikk galt på serveren', details: error.message });
    }
}
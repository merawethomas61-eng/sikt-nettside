// Denne koden kjører på Vercel sin server, ikke i nettleseren.
// Derfor blokkeres den ikke av CORS.

export default async function handler(request, response) {
    // Hent søkeordet fra URL-en (f.eks ?keyword=rørlegger)
    const { keyword } = request.query;

    if (!keyword) {
        return response.status(400).json({ error: 'Mangler søkeord' });
    }

    const apiKey = process.env.VITE_SERP_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'Mangler API-nøkkel på serveren' });
    }

    try {
        // Vi spør SerpApi direkte fra serveren
        const targetUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&gl=no&hl=no&api_key=${apiKey}`;

        const res = await fetch(targetUrl);
        const data = await res.json();

        // Send svaret tilbake til din React-app
        return response.status(200).json(data);

    } catch (error) {
        return response.status(500).json({ error: 'Noe gikk galt på serveren', details: error.message });
    }
}
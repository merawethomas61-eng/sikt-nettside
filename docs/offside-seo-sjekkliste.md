# Off-site SEO & GEO — manuell sjekkliste

On-site er på plass (sidene rangerer-klare og prerendret, JSON-LD, sitemap, llms.txt). Resten
under er **manuelt arbeid utenfor koden** — og det er her den faktiske rankingen og AI-siteringen
vinnes. AI-verktøy (ChatGPT/Perplexity/Gemini) vekter **uavhengig konsensus**: hva *andre* sier om
deg, ikke bare din egen side.

## 1. Meld inn i søkemotorene (gjør først — 20 min)

**Google Search Console** (https://search.google.com/search-console)
1. Eiendommen er allerede verifisert (meta-taggen `google-site-verification` ligger i `index.html`).
2. Gå til **Sitemaps** → send inn `https://siktseo.com/sitemap.xml`.
3. Gå til **URL-inspeksjon** → lim inn hver nye blogg-URL → **Be om indeksering**:
   - /blogg/hva-er-geo
   - /blogg/geo-vs-seo
   - /blogg/bli-nevnt-i-chatgpt
   - /blogg/lokal-seo-smabedrift
   - /blogg/5-seo-feil-smabedrifter
4. Gjør det samme for /, /funksjoner, /priser, /om-oss.

**Bing Webmaster Tools** (https://www.bing.com/webmasters) — viktig fordi **ChatGPT-søk bruker Bing**.
1. Legg til siten, verifiser (kan importeres direkte fra Google Search Console).
2. Send inn samme sitemap.
3. Bing støtter **IndexNow** for umiddelbar indeksering — kan settes opp senere hvis ønskelig.

## 2. Google-bedriftsprofil (størst effekt for lokal + AI)

1. Opprett/krev https://www.google.com/business/ for SIKT TECHNOLOGIES AS.
2. Fyll ut alt: kategori, beskrivelse, tjenester, område, åpningstider, nettsted, telefon.
3. Last opp ekte bilder.
4. Be de første kundene om en anmeldelse (send dem direktelenken). Svar på alle anmeldelser.

## 3. Konsistent bedriftsinfo (NAP) overalt

Navn, adresse, e-post (`siktseo@gmail.com`) og nettsted skal stå **identisk** på:
- Google-bedriftsprofil
- Bing Places
- Proff.no / Gulesider / 1881
- LinkedIn-bedriftsside, Facebook
- Eventuelle bransjekataloger

Sprikende info skaper tvil og svekker både Google- og AI-tillit.

## 4. Bli omtalt der AI «leser»

- **Lister/anmeldelser:** kom på lister som «beste SEO-hjelp i Norge», G2/Capterra-lignende, norske verktøy-oversikter.
- **Fora:** delta ekte (ikke spam) i r/norge, r/SEO, norske gründer-/småbedriftsgrupper på Facebook/LinkedIn der SEO/synlighet diskuteres.
- **Presse/gjesteinnlegg:** korte ekspertinnlegg eller intervjuer på relevante norske nettsteder gir både lenker og omtale.
- **Wikidata/Wikipedia:** en Wikidata-oppføring for selskapet hjelper kunnskapsgrafer og AI.
- **WordPress-plugin-katalogen:** «Sikt Connector»-pluginen bør ligge i den offisielle katalogen (lenke + omtale).

## 5. Sosiale profiler

Opprett og hold aktive: LinkedIn (viktigst for B2B), evt. Facebook/Instagram. Lenk til siktseo.com,
del blogginnleggene. Sosiale signaler + lenker styrker autoritet.

## 6. Innholdskadens (løpende)

5 innlegg er en start. Publiser jevnt (f.eks. 2/mnd) på søk folk faktisk gjør. Be Sikt skrive flere
— hvert nytt innlegg prerendres automatisk og legges i sitemap.

---

### Måling
Når du har satt `VITE_POSTHOG_KEY` i Vercel, måler du trafikk/konvertering (cookie-banner er allerede
bygget). I Google Search Console ser du visninger, klikk og posisjon per URL — sjekk månedlig.

### Realistisk tidslinje
Tekniske gevinster: uker. Lokal + autoritet: måneder. GEO-sitering bygger seg opp etter hvert som
uavhengige omtaler dukker opp. Dette er et løpende løp, ikke en engangsjobb.

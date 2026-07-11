// =====================================================================
// Vanskelighetsgrad + søkeintensjon — estimert fra SERP-signaler vi
// FAKTISK har (SerpAPI-svaret), ett kildested for portalen og onboarding.
// =====================================================================
// Historikk: den gamle formelen var `clamp(10–100, treff/100 000)`. Norske
// søkeord har nesten alltid godt under 1 M treff, så gulvet på 10 vant hver
// gang → «10 av 100» på alt (meningsløst tall). Denne versjonen kombinerer
// tre observerbare signaler i stedet:
//   1. Treffmengde på log-skala (1 k ≈ 15, 100 k ≈ 35, 1 M ≈ 45, 10 M ≈ 55)
//   2. Autoritets-domener i topp 10 — tunge sider å slå forbi
//   3. Annonser i SERP-en — kommersiell konkurranse om ordet
// Fortsatt et ESTIMAT (all «keyword difficulty» uten backlink-data er det) —
// UI-et skal merke tallet som estimat, ikke selge det som fasit.

/** Kjente autoritets-domener i norske SERP-er — vanskelige å forbigå. */
const AUTHORITY_RE = /(wikipedia\.org|snl\.no|finn\.no|gulesider\.no|1881\.no|proff\.no|nav\.no|regjeringen\.no|helsenorge\.no|lovdata\.no|nrk\.no|vg\.no|dinside\.no|dnb\.no|youtube\.com|facebook\.com|instagram\.com|linkedin\.com|tripadvisor\.|trustpilot\.|prisjakt\.no|komplett\.no|elkjop\.no|mittanbud\.no|byggstart\.no|legelisten\.no|advokatenhjelperdeg\.no)/i;

/** Vanskelighetsgrad 5–95 estimert fra SerpAPI-svaret for ett søkeord. */
export function estimateKeywordDifficulty(data: any): number {
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  const totalResults = Number(data?.search_information?.total_results) || 0;

  // 1) Basis: log-skala på treffmengde. Mangler tallet, start midt på treet.
  let kd = totalResults > 0
    ? Math.max(5, Math.min(55, 10 * Math.log10(totalResults) - 15))
    : 25;

  // 2) Autoritets-domener blant topp 10 organiske treff.
  const authorityHits = organic
    .slice(0, 10)
    .filter((r: any) => AUTHORITY_RE.test(String(r?.link || ''))).length;
  kd += Math.min(28, authorityHits * 4);

  // 3) Annonser på ordet = noen betaler for det = kommersiell konkurranse.
  const adCount = Array.isArray(data?.ads) ? data.ads.length : 0;
  kd += Math.min(12, adCount * 3);

  return Math.round(Math.max(5, Math.min(95, kd)));
}

/**
 * Søkeintensjon fra ekte signaler (aldri tilfeldig): kart-resultater i
 * SERP-en = lokalt søk, spørreord = info, kjøpsord = kjøp.
 */
export function deriveKeywordIntent(keyword: string, data: any): 'Kjøp' | 'Info' | 'Lokal' {
  if (data?.local_results) return 'Lokal';
  if (/^(hva|hvordan|hvorfor|når|hvem|hvor)\b/i.test(keyword)) return 'Info';
  if (/\b(pris|priser|billig|kjøp|kjøpe|tilbud|best)\b/i.test(keyword)) return 'Kjøp';
  return 'Info';
}

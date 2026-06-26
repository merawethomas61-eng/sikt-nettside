// =====================================================================
// Sentral firma- og kontaktinfo
// =====================================================================
// Ett sted for navn, org.nr, adresse og e-post som vises i footer,
// juridiske sider (personvern/vilkår) og på kontaktsiden.
//
// Felter som står tomme ('') vises IKKE i UI — slik lekker ingenting
// «halvferdig» (f.eks. «Org.nr: TODO») ut til kundene før det er klart.
//
// FYLL INN ETTER ENK-REGISTRERING (Enhetsregisteret / Brønnøysund):
//   - legalName : registrert foretaksnavn (ENK må inneholde innehavers etternavn)
//   - orgNr     : 9-sifret organisasjonsnummer
//   - address   : forretnings-/postadresse
//   - venue     : verneting (tingrett der foretaket hører hjemme)
//   - supportEmail: bytt til domene-e-post (post@siktseo.com) når den er satt opp
// =====================================================================

export const companyInfo = {
  brand: 'Sikt',

  // Juridisk enhet. ENK inntil en evt. omdanning til AS.
  // TODO: bytt til registrert foretaksnavn, f.eks. «Sikt SEO Etternavn».
  legalName: 'Sikt',
  entityType: 'ENK' as 'ENK' | 'AS',

  // TODO: fyll inn etter ENK-registrering. Tomt = skjules i UI.
  //   Eksempel på utfylt (bytt mot dine ekte verdier):
  //     legalName: 'Sikt SEO Etternavn',   // ENK MÅ inneholde innehavers etternavn
  //     orgNr:     '912 345 678',           // 9 sifre fra Enhetsregisteret
  //     address:   'Gateadresse 1, 0123 Oslo',
  //     venue:     'Oslo tingrett',         // tingretten der foretaket hører hjemme
  orgNr: '',
  address: '',

  // Verneting ved tvist (B2B kan avtale dette).
  // TODO: sett til tingretten der foretaket hører hjemme.
  venue: 'norske domstoler',

  // TODO: bytt til post@siktseo.com når domene-e-posten er satt opp og mottar e-post.
  supportEmail: 'siktseo@gmail.com',

  domain: 'siktseo.com',
};

/** Juridisk enhet med org.nr når det finnes, ellers bare navnet. Brukt i juridiske tekster. */
export const legalEntityLabel = companyInfo.orgNr
  ? `${companyInfo.legalName} (org.nr ${companyInfo.orgNr})`
  : companyInfo.legalName;

/** «© 2026 SIKT …»-linje til footer, med org.nr når satt. */
export const copyrightLine = (() => {
  const year = 2026;
  const base = `© ${year} ${companyInfo.legalName.toUpperCase()}`;
  return companyInfo.orgNr ? `${base} · ORG.NR ${companyInfo.orgNr}` : base;
})();

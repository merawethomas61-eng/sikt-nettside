# Google Business Profile API — slik låser du opp «svar på anmeldelser»

Koden for å svare på Google-anmeldelser **direkte fra portalen** er ferdig skrevet
(`supabase/functions/gbp-reviews/index.ts` — OAuth, tilkobling, listing og selve
svar-postingen). Den ligger «mørk» bak ett flagg: funksjonen våkner av seg selv
når tre secrets er satt. Det eneste som mangler er Googles godkjenning — som DU
må søke om. Regn 1–2 uker på Googles behandling.

## Steg 1 — Søk om API-tilgang hos Google (engangs)

1. Gå til <https://developers.google.com/my-business/content/prereqs> og følg
   lenken til **«Request access to the API»** (Google Business Profile APIs
   access request-skjemaet).
2. Bruk samme Google-konto/Cloud-prosjekt som GSC-integrasjonen allerede bruker
   (der `GOOGLE_CLIENT_ID` for scan-search-console bor).
3. I skjemaet: beskriv Sikt ærlig — norsk SEO-verktøy for småbedrifter; formålet
   er at bedriftseieren skal kunne lese og besvare SINE EGNE anmeldelser fra
   dashbordet. Ikke masseutsending, ikke tredjeparts-data.
4. Vent på godkjennings-e-posten. Kvoten er 0 til søknaden er godkjent — API-et
   svarer 403 selv med riktig oppsett fram til da.

## Steg 2 — Aktiver API-ene i Google Cloud Console

I prosjektet ditt (console.cloud.google.com → APIs & Services → Library),
aktiver:
- **My Business Account Management API**
- **My Business Business Information API**
- **Google My Business API** (v4 — svar-endepunktet `reviews/{id}/reply` bor her)

## Steg 3 — OAuth-client

Gjenbruk OAuth-clienten fra GSC-integrasjonen (eller lag en ny av type «Web
application») og legg til redirect-URI-en gbp-reviews bruker:

```
https://zsoqyerqdxhqnqjvzmsu.supabase.co/functions/v1/gbp-reviews
```

(Verifiser eksakt callback-sti mot `gbp-reviews/index.ts` — auth-callbacken
ligger i samme funksjon.) Scope-et funksjonen ber om er
`https://www.googleapis.com/auth/business.manage`.

## Steg 4 — Sett de tre secrets på Supabase

```bash
npx supabase secrets set GOOGLE_CLIENT_ID=<client-id> --project-ref zsoqyerqdxhqnqjvzmsu
npx supabase secrets set GOOGLE_CLIENT_SECRET=<client-secret> --project-ref zsoqyerqdxhqnqjvzmsu
npx supabase secrets set GBP_TOKEN_SECRET=<lang-tilfeldig-streng> --project-ref zsoqyerqdxhqnqjvzmsu
```

`GBP_TOKEN_SECRET` er Sikts egen krypteringsnøkkel for OAuth-tokens i
`gbp_connections` — generer en tilfeldig streng (32+ tegn) og ta vare på den.
NB: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` er trolig allerede satt for
scan-search-console — da er det kun `GBP_TOKEN_SECRET` som mangler.

## Steg 5 — Ingenting mer

Ingen redeploy nødvendig: `gbp-reviews` sjekker `CONFIGURED`-flagget ved hvert
kall. Når de tre secrets finnes:
- «kommer så snart Google godkjenner»-teksten i Anmeldelser-fanen byttes
  automatisk med en ekte «Koble til Google-bedriftsprofil»-knapp,
- kunden OAuth-er inn én gang,
- svar skrevet i portalen postes direkte til Google (`PUT …/reviews/{id}/reply`).

Test med din egen bedriftsprofil først: koble til, svar på en anmeldelse, og
sjekk at svaret dukker opp på Google Maps innen et par minutter.

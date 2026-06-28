# Første brukere — personlig outreach (pre-ENK)

Kortsiktig plan for å skaffe Sikts **første ekte brukere** mens ENK ordnes. Dette er **personlig 1:1**
fra din egen Gmail — IKKE den automatiske outreach-motoren (`scripts/outreach-send.mjs`), som bevisst er
sperret til org.nr er på plass. Personlige, individuelle e-poster der du tilbyr **gratis** hjelp til
bedrifter du faktisk har sett på, er greit før ENK. Hold det 1:1 (ikke masseutsending).

---

## 1) Plukk 10–20 mål

- Velg én bransje med **høyere kundeverdi** (matcher Premium-historien): tannlege, advokat, klinikk,
  håndverker, regnskap, B2B-tjenester — i ditt område.
- For hver: kjør nettsiden gjennom **gratis-analysen på siktseo.com**. Det gir deg ekte funn å vise til
  *og* fyller `audit_leads` (så de senere kan konverteres automatisk når ENK + outreach del 2 er live).
- Noter **1–2 konkrete funn** i plain norsk (f.eks. «laster tregt på mobil», «mangler tittel-tekst på
  forsiden», «ikke nevnt når jeg spør ChatGPT om {bransje} i {by}»).

**Ærlighets-regel:** nevn KUN funn du faktisk så. Ingen oppdiktede tall, garantier eller resultater.

## 2) Send denne (personlig mal)

> **Emne:** Så på {nettside} – et par raske ting
>
> Hei {fornavn},
>
> Jeg heter Thomas og driver Sikt, et lite norsk verktøy som hjelper bedrifter å bli mer synlige på
> Google og i AI-søk (ChatGPT, Gemini).
>
> Jeg kjørte en rask sjekk av {nettside} og la merke til **{funn 1}** – og **{funn 2}**. Begge er ganske
> enkle å gjøre noe med, og kan bety at flere kunder finner dere.
>
> Jeg henter inn de aller første brukerne nå, så jeg tilbyr **gratis oppsett + full gjennomgang** til noen
> få bedrifter – uten kostnad og uten binding. Vil du at jeg sender deg hele rapporten?
>
> Mvh
> Thomas · Sikt · siktseo.com

Tonen: en fagperson som faktisk har sett på siden — varm, konkret, null salgs-floskler. Maks ~120 ord.

## 3) Myk oppfølging (etter 3–4 dager, hvis ingen svar)

> Hei igjen {fornavn} — ville bare sjekke om dette var av interesse. Sender gjerne den korte rapporten
> uansett, så kan du se selv. Ha en fin uke! – Thomas

Maks én oppfølging. Får du «nei takk», la dem være.

## 4) Hold styr (enkelt)

| Bedrift | Nettside | E-post | Funn nevnt | Sendt | Svar | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

Et regneark holder. (Senere: når ENK + outreach del 2 er live, flyttes dette inn i `outreach_drafts`.)

## Når ENK er på plass

Bytt fra denne manuelle 1:1-flyten til den automatiske motoren: fyll `orgNr` i
`src/shared/companyInfo.ts`, godkjenn utkast (`status='approved'`) og kjør `node scripts/outreach-send.mjs`.
Da gjelder full avsender-identitet + ett-klikks avmelding automatisk.

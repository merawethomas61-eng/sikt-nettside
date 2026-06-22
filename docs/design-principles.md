# Sikt designprinsipper

Vårt visuelle regelsett, oversatt fra **The Interior Design Handbook** (Frida Ramstedt) til
skjerm/e-post. Et rom og en e-post løses med samme grammatikk: proporsjon, ett fokuspunkt,
lag som gir dybde, og luft som lar øyet puste. Dette dokumentet er fasiten for e-postmalen
(`supabase/functions/_shared/email.ts`) og kan gjenbrukes for forside/dashboard.

> Den røde tråden: **varm-nøytral ro + én rolig aksent**. Aldri kald grå, aldri to aksenter
> som slåss, aldri en flat flate uten lag.

---

## De 8 prinsippene (bok → skjerm)

1. **Gyllent snitt / proporsjon (1,618).** Mål er aldri tilfeldige. Spacing følger en
   Fibonacci-skala (≈ gyllent snitt) og typografien en ~1,5×-skala, så størrelsesforholdene
   alltid er i slekt. «Rommet» (innholdsbredden) er 600px.
2. **60 / 30 / 10 (+S) farge.** 60 % rolige flater, 30 % blekk/struktur, 10 % aksent — og
   **+S**: nøyaktig *én* «statement»-flate per e-post (det store fokus-tallet). Mer enn én
   statement = ingen statement.
3. **Fokuspunkt + siktlinje.** Hver e-post har én ting som er størst. Øyet skal lande i fast
   rekkefølge: avsender → overskrift → fokus-tall → handling (CTA). Ikke konkurrerende blikkfang.
4. **Optisk midtpunkt.** Det opplevde midtpunktet ligger litt over det geometriske. Overskrift
   høyt (øvre tredjedel), CTA i optisk tyngdepunkt — ikke alt sentrert i kjedelig symmetri.
5. **Lag-på-lag «lys» → dybde.** Som et rom aldri belyses av én takplafond: side (ambient) →
   kort (møbelet, hvitt + hårstrek) → tonet inset (aksent-lampen). Tre lag gir dybde uten skygge-støy.
6. **Negativt rom.** Luft er et virkemiddel, ikke tomhet. Sjenerøs padding og større mellomrom
   mellom hovedseksjoner enn det som føles «nok». Ikke fyll hvert hjørne.
7. **Repetisjon (den røde tråden).** Ett motiv gjentas overalt: wordmark-lockup, kort-radius,
   aksent-regelen, hårstrek-divideren, sign-off-stemmen. Gjenkjennelig på tvers av alle e-poster.
8. **Odde-tall-gruppering + kontrast.** Grupper i 3 (triangulering), ikke 4 like. Kontrast bærer
   hierarkiet: stor rolig overskrift mot liten caption; matt nøytral flate mot én mettet aksent;
   grønn «etter/seier» mot nøytral «før».

---

## Tokens

| Rolle | Token | Verdi |
|---|---|---|
| **Bredde** | `width` | 600 px (innhold), 32 px gutter |
| **Spacing** (Fibonacci ≈ φ) | `xs / sm / md / lg / xl` | 8 / 13 / 21 / 34 / 55 px |
| **Type** (~1,5×) | `caption / body / lead / subhead / h1` | 12 / 15 / 17 / 22 / 36 px · linjehøyde body 1,6 |
| **Radius** | `card / inset / pill` | 14 / 11 / 999 px |
| **60 % flater** | `pageBg` / `surface` | `#F6F5F1` / `#FFFFFF` |
| **30 % blekk** | `ink` / `muted` / `faint` / `hairline` | `#1A1A1A` / `#6B6B6B` / `#9A968C` / `#E9E4DA` |
| **10 % aksent** | `violet` (lenker) / `green` (seier) / `greenSoft` | `#7C3AED` / `#137A47` / `#52A447` |
| Tonet inset (lampen) | grønn / violett | `#F3FBF6` (kant `#D6EEDF`) / `#F4EFFC` (kant `#E7DBFB`) |
| Feil/forfall | `danger` / `dangerBg` | `#B42318` / `#FBEDEC` |
| Font | `font` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` |

**Aksent-disiplin:** primær handling = rolig **ink-pille** (`#1A1A1A`), ikke en farge som
roper. Violett er reservert for *lenker* og små aksentmerker; grønn kun for *positive* tall.
Det er hele 10 %-budsjettet — ikke bruk mer.

---

## E-post-spesifikke regler

- **To merkevare-moduser.** Sikts egne e-poster (ukesrapport, dunning) bærer **Sikt-wordmark**.
  Anmeldelses-e-postene er **white-label** — sendt på vegne av kundens bedrift til *deres*
  kunder: ingen Sikt-logo, kun en diskré «drevet av Sikt» i footeren.
- **Klient-trygg HTML.** `<table>`-layout + inline styles (ikke flexbox/grid), maks 600px,
  web-trygge fonter. Skjult preheader-tekst. `color-scheme: light` så dark mode ikke inverterer
  blekket til uleselig. Alt-tekst på evt. bilder. `escapeHtml` på alle dynamiske verdier.
- **Ett fokus-tall (+S).** ROI-verdi (kr/mnd) eller største seier rendres stort i grønt; resten
  er underordnet i størrelse og vekt.

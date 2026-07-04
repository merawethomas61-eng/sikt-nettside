# Sikt

Moderne norsk SEO-plattform med AI-drevet optimalisering og plain-norsk
rapportering. Frontend er en Vite + React-app, backend er en blanding
av Vercel Serverless-funksjoner (`/api/*`) og Supabase Edge Functions
(`supabase/functions/*`).

## Oversikt

| Lag | Plattform | Beskrivelse |
| --- | --- | --- |
| Frontend | Vite + React + Tailwind | `App.tsx`, `index.html`, `src/` |
| Database / Auth | Supabase (Postgres + Auth + RLS) | `supabase_schema.sql` |
| AI / søk / scan | Vercel Serverless | `api/openai-chat.js`, `api/pagespeed.js`, `api/search.js`, `api/scan-website.js`, `api/scan-competitor.js`, `api/solve-problem.js` |
| Stripe-webhook | Supabase Edge Function (kanonisk) | `supabase/functions/stripe-webhook/index.ts` |
| PageSpeed-scan | Supabase Edge Function | `supabase/functions/scan-pagespeed/index.ts` |

## Førstegangs-oppsett (ny utvikler)

1. Installer avhengigheter:
   ```bash
   npm install
   ```
2. Kopier `.env.example` til `.env.local` og fyll inn nøkler.
   `.env.local` er ignorert av git og skal ALDRI committes.
3. Kjør lokalt:
   ```bash
   npm run dev
   ```
4. Type-sjekk:
   ```bash
   npm run typecheck
   ```

## Database-oppsett (ny Supabase-instans)

Kjør hele `supabase_schema.sql` i Supabase Dashboard → SQL Editor.
Filen er idempotent og kan kjøres på nytt uten å miste data.

## Stripe-konfigurasjon

Stripe-webhooken er **én** kanonisk Edge Function:

```
https://<din-supabase-ref>.supabase.co/functions/v1/stripe-webhook
```

Sett denne URL-en i Stripe Dashboard → Developers → Webhooks med følgende
events:

- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated`
- `invoice.payment_failed` (dunning: past_due + gjenopprettings-e-post)
- `invoice.paid` (dunning løst: tilbake til active + bekreftelses-e-post)

Edge Function-secrets (Supabase Dashboard → Edge Functions → Secrets):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SIGNING_SECRET`
- `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_PREMIUM`
  (price-ID-er — påkrevd før MVA/prisendring, ellers gjetter webhooken på beløp)
- `FOUNDER_EMAIL` (mottaker for eiervarsler fra webhooken)
- `GOOGLE_PAGESPEED_API_KEY` (for `scan-pagespeed`)

`SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY` injiseres automatisk.

## Vercel-konfigurasjon

Sett disse i Vercel Project Settings → Environment Variables (Production):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `PAGESPEED_API_KEY`
- `SERP_API_KEY`

`VITE_*` lekkes til klienten — kun offentlige verdier her. Resten brukes
serverside av `/api/*`-endepunktene.

## Utviklings-bypass

`import.meta.env.DEV` aktiverer et "Dev Bypass"-panel som lar deg hoppe
inn i portalen uten å gå via Google OAuth. Dette panelet kan kun
aktiveres under `npm run dev` — Vite tree-shaker hele dev-grenen bort i
prod-bygget.

## Kjente begrensninger / TODO før lansering

Se `oppsummering` i prosjektets siste lansering-sjekk. Stikkord:

- Cookie-banner med samtykke før PostHog kan reaktiveres.
- Live Stripe payment-links (test-URL-er er fortsatt i koden).
- Norsk org.nr / MVA-info på fakturaer.

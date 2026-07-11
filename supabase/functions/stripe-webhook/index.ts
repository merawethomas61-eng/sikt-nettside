// =====================================================================
// Sikt — Stripe Webhook (kanonisk)
// =====================================================================
// Denne funksjonen er den ENESTE webhooken Stripe skal peke mot.
// URL i Stripe Dashboard:
//   https://<din-supabase-ref>.supabase.co/functions/v1/stripe-webhook
//
// Hendelser som må være krysset av i Stripe Dashboard:
//   - checkout.session.completed
//   - customer.subscription.deleted
//   - customer.subscription.updated   (valgfritt, gir status-oppdatering)
//   - invoice.payment_failed          (DUNNING: mislykket kort → past_due + e-post)
//   - invoice.paid                    (DUNNING: betaling reddet → tilbake til active)
//
// Env vars (sett i Supabase Dashboard → Project → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY                — sk_live_…
//   STRIPE_WEBHOOK_SIGNING_SECRET    — whsec_… fra webhook-konfigurasjonen
//   SUPABASE_URL                     — auto-injisert av Supabase
//   SUPABASE_SERVICE_ROLE_KEY        — auto-injisert av Supabase
//   RESEND_API_KEY                   — for dunning-e-post (samme som weekly-reports)
//   FROM_EMAIL                       — valgfri, default rapport@siktseo.com
//   FOUNDER_EMAIL                    — mottaker for eiervarsler (fallback SUPPORT_EMAIL)
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { renderEmail, railNote, defList, escapeHtml } from '../_shared/email.ts';
import { sendOwnerAlert } from '../_shared/owner-alert.ts';

// Support-adressen kunder kan svare til. Env-styrt så bytte til domene-e-post
// (support@siktseo.com) ikke krever redeploy — bare ny secret.
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'siktseo@gmail.com';
const PORTAL_URL = 'https://siktseo.com/portal';

console.log('Sikt Stripe Webhook v8 (canonical) lastet inn');

// ── Felles Resend-utsending for kunde-e-postene under ───────────────
// Samme mønster som sendWelcomeEmail/sendDunningEmail; logger og svelger
// feil slik at en e-postglipp aldri velter selve webhooken.
async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!apiKey || !to) {
    console.warn(`E-post «${subject}»: mangler RESEND_API_KEY eller mottaker — hopper over.`);
    return;
  }
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Sikt <${fromEmail}>`, to: [to], subject, html }),
    });
    if (!res.ok) console.error(`E-post «${subject}» feilet:`, res.status, await res.text());
  } catch (err) {
    console.error(`E-post «${subject}» kastet:`, (err as Error).message);
  }
}

// Pris-mapping. Vi prøver i denne rekkefølgen:
//   1) session.metadata.plan ("BASIC" / "STANDARD" / "PREMIUM")
//   2) line_items[0].price.id  (sett opp i PRICE_TO_PLAN under)
//   3) total amount  (fallback hvis ingen av delene over finnes)
//
// Når dere går live: sett LIVE price-IDene som secrets (Supabase → Edge Functions →
// Secrets), så slipper dere den skjøre amount-mappingen lenger ned:
//   STRIPE_PRICE_BASIC, STRIPE_PRICE_STANDARD, STRIPE_PRICE_PREMIUM
// Disse leses inn her — ingen kodeendring/redeploy trengs når dere får IDene.
const PRICE_TO_PLAN: Record<string, 'BASIC' | 'STANDARD' | 'PREMIUM'> = Object.fromEntries(
  (
    [
      [Deno.env.get('STRIPE_PRICE_BASIC'), 'BASIC'],
      [Deno.env.get('STRIPE_PRICE_STANDARD'), 'STANDARD'],
      [Deno.env.get('STRIPE_PRICE_PREMIUM'), 'PREMIUM'],
      // Årlig betaling (12 for 10) — samme plan/gating, bare annet intervall.
      [Deno.env.get('STRIPE_PRICE_BASIC_YEARLY'), 'BASIC'],
      [Deno.env.get('STRIPE_PRICE_STANDARD_YEARLY'), 'STANDARD'],
      [Deno.env.get('STRIPE_PRICE_PREMIUM_YEARLY'), 'PREMIUM'],
    ] as Array<[string | undefined, 'BASIC' | 'STANDARD' | 'PREMIUM']>
  ).filter(([id]) => !!id),
) as Record<string, 'BASIC' | 'STANDARD' | 'PREMIUM'>;

const AMOUNT_TO_PLAN: Record<number, 'BASIC' | 'STANDARD' | 'PREMIUM'> = {
  // Beløp i øre. Kun fallback på total-beløpet — foretrukket er metadata.plan
  // eller PRICE_TO_PLAN over. Juster hvis prisene endres.
  //
  // ⚠ MVA: beløpene under gjelder UTEN mva (ENK under 50 000 kr-terskelen). Når
  // foretaket blir mva-registrert og dere legger på 25 %, endres total-beløpet og
  // denne mappingen treffer ikke lenger. Da MÅ dere bruke PRICE_TO_PLAN (price-IDer)
  // — eller legge inn de mva-justerte beløpene her.
  //
  // Introrabatt de tre første månedene: kunden betaler 50 % / 70 % / 85 % av full pris.
  // — Basic (790 kr/mnd)
  39500: 'BASIC',     // mnd 1 (50 %)
  55300: 'BASIC',     // mnd 2 (70 %)
  67150: 'BASIC',     // mnd 3 (85 %)
  79000: 'BASIC',     // full pris
  // — Standard (1 690 kr/mnd)
  84500: 'STANDARD',  // mnd 1 (50 %)
  118300: 'STANDARD', // mnd 2 (70 %)
  143650: 'STANDARD', // mnd 3 (85 %)
  169000: 'STANDARD', // full pris
  // — Premium (4 990 kr/mnd)
  249500: 'PREMIUM',  // mnd 1 (50 %)
  349300: 'PREMIUM',  // mnd 2 (70 %)
  424150: 'PREMIUM',  // mnd 3 (85 %)
  499000: 'PREMIUM',  // full pris
  // — Årlig betaling (12 for 10, ingen introrabatt): 10 × månedspris.
  790000: 'BASIC',    // 7 900 kr/år
  1690000: 'STANDARD', // 16 900 kr/år
  4990000: 'PREMIUM', // 49 900 kr/år
};

const PLAN_TO_PACKAGE_NAME: Record<'BASIC' | 'STANDARD' | 'PREMIUM', string> = {
  BASIC: 'Basic Pakke',
  STANDARD: 'Standard Pakke',
  PREMIUM: 'Premium Pakke',
};

// ── Dunning-e-post (gjenoppretting av mislykket kort) ────────────────
// Gjenbruker samme Resend-oppsett som weekly-reports. hostedInvoiceUrl er
// Stripe sin egen «betal denne fakturaen»-lenke — tryggeste vei tilbake.
async function sendDunningEmail(
  to: string,
  contactName: string | null,
  hostedInvoiceUrl: string | null,
): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!apiKey || !to) {
    console.warn('Dunning: mangler RESEND_API_KEY eller mottaker — hopper over e-post.');
    return;
  }
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com';
  const html = renderEmail({
    preheader: 'Vi fikk ikke trukket den siste betalingen — som oftest et utløpt kort. Oppdater så unngår du avbrudd.',
    brand: 'sikt',
    kicker: 'Abonnement',
    heading: 'Betalingen din gikk ikke gjennom',
    intro: `${contactName ? `Hei ${escapeHtml(contactName)}, vi` : 'Vi'} fikk ikke trukket den siste betalingen for Sikt-abonnementet ditt — som oftest et utløpt eller sperret kort.`,
    blocks: [
      railNote({
        title: 'Sikt fortsetter å jobbe i mellomtiden',
        body: 'For å unngå avbrudd bør du oppdatere kortet snart. Det tar under ett minutt.',
        tone: 'accent',
      }),
    ],
    cta: hostedInvoiceUrl
      ? { label: 'Oppdater betaling', url: hostedInvoiceUrl }
      : { label: 'Åpne dashbordet', url: 'https://siktseo.com/portal' },
    signoff: 'Har du allerede ordnet det? Da kan du se bort fra denne e-posten.',
    footer: `Spørsmål? Svar på denne e-posten, eller kontakt ${escapeHtml(SUPPORT_EMAIL)}.`,
  });
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Sikt <${fromEmail}>`,
        to: [to],
        subject: 'Betalingen din gikk ikke gjennom — oppdater kortet',
        html,
      }),
    });
    if (!res.ok) console.error('Dunning-e-post feilet:', res.status, await res.text());
  } catch (err) {
    console.error('Dunning-e-post kastet:', (err as Error).message);
  }
}

// ── Velkomst-e-post (rett etter kjøp) ────────────────────────────────
// Før denne fantes var det TOTAL stillhet etter betaling — kunden betalte
// og hørte ingenting før første rapport. Velkomsten setter samme ærlige
// 4–12-ukers-forventning som JourneyTimeline i portalen, så «hvorfor har
// ingenting skjedd ennå?»-churnen dempes fra dag én.
async function sendWelcomeEmail(
  to: string,
  firstName: string | null,
  planLabel: string,
): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!apiKey || !to) {
    console.warn('Velkomst: mangler RESEND_API_KEY eller mottaker — hopper over e-post.');
    return;
  }
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com';
  const html = renderEmail({
    preheader: 'Betalingen er registrert. Her er hva som skjer nå — og hva du kan forvente når.',
    brand: 'sikt',
    kicker: escapeHtml(planLabel),
    heading: 'Velkommen til Sikt',
    intro: `${firstName ? `Hei ${escapeHtml(firstName)}. ` : ''}Betalingen er registrert, og vi er i gang. Her er hva som skjer nå — og like viktig: hva du realistisk kan forvente når.`,
    blocks: [
      defList([
        { title: '1. Fullfør oppstarten', body: 'Et kort skjema (2 minutter) forteller oss hvilken side vi skal jobbe med og hva som betyr mest for deg.' },
        { title: '2. Vi analyserer siden din automatisk', body: 'Første tekniske analyse kjører i bakgrunnen med én gang skjemaet er levert — du ser resultatet i dashbordet.' },
        { title: '3. Rapportene kommer av seg selv', body: 'Du får jevnlige rapporter på e-post med hva som er gjort, hva vi fant og hva det er verdt. Frekvensen styrer du selv i innstillingene.' },
      ]),
      railNote({
        title: 'Ærlig forventning: SEO er en klatring, ikke en bryter',
        body: 'Tekniske forbedringer skjer fra uke én, men Google belønner dem typisk etter 4–12 uker. Det er normalt — og det er derfor introrabatten din dekker nettopp de første månedene av klatringen.',
        tone: 'green',
      }),
    ],
    cta: { label: 'Kom i gang', url: PORTAL_URL },
    signoff: 'Vi holder vakt fra nå av — snakkes i første rapport.',
    footer: `Spørsmål? Svar på denne e-posten, eller kontakt ${escapeHtml(SUPPORT_EMAIL)}.`,
  });
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Sikt <${fromEmail}>`,
        to: [to],
        subject: 'Velkommen til Sikt — dette skjer nå',
        html,
      }),
    });
    if (!res.ok) console.error('Velkomst-e-post feilet:', res.status, await res.text());
  } catch (err) {
    console.error('Velkomst-e-post kastet:', (err as Error).message);
  }
}

// ── Planbytte-bekreftelse ────────────────────────────────────────────
// Sendes når en eksisterende kunde fullfører checkout for en ny plan.
// Viktigst: den forteller eksplisitt at det gamle abonnementet er stoppet,
// så kunden ikke frykter dobbel fakturering.
async function sendPlanChangeEmail(
  to: string,
  firstName: string | null,
  planLabel: string,
): Promise<void> {
  const html = renderEmail({
    preheader: 'Byttet er registrert. Det forrige abonnementet ditt er stoppet — du betaler kun for den nye planen.',
    brand: 'sikt',
    kicker: escapeHtml(planLabel),
    heading: 'Planen din er oppdatert',
    intro: `${firstName ? `Hei ${escapeHtml(firstName)}. ` : ''}Vi har registrert byttet til ${escapeHtml(planLabel)}. Det forrige abonnementet ditt er stoppet automatisk — du faktureres kun for den nye planen fremover.`,
    blocks: [
      railNote({
        title: 'Alt fortsetter som før',
        body: 'Data, rapporter og innstillinger er urørt. Endringen gjelder kun hvilke funksjoner du har tilgang til, og hva du betaler.',
        tone: 'green',
      }),
    ],
    cta: { label: 'Åpne dashbordet', url: PORTAL_URL },
    signoff: 'Ser du noe som ikke stemmer på neste faktura? Si fra, så ordner vi det.',
    footer: `Spørsmål? Svar på denne e-posten, eller kontakt ${escapeHtml(SUPPORT_EMAIL)}.`,
  });
  await sendViaResend(to, `Planen din er oppdatert til ${planLabel}`, html);
}

// ── Gjenopprettet betaling (dunning løst) ────────────────────────────
// Motstykket til sendDunningEmail: kunden fikset kortet og skal få
// bekreftet at alt er i orden igjen — ellers henger uroen igjen.
async function sendRecoveryEmail(to: string, firstName: string | null): Promise<void> {
  const html = renderEmail({
    preheader: 'Betalingen gikk gjennom, og abonnementet ditt fortsetter som normalt.',
    brand: 'sikt',
    kicker: 'Abonnement',
    heading: 'Betalingen er i orden igjen',
    intro: `${firstName ? `Hei ${escapeHtml(firstName)}. ` : ''}Den utestående betalingen har gått gjennom, og Sikt-abonnementet ditt fortsetter som normalt. Du trenger ikke gjøre noe mer.`,
    signoff: 'Takk for at du ordnet det så raskt.',
    footer: `Spørsmål? Svar på denne e-posten, eller kontakt ${escapeHtml(SUPPORT_EMAIL)}.`,
  });
  await sendViaResend(to, 'Betalingen er i orden igjen', html);
}

// ── Oppsigelses-bekreftelse ──────────────────────────────────────────
// Sendes når abonnementet faktisk avsluttes i Stripe. Uten denne vet ikke
// kunden om oppsigelsen «tok» — som skaper support-mail og disputter.
async function sendCancellationEmail(to: string, firstName: string | null): Promise<void> {
  const html = renderEmail({
    preheader: 'Oppsigelsen er bekreftet. Du beholder tilgang ut perioden du har betalt for.',
    brand: 'sikt',
    kicker: 'Abonnement',
    heading: 'Abonnementet ditt er avsluttet',
    intro: `${firstName ? `Hei ${escapeHtml(firstName)}. ` : ''}Oppsigelsen er bekreftet — du blir ikke belastet mer. Du beholder tilgang til dashbordet ut perioden du allerede har betalt for.`,
    blocks: [
      railNote({
        title: 'Dataene dine',
        body: 'Kontoen og dataene dine slettes innen 90 dager, med unntak av det vi må oppbevare etter regnskapsloven. Ombestemmer du deg før den tid, er alt som før når du kommer tilbake.',
        tone: 'neutral',
      }),
    ],
    signoff: 'Takk for tiden med oss — du er velkommen tilbake når som helst.',
    footer: `Spørsmål? Svar på denne e-posten, eller kontakt ${escapeHtml(SUPPORT_EMAIL)}.`,
  });
  await sendViaResend(to, 'Oppsigelsen er bekreftet', html);
}

async function resolvePlan(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<'BASIC' | 'STANDARD' | 'PREMIUM' | null> {
  const metaPlan = (session.metadata?.plan || '').toUpperCase();
  if (metaPlan === 'BASIC' || metaPlan === 'STANDARD' || metaPlan === 'PREMIUM') {
    return metaPlan;
  }

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
    for (const item of lineItems.data) {
      const priceId = item.price?.id;
      if (priceId && PRICE_TO_PLAN[priceId]) {
        return PRICE_TO_PLAN[priceId];
      }
    }
  } catch (err) {
    console.error('Kunne ikke hente line items:', (err as Error).message);
  }

  if (session.amount_total && AMOUNT_TO_PLAN[session.amount_total]) {
    return AMOUNT_TO_PLAN[session.amount_total];
  }

  return null;
}

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response('Mangler signatur', { status: 400 });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!stripeKey || !endpointSecret || !supabaseUrl || !supabaseKey) {
    console.error('Mangler env vars i Edge Function. Sjekk Supabase secrets.');
    return new Response('Server feilkonfigurert', { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err) {
    console.error(`Signatur feilet: ${(err as Error).message}`);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  console.log(`Mottatt event: ${event.type} (${event.id})`);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      let userId = session.client_reference_id;
      const email = session.customer_details?.email ?? null;
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null;

      // Fallback: en rå Payment Link (bokmerke, delt lenke, faktura-lenke) kan
      // fullføres utenfor innlogget flyt — da mangler client_reference_id.
      // Kunden ER belastet, så vi prøver å løse konto via e-post før vi gir opp.
      if (!userId && email) {
        const { data: matches } = await supabase
          .from('clients')
          .select('user_id')
          .eq('email', email)
          .limit(2);
        if (matches && matches.length === 1) {
          userId = matches[0].user_id;
          console.log(`client_reference_id manglet — løste bruker via e-post (session ${session.id}).`);
        }
      }

      if (!userId) {
        // Permanent feil: Stripe-retries kan ikke fremskaffe en konto som ikke
        // finnes. Vi svarer 200 og lar eiervarselet være gjenopprettingsveien —
        // ellers spammer retries i tre døgn uten å løse noe.
        console.error(`Betaling uten konto: session ${session.id} mangler client_reference_id og e-posten matchet ingen entydig konto.`);
        await sendOwnerAlert('Betaling uten konto', [
          { title: 'Hva skjedde', body: 'En checkout ble fullført uten client_reference_id, og e-posten matchet ingen (eller flere) kontoer. Kunden er belastet, men har ikke fått tilgang.' },
          { title: 'Stripe session', body: session.id },
          { title: 'E-post fra checkout', body: email ?? 'ukjent' },
          { title: 'Beløp', body: session.amount_total != null ? `${(session.amount_total / 100).toFixed(2)} kr` : 'ukjent' },
          { title: 'Neste steg', body: 'Finn betalingen i Stripe Dashboard, opprett/finn kontoen og koble den manuelt — eller refunder.' },
        ]);
        return new Response(JSON.stringify({ received: true, unresolved: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const plan = await resolvePlan(stripe, session);
      if (!plan) {
        // Retryable: mangler STRIPE_PRICE_*-secrets eller nytt beløp (f.eks. mva).
        // 400 → Stripe prøver igjen i ~3 døgn; settes secreten i mellomtiden,
        // heles dette uten manuell resend. Varselet kan komme flere ganger.
        console.error(`Ukjent plan for session ${session.id} (amount=${session.amount_total}).`);
        await sendOwnerAlert('Ukjent plan i checkout', [
          { title: 'Hva skjedde', body: 'En fullført checkout kunne ikke mappes til Basic/Standard/Premium. Kunden er belastet, men kontoen er ikke oppdatert ennå.' },
          { title: 'Stripe session', body: session.id },
          { title: 'Beløp', body: session.amount_total != null ? `${(session.amount_total / 100).toFixed(2)} kr` : 'ukjent' },
          { title: 'Neste steg', body: 'Sett STRIPE_PRICE_BASIC/STANDARD/PREMIUM som Supabase-secrets (eller oppdater beløps-mappingen). Stripe re-leverer eventen automatisk.' },
        ]);
        return new Response('Ukjent plan', { status: 400 });
      }

      const packageName = PLAN_TO_PACKAGE_NAME[plan];

      // Leses FØR upsert: var kunden allerede aktiv, er dette en Stripe-retry
      // eller et plan-bytte — da skal det ikke gå ut en ny velkomst-e-post.
      // stripe_subscription_id trengs for å kansellere gammelt abonnement ved bytte.
      const { data: existing } = await supabase
        .from('clients')
        .select('subscription_status, contact_person, stripe_subscription_id')
        .eq('user_id', userId)
        .maybeSingle();
      const isNewCustomer = existing?.subscription_status !== 'active';

      // VIKTIG: vi rører IKKE onboarding_completed her — det settes når kunden
      // fyller ut skjemaet. UPSERT slik at raden opprettes om den ikke finnes.
      const { error } = await supabase
        .from('clients')
        .upsert(
          {
            user_id: userId,
            package_name: packageName,
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
          },
          { onConflict: 'user_id' },
        );

      if (error) {
        console.error('Database-feil (upsert clients):', error);
        return new Response('Database error', { status: 500 });
      }

      console.log(`Lagret ${packageName} på bruker ${userId}.`);

      const firstName =
        existing?.contact_person?.split(' ')[0] ||
        session.customer_details?.name?.split(' ')[0] ||
        null;

      // ── Planbytte: kanseller det gamle abonnementet ─────────────────
      // Payment Links oppretter et NYTT abonnement ved bytte — uten dette
      // faktureres kunden dobbelt. Idempotent mot Stripe-retries: etter første
      // vellykkede kjøring holder DB-raden den nye id-en, så `existing` (lest
      // over) har samme id og branchen re-fyrer ikke. Rekkefølgen upsert-først/
      // kanseller-etterpå gjør at et krasj imellom heles av Stripes retry.
      const oldSubId = existing?.stripe_subscription_id;
      const isPlanChange = !!(oldSubId && subscriptionId && oldSubId !== subscriptionId);
      if (isPlanChange) {
        try {
          const oldSub = await stripe.subscriptions.retrieve(oldSubId);
          if (['active', 'trialing', 'past_due', 'unpaid'].includes(oldSub.status)) {
            await stripe.subscriptions.cancel(oldSubId);
            console.log(`Planbytte: kansellerte gammelt abonnement ${oldSubId} (nytt: ${subscriptionId}).`);
          } else {
            console.log(`Planbytte: gammelt abonnement ${oldSubId} var allerede ${oldSub.status} — ingen handling.`);
          }
        } catch (err) {
          if ((err as { code?: string }).code === 'resource_missing') {
            console.log(`Planbytte: gammelt abonnement ${oldSubId} finnes ikke lenger — ingen handling.`);
          } else {
            // Ikke feile webhooken: kundens konto er allerede riktig. Varselet
            // gjør dobbel fakturering til en manuell samme-dags-fiks i stedet
            // for en stille lekkasje.
            console.error(`Planbytte: klarte ikke kansellere ${oldSubId}:`, (err as Error).message);
            await sendOwnerAlert('Planbytte: gammelt abonnement ble IKKE kansellert', [
              { title: 'Kunde (user_id)', body: userId },
              { title: 'Gammelt abonnement', body: oldSubId },
              { title: 'Nytt abonnement', body: subscriptionId ?? 'ukjent' },
              { title: 'Neste steg', body: 'Kanseller det gamle abonnementet manuelt i Stripe Dashboard — ellers faktureres kunden dobbelt.' },
            ]);
          }
        }
        if (email) {
          await sendPlanChangeEmail(email, firstName, packageName);
          console.log(`Planbytte-bekreftelse sendt til ${userId}.`);
        }
      }

      if (isNewCustomer && email) {
        await sendWelcomeEmail(email, firstName, packageName);
        console.log(`Velkomst-e-post sendt til ny kunde ${userId}.`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

      if (!customerId) {
        console.error('Mangler customer-id på subscription.deleted.');
        return new Response('Mangler customer', { status: 400 });
      }

      // Guard mot planbytte: når vi selv kansellerer det GAMLE abonnementet
      // (se checkout.session.completed), fyrer Stripe denne eventen for det.
      // Da holder clients-raden allerede den NYE abonnements-id-en — og kunden
      // skal selvsagt ikke markeres som kansellert eller få oppsigelses-e-post.
      const { data: client } = await supabase
        .from('clients')
        .select('email, contact_person, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (client?.stripe_subscription_id && client.stripe_subscription_id !== subscription.id) {
        console.log(`subscription.deleted for ${subscription.id} ignorert — kunden har nyere abonnement ${client.stripe_subscription_id} (planbytte).`);
      } else {
        const { error } = await supabase
          .from('clients')
          .update({ subscription_status: 'canceled' })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Database-feil (cancel):', error);
          return new Response('Database error', { status: 500 });
        }

        console.log(`Markerte abonnement som kansellert for customer ${customerId}.`);

        if (client?.email) {
          const firstName = client.contact_person ? client.contact_person.split(' ')[0] : null;
          await sendCancellationEmail(client.email, firstName);
          console.log(`Oppsigelses-bekreftelse sendt for customer ${customerId}.`);
        }
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;
      if (!customerId) {
        return new Response(JSON.stringify({ received: true, ignored: 'missing customer' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Samme planbytte-guard som over: status-endringer på et UTGÅTT abonnement
      // (det gamle etter et bytte) skal ikke overskrive status fra det nye.
      const { data: client } = await supabase
        .from('clients')
        .select('stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (client?.stripe_subscription_id && client.stripe_subscription_id !== subscription.id) {
        console.log(`subscription.updated for ${subscription.id} ignorert — kunden følger abonnement ${client.stripe_subscription_id}.`);
      } else {
        await supabase
          .from('clients')
          .update({ subscription_status: subscription.status })
          .eq('stripe_customer_id', customerId);
      }
    }

    // ── DUNNING: kortet ble avvist ──────────────────────────────────
    // Marker past_due og send gjenopprettings-e-post med Stripe sin egen
    // «betal denne fakturaen»-lenke. Fanger ufrivillig churn (utløpte kort).
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) {
        return new Response(JSON.stringify({ received: true, ignored: 'missing customer' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('clients')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId);

      // Hent kontaktinfo for e-posten (fall tilbake til Stripe sin invoice-e-post).
      const { data: client } = await supabase
        .from('clients')
        .select('email, contact_person')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      const to = client?.email || invoice.customer_email || '';
      const firstName = client?.contact_person ? client.contact_person.split(' ')[0] : null;
      await sendDunningEmail(to, firstName, invoice.hosted_invoice_url ?? null);
      console.log(`Dunning: past_due + e-post for customer ${customerId}.`);
    }

    // ── DUNNING: betalingen ble reddet ──────────────────────────────
    // Sett tilbake til active hvis kunden var past_due. `.select()` gjør at
    // e-posten kun sendes når en rad faktisk flippet (vanlige månedstrekk
    // treffer ikke past_due-filteret og skal ikke gi e-post).
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const { data: recovered } = await supabase
          .from('clients')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', customerId)
          .eq('subscription_status', 'past_due')
          .select('email, contact_person');

        if (recovered && recovered.length > 0) {
          const client = recovered[0];
          const to = client.email || invoice.customer_email || '';
          const firstName = client.contact_person ? client.contact_person.split(' ')[0] : null;
          await sendRecoveryEmail(to, firstName);
          console.log(`Dunning løst: active + bekreftelse for customer ${customerId}.`);
        }
      }
    }
  } catch (err) {
    console.error('Uventet feil i webhook:', err);
    // Pengeveien er det siste stedet feil skal dø stille: eieren varsles så
    // en død webhook oppdages samme dag, ikke ved neste manuelle logg-sjekk.
    await sendOwnerAlert('Stripe-webhook krasjet', [
      { title: 'Event', body: `${event.type} (${event.id})` },
      { title: 'Feil', body: (err as Error).message ?? String(err) },
      { title: 'Neste steg', body: 'Sjekk loggene til stripe-webhook i Supabase Dashboard. Stripe re-leverer eventen automatisk ved 500-svar.' },
    ]);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

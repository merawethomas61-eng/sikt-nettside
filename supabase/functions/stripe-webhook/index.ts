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
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { renderEmail, railNote, escapeHtml } from '../_shared/email.ts';

console.log('Sikt Stripe Webhook v7 (canonical) lastet inn');

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
    footer: 'Spørsmål? Svar på denne e-posten, eller kontakt support@siktseo.com.',
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
      const userId = session.client_reference_id;
      const email = session.customer_details?.email ?? null;
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null;

      if (!userId) {
        console.error('Mangler client_reference_id i checkout-session — kan ikke koble til bruker.');
        return new Response('Mangler client_reference_id', { status: 400 });
      }

      const plan = await resolvePlan(stripe, session);
      if (!plan) {
        console.error(`Ukjent plan for session ${session.id} (amount=${session.amount_total}).`);
        return new Response('Ukjent plan', { status: 400 });
      }

      const packageName = PLAN_TO_PACKAGE_NAME[plan];

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

      const { error } = await supabase
        .from('clients')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_customer_id', customerId);

      if (error) {
        console.error('Database-feil (cancel):', error);
        return new Response('Database error', { status: 500 });
      }

      console.log(`Markerte abonnement som kansellert for customer ${customerId}.`);
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

      await supabase
        .from('clients')
        .update({ subscription_status: subscription.status })
        .eq('stripe_customer_id', customerId);
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
    // Sett tilbake til active hvis kunden var past_due.
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await supabase
          .from('clients')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', customerId)
          .eq('subscription_status', 'past_due');
      }
    }
  } catch (err) {
    console.error('Uventet feil i webhook:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

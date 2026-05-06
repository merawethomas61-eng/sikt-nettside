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
//
// Env vars (sett i Supabase Dashboard → Project → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY                — sk_live_…
//   STRIPE_WEBHOOK_SIGNING_SECRET    — whsec_… fra webhook-konfigurasjonen
//   SUPABASE_URL                     — auto-injisert av Supabase
//   SUPABASE_SERVICE_ROLE_KEY        — auto-injisert av Supabase
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

console.log('Sikt Stripe Webhook v7 (canonical) lastet inn');

// Pris-mapping. Vi prøver i denne rekkefølgen:
//   1) session.metadata.plan ("BASIC" / "STANDARD" / "PREMIUM")
//   2) line_items[0].price.id  (sett opp i PRICE_TO_PLAN under)
//   3) total amount  (fallback hvis ingen av delene over finnes)
//
// Når dere går live: fyll inn LIVE price-IDene under, så slipper dere amount-mapping.
const PRICE_TO_PLAN: Record<string, 'BASIC' | 'STANDARD' | 'PREMIUM'> = {
  // 'price_LIVE_basic': 'BASIC',
  // 'price_LIVE_standard': 'STANDARD',
  // 'price_LIVE_premium': 'PREMIUM',
};

const AMOUNT_TO_PLAN: Record<number, 'BASIC' | 'STANDARD' | 'PREMIUM'> = {
  // Førstegangs (introduksjons-rabatt) i øre — juster om dere endrer prisen
  17970: 'BASIC',     // 599 × 0.30 ≈ 179,70
  44970: 'STANDARD',  // 1499 × 0.30 ≈ 449,70
  149970: 'PREMIUM',  // 4999 × 0.30 ≈ 1499,70
  // Vanlige måneder
  59900: 'BASIC',
  149900: 'STANDARD',
  499900: 'PREMIUM',
};

const PLAN_TO_PACKAGE_NAME: Record<'BASIC' | 'STANDARD' | 'PREMIUM', string> = {
  BASIC: 'Basic Pakke',
  STANDARD: 'Standard Pakke',
  PREMIUM: 'Premium Pakke',
};

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
  } catch (err) {
    console.error('Uventet feil i webhook:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

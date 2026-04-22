import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// VIKTIG: Hindrer Vercel i å formatere dataene, slik at Stripe kan sjekke den rå, krypterte signaturen
export const config = {
    api: { bodyParser: false },
};

async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

// Map fra Stripe til vårt interne system
// Sett enten metadata.plan på Payment Link-et ("BASIC"/"STANDARD"/"PREMIUM"),
// eller map Stripe Price-ID-er direkte under.
const PRICE_TO_PLAN = {
    // Fyll inn med dine LIVE price-IDer fra Stripe Dashboard:
    // 'price_XXX_basic':    { name: 'BASIC',    level: 1 },
    // 'price_XXX_standard': { name: 'STANDARD', level: 2 },
    // 'price_XXX_premium':  { name: 'PREMIUM',  level: 3 },
};

const PLAN_LEVELS = {
    BASIC: 1,
    STANDARD: 2,
    PREMIUM: 3,
};

async function resolvePlan(stripe, session) {
    // 1. Foretrekk metadata.plan satt på Payment Link-et
    const metaPlan = (session.metadata?.plan || '').toUpperCase();
    if (PLAN_LEVELS[metaPlan]) {
        return { name: metaPlan, level: PLAN_LEVELS[metaPlan] };
    }

    // 2. Fallback: slå opp line_items og sjekk mot PRICE_TO_PLAN
    try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
        for (const item of lineItems.data) {
            const priceId = item.price?.id;
            if (priceId && PRICE_TO_PLAN[priceId]) {
                return PRICE_TO_PLAN[priceId];
            }
        }
    } catch (err) {
        console.error('Kunne ikke hente line items:', err.message);
    }

    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Only POST allowed');
    }

    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
        console.error('Sikkerhetsfeil Webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        const userId = session.client_reference_id;
        if (!userId) {
            console.error('Kritisk: Mangler userId på kjøpet.');
            return res.status(400).send('Mangler userId');
        }

        const plan = await resolvePlan(stripe, session);
        if (!plan) {
            console.error('Fant ikke plan for session', session.id);
            return res.status(400).send('Ukjent plan');
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

        const { error } = await supabase
            .from('profiles')
            .update({
                current_level: plan.level,
                package_name: plan.name,
                has_active_sub: true
            })
            .eq('id', userId);

        if (error) {
            console.error('Klarte ikke oppdatere databasen:', error);
            return res.status(500).send('Database Error');
        }

        console.log(`Suksess! Bruker ${userId} fikk ${plan.name} (nivå ${plan.level}).`);
    }

    // Håndter abonnement-kansellering også
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id || subscription.client_reference_id;
        if (userId) {
            const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
            await supabase
                .from('profiles')
                .update({ has_active_sub: false })
                .eq('id', userId);
        }
    }

    res.status(200).json({ received: true });
}

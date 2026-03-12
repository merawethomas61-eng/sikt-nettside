import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// VIKTIG: Hindrer Vercel i å formatere dataene, slik at Stripe kan sjekke den rå, krypterte signaturen
export const config = {
    api: { bodyParser: false },
};

// Hjelpefunksjon for å oversette datastrømmen fra Stripe
async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Only POST allowed');
    }

    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    // Henter de hemmelige nøklene dine fra Vercel
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // Sjekker at signalet faktisk kommer fra Stripe og ikke en hacker
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
        console.error('Sikkerhetsfeil Webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // HVIS KUNDEN AKKURAT HAR BETALT:
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // 1. Hent ID-en til kunden som betalte
        const userId = session.client_reference_id;

        if (!userId) {
            console.error('Kritisk: Mangler userId på kjøpet. Kan ikke oppgradere kunden!');
            return res.status(400).send('Mangler userId');
        }

        // 2. Logg inn i databasen som "Super-Admin" for å overstyre sikkerhetsreglene (RLS)
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL; // Sørg for at Vercel har denne
        const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // 3. Oppdater kundens abonnement i databasen!
        // NB: Hvis tabellen din for bruker-data heter noe annet enn 'profiles', bytt det her.
        // Bytt også ut 'current_level' med det faktiske navnet på kolonnen din i databasen.
        const { error } = await supabase
            .from('profiles')
            .update({
                current_level: 3, // 3 = Premium (Tilpass etter ditt system)
                has_active_sub: true
            })
            .eq('id', userId);

        if (error) {
            console.error('Klarte ikke oppdatere databasen:', error);
            return res.status(500).send('Database Error');
        }

        console.log(`Suksess! Bruker ${userId} har fått Premium.`);
    }

    // Gi Stripe beskjed om at alt gikk bra
    res.status(200).json({ received: true });
}
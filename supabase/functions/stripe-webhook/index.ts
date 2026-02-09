// Vi bruker nå npm: imports via deno.json for stabilitet
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

console.log("Stripe Webhook v6 (Async Fix) LASTET INN")

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')

  if (!signature) {
    return new Response("Mangler signatur", { status: 400 })
  }

  // Hent hemmeligheter
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // Initialiser klienter
  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const supabase = createClient(supabaseUrl, supabaseKey)

  let event
  const body = await req.text()

  // 1. Verifiser signatur (HER ER ENDRINGEN)
  try {
    // Feilmeldingen din ba oss bruke 'constructEventAsync' med 'await'. Her er den:
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
  } catch (err) {
    console.error(`❌ Signatur feilet: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // 2. Håndter hendelsen
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.client_reference_id
    const amount = session.amount_total
    const email = session.customer_details?.email

    console.log(`✅ Betaling mottatt: ${amount} øre fra bruker ${userId}`)

    // Pris-logikk
    let planName = "Ukjent Pakke"
    if (amount === 59900) planName = "Basic Pakke"
    if (amount === 149900) planName = "Standard Pakke"
    if (amount === 499900) planName = "Premium Pakke"

    if (userId) {
      // Lagre til database
      const { error } = await supabase
        .from('clients')
        .upsert({
          user_id: userId,
          package_name: planName,
          email: email,
          // Vi rører IKKE onboarding_completed her, så vi ikke ødelegger for skjemaet
        }, { onConflict: 'user_id' })

      if (error) {
        console.error("❌ Database-feil:", error)
        return new Response("Database error", { status: 500 })
      } else {
        console.log(`🎉 Suksess! Lagret ${planName} på bruker.`)
      }
    } else {
      console.log("⚠️ Ingen bruker-ID funnet i sesjonen.")
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
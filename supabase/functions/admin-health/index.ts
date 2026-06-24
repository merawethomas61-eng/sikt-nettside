// =====================================================================
// admin-health — eier-only lesing av client_health-viewet (punkt 3B).
//
// client_health er REVOKET for anon/authenticated, så portalen (som kjører
// med innlogget brukers JWT) kan ikke lese viewet direkte. Denne funksjonen
// verifiserer at kalleren er eier (FOUNDER_EMAIL-allowlist) og leser så
// viewet med service-role.
//
// verify_jwt = false BEVISST: funksjonen kalles fra nettleseren (siktseo.com
// → annet origin), og med plattform-JWT-verifisering ville CORS-preflighten
// (OPTIONS, uten Authorization) blitt avvist før den nådde koden. Vi gjør i
// stedet streng JWT-verifisering + eier-sjekk inne i funksjonen.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const FOUNDER_EMAILS = (Deno.env.get('FOUNDER_EMAIL') ?? 'siktseo@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ ok: false, error: 'no_token' }, 401)

    // 1) Hvem kaller? Verifiser JWT mot Supabase Auth.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ ok: false, error: 'invalid_token' }, 401)

    // 2) Er kalleren eier?
    const email = (user.email ?? '').toLowerCase()
    if (!FOUNDER_EMAILS.includes(email)) return json({ ok: false, error: 'forbidden' }, 403)

    // 3) Eier bekreftet → les helse-viewet med service-role.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data, error } = await admin
      .from('client_health')
      .select('user_id, email, package_name, subscription_status, health, last_seen_at, last_active_at, last_login_at, created_at')
    if (error) return json({ ok: false, error: error.message }, 500)

    // Sorter: røde først, så gule, så grønne.
    const rank: Record<string, number> = { red: 0, yellow: 1, green: 2 }
    const rows = (data ?? []).slice().sort(
      (a: { health: string }, b: { health: string }) => (rank[a.health] ?? 9) - (rank[b.health] ?? 9),
    )
    const summary = rows.reduce((acc: Record<string, number>, r: { health: string }) => {
      acc[r.health] = (acc[r.health] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    return json({ ok: true, rows, summary }, 200)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

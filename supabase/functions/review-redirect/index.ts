// review-redirect — sporings-redirect for anmeldelses-lenken.
//
// Kunden klikker lenken i e-posten (?t=<token>). Vi registrerer at lenken ble
// åpnet (status 'sent' → 'opened', setter opened_at) og sender dem videre til
// den ekte Google «skriv anmeldelse»-lenken. Offentlig — ingen JWT.
// MÅ deployes med verify_jwt = false (se supabase/config.toml).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const FALLBACK = 'https://www.google.com';

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t');
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return redirect(FALLBACK);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: reqRow } = await admin
    .from('review_requests')
    .select('id, user_id, status')
    .eq('token', token)
    .maybeSingle();

  if (!reqRow) return redirect(FALLBACK);

  // Marker åpnet (kun fram til 'opened' — ikke overstyr 'responded').
  if (reqRow.status === 'sent') {
    await admin.from('review_requests')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', reqRow.id);
  } else if (reqRow.status === 'ready') {
    // Sjelden (lenke åpnet før status oppdatert) — sett bare tidspunkt.
    await admin.from('review_requests')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', reqRow.id);
  }

  const { data: settings } = await admin
    .from('review_settings')
    .select('write_review_url')
    .eq('user_id', reqRow.user_id)
    .maybeSingle();

  return redirect(settings?.write_review_url || FALLBACK);
});

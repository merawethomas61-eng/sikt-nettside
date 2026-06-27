// outreach-unsubscribe — offentlig ett-klikks avmelding for outreach-e-post.
//
// Lenken ligger i footeren + List-Unsubscribe-headeren på hver outreach-e-post
// (?t=<unsub_token>). Vi slår opp e-posten via token og legger den i
// outreach_optouts — send-scriptet hopper deretter over den for alltid.
// Offentlig — ingen JWT. MÅ deployes med verify_jwt = false (se config.toml).
//
//   GET   → registrer avmelding + vis en rolig «Du er meldt av»-side.
//   POST  → RFC 8058 ett-klikk (e-postklientens knapp): registrer, svar 200.
//
// Ukjent token lekker ingenting: vi viser samme «meldt av»-side uansett.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function page(message: string): Response {
  const html = `<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Avmeldt — Sikt</title>
<style>
  body { margin:0; background:#F4F1EA; color:#1A1A1A;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .card { max-width:440px; padding:40px 32px; text-align:center; }
  h1 { font-family:Georgia,"Times New Roman",serif; font-weight:600; font-size:24px; margin:0 0 12px; }
  p { font-size:15px; line-height:1.6; color:#44423D; margin:0; }
  .brand { margin-top:28px; font-size:13px; color:#8A877F; }
</style>
</head>
<body>
  <div class="card">
    <h1>Du er meldt av</h1>
    <p>${message}</p>
    <div class="brand">Sikt</div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function optOutByToken(token: string): Promise<void> {
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: row } = await admin
    .from('outreach_drafts')
    .select('lead_email')
    .eq('unsub_token', token)
    .maybeSingle();

  const email = row?.lead_email;
  if (!email) return; // ukjent token → ikke lekk, men ikke skriv noe heller

  // Idempotent: én rad per e-post.
  await admin
    .from('outreach_optouts')
    .upsert({ email, source: 'link' }, { onConflict: 'email', ignoreDuplicates: true });
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t') ?? '';

  // RFC 8058 ett-klikk: e-postklienten POST-er uten videre interaksjon.
  if (req.method === 'POST') {
    await optOutByToken(token);
    return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }

  // Nettleser-klikk: registrer og vis bekreftelse (samme side også ved ukjent token).
  await optOutByToken(token);
  return page('Du vil ikke motta flere e-poster fra Sikt. Takk — vi lar deg være i fred. '
    + 'Var dette en feil, kan du bare svare på en av e-postene våre.');
});

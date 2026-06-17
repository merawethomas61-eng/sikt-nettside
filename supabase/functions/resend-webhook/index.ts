// =====================================================================
// Sikt — Resend Webhook (e-post-engasjement)
// =====================================================================
// Tar imot Resend-hendelser (sent/delivered/opened/clicked/…) og skriver
// dem til public.email_events. Forteller oss om ukesrapporten — det
// viktigste retention-verktøyet — faktisk blir åpnet og klikket på.
//
// URL i Resend Dashboard → Webhooks:
//   https://<din-supabase-ref>.supabase.co/functions/v1/resend-webhook
//
// Dependency-fri med vilje (kun Deno.serve + fetch + Web Crypto), så den
// trenger ingen import_map / deno.json.
//
// Env vars (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL               — auto-injisert
//   SUPABASE_SERVICE_ROLE_KEY  — auto-injisert (skriver forbi RLS)
//   RESEND_WEBHOOK_SECRET      — whsec_… fra Resend (Svix-signering).
//                                Hvis tom: signatur verifiseres IKKE (kun for
//                                første test — sett den før prod).
// =====================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

// Resend «email.opened» → vår enum «opened».
const ALLOWED = new Set([
  'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'delivery_delayed',
]);

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Svix/Resend-signaturskjema: HMAC-SHA256 over «{id}.{timestamp}.{body}»,
// nøkkel = base64-delen etter «whsec_». Header «svix-signature» = «v1,<sig> …».
async function verifySignature(
  id: string | null,
  timestamp: string | null,
  body: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // ikke konfigurert ennå → slipp gjennom (warn under)
  if (!id || !timestamp || !signatureHeader) return false;
  try {
    const secretBytes = base64ToBytes(WEBHOOK_SECRET.replace(/^whsec_/, ''));
    const key = await crypto.subtle.importKey(
      'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const signed = `${id}.${timestamp}.${body}`;
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
    const expected = bytesToBase64(new Uint8Array(sigBuf));
    return signatureHeader.split(' ').some((part) => {
      const idx = part.indexOf(',');
      const value = idx >= 0 ? part.slice(idx + 1) : part;
      return value === expected;
    });
  } catch (err) {
    console.error('Signatur-verifisering kastet:', (err as Error).message);
    return false;
  }
}

async function resolveUserId(email: string | null): Promise<string | null> {
  if (!email) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?email=eq.${encodeURIComponent(email)}&select=user_id&limit=1`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0]?.user_id ? rows[0].user_id : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Mangler SUPABASE_URL / SERVICE_ROLE_KEY.');
    return new Response('Server feilkonfigurert', { status: 500 });
  }

  const body = await req.text();
  const ok = await verifySignature(
    req.headers.get('svix-id'),
    req.headers.get('svix-timestamp'),
    body,
    req.headers.get('svix-signature'),
  );
  if (!ok) {
    return new Response('Ugyldig signatur', { status: 401 });
  }
  if (!WEBHOOK_SECRET) {
    console.warn('RESEND_WEBHOOK_SECRET ikke satt — signatur ble IKKE verifisert.');
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Ugyldig JSON', { status: 400 });
  }

  // type: «email.opened» → «opened».
  const rawType: string = payload?.type ?? '';
  const event = rawType.startsWith('email.') ? rawType.slice('email.'.length) : rawType;
  if (!ALLOWED.has(event)) {
    // Ukjent/uinteressant hendelse — kvitter ut uten å feile.
    return new Response(JSON.stringify({ received: true, ignored: rawType }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = payload?.data ?? {};
  const to: string | null = Array.isArray(data.to) ? (data.to[0] ?? null) : (data.to ?? null);
  const messageId: string | null = data.email_id ?? data.id ?? null;
  const subject: string | null = data.subject ?? null;
  const userId = await resolveUserId(to);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/email_events`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        email: to,
        email_type: subject ? subject.slice(0, 120) : null,
        event,
        message_id: messageId,
      }),
    });
    if (!res.ok) {
      console.error('Kunne ikke skrive email_events:', res.status, await res.text());
      return new Response('Database error', { status: 500 });
    }
  } catch (err) {
    console.error('email_events-insert kastet:', (err as Error).message);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

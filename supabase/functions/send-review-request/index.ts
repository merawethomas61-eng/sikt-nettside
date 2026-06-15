// send-review-request — sender én vennlig anmeldelses-forespørsel på e-post.
//
// Kalles fra dashbordet (ReviewsPage) med brukerens JWT + { requestId }.
// Verifiserer at forespørselen tilhører innlogget bruker, henter Google-
// lenken fra review_settings, sender via Resend og setter status → 'sent'.
//
// Deeplink-modus: vi leser/skriver IKKE Google-anmeldelser her (krever API).
// Vi gjør det bare lett å be ekte kunder om en ekte anmeldelse.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmail(opts: {
  customerName: string;
  businessName: string;
  buttonUrl: string;
  privateFeedback: boolean;
}): { subject: string; html: string } {
  const { customerName, businessName, buttonUrl, privateFeedback } = opts;
  const first = (customerName || '').trim().split(/\s+/)[0] || 'hei';
  const biz = businessName || 'oss';

  const privateBlock = privateFeedback
    ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#5C574C">
         Var det noe som ikke var helt bra? Du kan bare svare på denne e-posten,
         så hører vi fra deg direkte.
       </p>`
    : '';

  const html = `<!doctype html><html lang="no"><body style="margin:0;padding:0;background:#F6F5F1">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E9E4DA;border-radius:16px;padding:32px 32px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <tr><td>
          <p style="margin:0 0 4px;font-size:15px;color:#1A1A1A;font-weight:600">Hei ${escapeHtml(first)},</p>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.65;color:#1A1A1A">
            Tusen takk for at du valgte <strong>${escapeHtml(biz)}</strong>. Hvis du var fornøyd,
            ville det betydd mye om du ga oss noen ord på Google — det tar under ett minutt
            og hjelper andre med å finne oss.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px">
            <tr><td style="border-radius:11px;background:#1A1A1A">
              <a href="${escapeHtml(buttonUrl)}" target="_blank"
                 style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:11px">
                ⭐ Gi en vurdering på Google
              </a>
            </td></tr>
          </table>
          ${privateBlock}
          <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#8A8578">
            Fungerer ikke knappen? Kopier denne lenken inn i nettleseren:<br>
            <a href="${escapeHtml(buttonUrl)}" target="_blank" style="color:#15795A;word-break:break-all">${escapeHtml(buttonUrl)}</a>
          </p>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:11px;color:#B3AD9F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        Sendt på vegne av ${escapeHtml(biz)} · drevet av Sikt
      </p>
    </td></tr>
  </table></body></html>`;

  return { subject: `Hvordan var opplevelsen med ${biz}?`, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Kun POST er tillatt' }, 405);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'Serveren mangler Supabase-konfigurasjon.' }, 500);
  }
  if (!RESEND_API_KEY) {
    return json({ ok: false, error: 'E-post er ikke konfigurert (RESEND_API_KEY mangler).' }, 500);
  }

  // 1) Hvem er innlogget?
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'Du er ikke logget inn.' }, 401);

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return json({ ok: false, error: 'Ugyldig sesjon.' }, 401);

  // 2) Hvilken forespørsel?
  let requestId: string | null = null;
  try {
    const body = await req.json();
    requestId = typeof body?.requestId === 'string' ? body.requestId : null;
  } catch { /* ignore */ }
  if (!requestId) return json({ ok: false, error: 'Mangler requestId.' }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 3) Hent forespørselen og bekreft eierskap.
  const { data: reqRow, error: reqErr } = await admin
    .from('review_requests')
    .select('id, user_id, customer_name, email, status, token')
    .eq('id', requestId)
    .maybeSingle();
  if (reqErr || !reqRow) return json({ ok: false, error: 'Fant ikke forespørselen.' }, 404);
  if (reqRow.user_id !== user.id) return json({ ok: false, error: 'Ikke din forespørsel.' }, 403);
  if (!reqRow.email) return json({ ok: false, error: 'Forespørselen mangler e-postadresse.' }, 400);

  // Forretningsnavn + svar-til + pakke fra clients (samme spørring).
  const { data: client } = await admin
    .from('clients')
    .select('email, company_name, package_name')
    .eq('user_id', user.id)
    .maybeSingle();

  // Gating (defense-in-depth): anmeldelses-motoren er Standard + Premium.
  const plan = client?.package_name ?? '';
  if (!/standard|premium/i.test(plan)) {
    return json({ ok: false, error: 'Anmeldelses-motoren krever Standard eller Premium.' }, 403);
  }

  // 4) Hent Google-lenke + innstillinger.
  const { data: settings } = await admin
    .from('review_settings')
    .select('write_review_url, business_name, private_feedback_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings?.write_review_url) {
    return json({ ok: false, error: 'Koble til Google-lenken din først.' }, 400);
  }

  const businessName = settings.business_name || client?.company_name || 'oss';

  // Sporings-lenke: registrerer åpning, redirecter til ekte Google-lenke.
  const buttonUrl = `${SUPABASE_URL}/functions/v1/review-redirect?t=${encodeURIComponent(reqRow.token)}`;

  const { subject, html } = buildEmail({
    customerName: reqRow.customer_name,
    businessName,
    buttonUrl,
    privateFeedback: !!settings.private_feedback_enabled,
  });

  // 5) Send via Resend.
  const resendBody: Record<string, unknown> = {
    from: `${businessName} <${FROM_EMAIL}>`,
    to: [reqRow.email],
    subject,
    html,
  };
  if (client?.email) resendBody.reply_to = client.email;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(resendBody),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('[send-review-request] Resend-feil:', resp.status, detail);
    await admin.from('review_requests')
      .update({ status: 'failed', error: `Resend ${resp.status}` })
      .eq('id', reqRow.id);
    return json({ ok: false, error: 'Kunne ikke sende e-posten akkurat nå.' }, 502);
  }

  await admin.from('review_requests')
    .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
    .eq('id', reqRow.id);

  return json({ ok: true });
});

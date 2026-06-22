// review-followup — sender ÉN vennlig påminnelse til forespørsler som er
// sendt for > 4 dager siden uten at lenken er åpnet, og ikke fulgt opp før.
//
// Kjøres av Supabase pg_cron (daglig) med x-cron-secret. MÅ deployes med
// verify_jwt = false (se supabase/config.toml). Cron-snutt i migrasjonen
// 2026-06-15_reviews.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderEmail } from '../_shared/email.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const FOLLOWUP_AFTER_DAYS = 4;
const MAX_PER_RUN = 100;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildFollowup(opts: { customerName: string; businessName: string; buttonUrl: string }) {
  const first = (opts.customerName || '').trim().split(/\s+/)[0] || 'hei';
  const biz = opts.businessName || 'oss';
  const html = renderEmail({
    preheader: `En liten påminnelse fra ${biz} — noen ord på Google tar under ett minutt.`,
    brand: 'none', // white-label
    intro: `Hei ${escapeHtml(first)}, en liten påminnelse. Hadde du en god opplevelse med <strong style="color:#1A1A1A">${escapeHtml(biz)}</strong>, setter vi stor pris på noen ord på Google. Det tar under ett minutt.`,
    cta: { label: 'Gi en vurdering på Google', url: opts.buttonUrl },
    signoff: 'Dette er den eneste påminnelsen vi sender.',
    footer: `Sendt på vegne av ${escapeHtml(biz)} &nbsp;·&nbsp; drevet av Sikt`,
  });
  return { subject: `En liten påminnelse fra ${biz}`, html };
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return new Response('Server ikke konfigurert', { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const cutoff = new Date(Date.now() - FOLLOWUP_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await admin
    .from('review_requests')
    .select('id, user_id, customer_name, email, token')
    .eq('status', 'sent')
    .is('last_followup_at', null)
    .lt('sent_at', cutoff)
    .not('email', 'is', null)
    .order('sent_at', { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[review-followup] Spørrefeil:', error);
    return new Response('Feil ved henting', { status: 500 });
  }
  if (!due || due.length === 0) {
    return Response.json({ sent: 0, errors: 0 });
  }

  // Slå opp innstillinger + bedriftsnavn per unik bruker (én gang).
  const userIds = [...new Set(due.map((r) => r.user_id))];
  const settingsMap = new Map<string, { url: string | null; name: string | null }>();
  const clientMap = new Map<string, { email: string | null; company_name: string | null }>();

  const { data: settingsRows } = await admin
    .from('review_settings').select('user_id, write_review_url, business_name').in('user_id', userIds);
  for (const s of settingsRows ?? []) settingsMap.set(s.user_id, { url: s.write_review_url, name: s.business_name });

  const { data: clientRows } = await admin
    .from('clients').select('user_id, email, company_name').in('user_id', userIds);
  for (const c of clientRows ?? []) clientMap.set(c.user_id, { email: c.email, company_name: c.company_name });

  let sent = 0;
  let errors = 0;

  for (const r of due) {
    const s = settingsMap.get(r.user_id);
    if (!s?.url) continue; // ingen Google-lenke → hopp over (men ikke prøv igjen)
    const businessName = s.name || clientMap.get(r.user_id)?.company_name || 'oss';
    const buttonUrl = `${SUPABASE_URL}/functions/v1/review-redirect?t=${encodeURIComponent(r.token)}`;
    const { subject, html } = buildFollowup({ customerName: r.customer_name, businessName, buttonUrl });

    const body: Record<string, unknown> = { from: `${businessName} <${FROM_EMAIL}>`, to: [r.email], subject, html };
    const replyTo = clientMap.get(r.user_id)?.email;
    if (replyTo) body.reply_to = replyTo;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Uansett resultat: marker fulgt opp, så vi aldri sender mer enn én påminnelse.
    await admin.from('review_requests').update({ last_followup_at: new Date().toISOString() }).eq('id', r.id);
    if (resp.ok) sent++; else { errors++; console.error('[review-followup] Resend-feil:', resp.status); }
  }

  return Response.json({ sent, errors });
});

import { withSentry, Sentry } from './_lib/sentry.js';
import { renderEmail, note } from './_lib/email.js';

// =====================================================================
// /api/contact — tar imot meldinger fra kontaktskjemaet og sender e-post
// via Resend (samme oppsett som weekly-reports / dunning).
//
// Env vars (settes i Vercel):
//   RESEND_API_KEY    — påkrevd for å sende
//   FROM_EMAIL        — avsender (må være verifisert domene i Resend),
//                       default rapport@siktseo.com
//   CONTACT_TO_EMAIL  — hvor meldinger havner, default siktseo@gmail.com
//
// Frontend faller tilbake til mailto: hvis dette endepunktet feiler, så
// en henvendelse går aldri tapt.
// =====================================================================

const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 5;
const ipTracker = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default withSentry(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode ikke tillatt' });
  }

  // --- Fartsdump per IP ---
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'ukjent-ip';
  const now = Date.now();
  const requestData = ipTracker.get(ip) || { count: 0, firstRequest: now };
  if (now - requestData.firstRequest > rateLimitWindowMs) {
    requestData.count = 1;
    requestData.firstRequest = now;
  } else {
    requestData.count++;
  }
  ipTracker.set(ip, requestData);
  if (requestData.count > maxRequestsPerWindow) {
    return res.status(429).json({ error: 'For mange meldinger. Vennligst vent ett minutt.' });
  }

  const { name, email, message, hp } = req.body || {};

  // Honeypot: ekte brukere ser ikke dette feltet. Er det fylt ut, later vi
  // som alt gikk bra uten å sende noe (stopper enkle bots).
  if (typeof hp === 'string' && hp.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const cleanName = typeof name === 'string' ? name.trim().slice(0, 120) : '';
  const cleanEmail = typeof email === 'string' ? email.trim().slice(0, 200) : '';
  const cleanMessage = typeof message === 'string' ? message.trim().slice(0, 5000) : '';

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return res.status(400).json({ error: 'Fyll inn navn, e-post og melding.' });
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Ugyldig e-postadresse.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Ingen e-posttjeneste konfigurert ennå — be frontend falle tilbake til mailto.
    return res.status(503).json({ error: 'E-posttjenesten er ikke satt opp ennå.' });
  }

  const fromEmail = process.env.FROM_EMAIL || 'rapport@siktseo.com';
  const toEmail = process.env.CONTACT_TO_EMAIL || 'siktseo@gmail.com';

  const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Intern e-post via Node-tvillingen api/_lib/email.js (samme designsystem
  // som de øvrige e-postene — docs/design-principles.md).
  const html = renderEmail({
    preheader: `Ny henvendelse fra ${cleanName}.`,
    brand: 'sikt',
    kicker: 'Kontaktskjema',
    heading: 'Ny henvendelse',
    intro: 'Fra kontaktskjemaet på siktseo.com.',
    blocks: [
      note(
        `<strong style="color:#1A1A1A">${esc(cleanName)}</strong> &nbsp;·&nbsp; ` +
        `<a href="mailto:${esc(cleanEmail)}" style="color:#15795A;text-decoration:underline">${esc(cleanEmail)}</a>` +
        `<br><br>${esc(cleanMessage).replace(/\n/g, '<br>')}`,
      ),
    ],
  });

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Sikt kontaktskjema <${fromEmail}>`,
        to: [toEmail],
        reply_to: cleanEmail,
        subject: `Henvendelse fra ${cleanName}`,
        html,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`Resend svarte ${resp.status}: ${detail.slice(0, 200)}`);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('contact error:', error?.message || error);
    Sentry.captureException(error);
    return res.status(502).json({ error: 'Kunne ikke sende meldingen akkurat nå.' });
  }
});

// =====================================================================
// Eiervarsling for Sikt-edge-funksjoner (Deno).
// =====================================================================
// Sender en kort drifts-e-post til grunnleggeren (FOUNDER_EMAIL) når noe
// går galt som krever manuell oppfølging — f.eks. en betaling som ikke
// kunne kobles til en konto, eller et planbytte der det gamle abonnementet
// ikke lot seg kansellere.
//
// Kaster ALDRI: en feilet varsling skal aldri velte funksjonen som kaller.
// `_shared/email.ts` holdes bevisst fri for Deno-globaler (ren string-
// bygging) — derfor bor all env-lesing og fetch her, ikke der.

import { renderEmail, defList, escapeHtml } from './email.ts';

export async function sendOwnerAlert(
  subject: string,
  lines: Array<{ title: string; body?: string }>,
): Promise<void> {
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const to = Deno.env.get('FOUNDER_EMAIL') || Deno.env.get('SUPPORT_EMAIL') || 'siktseo@gmail.com';
    if (!apiKey || !to) {
      console.warn('[owner-alert] Mangler RESEND_API_KEY eller mottaker — hopper over varsel:', subject);
      return;
    }
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com';
    const html = renderEmail({
      preheader: subject,
      brand: 'sikt',
      kicker: 'Driftsvarsel',
      heading: escapeHtml(subject),
      intro: 'Automatisk varsel fra en edge-funksjon. Dette trenger som regel manuell oppfølging.',
      blocks: [defList(lines)],
      footer: 'Sendt automatisk fra Sikt-plattformen.',
    });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Sikt Drift <${fromEmail}>`,
        to: [to],
        subject: `[Sikt drift] ${subject}`,
        html,
      }),
    });
    if (!res.ok) console.error('[owner-alert] Resend feilet:', res.status, await res.text());
  } catch (err) {
    console.error('[owner-alert] Kastet:', (err as Error).message);
  }
}

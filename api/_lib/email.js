// =====================================================================
// Node/ESM-tvilling av supabase/functions/_shared/email.ts.
// =====================================================================
// Vercel-funksjoner (Node) kan IKKE importere Deno-malen i _shared, så vi
// speiler designsystemet (docs/design-principles.md) her. Hold de to filene
// i synk når malen endres. Brukes av api/contact.js + varsel-e-postene i
// api/cron-scan-competitors.js. Ren string-bygging.
// =====================================================================

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const TOKENS = {
  width: 580,
  pad: 40,
  space: { xs: 8, sm: 13, md: 21, lg: 34, xl: 55 },
  radius: { card: 16, button: 10 },
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  serif: "Georgia,'Times New Roman',Times,serif",
  type: { caption: 11, body: 15, lead: 16, sub: 13, h1: 31, focal: 46 },
  color: {
    pageBg: '#F1EFE8', surface: '#FFFFFF', ink: '#1A1A1A', soft: '#55514A',
    muted: '#8A857A', faint: '#B3AD9F', hairline: '#E7E2D8', accent: '#6D28D9',
    green: '#15724A', greenSoft: '#3F8F38', danger: '#A33A2A',
  },
};

const C = TOKENS.color;
const S = TOKENS.space;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;
const T = TOKENS.type;

export function sectionHead(title) {
  return `<div style="margin:0 0 ${S.md}px">
    <div style="width:22px;height:2px;background:${C.accent};font-size:0;line-height:0;margin-bottom:${S.sm}px">&nbsp;</div>
    <div style="font-family:${SANS};font-size:${T.sub}px;font-weight:700;color:${C.ink};letter-spacing:-0.1px">${escapeHtml(title)}</div>
  </div>`;
}

export function paragraph(html, opts = {}) {
  return `<div style="font-family:${SANS};font-size:${opts.size ?? T.body}px;line-height:1.72;color:${opts.color ?? C.soft};margin-top:${opts.mt ?? 0}px">${html}</div>`;
}

export function statement(opts) {
  const trend = opts.trend
    ? `<div style="font-family:${SANS};font-size:13px;font-weight:600;color:${C.green};margin-top:${S.sm}px">${escapeHtml(opts.trend)}</div>`
    : '';
  const sub = opts.sub
    ? `<div style="font-family:${SANS};font-size:13px;color:${C.muted};line-height:1.65;margin-top:${S.md}px">${opts.sub}</div>`
    : '';
  return `<div>
    <div style="font-family:${SERIF};font-size:${T.focal}px;font-weight:700;color:${C.green};line-height:1;letter-spacing:-1px">${escapeHtml(opts.value)}</div>
    <div style="font-family:${SANS};font-size:13px;color:${C.muted};font-weight:500;margin-top:${S.sm}px;text-transform:uppercase;letter-spacing:1px">${escapeHtml(opts.label)}</div>
    ${trend}${sub}
  </div>`;
}

export function winList(items) {
  return items.map((w, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:${i === 0 ? '0' : '1px solid ' + C.hairline}"><tr>
      <td style="padding:${S.sm}px 0;font-family:${SANS};font-size:15px;font-weight:500;color:${C.ink}">${escapeHtml(w.keyword)}</td>
      <td align="right" style="padding:${S.sm}px 0;white-space:nowrap;font-family:${SANS};font-size:14px;font-weight:600;color:${w.tone === 'down' ? C.danger : C.green}">${escapeHtml(w.from)} &rarr; ${escapeHtml(w.to)}${w.flag ? `<span style="color:${C.muted};font-weight:500"> · ${escapeHtml(w.flag)}</span>` : ''}</td>
    </tr></table>`).join('');
}

export function railNote(opts) {
  const rail = { accent: C.accent, green: C.green, danger: C.danger, neutral: C.hairline }[opts.tone ?? 'neutral'];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="2" style="background:${rail};font-size:0;line-height:0" valign="top">&nbsp;</td>
    <td style="padding-left:${S.md}px">
      <div style="font-family:${SANS};font-size:15px;font-weight:600;color:${C.ink};margin-bottom:5px">${escapeHtml(opts.title)}</div>
      <div style="font-family:${SANS};font-size:14px;color:${C.soft};line-height:1.65">${escapeHtml(opts.body)}</div>
    </td>
  </tr></table>`;
}

export function note(html, tone = 'neutral') {
  const col = { neutral: C.soft, green: C.green, danger: C.danger }[tone];
  return `<div style="font-family:${SANS};font-size:14px;line-height:1.7;color:${col}">${html}</div>`;
}

function wordmark() {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td width="30" style="width:30px;height:30px;background:${C.ink};border-radius:8px;text-align:center;vertical-align:middle">
      <span style="font-family:${SERIF};font-size:17px;font-weight:700;color:#FFFFFF;line-height:30px">S</span>
    </td>
    <td style="padding-left:10px;font-family:${SANS};font-size:13px;font-weight:700;color:${C.ink};letter-spacing:2px">SIKT</td>
  </tr></table>`;
}

function masthead(kicker) {
  const kick = kicker
    ? `<td align="right" valign="middle" style="font-family:${SANS};font-size:12px;color:${C.muted};letter-spacing:0.3px">${escapeHtml(kicker)}</td>`
    : '<td></td>';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle">${wordmark()}</td>${kick}
    </tr></table>
    <div style="border-top:1px solid ${C.hairline};font-size:0;line-height:0;margin-top:${S.md}px">&nbsp;</div>`;
}

export function renderEmail(opts) {
  const lang = opts.lang ?? 'no';
  const isSikt = opts.brand === 'sikt';
  const head = isSikt ? `<tr><td style="padding-bottom:${S.lg}px">${masthead(opts.kicker)}</td></tr>` : '';

  const headingHtml = opts.heading
    ? `<div style="font-family:${SERIF};font-size:${T.h1}px;font-weight:700;color:${C.ink};line-height:1.18;letter-spacing:-0.4px;margin:0 0 ${S.md}px">${opts.heading}</div>` : '';
  const introHtml = opts.intro
    ? `<div style="font-family:${SANS};font-size:${T.lead}px;color:${C.soft};line-height:1.72">${opts.intro}</div>` : '';
  const topCell = (headingHtml || introHtml) ? `<tr><td>${headingHtml}${introHtml}</td></tr>` : '';

  const blocksHtml = (opts.blocks ?? []).filter(Boolean).map((b, i) =>
    `<tr><td style="padding-top:${i === 0 && topCell ? S.xl : S.lg}px">${b}</td></tr>`).join('');

  const signoffHtml = opts.signoff
    ? `<tr><td style="padding-top:${S.lg}px"><div style="font-family:${SERIF};font-size:16px;font-style:italic;color:${C.soft};line-height:1.7">${opts.signoff}</div></td></tr>` : '';

  const ctaBtn = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="border-radius:${TOKENS.radius.button}px;background:${C.ink}">
          <a href="${escapeHtml(opts.cta.url)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:${TOKENS.radius.button}px;letter-spacing:0.2px">${escapeHtml(opts.cta.label)}&nbsp;&nbsp;&rarr;</a>
        </td>
      </tr></table>` : '';
  const secondaryHtml = opts.secondary
    ? `<div style="font-family:${SANS};font-size:13px;color:${C.muted};line-height:1.6;margin-top:${S.md}px">${opts.secondary}</div>` : '';
  const ctaHtml = (ctaBtn || secondaryHtml)
    ? `<tr><td style="padding-top:${S.lg}px">${ctaBtn}${secondaryHtml}</td></tr>` : '';

  const footerHtml = opts.footer
    ? `<tr><td style="padding:${S.lg}px ${TOKENS.pad}px 0"><div style="font-family:${SANS};font-size:11px;color:${C.faint};line-height:1.9;letter-spacing:0.2px">${opts.footer}</div></td></tr>` : '';

  const preheader = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.pageBg};opacity:0">${escapeHtml(opts.preheader)}${'&#8202;&zwnj;'.repeat(40)}</div>`;

  return `<!DOCTYPE html>
<html lang="${lang}" style="margin:0;padding:0">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:${C.pageBg};-webkit-text-size-adjust:100%">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.pageBg}" style="background:${C.pageBg};padding:${S.xl}px ${S.md}px">
<tr><td align="center">
<table role="presentation" width="${TOKENS.width}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${TOKENS.width}px">
<tr><td style="background:${C.surface};border:1px solid ${C.hairline};border-radius:${TOKENS.radius.card}px;padding:${TOKENS.pad}px;box-shadow:0 1px 2px rgba(26,26,26,0.03),0 18px 40px -20px rgba(26,26,26,0.12)">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${head}
    ${topCell}
    ${blocksHtml}
    ${signoffHtml}
    ${ctaHtml}
  </table>
</td></tr>
${footerHtml}
<tr><td style="padding-bottom:${S.xl}px"></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

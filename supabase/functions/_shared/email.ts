// =====================================================================
// Delt e-postmal for alle Sikt-edge-funksjoner (Deno).
// =====================================================================
// Redaksjonelt uttrykk ("quiet-luxury newsletter"), tuftet på
// The Interior Design Handbook — se docs/design-principles.md.
//
// Designvalg som gjør den til "laget av en designer", ikke AI-default:
//   • Serif-display (Georgia) for overskrift/fokus-tall mot ren sans body
//     → ekte typografisk kontrast.
//   • Hårstrek-linjer + luft som grupperer — IKKE en stabel like kort.
//   • Fokus-tallet er stort og redaksjonelt under en kort aksent-strek,
//     ikke en farget pille-boks. Ett rolig blikkfang (+S).
//   • Ingen emoji, ingen uppercase-etikett på hver seksjon.
//   • Brevhode (wordmark + dato + hårstrek), rolig ink-knapp med "→".
//
// `_shared` deployes IKKE som funksjon. Importeres av Deno-funksjonene via
// `import { renderEmail } from '../_shared/email.ts'`. Ren string-bygging,
// ingen Deno-globaler — så en Node-preview kan rendre den.
//
// KONVENSJON: `heading`, `intro`, `blocks[]`, `footer` er RÅ HTML — kallstedet
// MÅ escapeHtml() alt dynamisk. Blokk-helperne escaper sine egne argumenter.
// =====================================================================

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const TOKENS = {
  width: 580,
  pad: 40,            // kort-padding (sjenerøst negativt rom)
  space: { xs: 8, sm: 13, md: 21, lg: 34, xl: 55 }, // Fibonacci ≈ gyllent snitt
  radius: { card: 16, button: 10 },
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  serif: "Georgia,'Times New Roman',Times,serif", // redaksjonell display (e-post-trygg)
  type: { caption: 11, body: 15, lead: 16, sub: 13, h1: 31, focal: 46 },
  color: {
    pageBg: '#F1EFE8',     // varm papir-tone (ambient)
    surface: '#FFFFFF',    // arket
    ink: '#1A1A1A',        // blekk (30 %)
    soft: '#55514A',       // dempet blekk
    muted: '#8A857A',      // caption
    faint: '#B3AD9F',
    hairline: '#E7E2D8',   // varm hårstrek
    accent: '#6D28D9',     // brand-aksent (violett) — brukt sparsomt
    green: '#15724A',      // positivt
    greenSoft: '#3F8F38',
    danger: '#A33A2A',
  },
} as const;

const C = TOKENS.color;
const S = TOKENS.space;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;
const T = TOKENS.type;

// =====================================================================
// Blokk-helpere — innhold som legges i kortet. renderEmail() skiller
// blokker med luft (negativt rom), ikke med rammer.
// =====================================================================

/** Hel hårstrek-linje (redaksjonell seksjons-skille). */
export function rule(): string {
  return `<div style="border-top:1px solid ${C.hairline};font-size:0;line-height:0">&nbsp;</div>`;
}

/**
 * Rolig seksjons-overskrift: kort aksent-strek + tittel i sans, sentence case.
 * Erstatter de skrikende uppercase-etikettene.
 */
export function sectionHead(title: string): string {
  return `<div style="margin:0 0 ${S.md}px">
    <div style="width:22px;height:2px;background:${C.accent};font-size:0;line-height:0;margin-bottom:${S.sm}px">&nbsp;</div>
    <div style="font-family:${SANS};font-size:${T.sub}px;font-weight:700;color:${C.ink};letter-spacing:-0.1px">${escapeHtml(title)}</div>
  </div>`;
}

/** Brødtekst (rå HTML — kallstedet escaper dynamikk). */
export function paragraph(html: string, opts: { size?: number; color?: string; mt?: number } = {}): string {
  return `<div style="font-family:${SANS};font-size:${opts.size ?? T.body}px;line-height:1.72;color:${opts.color ?? C.soft};margin-top:${opts.mt ?? 0}px">${html}</div>`;
}

/**
 * +S-fokus: ÉN redaksjonell statement. Stort serif-tall under en kort aksent-
 * strek, liten caption under. Ingen farget boks — tallet ER blikkfanget.
 * Maks én gang per e-post.
 */
export function statement(opts: {
  value: string; label: string; sub?: string; trend?: string;
}): string {
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

/**
 * Seier-liste: søkeord som klatret, som en redaksjonell hårstrek-liste
 * (skillelinjer mellom rader) — ikke et farget kort.
 */
export function winList(items: Array<{ keyword: string; from: number | string; to: number | string; flag?: string }>): string {
  return items.map((w, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:${i === 0 ? '0' : '1px solid ' + C.hairline}"><tr>
      <td style="padding:${S.sm}px 0;font-family:${SANS};font-size:15px;font-weight:500;color:${C.ink}">${escapeHtml(w.keyword)}</td>
      <td align="right" style="padding:${S.sm}px 0;white-space:nowrap;font-family:${SANS};font-size:14px;font-weight:600;color:${C.green}">${escapeHtml(w.from)} &rarr; ${escapeHtml(w.to)}${w.flag ? `<span style="color:${C.muted};font-weight:500"> · ${escapeHtml(w.flag)}</span>` : ''}</td>
    </tr></table>`).join('');
}

/**
 * Tre tall (odde-gruppering), redaksjonelt: serif-tall + caption, skilt med
 * fine vertikale hårstreker — ingen kort-rammer.
 */
export function statRow(items: Array<{ value: string | number; label: string }>): string {
  const list = items.slice(0, 3);
  const cells = list.map((s, i) => `
    <td width="33.33%" valign="top" style="${i === 0 ? `padding-right:${S.md}px` : `padding-left:${S.md}px;border-left:1px solid ${C.hairline}`}">
      <div style="font-family:${SERIF};font-size:30px;font-weight:700;color:${C.ink};letter-spacing:-0.5px;line-height:1">${escapeHtml(s.value)}</div>
      <div style="font-family:${SANS};font-size:12px;color:${C.muted};margin-top:${S.xs}px;line-height:1.4">${escapeHtml(s.label)}</div>
    </td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

/** Hårstrek-separert liste: tittel + valgfri underlinje (fikset/funn/forslag). */
export function defList(items: Array<{ title: string; body?: string }>): string {
  return items.map((it, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:${i === 0 ? '0' : '1px solid ' + C.hairline}"><tr><td style="padding:${S.sm}px 0">
      <div style="font-family:${SANS};font-size:15px;font-weight:600;color:${C.ink}${it.body ? `;margin-bottom:3px` : ''}">${escapeHtml(it.title)}</div>
      ${it.body ? `<div style="font-family:${SANS};font-size:13px;color:${C.muted};line-height:1.6">${escapeHtml(it.body)}</div>` : ''}
    </td></tr></table>`).join('');
}

/** Venstre aksent-skinne + tekst (rolig notis uten egen flate). */
export function railNote(opts: { title: string; body: string; tone?: 'accent' | 'green' | 'danger' | 'neutral' }): string {
  const rail = { accent: C.accent, green: C.green, danger: C.danger, neutral: C.hairline }[opts.tone ?? 'neutral'];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="2" style="background:${rail};font-size:0;line-height:0" valign="top">&nbsp;</td>
    <td style="padding-left:${S.md}px">
      <div style="font-family:${SANS};font-size:15px;font-weight:600;color:${C.ink};margin-bottom:5px">${escapeHtml(opts.title)}</div>
      <div style="font-family:${SANS};font-size:14px;color:${C.soft};line-height:1.65">${escapeHtml(opts.body)}</div>
    </td>
  </tr></table>`;
}

/** Liten notis-linje (rå HTML), valgfri venstre-aksent. */
export function note(html: string, tone: 'neutral' | 'green' | 'danger' = 'neutral'): string {
  const col = { neutral: C.soft, green: C.green, danger: C.danger }[tone];
  return `<div style="font-family:${SANS};font-size:14px;line-height:1.7;color:${col}">${html}</div>`;
}

// =====================================================================
// renderEmail — arket (papir → kort → footer)
// =====================================================================
export interface EmailOptions {
  preheader: string;
  brand?: 'sikt' | 'none';
  /** Liten masthead-etikett til høyre (f.eks. "Uke 25 · 16. juni"). */
  kicker?: string;
  /** Fokus-overskrift (rå HTML) — settes i serif. */
  heading?: string;
  intro?: string;
  blocks?: string[];
  cta?: { label: string; url: string };
  /** Sekundær tekstlenke under CTA (rå HTML). */
  secondary?: string;
  signoff?: string;
  footer?: string;
  lang?: string;
}

/** Brevhode: monogram + SIKT + valgfri dato-kicker, avsluttet med hårstrek. */
function masthead(kicker?: string): string {
  const kick = kicker
    ? `<td align="right" valign="middle" style="font-family:${SANS};font-size:12px;color:${C.muted};letter-spacing:0.3px">${escapeHtml(kicker)}</td>`
    : '<td></td>';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="30" style="width:30px;height:30px;background:${C.ink};border-radius:8px;text-align:center;vertical-align:middle">
            <span style="font-family:${SERIF};font-size:17px;font-weight:700;color:#FFFFFF;line-height:30px">S</span>
          </td>
          <td style="padding-left:10px;font-family:${SANS};font-size:13px;font-weight:700;color:${C.ink};letter-spacing:2px">SIKT</td>
        </tr></table>
      </td>
      ${kick}
    </tr>
  </table>
  <div style="border-top:1px solid ${C.hairline};font-size:0;line-height:0;margin-top:${S.md}px">&nbsp;</div>`;
}

export function renderEmail(opts: EmailOptions): string {
  const lang = opts.lang ?? 'no';
  const isSikt = opts.brand === 'sikt';

  const head = isSikt
    ? `<tr><td style="padding-bottom:${S.lg}px">${masthead(opts.kicker)}</td></tr>`
    : '';

  const headingHtml = opts.heading
    ? `<div style="font-family:${SERIF};font-size:${T.h1}px;font-weight:700;color:${C.ink};line-height:1.18;letter-spacing:-0.4px;margin:0 0 ${S.md}px">${opts.heading}</div>` : '';
  const introHtml = opts.intro
    ? `<div style="font-family:${SANS};font-size:${T.lead}px;color:${C.soft};line-height:1.72">${opts.intro}</div>` : '';
  const topCell = (headingHtml || introHtml)
    ? `<tr><td>${headingHtml}${introHtml}</td></tr>` : '';

  // Negativt rom mellom blokker: lg (luftig). Første blokk større slipp fra intro.
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

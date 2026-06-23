import React from 'react';
import { PORTAL } from './portalTheme';

/**
 * Den røde tråden fra «The Interior Design Handbook» (docs/design-principles.md),
 * delt mellom Hjem-bitene og speilet etter Innstillinger-blokken + e-postmalen
 * (supabase/functions/_shared/email.ts). Varm-nøytral ro + én rolig grønn aksent.
 *
 * ALLE verdier kommer fra PORTAL (src/portalTheme.ts) — ett kildested. EDITORIAL er
 * kun et tynt navne-kart over PORTAL, så det ikke finnes duplisert/avvikende hex her.
 */
export const SERIF = PORTAL.serif;
export const SANS = PORTAL.sans;

export const EDITORIAL = {
  ink: PORTAL.ink,
  sub: PORTAL.sub,
  muted: PORTAL.muted,
  faint: PORTAL.faint,
  hair: PORTAL.border,
  green: PORTAL.success,
  insetBg: PORTAL.insetBg,
  insetBorder: PORTAL.insetBorder,
  insetInk: PORTAL.insetInk,
  danger: PORTAL.danger,
  dangerBg: PORTAL.dangerBg,
  dangerBorder: 'rgba(180,35,31,0.25)', // = PORTAL.danger (#B4231F) med 25 % alfa
  neutralBg: PORTAL.subtle,
} as const;

/** Seksjons-tittel med liten grønn aksent-strek (gjentar e-postenes sectionHead-motiv). */
export const SectionTitle: React.FC<{
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ children, size = 'md', className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
    <span
      aria-hidden
      style={{ width: 18, height: 2, background: EDITORIAL.green, borderRadius: 2, flexShrink: 0 }}
    />
    <span
      className={`font-semibold ${size === 'sm' ? 'text-sm' : 'text-base sm:text-lg'} ${className.includes('truncate') ? 'truncate' : ''}`}
      style={{ color: EDITORIAL.ink, fontFamily: SANS, letterSpacing: '-0.01em' }}
    >
      {children}
    </span>
  </span>
);

/** Tonet inset = «aksent-lampen»: gir dybde til en merknad/tomtilstand uten skygge-støy. */
export const Note: React.FC<{
  tone?: 'neutral' | 'green' | 'danger';
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', className = '', children }) => {
  const s =
    tone === 'green'
      ? { background: EDITORIAL.insetBg, border: `1px solid ${EDITORIAL.insetBorder}`, color: EDITORIAL.insetInk }
      : tone === 'danger'
        ? { background: EDITORIAL.dangerBg, border: `1px solid ${EDITORIAL.dangerBorder}`, color: EDITORIAL.danger }
        : { background: EDITORIAL.neutralBg, border: `1px solid ${EDITORIAL.hair}`, color: EDITORIAL.sub };
  return (
    <div className={`rounded-[11px] px-4 py-3 text-sm ${className}`} style={{ ...s, lineHeight: 1.6 }}>
      {children}
    </div>
  );
};

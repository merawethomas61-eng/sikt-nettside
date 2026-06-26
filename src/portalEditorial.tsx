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

// Tema-bevisst: peker på CSS-variabler (definert på .sikt-portal i ClientPortal),
// med lys fallback = de gamle PORTAL-verdiene. Inne i portalen flipper de med
// data-theme; utenfor portalen (om noen gjenbruker disse) faller de til lys.
export const EDITORIAL = {
  ink: 'var(--ink, #1A1A1A)',
  sub: 'var(--sub, #5C574C)',
  muted: 'var(--muted, #8A8578)',
  faint: 'var(--faint, #B3AD9F)',
  hair: 'var(--hair, #E9E4DA)',
  green: 'var(--green, #15795A)',
  insetBg: 'var(--inset, #F3FBF6)',
  insetBorder: 'var(--insetbd, #D6EEDF)',
  insetInk: 'var(--inset-ink, #2F5C45)',
  danger: 'var(--danger, #B4231F)',
  dangerBg: 'var(--dangerbg, #FBECEB)',
  dangerBorder: 'var(--insetbd, rgba(180,35,31,0.25))',
  neutralBg: 'var(--subtle, #FAF8F3)',
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

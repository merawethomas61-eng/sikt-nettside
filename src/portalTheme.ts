// portalTheme — ett kildested for «warm-neutral Linear»-paletten som
// klientportalen bruker. Samler fargene som ellers var spredt som inline-hex,
// slik at grafer (PortalCharts) og tabell-/kort-primitiver holder seg konsistente.
import type { CSSProperties } from 'react';

export type PortalTheme = 'light' | 'dark';

export const PORTAL = {
  // Flater
  bg: '#F2EFE8',
  card: '#FFFFFF',
  subtle: '#FAF8F3', // svak hover/innfelt flate
  // Tekst
  ink: '#1A1A1A', // primær tekst
  sub: '#5C574C', // sekundær tekst
  muted: '#8A8578', // labels / akser
  faint: '#B3AD9F', // hint / placeholder
  // Linjer
  border: '#E9E4DA', // synlig hårlinje
  hair: '#EFEBE2', // ekstra svak hårlinje / grid
  // Status
  success: '#15795A',
  successBg: '#E8F1EB',
  accent: '#52A447', // lysere grønn — prikker / aksenter
  warn: '#9A6700',
  warnBg: '#F6EEDD',
  danger: '#B4231F',
  dangerBg: '#FBECEB',
  // Tonet innfelt («aksent-lampe») — myk grønn dybde for merknader / tomtilstander
  insetBg: '#F3FBF6',
  insetBorder: '#D6EEDF',
  insetInk: '#2F5C45',
  // Typografi — ett sted for font-stakkene portalen bruker
  serif: "Georgia,'Times New Roman',Times,serif",
  sans: "'Geist','DM Sans',sans-serif",
} as const;

// Farger spesifikt for Recharts — holder akser/grid/tooltip rolige og lar
// dataen (linjer/søyler) bære fargen. Brukes av src/PortalCharts.tsx.
export const chartPalette = {
  ink: PORTAL.ink,
  accent: PORTAL.accent,
  success: PORTAL.success,
  danger: PORTAL.danger,
  axis: PORTAL.muted,
  grid: PORTAL.hair,
  track: PORTAL.bg, // bakgrunnsspor i radial/donut
  tooltipBg: PORTAL.card,
  tooltipBorder: PORTAL.border,
} as const;

// Felles tooltip-stil for alle charts (avrundet, hårlinje, mild skygge).
export const chartTooltipStyle: CSSProperties = {
  background: chartPalette.tooltipBg,
  border: `1px solid ${chartPalette.tooltipBorder}`,
  borderRadius: 10,
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 8px 24px -12px rgba(26,24,18,0.25)',
  color: PORTAL.ink,
};

// Felles dato-format for tidsakser/tooltips på alle tidsserie-grafer («12. jun»).
export const formatChartDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
};

// Skår 0–100 → farge + etikett, i tråd med paletten (erstatter slate/emerald/amber/rose).
export const scoreColor = (score: number | null) => {
  if (score == null) return { label: 'Ikke målt', shortLabel: 'Mangler data', color: PORTAL.muted };
  if (score >= 80) return { label: 'Sterk score', shortLabel: 'Bra', color: PORTAL.success };
  if (score >= 60) return { label: 'God, men kan løftes', shortLabel: 'OK', color: PORTAL.warn };
  return { label: 'Trenger forbedring', shortLabel: 'Svak', color: PORTAL.danger };
};

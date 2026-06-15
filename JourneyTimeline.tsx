import React from 'react';
import { X } from 'lucide-react';

export type JourneyTimelineProps = {
  theme: 'light' | 'dark';
  onDismiss?: () => void;
};

type Phase = { n: string; week: string; title: string; body: string };

const PHASES: Phase[] = [
  { n: '01', week: 'Uke 1–2', title: 'Grunnmuren', body: 'Sikt kobler til, analyserer og fikser de tekniske feilene som holder deg nede.' },
  { n: '02', week: 'Uke 3–6', title: 'Klatringen', body: 'Innhold og søkeord optimaliseres. Du begynner å klatre på «nesten på side 1».' },
  { n: '03', week: 'Uke 8–12', title: 'Resultatene', body: 'Rangering og trafikk begynner å bevege seg synlig. Tålmodigheten betaler seg.' },
];

// Emil: custom ease-out — sterkere enn innebygd, gir bevegelsen mening.
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const SERIF = "'Georgia','Times New Roman',serif";

/**
 * «Slik ser veien ut» — forventnings-onboarding. Reframer SEO-ventetiden (60–90
 * dager) som planen, ikke en feil — den viktigste tause churn-dempen.
 *
 * Stil: varmt redaksjonelt kort (matcher merkevarens landingsside, ikke de kjølige
 * slate/violet data-kortene rundt) — serif-kursiv overskrift, store serif-tall som
 * mørkner for hvert steg (bygger mot resultatet), dempet aksent. Tema-bevisst.
 * Emil: stagger-inngang, ekte ease-out, scale-on-press, respekterer reduced-motion.
 */
export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({ theme, onDismiss }) => {
  const isLight = theme === 'light';

  // Varm, restriktiv palett — bevisst vekk fra generisk violet.
  const P = isLight
    ? {
        surface: 'linear-gradient(180deg,#FFFFFF 0%,#FBFAF6 100%)',
        border: '#E9E4DA',
        ink: '#1A1A1A',
        muted: '#5C574C',
        label: '#8A8578',
        accent: '#15795A',
        hair: '#EFEBE2',
        footerBg: '#F2EFE8',
        footerInk: '#5C574C',
        close: '#B3AD9F',
        closeHover: '#5C574C',
        ramp: ['#CFC9BB', '#7FB496', '#15795A'], // faint → grønn: bygger mot resultat
        shadow: '0 1px 2px rgba(26,24,18,0.04), 0 10px 24px -16px rgba(26,24,18,0.14)',
      }
    : {
        surface: 'linear-gradient(180deg,#1A1813 0%,#141209 100%)',
        border: 'rgba(255,255,255,0.08)',
        ink: '#F3EFE6',
        muted: '#9C9485',
        label: '#9C9485',
        accent: '#6EE7B7',
        hair: 'rgba(255,255,255,0.07)',
        footerBg: 'rgba(110,231,183,0.07)',
        footerInk: '#B9B1A1',
        close: '#6F6B61',
        closeHover: '#D2CCBE',
        ramp: ['rgba(110,231,183,0.30)', 'rgba(110,231,183,0.6)', '#6EE7B7'],
        shadow: '0 20px 50px -24px rgba(0,0,0,0.6)',
      };

  return (
    <div
      style={{
        position: 'relative',
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 20,
        padding: '26px 28px',
        boxShadow: P.shadow,
        fontFamily: "'Geist','DM Sans',system-ui,sans-serif",
      }}
    >
      <style>{`
        @keyframes journey-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .journey-item { opacity: 0; animation: journey-in 380ms ${EASE_OUT} forwards; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes journey-in { from { opacity: 0; } to { opacity: 1; } }
        }
        .journey-close { transition: color 150ms ${EASE_OUT}, background-color 150ms ${EASE_OUT}, transform 120ms ${EASE_OUT}; }
        .journey-close:active { transform: scale(0.9); }
      `}</style>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Lukk"
          className="journey-close"
          style={{
            position: 'absolute', top: 14, right: 14,
            display: 'grid', placeItems: 'center', height: 28, width: 28,
            borderRadius: 9, border: 'none', background: 'transparent',
            color: P.close, cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget.style.color = P.closeHover); (e.currentTarget.style.background = P.hair); }}
          onMouseLeave={(e) => { (e.currentTarget.style.color = P.close); (e.currentTarget.style.background = 'transparent'); }}
        >
          <X size={15} />
        </button>
      )}

      {/* Header */}
      <div className="journey-item" style={{ animationDelay: '0ms', paddingRight: 36 }}>
        <p style={{ margin: 0, fontFamily: "'Geist Mono',ui-monospace,SFMono-Regular,monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: P.label }}>
          Slik ser veien ut
        </p>
        <h2 style={{ margin: '11px 0 0', fontSize: 23, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.02em', color: P.ink }}>
          SEO er en klatring,{' '}
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, color: P.accent }}>ikke en bryter.</span>
        </h2>
        <p style={{ margin: '11px 0 0', fontSize: 13.5, lineHeight: 1.6, color: P.muted, maxWidth: 480 }}>
          Resultater på Google tar vanligvis 60–90 dager. Men du ser arbeidet vårt hver eneste mandag — lenge før rangeringen flytter seg. Slik ser de første månedene ut:
        </p>
      </div>

      {/* Faser — redaksjonell liste med serif-tall som mørkner for hvert steg */}
      <div style={{ marginTop: 22, borderTop: `1px solid ${P.hair}` }}>
        {PHASES.map((p, i) => (
          <div
            key={p.n}
            className="journey-item"
            style={{
              animationDelay: `${90 + i * 75}ms`,
              display: 'flex', gap: 18, alignItems: 'flex-start',
              padding: '15px 0',
              borderBottom: i < PHASES.length - 1 ? `1px solid ${P.hair}` : 'none',
            }}
          >
            <span
              aria-hidden
              style={{
                fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400,
                fontSize: 30, lineHeight: 0.9, color: P.ramp[i],
                width: 40, flexShrink: 0, textAlign: 'left',
                fontVariantNumeric: 'lining-nums',
              }}
            >
              {p.n}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: "'Geist Mono',ui-monospace,SFMono-Regular,monospace", fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: P.label }}>
                {p.week} · {p.title}
              </p>
              <p style={{ margin: '5px 0 0', fontSize: 13.5, lineHeight: 1.55, color: P.muted }}>
                {p.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer — pris-trygghet, satt i en dempet aksent-stripe */}
      <div
        className="journey-item"
        style={{
          animationDelay: `${90 + PHASES.length * 75}ms`,
          marginTop: 18, padding: '13px 15px',
          background: P.footerBg, borderRadius: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: P.footerInk }}>
          Derfor er starten rabattert i tre måneder{' '}
          <span style={{ color: P.accent, fontWeight: 600 }}>(50 % → 30 % → 15 %)</span>{' '}
          — du betaler minst mens du venter, og full pris først når resultatene er der.
        </p>
      </div>
    </div>
  );
};

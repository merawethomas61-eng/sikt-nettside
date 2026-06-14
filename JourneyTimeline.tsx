import React from 'react';
import { X } from 'lucide-react';

export type JourneyTimelineProps = {
  theme: 'light' | 'dark';
  onDismiss?: () => void;
};

type Phase = { week: string; title: string; body: string };

const PHASES: Phase[] = [
  { week: 'Uke 1–2', title: 'Grunnmuren', body: 'Sikt kobler til, analyserer og fikser de tekniske feilene som holder deg nede.' },
  { week: 'Uke 3–6', title: 'Klatringen', body: 'Innhold og søkeord optimaliseres. Du begynner å klatre på «nesten på side 1».' },
  { week: 'Uke 8–12', title: 'Resultatene', body: 'Rangering og trafikk begynner å bevege seg synlig. Tålmodigheten betaler seg.' },
];

// Emil: custom ease-out — sterkere enn innebygd, gir bevegelsen mening.
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * «Slik ser veien ut» — forventnings-onboarding. Reframer SEO-ventetiden (60–90
 * dager) som planen, ikke en feil — den viktigste tause churn-dempen.
 * Brandkit: premium, sparsomt, merkevare-palett. Emil: stagger-inngang,
 * ekte ease-out, scale-on-press, respekterer prefers-reduced-motion.
 */
export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({ theme, onDismiss }) => {
  const isLight = theme === 'light';
  const cardCls = isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const lineCls = isLight ? 'bg-slate-200' : 'bg-white/10';
  const weekCls = isLight ? 'text-violet-600' : 'text-violet-300';
  const closeCls = isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-200 hover:bg-white/10';

  return (
    <div className={`relative rounded-2xl border ${cardCls} p-5 sm:p-6 shadow-sm font-['DM_Sans',sans-serif]`}>
      <style>{`
        @keyframes journey-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .journey-item { opacity: 0; animation: journey-in 360ms ${EASE_OUT} forwards; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes journey-in { from { opacity: 0; } to { opacity: 1; } }
        }
        .journey-close { transition: color 150ms ${EASE_OUT}, background-color 150ms ${EASE_OUT}, transform 120ms ${EASE_OUT}; }
        .journey-close:active { transform: scale(0.92); }
      `}</style>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Lukk"
          className={`journey-close absolute top-3 right-3 grid h-7 w-7 place-items-center rounded-lg ${closeCls}`}
        >
          <X size={15} />
        </button>
      )}

      <div className="journey-item pr-8" style={{ animationDelay: '0ms' }}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${weekCls}`}>Slik ser veien ut</p>
        <h2 className={`mt-1.5 text-[17px] font-bold tracking-[-0.01em] ${titleCls}`}>SEO er en klatring, ikke en bryter</h2>
        <p className={`mt-1.5 text-[13px] leading-relaxed ${mutedCls}`}>
          Resultater på Google tar vanligvis 60–90 dager. Men du ser arbeidet vårt hver eneste mandag — lenge før rangeringen flytter seg. Slik ser de første månedene ut:
        </p>
      </div>

      <div className="relative mt-5 pl-7">
        {/* Vertikal linje */}
        <div className={`absolute left-[10px] top-2 bottom-2 w-px ${lineCls}`} aria-hidden />
        <div className="flex flex-col gap-5">
          {PHASES.map((p, i) => (
            <div key={i} className="journey-item relative" style={{ animationDelay: `${80 + i * 70}ms` }}>
              {/* Node */}
              <span
                className={`absolute -left-7 top-1 grid h-[21px] w-[21px] place-items-center rounded-full ${isLight ? 'bg-violet-100' : 'bg-violet-500/20'}`}
                aria-hidden
              >
                <span className="h-2 w-2 rounded-full bg-violet-600" />
              </span>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${weekCls}`}>{p.week}</p>
              <p className={`mt-0.5 text-[14px] font-semibold ${titleCls}`}>{p.title}</p>
              <p className={`mt-0.5 text-[13px] leading-snug ${mutedCls}`}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="journey-item mt-5 pt-4 border-t" style={{ animationDelay: `${80 + PHASES.length * 70}ms`, borderColor: isLight ? 'rgb(226 232 240)' : 'rgba(255,255,255,0.1)' }}>
        <p className={`text-[12px] leading-relaxed ${mutedCls}`}>
          Derfor er starten rabattert i tre måneder (50 % → 30 % → 15 %) — du betaler minst mens du venter, og full pris først når resultatene er der.
        </p>
      </div>
    </div>
  );
};

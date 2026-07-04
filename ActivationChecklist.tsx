import React from 'react';
import { Zap, CheckCircle2, ArrowRight, Globe, Activity, Search, Wrench, X, Target, Users } from 'lucide-react';
import { SectionTitle } from './src/portalEditorial';

export type ActivationChecklistProps = {
  theme: 'light' | 'dark';
  websiteUrl?: string | null;
  hasAnalysis: boolean;
  isAnalyzing: boolean;
  gscConnected: boolean;
  hasKeywords: boolean;
  hasCompetitors: boolean;
  hasStandardOrHigher: boolean;
  hostIsFullyConnected: boolean;
  hostWasLightOnly: boolean;
  onAddUrl: () => void;
  onRunAnalysis: () => void;
  onConnectGsc: () => void;
  onAddKeywords: () => void;
  onAddCompetitor: () => void;
  onConnectWp: () => void;
  onDismiss?: () => void;
};

type Step = {
  done: boolean; title: string; desc: string; cta: string;
  onClick: () => void; icon: any; disabled?: boolean; accent?: boolean; optional?: boolean;
};

/**
 * AKTIVER SIKT — tilkoblings-trakt. Det første en kunde ser til alt som
 * planen betaler for faktisk er skrudd på. Tema-bevisst (matcher PortalCard).
 * Returnerer null når fullført; kan også lukkes via onDismiss.
 */
export const ActivationChecklist: React.FC<ActivationChecklistProps> = ({
  theme, websiteUrl, hasAnalysis, isAnalyzing, gscConnected,
  hasKeywords, hasCompetitors,
  hasStandardOrHigher, hostIsFullyConnected, hostWasLightOnly,
  onAddUrl, onRunAnalysis, onConnectGsc, onAddKeywords, onAddCompetitor, onConnectWp, onDismiss,
}) => {
  const isLight = theme === 'light';

  const steps: Step[] = [];
  steps.push({
    done: !!websiteUrl,
    title: 'Legg inn nettsiden din',
    desc: 'Så Sikt vet hvilken side den skal jobbe med.',
    cta: 'Legg inn', icon: Globe,
    onClick: onAddUrl,
  });
  steps.push({
    done: hasAnalysis,
    title: 'Kjør første analyse',
    desc: 'Teknisk score og dine første funn på ~60 sekunder.',
    cta: isAnalyzing ? 'Kjører…' : 'Kjør analyse', icon: Activity,
    disabled: !websiteUrl || isAnalyzing,
    onClick: onRunAnalysis,
  });
  // De to «aha»-handlingene: egne søkeord og en konkurrent å måle seg mot.
  // Uten dem lander kunden i tomme faner og ser aldri verdien planen betaler for.
  steps.push({
    done: hasKeywords,
    title: 'Legg inn søkeordene dine',
    desc: 'Fortell Sikt hvilke søk du vil vinne — da kan vi måle posisjonen din og vise fremgangen i rapportene.',
    cta: 'Velg søkeord', icon: Target,
    onClick: onAddKeywords,
  });
  steps.push({
    done: hasCompetitors,
    title: 'Følg en konkurrent',
    desc: 'Se hva de gjør som virker — og få varsel når de endrer noe, så du aldri blir tatt på senga.',
    cta: 'Velg konkurrent', icon: Users,
    onClick: onAddCompetitor,
  });
  steps.push({
    done: gscConnected,
    title: 'Koble til Google Search Console (valgfritt)',
    desc: 'Du er allerede i gang uten dette. Koble til når du vil, så henter vi søkeordene Google gir deg — og «Nesten på side 1»-muligheter — automatisk.',
    cta: 'Koble til', icon: Search,
    onClick: onConnectGsc,
    optional: true,
  });
  if (hasStandardOrHigher) {
    steps.push({
      done: hostIsFullyConnected,
      title: 'Koble til nettsiden for auto-fiks',
      desc: 'Du betaler for at Sikt gjør jobben — dette skrur den på. Da fikser og optimaliserer Sikt siden din automatisk hver uke.',
      cta: hostWasLightOnly ? 'Koble til på nytt' : 'Koble til', icon: Wrench, accent: true,
      onClick: onConnectWp,
    });
  }

  const doneCount = steps.filter(s => s.done).length;
  // GSC er valgfritt — skjul trakten når de PÅKREVDE stegene er gjort, så vi
  // ikke maser om en tilkobling kunden ikke trenger for å få verdi.
  if (steps.filter(s => !s.optional).every(s => s.done)) return null;
  const pct = Math.round((doneCount / steps.length) * 100);

  // Tema-tokens (matcher PortalCard / portal*Class i App.tsx)
  const cardCls = isLight ? 'bg-white border-[color:var(--hair)]' : 'bg-slate-900 border-violet-500/30';
  const titleCls = isLight ? 'text-[color:var(--ink)]' : 'text-white';
  const mutedCls = isLight ? 'text-[color:var(--ink)]' : 'text-slate-400';
  const trackCls = isLight ? 'bg-[color:var(--subtle)]' : 'bg-white/10';
  const closeCls = isLight ? 'text-[color:var(--faint)] hover:text-[color:var(--ink)] hover:bg-[color:var(--subtle)]' : 'text-slate-500 hover:text-slate-200 hover:bg-white/10';

  return (
    <div className={`relative rounded-[16px] border ${cardCls} p-5 sm:p-6 font-['Geist','DM_Sans',sans-serif]`}>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Lukk"
          className={`absolute top-3 right-3 grid h-7 w-7 place-items-center rounded-lg transition-colors ${closeCls}`}
        >
          <X size={15} />
        </button>
      )}

      <div className="flex items-start justify-between gap-3 mb-1 pr-8">
        {isLight ? (
          <SectionTitle>Aktiver Sikt</SectionTitle>
        ) : (
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[color:var(--btn-bg)] text-white">
              <Zap size={15} />
            </span>
            <h2 className={`text-[15px] font-bold tracking-[-0.01em] ${titleCls}`}>Aktiver Sikt</h2>
          </div>
        )}
        <span className={`text-[12px] font-semibold ${mutedCls} whitespace-nowrap`}>{doneCount} av {steps.length} fullført</span>
      </div>

      <p className={`text-[13px] ${mutedCls} leading-relaxed mb-4`}>
        {hasStandardOrHigher && !hostIsFullyConnected
          ? 'Sikt er ikke koblet til siden din ennå — så auto-fiksen du betaler for er ikke i gang. Fullfør stegene under (ca. 2 min) så begynner Sikt å jobbe.'
          : 'Noen få steg gjenstår før Sikt jobber for fullt for deg.'}
      </p>

      <div className={`h-1.5 w-full rounded-full ${trackCls} overflow-hidden mb-5`}>
        <div className="h-full rounded-full bg-[#15795A] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const rowCls = s.done
            ? (isLight ? 'border-[color:var(--hair)] bg-[color:var(--subtle)]' : 'border-white/5 bg-white/[0.03]')
            : s.accent
              ? (isLight ? 'border-[color:var(--insetbd)] bg-[color:var(--inset)]' : 'border-violet-500/30 bg-violet-500/10')
              : (isLight ? 'border-[color:var(--hair)] bg-white' : 'border-white/10 bg-transparent');
          const iconCls = s.done
            ? (isLight ? 'bg-[color:var(--inset)] text-[color:var(--green)]' : 'bg-emerald-500/15 text-emerald-300')
            : s.accent
              ? (isLight ? 'bg-[color:var(--inset)] text-[color:var(--green)]' : 'bg-violet-500/15 text-violet-300')
              : (isLight ? 'bg-[color:var(--subtle)] text-[color:var(--muted)]' : 'bg-white/10 text-slate-300');
          const stepTitleCls = s.done
            ? `${mutedCls} line-through`
            : titleCls;
          const secondaryBtn = isLight ? 'bg-[color:var(--btn-bg)] text-white hover:bg-[#2A2722]' : 'bg-white text-slate-900 hover:bg-slate-200';
          const disabledBtn = isLight ? 'bg-[color:var(--subtle)] text-[color:var(--faint)] cursor-not-allowed' : 'bg-white/10 text-slate-500 cursor-not-allowed';
          return (
            <div key={i} className={`flex items-center gap-3 rounded-[12px] border p-3.5 ${rowCls}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${iconCls}`}>
                {s.done ? <CheckCircle2 size={16} /> : <s.icon size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold leading-snug ${stepTitleCls}`}>{s.title}</p>
                {!s.done && <p className={`mt-0.5 text-[12px] leading-snug ${mutedCls}`}>{s.desc}</p>}
              </div>
              {s.done ? (
                <span className={`shrink-0 text-[12px] font-semibold ${isLight ? 'text-[color:var(--green)]' : 'text-emerald-300'}`}>Ferdig</span>
              ) : (
                <button
                  type="button"
                  disabled={s.disabled}
                  onClick={s.onClick}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                    s.disabled ? disabledBtn : secondaryBtn
                  }`}
                >
                  {s.cta} {!s.disabled && <ArrowRight size={13} />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

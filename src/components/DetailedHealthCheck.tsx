import React from 'react';
import { Zap, Image, LayoutTemplate, MousePointerClick, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

type HealthTheme = 'light' | 'dark';

export const DetailedHealthCheck = ({ result, theme = 'dark' }: { result: any; theme?: HealthTheme }) => {
    if (!result) return null;

    const isLight = theme === 'light';
    const headingClass = isLight ? 'text-slate-900' : 'text-white';
    const subClass = isLight ? 'text-slate-600' : 'text-slate-400';
    const cardClass = isLight
        ? 'bg-white border-slate-200 shadow-sm hover:border-violet-200'
        : 'bg-slate-900/40 border-white/10 hover:bg-white/5';
    const descClass = isLight ? 'text-slate-600' : 'text-slate-400';
    const oppCardClass = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/40 border-white/5';
    const rankBadgeClass = isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400';

    const translateOpportunity = (id: string) => {
        const map: Record<string, string> = {
            'properly-size-images': 'Tilpass bildestørrelser',
            'unused-javascript': 'Fjern ubrukt JavaScript',
            'unused-css-rules': 'Fjern ubrukte CSS-regler',
            'render-blocking-resources': 'Eliminer blokkerende ressurser',
            'server-response-time': 'Reduser serverens responstid',
            'total-byte-weight': 'Unngå enorme nettverksbelastninger',
            'uses-optimized-images': 'Koding av bilder effektivt',
            'dom-size': 'Unngå for stor DOM-størrelse',
            'unminified-javascript': 'Minifiser JavaScript',
            'unminified-css': 'Minifiser CSS',
            'uses-text-compression': 'Aktiver tekstkomprimering',
            'uses-responsive-images': 'Vis bilder med riktig størrelse',
            'offscreen-images': 'Utsett lasting av bilder utenfor skjermen'
        };
        return map[id] || id;
    };

    const getScoreAttributes = (score: number) => {
        if (score >= 0.9) return {
            text: isLight ? 'text-emerald-600' : 'text-emerald-400',
            bg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10',
            border: isLight ? 'border-emerald-200' : 'border-emerald-500/20',
            label: 'Utmerket',
            icon: CheckCircle2
        };
        if (score >= 0.5) return {
            text: isLight ? 'text-amber-700' : 'text-amber-400',
            bg: isLight ? 'bg-amber-50' : 'bg-amber-500/10',
            border: isLight ? 'border-amber-200' : 'border-amber-500/20',
            label: 'Middels',
            icon: AlertTriangle
        };
        return {
            text: isLight ? 'text-rose-600' : 'text-rose-400',
            bg: isLight ? 'bg-rose-50' : 'bg-rose-500/10',
            border: isLight ? 'border-rose-200' : 'border-rose-500/20',
            label: 'Kritisk',
            icon: XCircle
        };
    };

    const metrics = [
        { label: 'Første inntrykk (FCP)', key: 'FCP', data: result.fcp, icon: Zap, desc: 'Tiden før første innhold vises.' },
        { label: 'Hovedinnhold (LCP)', key: 'LCP', data: result.lcp, icon: Image, desc: 'Tiden før siden føles ferdig.' },
        { label: 'Visuell stabilitet (CLS)', key: 'CLS', data: result.cls, icon: LayoutTemplate, desc: 'Hvor mye siden hopper.' },
        { label: 'Reaksjonstid (TBT)', key: 'TBT', data: result.tbt, icon: MousePointerClick, desc: 'Respons ved klikk.' }
    ];

    return (
        <div className="mt-10 w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="space-y-4">
                <div className="px-1">
                    <h3 className={`text-xl font-bold flex items-center gap-2 ${headingClass}`}>Dybdeanalyse</h3>
                    <p className={`text-sm ${subClass}`}>Teknisk ytelsesrapport (Core Web Vitals og Lighthouse).</p>
                </div>

                <div className="flex flex-col gap-3">
                    {metrics.map((m, i) => {
                        const score = m.data?.score || 0;
                        const styles = getScoreAttributes(score);

                        return (
                            <div
                                key={i}
                                className={`
                                w-full border ${styles.border} rounded-xl p-4
                                flex flex-wrap items-center justify-between gap-4
                                transition-colors ${cardClass}
                            `}
                            >
                                <div className="flex items-center gap-4 min-w-[180px]">
                                    <div className={`p-3 rounded-lg ${styles.bg} ${styles.text} shrink-0`}>
                                        <m.icon size={24} />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-base whitespace-nowrap ${headingClass}`}>{m.label}</h4>
                                        <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.text} flex items-center gap-1 mt-1`}>
                                            <styles.icon size={10} /> {styles.label}
                                        </div>
                                    </div>
                                </div>

                                <div className={`hidden sm:block flex-1 text-sm px-4 ${descClass}`}>
                                    {m.desc}
                                </div>

                                <div className="text-right shrink-0 min-w-[80px]">
                                    <div className={`text-3xl font-black tabular-nums ${styles.text}`}>
                                        {m.data?.value || '-'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {result.opportunities && result.opportunities.length > 0 && (
                <div className="space-y-4">
                    <div className="px-1">
                        <h3 className={`text-xl font-bold flex items-center gap-2 ${headingClass}`}>
                            <AlertTriangle className={isLight ? 'text-rose-600' : 'text-rose-500'} size={20} />
                            Topp 3 tidstyver
                        </h3>
                        <p className={`text-sm mt-1 ${subClass}`}>Størst mulig gevinst ved optimalisering.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                        {result.opportunities.map((op: any, i: number) => {
                            const savingsSec = (op.overallSavingsMs / 1000).toFixed(2);
                            return (
                                <div key={i} className={`w-full border p-4 rounded-xl flex items-center justify-between gap-4 ${oppCardClass} ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${rankBadgeClass}`}>#{i + 1}</span>
                                        <div className="min-w-0">
                                            <h4 className={`font-bold text-sm truncate pr-2 ${headingClass}`}>
                                                {translateOpportunity(op.id)}
                                            </h4>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className={`text-[10px] uppercase font-bold ${subClass}`}>Spar</p>
                                        <p className={`text-xl font-black tabular-nums ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>{savingsSec} s</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

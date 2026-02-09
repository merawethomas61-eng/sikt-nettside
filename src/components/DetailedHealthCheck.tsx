import React from 'react';
import { Zap, Image, LayoutTemplate, MousePointerClick, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

export const DetailedHealthCheck = ({ result }: { result: any }) => {
    if (!result) return null;

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
            text: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            label: "Utmerket",
            icon: CheckCircle2
        };
        if (score >= 0.5) return {
            text: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            label: "Middels",
            icon: AlertTriangle
        };
        return {
            text: "text-rose-400",
            bg: "bg-rose-500/10",
            border: "border-rose-500/20",
            label: "Kritisk",
            icon: XCircle
        };
    };

    const metrics = [
        { label: "Første inntrykk (FCP)", key: "FCP", data: result.fcp, icon: Zap, desc: "Tiden før første innhold vises." },
        { label: "Hovedinnhold (LCP)", key: "LCP", data: result.lcp, icon: Image, desc: "Tiden før siden føles ferdig." },
        { label: "Visuell stabilitet (CLS)", key: "CLS", data: result.cls, icon: LayoutTemplate, desc: "Hvor mye siden hopper." },
        { label: "Reaksjonstid (TBT)", key: "TBT", data: result.tbt, icon: MousePointerClick, desc: "Respons ved klikk." }
    ];

    return (
        // VIKTIG: w-full her tvinger den til å bruke all tilgjengelig plass
        <div className="mt-10 w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* --- SEKSJON A: METRIKKER --- */}
            <div className="space-y-4">
                <div className="px-1">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">🔍 Dybdeanalyse</h3>
                    <p className="text-slate-400 text-sm">Teknisk ytelsesrapport.</p>
                </div>

                {/* Bruker FLEX COL istedenfor GRID for å unngå klemming */}
                <div className="flex flex-col gap-3">
                    {metrics.map((m, i) => {
                        const score = m.data?.score || 0;
                        const styles = getScoreAttributes(score);

                        return (
                            <div key={i} className={`
                                w-full bg-slate-900/40 border ${styles.border} rounded-xl p-4
                                flex flex-wrap items-center justify-between gap-4
                                hover:bg-white/5 transition-colors
                            `}>
                                {/* Del 1: Ikon og Navn */}
                                <div className="flex items-center gap-4 min-w-[180px]">
                                    <div className={`p-3 rounded-lg ${styles.bg} ${styles.text} shrink-0`}>
                                        <m.icon size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-base whitespace-nowrap">{m.label}</h4>
                                        <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.text} flex items-center gap-1 mt-1`}>
                                            <styles.icon size={10} /> {styles.label}
                                        </div>
                                    </div>
                                </div>

                                {/* Del 2: Beskrivelse (Skjules hvis det blir ekstremt trangt) */}
                                <div className="hidden sm:block flex-1 text-slate-400 text-sm px-4">
                                    {m.desc}
                                </div>

                                {/* Del 3: Verdi */}
                                <div className="text-right shrink-0 min-w-[80px]">
                                    <div className={`text-3xl font-black tabular-nums ${styles.text}`}>
                                        {m.data?.value || "-"}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- SEKSJON B: TIDSTYVER --- */}
            {result.opportunities && result.opportunities.length > 0 && (
                <div className="space-y-4">
                    <div className="px-1">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <AlertTriangle className="text-rose-500" size={20} />
                            Topp 3 Tidstyver
                        </h3>
                    </div>

                    <div className="flex flex-col gap-3">
                        {result.opportunities.map((op: any, i: number) => {
                            const savingsSec = (op.overallSavingsMs / 1000).toFixed(2);
                            return (
                                <div key={i} className="w-full bg-slate-900/40 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="bg-slate-800 text-slate-400 text-xs font-bold px-2 py-1 rounded shrink-0">#{i + 1}</span>
                                        <div className="min-w-0">
                                            <h4 className="text-slate-200 font-bold text-sm truncate pr-2">
                                                {translateOpportunity(op.id)}
                                            </h4>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Spar</p>
                                        <p className="text-xl font-black text-rose-400 tabular-nums">{savingsSec} s</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
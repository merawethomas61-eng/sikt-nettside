import React, { useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

type PortalTab = 'home' | 'visibility' | 'keywords' | 'competitors' | 'geo' | 'workshop' | 'log' | 'settings';

type DashboardHomeProps = {
  user: any;
  clientData: any;
  formData?: any;
  analysisResults?: any | null;
  scoreHistory?: { at: string; mobilePerf: number; mobileSeo: number; desktopPerf: number }[];
  siktActions?: any[];
  realRankings?: any[];
  gscConnected?: boolean;
  gscKeywords?: any[];
  isAnalyzing?: boolean;
  onRunAnalysis: () => void;
  onNavigate: (tab: PortalTab) => void;
};

type PriorityTask = {
  id: string;
  title: string;
  displayValue?: string;
  priority: 'høy' | 'middels';
  category: string;
};

type ActivityLog = {
  id?: string;
  action?: string;
  action_type?: string;
  title?: string;
  details?: any;
  created_at?: string;
};

const highPriorityAudits = new Set([
  'largest-contentful-paint',
  'unused-javascript',
  'render-blocking-resources',
  'uses-optimized-images',
]);

const mediumPriorityAudits = new Set([
  'meta-description',
  'image-alt',
  'document-title',
]);

const getDomain = (value: string) => {
  if (!value) return 'nettsiden din';
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '');
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || 'nettsiden din';
  }
};

const relativeTime = (iso?: string) => {
  if (!iso) return 'ikke analysert ennå';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60000) return 'akkurat nå';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} timer siden`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'i går';
  return `${days}d siden`;
};

const formatNumber = (value: number) => value.toLocaleString('nb-NO');

const cardClass = 'rounded-xl border border-[#D8D8D2] bg-white p-5 shadow-none';

const formatLastAnalysis = (iso?: string) => {
  if (!iso) return 'ikke analysert ennå';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return relativeTime(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  return `${sameDay ? 'i dag' : date.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}, ${time}`;
};

const dedupeLogs = (rows: ActivityLog[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const ts = new Date(row.created_at || '').getTime();
    const minute = Number.isFinite(ts) ? Math.floor(ts / 60000) : 0;
    const key = `${row.action || row.action_type || row.title || ''}|${minute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const readableAction = (log: ActivityLog) => {
  const action = log.action || (log as any).action_type || '';
  const details = log.details || {};
  if ((log as any).title) return (log as any).title;
  if (action === 'analysis_run') {
    const score = details.technical_score ?? details.mobile_score ?? details.score;
    return `Analyse fullført${score != null ? ` · Teknisk score ${score}` : ''}`;
  }
  if (action === 'keyword_check') return 'Søkeord sjekket';
  if (action === 'keyword_added') return 'Søkeord lagt til';
  if (action === 'gsc_connected') return 'Google Search Console koblet til';
  if (action === 'content_scan') return 'Innhold skannet';
  if (action === 'link_scan') return 'Lenker kartlagt';
  return action
    ? action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Hendelse registrert';
};

const readableActionDetail = (log: ActivityLog) => {
  const details = log.details || {};
  if (details.technical_score != null) return `Teknisk score ${details.technical_score}`;
  if (details.mobile_score != null) return `Teknisk score ${details.mobile_score}`;
  if (details.keyword) return `${details.keyword}${details.location ? ` · ${details.location}` : ''}`;
  if (details.total != null) return `${details.total} elementer`;
  if (details.total_pages != null) return `${details.total_pages} sider`;
  return '';
};

const extractTasks = (analysisResults?: any | null): PriorityTask[] => {
  const opportunities = analysisResults?.mobile?.opportunities;
  if (!Array.isArray(opportunities)) return [];

  return opportunities.slice(0, 6).map((audit: any, index: number) => {
    const id = audit.id || audit.title || `task-${index}`;
    return {
      id,
      title: audit.title || id,
      displayValue: audit.savings || audit.displayValue,
      priority: highPriorityAudits.has(id) ? 'høy' as const : 'middels' as const,
      category: mediumPriorityAudits.has(id) ? 'Teknisk' : 'PageSpeed',
    };
  });
};

const SmallPeriodSwitch = ({
  value,
  onChange,
  dark = false,
}: {
  value: number;
  onChange: (value: number) => void;
  dark?: boolean;
}) => (
  <div className="inline-flex gap-1">
    {[
      { label: '1m', value: 30 },
      { label: '2m', value: 60 },
      { label: '3m', value: 90 },
    ].map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
          dark
            ? value === option.value
              ? 'bg-white/10 font-medium text-white'
              : 'font-medium text-white/30 hover:text-white/60'
            : value === option.value
              ? 'font-semibold text-slate-900'
              : 'font-medium text-slate-300 hover:text-slate-500'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const ScoreCard = ({
  label,
  score,
  data,
  delta,
  period,
  setPeriod,
}: {
  label: string;
  score: number | null;
  data: { v: number }[];
  delta: number | null;
  period: number;
  setPeriod: (value: number) => void;
}) => (
  <div className={cardClass}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <SmallPeriodSwitch value={period} onChange={setPeriod} />
    </div>
    <div className="mb-2 mt-4 flex items-baseline gap-1.5">
      <span className="text-4xl font-semibold leading-none tracking-tight text-slate-900">{score ?? '—'}</span>
      <span className="text-sm font-normal text-slate-400">/100</span>
      {delta != null && delta !== 0 && (
        <span className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${delta > 0 ? 'bg-[#EDF7EF] text-[#2F6F46]' : 'bg-rose-50 text-rose-500'}`}>
          {delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`}
        </span>
      )}
    </div>
    <div className="h-12">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis hide domain={[0, 100]} />
            <Tooltip cursor={false} />
            <Line type="monotone" dataKey="v" stroke="#18181B" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-xl bg-[#F7F7F5] text-[10px] font-normal text-slate-400">
          Kjør en analyse for å se data
        </div>
      )}
    </div>
    <p className="mt-2 text-[10px] font-normal text-slate-400">health_checks · siste rad</p>
  </div>
);

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  user,
  clientData,
  formData,
  analysisResults,
  scoreHistory = [],
  siktActions = [],
  realRankings = [],
  gscConnected = false,
  gscKeywords = [],
  isAnalyzing = false,
  onRunAnalysis,
  onNavigate,
}) => {
  const [chartPeriod, setChartPeriod] = useState(30);
  const [technicalPeriod, setTechnicalPeriod] = useState(30);
  const [visibilityPeriod, setVisibilityPeriod] = useState(30);

  const technicalScore = analysisResults
    ? Math.round((
        (analysisResults.mobile?.performance ?? 0)
        + (analysisResults.mobile?.seo ?? 0)
        + (analysisResults.mobile?.bestPractices ?? 0)
        + (analysisResults.mobile?.accessibility ?? 0)
      ) / 4)
    : null;

  const visibilityScore: number | null = (() => {
    if (!realRankings.length) return analysisResults?.mobile?.seo ?? null;
    const sum = realRankings.reduce((acc: number, row: any) => {
      const position = typeof row?.position === 'number' ? row.position : null;
      if (position == null) return acc + 10;
      if (position <= 3) return acc + 100;
      if (position <= 10) return acc + 80;
      if (position <= 20) return acc + 50;
      if (position <= 50) return acc + 25;
      return acc + 10;
    }, 0);
    return Math.round(sum / realRankings.length);
  })();

  const combinedScore = technicalScore != null && visibilityScore != null
    ? Math.round((technicalScore + visibilityScore) / 2)
    : technicalScore ?? visibilityScore;

  const allTrendData = useMemo(
    () => scoreHistory.slice(-chartPeriod).map((row) => ({ v: Math.round(((row.mobilePerf ?? 0) + (row.mobileSeo ?? 0)) / 2) })),
    [scoreHistory, chartPeriod],
  );
  const technicalTrend = useMemo(
    () => scoreHistory.slice(-technicalPeriod).map((row) => ({ v: row.mobilePerf ?? 0 })),
    [scoreHistory, technicalPeriod],
  );
  const visibilityTrend = useMemo(
    () => scoreHistory.slice(-visibilityPeriod).map((row) => ({ v: row.mobileSeo ?? 0 })),
    [scoreHistory, visibilityPeriod],
  );

  const weekDelta = useMemo(() => {
    if (technicalScore == null || scoreHistory.length < 2) return null;
    const latestDate = new Date(scoreHistory[scoreHistory.length - 1]?.at || '').getTime();
    const sevenDaysAgo = Number.isFinite(latestDate) ? latestDate - 7 * 24 * 60 * 60 * 1000 : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const reference = [...scoreHistory].reverse().find((row) => new Date(row.at).getTime() <= sevenDaysAgo)
      || scoreHistory[Math.max(0, scoreHistory.length - 2)];
    if (!reference) return null;
    const referenceScore = Math.round(((reference.mobilePerf ?? 0) + (reference.mobileSeo ?? 0)) / 2);
    return combinedScore != null ? combinedScore - referenceScore : null;
  }, [combinedScore, scoreHistory, technicalScore]);

  const technicalDelta = useMemo(() => {
    if (scoreHistory.length < 2) return null;
    const latest = scoreHistory[scoreHistory.length - 1]?.mobilePerf;
    const previous = scoreHistory[scoreHistory.length - 2]?.mobilePerf;
    if (typeof latest !== 'number' || typeof previous !== 'number') return null;
    return Math.round(latest - previous);
  }, [scoreHistory]);

  const visibilityDelta = useMemo(() => {
    if (scoreHistory.length < 2) return null;
    const latest = scoreHistory[scoreHistory.length - 1]?.mobileSeo;
    const previous = scoreHistory[scoreHistory.length - 2]?.mobileSeo;
    if (typeof latest !== 'number' || typeof previous !== 'number') return null;
    return Math.round(latest - previous);
  }, [scoreHistory]);

  const tasks = useMemo(() => extractTasks(analysisResults), [analysisResults]);
  const domain = getDomain(formData?.websiteUrl || clientData?.websiteUrl || clientData?.website_url || '');
  const latestAt = scoreHistory[scoreHistory.length - 1]?.at;
  const clicks = gscKeywords.reduce((sum: number, row: any) => sum + Number(row.clicks || 0), 0);
  const impressions = gscKeywords.reduce((sum: number, row: any) => sum + Number(row.impressions || 0), 0);
  const logs = dedupeLogs(siktActions as ActivityLog[]).slice(0, 7);

  if (isAnalyzing && !analysisResults) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-5xl items-center justify-center bg-[#F7F7F5] font-['DM_Sans',sans-serif]">
        <div className="inline-flex items-center gap-3 rounded-xl border border-[#E5E5E3] bg-white p-5 shadow-none">
          <Loader2 size={18} className="animate-spin text-slate-900" />
          <span className="text-sm font-normal text-slate-600">Henter dashboard-data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col bg-[#F7F7F5] font-['DM_Sans',sans-serif] text-slate-900">
      <div className="mb-4 flex h-10 items-center justify-between border-b border-[#E1E1DD]">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900">Dashboard</span>
          <span className="text-xs font-medium text-slate-400">{domain}</span>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="w-72 rounded-lg border border-[#E1E1DD] bg-white px-3 py-2 text-xs text-slate-400">
            Søk eller hopp til ...
          </div>
          <button
            type="button"
            onClick={onRunAnalysis}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[#E1E1DD] bg-white text-slate-500 hover:text-slate-900"
            aria-label="Kjør ny analyse"
          >
            <RefreshCw size={13} />
          </button>
          <div className="h-8 w-8 rounded-full bg-[#E7E6DF]" />
        </div>
      </div>

      <section className="mb-5">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#1C1C1F]">
              Slik står det til med {domain}
            </h1>
            <p className="mt-2 text-sm font-normal text-slate-400">
              Siste analyse: {formatLastAnalysis(latestAt)} · {scoreHistory.length} målinger i historikk
            </p>
          </div>
          <button
            type="button"
            onClick={onRunAnalysis}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#18181B] px-5 py-3 text-sm font-medium text-white shadow-none transition-colors hover:bg-[#18181B]/90"
          >
            <RefreshCw size={14} />
            Kjør ny analyse
          </button>
        </div>

        <div className="rounded-xl bg-[#18181B] p-6 text-white shadow-none">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.25fr_0.35fr] lg:items-center">
            <div className="lg:border-r lg:border-white/10 lg:pr-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/35">Samlet score</p>
              <div className="flex items-end gap-2">
                <span className="text-[72px] font-semibold leading-[0.85] tracking-[-0.06em] text-white">{combinedScore ?? '—'}</span>
                <span className="pb-1 text-2xl font-normal text-white/45">/100</span>
              </div>
              {weekDelta != null && (
                <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${weekDelta >= 0 ? 'bg-[#E6F2EA] text-[#2F6F46]' : 'bg-rose-50 text-rose-500'}`}>
                  {weekDelta >= 0 ? `↑ +${weekDelta}` : `↓ ${Math.abs(weekDelta)}`} siste uke
                </span>
              )}
              <p className="mt-4 text-xs font-medium text-white/45">
                Basert på Lighthouse-teknisk · siste kjøring {formatLastAnalysis(latestAt)}
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium text-white/45">Trend siste {allTrendData.length || 0} målinger</p>
              <div className="h-28">
                {allTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={allTrendData}>
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip cursor={false} />
                      <Line type="monotone" dataKey="v" stroke="#89B49F" strokeWidth={2.25} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-normal text-white/40">
                    Kjør en analyse for å se data
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-start lg:justify-end">
              <div className="rounded-lg border border-white/50 p-1">
                <SmallPeriodSwitch value={chartPeriod} onChange={setChartPeriod} dark />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ScoreCard label="Teknisk" score={technicalScore} data={technicalTrend} delta={technicalDelta} period={technicalPeriod} setPeriod={setTechnicalPeriod} />
        <ScoreCard label="Synlighet" score={visibilityScore} data={visibilityTrend} delta={visibilityDelta} period={visibilityPeriod} setPeriod={setVisibilityPeriod} />

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-slate-500">Search<br />Console</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F1EC] px-2.5 py-1 text-[11px] font-normal text-slate-600">
              <span className={`h-1.5 w-1.5 rounded-full ${gscConnected ? 'bg-[#16a34a]' : 'bg-slate-300'}`} />
              {gscConnected ? 'tilkoblet' : 'ikke koblet'}
            </span>
          </div>
          {gscConnected ? (
            <>
              <p className="mt-4 text-xs font-normal text-slate-400">Klikk · 28d</p>
              <p className="mb-2 mt-2 text-4xl font-semibold leading-none tracking-tight text-slate-900">{formatNumber(clicks)}</p>
              <p className="text-xs font-normal text-slate-400">{formatNumber(impressions)} visninger</p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="mt-4 text-sm font-normal text-slate-500 transition-colors hover:text-slate-900"
            >
              Koble til GSC
            </button>
          )}
        </div>

        <div className={`${cardClass} opacity-70`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">GEO</p>
            <span className="inline-flex items-center rounded-full bg-[#F0F1EC] px-2.5 py-1 text-[11px] font-normal text-slate-400">
              Kommer
            </span>
          </div>
          <p className="mb-2 mt-6 text-4xl font-semibold leading-none tracking-tight text-slate-300">—</p>
          <p className="mt-6 text-sm font-normal leading-6 text-slate-400">
            AI-synlighet i ChatGPT, Perplexity og Gemini. Lansering Q3.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className={`lg:col-span-3 ${cardClass}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prioriterte oppgaver</h2>
              <span className="rounded-full bg-[#F0F1EC] px-2 py-1 text-[11px] font-medium text-slate-600">{tasks.length} totalt</span>
            </div>
            <span className="text-xs font-normal text-slate-500">Sortér: prioritet ↓</span>
          </div>

          {!analysisResults ? (
            <div className="rounded-xl border border-[#E5E5E3] bg-[#F7F7F5] p-5 text-center">
              <p className="text-sm font-medium text-slate-800">Kjør analyse for å se oppgaver</p>
              <button
                type="button"
                onClick={onRunAnalysis}
                className="mt-4 rounded-lg bg-[#18181B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#18181B]/90"
              >
                Kjør analyse
              </button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-[#E5E5E3] bg-[#F7F7F5] p-5 text-center">
              <p className="text-sm font-medium text-slate-800">Alt ser bra ut!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onNavigate('visibility')}
                  className="rounded-xl border border-[#E5E5E3] bg-white p-4 text-left transition-colors hover:bg-[#FAFAF7]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${task.priority === 'høy' ? 'bg-orange-50 text-orange-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${task.priority === 'høy' ? 'bg-orange-500' : 'bg-yellow-400'}`} />
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">{task.category}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-5 text-slate-800">{task.title}</p>
                  {task.displayValue && <p className="mt-1 text-xs font-normal text-slate-400">Sparing: {task.displayValue}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`lg:col-span-2 ${cardClass}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Siste hendelser</h2>
          </div>
          {logs.length === 0 ? (
            <div className="rounded-xl border border-[#E5E5E3] bg-[#F7F7F5] p-5 text-center">
              <p className="text-sm font-normal text-slate-600">Ingen hendelser ennå</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E8E8E2]">
              {logs.map((log, index) => (
                <li key={log.id || `${log.action}-${index}`} className="flex gap-3 py-3 first:pt-0">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F0F1EC] text-[11px] text-slate-500">
                    {index === 0 ? '✓' : index === 1 ? '↑' : index === 2 ? '↻' : '•'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-5 text-slate-700">{readableAction(log)}</p>
                    <p className="mt-0.5 text-xs font-normal text-slate-400">
                      {[readableActionDetail(log), relativeTime(log.created_at)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onNavigate('log')}
            className="mt-5 text-sm font-normal text-slate-500 transition-colors hover:text-slate-900"
          >
            Se alle hendelser →
          </button>
        </div>
      </section>
    </div>
  );
};

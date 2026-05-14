import React, { useMemo, useState } from 'react';
import {
  Check,
  Globe,
  Lightbulb,
  Loader2,
  Mail,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';

type PortalTab =
  | 'home'
  | 'visibility'
  | 'keywords'
  | 'competitors'
  | 'geo'
  | 'workshop'
  | 'log'
  | 'settings';

type DashboardHomeProps = {
  user: any;
  clientData: any;
  formData?: any;
  analysisResults?: any | null;
  scoreHistory?: {
    at: string;
    mobilePerf: number;
    mobileSeo: number;
    desktopPerf: number;
  }[];
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
    return new URL(value.startsWith('http') ? value : `https://${value}`)
      .hostname.replace(/^www\./i, '');
  } catch {
    return (
      value
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0] || 'nettsiden din'
    );
  }
};

const relativeTime = (iso?: string) => {
  if (!iso) return 'ikke analysert ennå';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60000) return 'akkurat nå';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `for ${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}t`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'i går';
  return `${days}d`;
};

const formatNumber = (n: number) => n.toLocaleString('nb-NO');

const formatLastAnalysis = (iso?: string) => {
  if (!iso) return 'ikke analysert ennå';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return relativeTime(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${sameDay ? 'i dag' : d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}, ${time}`;
};

const filterHistoryByDays = (
  rows: { at: string; mobilePerf: number; mobileSeo: number; desktopPerf: number }[],
  days: number,
) => {
  if (!rows.length) return [];
  const latest = new Date(rows[rows.length - 1]?.at || '').getTime();
  const now = Number.isFinite(latest) ? latest : Date.now();
  const cutoff = now - days * 86_400_000;
  return rows.filter((row) => {
    const ts = new Date(row.at || '').getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
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
  const action = log.action || log.action_type || '';
  const details = log.details || {};
  if (log.title) return log.title;
  if (action === 'analysis_run') {
    const score =
      details.technical_score ?? details.mobile_score ?? details.score;
    return `Analyse fullført${score != null ? '' : ''}`;
  }
  if (action === 'keyword_check') return 'Ny posisjon registrert';
  if (action === 'keyword_added') return 'Søkeord lagt til';
  if (action === 'gsc_connected') return 'Google Search Console synket';
  if (action === 'content_scan') return 'Ny anbefaling generert';
  if (action === 'link_scan') return 'Lenker kartlagt';
  if (action === 'report_sent') return 'Ukentlig rapport sendt';
  return action
    ? action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Hendelse registrert';
};

const readableActionDetail = (log: ActivityLog) => {
  const action = log.action || log.action_type || '';
  const details = log.details || {};
  if (action === 'analysis_run') {
    const score =
      details.technical_score ?? details.mobile_score ?? details.score;
    return score != null ? `Teknisk score ${score}` : '';
  }
  if (action === 'keyword_check' && details.keyword) {
    const from = details.previous_position ?? details.from;
    const to = details.position ?? details.to;
    return from && to
      ? `«${details.keyword}» ${from} → ${to}`
      : `«${details.keyword}»`;
  }
  if (action === 'gsc_connected' || action === 'gsc_sync') {
    const views = details.impressions ?? details.total_impressions;
    return views != null
      ? `${formatNumber(Math.round(views / 1000))}k visninger siste 28d`
      : '';
  }
  if (action === 'content_scan' && details.audit) {
    return `${details.audit}${details.page ? ` på ${details.page}` : ''}`;
  }
  if (action === 'report_sent') {
    const count = details.recipients ?? details.count;
    return count != null ? `til ${count} mottakere` : '';
  }
  if (details.keyword)
    return `${details.keyword}${details.location ? ` · ${details.location}` : ''}`;
  if (details.total != null) return `${details.total} elementer`;
  if (details.total_pages != null) return `${details.total_pages} sider`;
  return '';
};

const getEventIcon = (log: ActivityLog, index: number) => {
  const action = log.action || log.action_type || '';
  if (action.includes('analysis') || action.includes('health'))
    return Check;
  if (action.includes('keyword') || action.includes('position'))
    return TrendingUp;
  if (action.includes('gsc') || action.includes('search_console'))
    return Globe;
  if (
    action.includes('content') ||
    action.includes('recommendation') ||
    action.includes('anbefaling')
  )
    return Lightbulb;
  if (action.includes('report') || action.includes('rapport'))
    return Mail;
  const fallback = [Check, TrendingUp, Globe, Lightbulb, Mail];
  return fallback[index % fallback.length];
};

const extractAuditTasks = (
  analysisResults?: any | null,
): PriorityTask[] => {
  const opportunities = analysisResults?.mobile?.opportunities;
  if (!Array.isArray(opportunities)) return [];
  return opportunities.slice(0, 4).map((audit: any, i: number) => {
    const id = audit.id || audit.title || `task-${i}`;
    return {
      id,
      title: audit.title || id,
      displayValue: audit.savings || audit.displayValue,
      priority: highPriorityAudits.has(id)
        ? ('høy' as const)
        : ('middels' as const),
      category: mediumPriorityAudits.has(id) ? 'Teknisk' : 'PageSpeed',
    };
  });
};

const extractKeywordTasks = (rankings: any[]): PriorityTask[] => {
  if (!rankings.length) return [];
  return rankings
    .filter(
      (r: any) =>
        typeof r.position === 'number' && r.position > 10 && r.position <= 50,
    )
    .slice(0, 4)
    .map((r: any) => ({
      id: `kw-${r.keyword || r.id}`,
      title: `«${r.keyword}» på posisjon ${r.position}`,
      displayValue: r.position <= 20 ? 'Lavt hengende frukt' : 'Potensial for topp 10',
      priority: 'middels' as const,
      category: 'Søkeord',
    }));
};

/* ── Period switcher ──────────────────────────────────────────────── */
const periodOptions = [
  { label: '1m', value: 30 },
  { label: '2m', value: 60 },
  { label: '3m', value: 90 },
] as const;

const PeriodSwitch = ({
  value,
  onChange,
  dark = false,
}: {
  value: number;
  onChange: (v: number) => void;
  dark?: boolean;
}) => (
  <div
    className={`inline-flex rounded-md ${
      dark
        ? 'border border-white/20'
        : 'border border-[#E2DFD5] bg-[#F6F5EF]'
    }`}
  >
    {periodOptions.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
          dark
            ? value === o.value
              ? 'bg-white/10 text-white'
              : 'text-white/55 hover:text-white/80'
            : value === o.value
              ? 'bg-white text-[#1C1C1F] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-[#A09E94] hover:text-[#6B6A60]'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/* ── Score card (Teknisk / Synlighet) ─────────────────────────────── */
const ScoreCard = ({
  label,
  score,
  data,
  delta,
  period,
  setPeriod,
  gradientId,
}: {
  label: string;
  score: number | null;
  data: { v: number }[];
  delta: number | null;
  period: number;
  setPeriod: (v: number) => void;
  gradientId: string;
}) => (
  <div className="rounded-xl border border-[#E7E4DA] bg-[#FFFDF8] p-5 shadow-[0_1px_2px_rgba(28,28,24,0.04)]">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8880]">
        {label}
      </p>
      <PeriodSwitch value={period} onChange={setPeriod} />
    </div>

    <div className="mb-3 mt-5 flex items-baseline gap-1.5">
      <span className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-[#1C1C1F]">
        {score ?? '—'}
      </span>
      <span className="text-base font-normal text-[#B5B3AA]">/100</span>
      {delta != null && delta !== 0 && (
        <span
          className={`ml-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            delta > 0
              ? 'bg-[#EAF4ED] text-[#2F6F46]'
              : 'bg-[#FDF2F2] text-[#C53030]'
          }`}
        >
          {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
        </span>
      )}
    </div>

    <div className="h-12">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6B9E82" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6B9E82" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, 100]} />
            <Tooltip cursor={false} />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#5A8E6E"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-lg bg-[#F4F3ED] text-[10px] text-[#A09E94]">
          Kjør en analyse for å se data
        </div>
      )}
    </div>

    <p className="mt-2.5 text-[10px] font-medium text-[#B5B3AA]">
      health_checks · siste rad
    </p>
  </div>
);

/* ── Main component ───────────────────────────────────────────────── */
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
  const [techPeriod, setTechPeriod] = useState(30);
  const [visPeriod, setVisPeriod] = useState(30);

  const technicalScore = analysisResults
    ? Math.round(
        ((analysisResults.mobile?.performance ?? 0) +
          (analysisResults.mobile?.seo ?? 0) +
          (analysisResults.mobile?.bestPractices ?? 0) +
          (analysisResults.mobile?.accessibility ?? 0)) /
          4,
      )
    : null;

  const visibilityScore: number | null = (() => {
    if (!realRankings.length) return analysisResults?.mobile?.seo ?? null;
    const sum = realRankings.reduce((acc: number, row: any) => {
      const p = typeof row?.position === 'number' ? row.position : null;
      if (p == null) return acc + 10;
      if (p <= 3) return acc + 100;
      if (p <= 10) return acc + 80;
      if (p <= 20) return acc + 50;
      if (p <= 50) return acc + 25;
      return acc + 10;
    }, 0);
    return Math.round(sum / realRankings.length);
  })();

  const combinedScore =
    technicalScore != null && visibilityScore != null
      ? Math.round((technicalScore + visibilityScore) / 2)
      : (technicalScore ?? visibilityScore);

  const allTrendData = useMemo(
    () =>
      filterHistoryByDays(scoreHistory, chartPeriod)
        .map((r) => ({
          v: Math.round(((r.mobilePerf ?? 0) + (r.mobileSeo ?? 0)) / 2),
        })),
    [scoreHistory, chartPeriod],
  );
  const techTrend = useMemo(
    () =>
      filterHistoryByDays(scoreHistory, techPeriod)
        .map((r) => ({ v: r.mobilePerf ?? 0 })),
    [scoreHistory, techPeriod],
  );
  const visTrend = useMemo(
    () =>
      filterHistoryByDays(scoreHistory, visPeriod)
        .map((r) => ({ v: r.mobileSeo ?? 0 })),
    [scoreHistory, visPeriod],
  );

  const weekDelta = useMemo(() => {
    if (combinedScore == null || scoreHistory.length < 2) return null;
    const latestMs = new Date(
      scoreHistory[scoreHistory.length - 1]?.at || '',
    ).getTime();
    const sevenAgo = Number.isFinite(latestMs)
      ? latestMs - 7 * 86_400_000
      : Date.now() - 7 * 86_400_000;
    const ref =
      [...scoreHistory]
        .reverse()
        .find((r) => new Date(r.at).getTime() <= sevenAgo) ||
      scoreHistory[Math.max(0, scoreHistory.length - 2)];
    if (!ref) return null;
    const refScore = Math.round(
      ((ref.mobilePerf ?? 0) + (ref.mobileSeo ?? 0)) / 2,
    );
    return combinedScore - refScore;
  }, [combinedScore, scoreHistory]);

  const techDelta = useMemo(() => {
    if (scoreHistory.length < 2) return null;
    const a = scoreHistory[scoreHistory.length - 1]?.mobilePerf;
    const b = scoreHistory[scoreHistory.length - 2]?.mobilePerf;
    return typeof a === 'number' && typeof b === 'number'
      ? Math.round(a - b)
      : null;
  }, [scoreHistory]);

  const visDelta = useMemo(() => {
    if (scoreHistory.length < 2) return null;
    const a = scoreHistory[scoreHistory.length - 1]?.mobileSeo;
    const b = scoreHistory[scoreHistory.length - 2]?.mobileSeo;
    return typeof a === 'number' && typeof b === 'number'
      ? Math.round(a - b)
      : null;
  }, [scoreHistory]);

  const tasks = useMemo(() => {
    const audit = extractAuditTasks(analysisResults);
    const kw = extractKeywordTasks(realRankings);
    return [...audit, ...kw].slice(0, 6);
  }, [analysisResults, realRankings]);

  const domain = getDomain(
    formData?.websiteUrl ||
      clientData?.websiteUrl ||
      clientData?.website_url ||
      '',
  );
  const latestAt = scoreHistory[scoreHistory.length - 1]?.at;
  const clicks = gscKeywords.reduce(
    (s: number, r: any) => s + Number(r.clicks || 0),
    0,
  );
  const impressions = gscKeywords.reduce(
    (s: number, r: any) => s + Number(r.impressions || 0),
    0,
  );
  const logs = dedupeLogs(siktActions as ActivityLog[]).slice(0, 5);

  /* ── Loading state ──────────────────────────────────────────────── */
  if (isAnalyzing && !analysisResults) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-5xl items-center justify-center bg-[#F4F3ED] font-['DM_Sans',sans-serif]">
        <div className="inline-flex items-center gap-3 rounded-xl border border-[#E7E4DA] bg-[#FFFDF8] px-6 py-4">
          <Loader2 size={18} className="animate-spin text-[#1C1C1F]" />
          <span className="text-sm text-[#6B6A60]">
            Henter dashboard-data…
          </span>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5 bg-[#F4F3ED] px-5 py-4 font-['DM_Sans',sans-serif] text-[#1C1C1F]">
      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold text-[#1C1C1F]">
            Dashboard
          </span>
          <span className="text-xs font-medium text-[#A09E94]">
            {domain}
          </span>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="w-64 rounded-lg border border-[#E2DFD5] bg-[#FFFDF8] px-3 py-2 text-xs text-[#B5B3AA]">
            Søk eller hopp til …
          </div>
          <button
            type="button"
            onClick={onRunAnalysis}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[#E2DFD5] bg-[#FFFDF8] text-[#8A8880] transition-[transform,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#1C1C1F] active:scale-[0.97]"
            aria-label="Kjør ny analyse"
          >
            <RefreshCw size={13} />
          </button>
          <div className="h-8 w-8 rounded-full bg-[#E7E4DA]" />
        </div>
      </div>

      {/* ── Heading ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-[#1C1C1F]">
            Slik står det til med {domain}
          </h1>
          <p className="mt-1.5 text-[13px] text-[#8A8880]">
            Siste analyse: {formatLastAnalysis(latestAt)} ·{' '}
            {scoreHistory.length} målinger i historikk
          </p>
        </div>
        <button
          type="button"
          onClick={onRunAnalysis}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#1C1C1F] px-5 py-3 text-[13px] font-medium text-white transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#2A2A2D] active:scale-[0.97]"
        >
          <RefreshCw size={13} />
          Kjør ny analyse
        </button>
      </div>

      {/* ── SAMLET SCORE (dark card) ────────────────────────────────── */}
      <section
        className="rounded-[12px] border border-white/10 bg-[#111211] px-6 py-6 text-white shadow-[0_14px_36px_rgba(0,0,0,0.32)]"
        style={{ backgroundColor: '#111211' }}
      >
        <div className="flex min-h-[126px] flex-col gap-6 lg:flex-row lg:items-center lg:gap-0">
          {/* Left: score */}
          <div className="lg:w-[326px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8F8F89]">
              Samlet score
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[78px] font-bold leading-[0.8] tracking-[-0.065em] text-[#F7F6F0]">
                {combinedScore ?? '—'}
              </span>
              <span className="pb-1.5 text-[22px] font-normal text-white/40">
                /100
              </span>
              {weekDelta != null && (
                <span
                  className={`mb-2 ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                    weekDelta >= 0
                      ? 'bg-[#DDECE1] text-[#2A6B42]'
                      : 'bg-[#FDF2F2] text-[#C53030]'
                  }`}
                >
                  {weekDelta >= 0 ? '↑' : '↓'} {weekDelta >= 0 ? '+' : ''}
                  {weekDelta} siste uke
                </span>
              )}
            </div>
            <p className="mt-4 text-[11px] font-medium leading-none text-white/40">
              Basert på Lighthouse-teknisk · siste kjøring{' '}
              {formatLastAnalysis(latestAt)}
            </p>
          </div>

          <div className="hidden h-[88px] w-px bg-white/10 lg:block" />

          {/* Right: trend chart */}
          <div className="flex flex-1 flex-col gap-4 lg:ml-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:w-[352px]">
              <p className="mb-3 text-[12px] font-medium text-white/40">
                Trend siste {allTrendData.length} målinger
              </p>
              <div className="h-[78px]">
                {allTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={allTrendData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient
                          id="heroGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#8FC0A5"
                            stopOpacity={0.32}
                          />
                          <stop
                            offset="100%"
                            stopColor="#111211"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={[0, 100]} />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#9ACDB3"
                        strokeWidth={2}
                        fill="url(#heroGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/30">
                    Kjør en analyse for å se data
                  </div>
                )}
              </div>
            </div>

            <div className="lg:mr-0">
              <PeriodSwitch
                value={chartPeriod}
                onChange={setChartPeriod}
                dark
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Four metric cards ───────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ScoreCard
          label="Teknisk"
          score={technicalScore}
          data={techTrend}
          delta={techDelta}
          period={techPeriod}
          setPeriod={setTechPeriod}
          gradientId="techGrad"
        />
        <ScoreCard
          label="Synlighet"
          score={visibilityScore}
          data={visTrend}
          delta={visDelta}
          period={visPeriod}
          setPeriod={setVisPeriod}
          gradientId="visGrad"
        />

        {/* Search Console */}
        <div className="rounded-xl border border-[#E7E4DA] bg-[#FFFDF8] p-5 shadow-[0_1px_2px_rgba(28,28,24,0.04)]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-[#8A8880]">
              Search
              <br />
              Console
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E2DFD5] bg-[#F6F5EF] px-2.5 py-1 text-[11px] font-medium text-[#6B6A60]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  gscConnected ? 'bg-[#3D9A5A]' : 'bg-[#C4C3BB]'
                }`}
              />
              {gscConnected ? 'tilkoblet' : 'ikke koblet'}
            </span>
          </div>

          {gscConnected ? (
            <>
              <p className="mt-4 text-[11px] font-medium text-[#B5B3AA]">
                Klikk · 28d
              </p>
              <p className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.04em] text-[#1C1C1F]">
                {formatNumber(clicks)}
              </p>
              <p className="mt-2 text-xs text-[#A09E94]">
                {formatNumber(impressions)} visninger
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="mt-5 text-[13px] font-medium text-[#6B6A60] transition-colors hover:text-[#1C1C1F]"
            >
              Koble til GSC →
            </button>
          )}
        </div>

        {/* GEO */}
        <div className="rounded-xl border border-[#E7E4DA] bg-[#FFFDF8] p-5 opacity-70 shadow-[0_1px_2px_rgba(28,28,24,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8880]">
              GEO
            </p>
            <span className="inline-flex items-center rounded-full border border-[#E2DFD5] bg-[#F6F5EF] px-2.5 py-1 text-[11px] font-medium text-[#A09E94]">
              Kommer
            </span>
          </div>
          <p className="mt-6 text-[40px] font-semibold leading-none tracking-[-0.04em] text-[#D0CECC]">
            —
          </p>
          <p className="mt-4 text-[12px] leading-relaxed text-[#A09E94]">
            AI-synlighet i ChatGPT, Perplexity og Gemini. Lansering Q3.
          </p>
        </div>
      </section>

      {/* ── Bottom grid: tasks + events ─────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Prioriterte oppgaver */}
        <div className="flex flex-col rounded-xl border border-[#E7E4DA] bg-[#FFFDF8] p-5 shadow-[0_1px_2px_rgba(28,28,24,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8880]">
                Prioriterte oppgaver
              </h2>
              <span className="rounded-full border border-[#E2DFD5] bg-[#F6F5EF] px-2.5 py-0.5 text-[11px] font-medium text-[#6B6A60]">
                {tasks.length} totalt
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#A09E94]">
              Sortér: prioritet ↓
            </span>
          </div>

          {!analysisResults && !realRankings.length ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[#E7E4DA] bg-[#F4F3ED] p-8 text-center">
              <p className="text-sm font-medium text-[#6B6A60]">
                Kjør analyse for å se oppgaver
              </p>
              <button
                type="button"
                onClick={onRunAnalysis}
                className="mt-4 rounded-lg bg-[#1C1C1F] px-4 py-2 text-[13px] font-medium text-white transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#2A2A2D] active:scale-[0.97]"
              >
                Kjør analyse
              </button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-[#E7E4DA] bg-[#F4F3ED] p-8 text-center">
              <p className="text-sm font-medium text-[#6B6A60]">
                Alt ser bra ut!
              </p>
            </div>
          ) : (
            <>
              <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2">
                {tasks.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onNavigate('visibility')}
                    className="rounded-xl border border-[#E7E4DA] bg-[#FFFDF8] p-4 text-left transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#F6F5EF] active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          t.priority === 'høy'
                            ? 'bg-[#FFF3E8] text-[#C05621]'
                            : 'bg-[#F0F2E6] text-[#5F6B2F]'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            t.priority === 'høy'
                              ? 'bg-[#DD6B20]'
                              : 'bg-[#8B9A3C]'
                          }`}
                        />
                        {t.priority}
                      </span>
                      <span className="text-[10px] font-medium text-[#B5B3AA]">
                        {t.category}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] font-semibold leading-snug text-[#1C1C1F]">
                      {t.title}
                    </p>
                    {t.displayValue && (
                      <p className="mt-1 text-[11px] text-[#A09E94]">
                        {t.displayValue}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              {tasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('visibility')}
                  className="mt-4 self-start text-[13px] font-medium text-[#8A8880] transition-colors hover:text-[#1C1C1F]"
                >
                  Vis alle {tasks.length} →
                </button>
              )}
            </>
          )}
        </div>

        {/* Siste hendelser */}
        <div className="flex flex-col rounded-xl border border-[#E7E4DA] bg-[#FFFDF8] p-5 shadow-[0_1px_2px_rgba(28,28,24,0.04)]">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#8A8880]">
            Siste hendelser
          </h2>

          {logs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-[#E7E4DA] bg-[#F4F3ED] p-8 text-center">
              <p className="text-sm text-[#8A8880]">
                Ingen hendelser ennå
              </p>
            </div>
          ) : (
            <ul className="flex flex-1 flex-col">
              {logs.map((log, i) => {
                const Icon = getEventIcon(log, i);
                const detail = readableActionDetail(log);
                const time = relativeTime(log.created_at);
                return (
                  <li
                    key={log.id || `${log.action}-${i}`}
                    className={`flex gap-3 py-3 ${
                      i > 0 ? 'border-t border-[#EBE9E0]' : ''
                    }`}
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F0EDDF]">
                      <Icon size={13} className="text-[#7B7455]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug text-[#1C1C1F]">
                        {readableAction(log)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#A09E94]">
                        {[detail, time].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => onNavigate('log')}
            className="mt-4 self-start text-[13px] font-medium text-[#8A8880] transition-colors hover:text-[#1C1C1F]"
          >
            Se alle hendelser →
          </button>
        </div>
      </section>
    </div>
  );
};

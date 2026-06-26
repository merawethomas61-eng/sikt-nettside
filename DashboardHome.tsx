import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
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
  XAxis,
  YAxis,
} from 'recharts';
import { formatChartDate, chartTooltipStyle } from './src/portalTheme';
import { SectionTitle } from './src/portalEditorial';

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
  geo?: { total: number; mentioned: number; byProvider: Record<string, { total: number; mentioned: number }>; lastCheckedAt?: string } | null;
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

// Lighthouse-mulighetene lagres med engelske titler (PSI svarer på engelsk, og
// opportunity-objektet i ClientPortal bærer kun `title`/`savings` — ingen slug-id).
// Vi oversetter derfor de faste opportunity-titlene; ukjente faller tilbake til engelsk.
const auditTitleNo: Record<string, string> = {
  'Eliminate render-blocking resources': 'Eliminer blokkerende ressurser',
  'Reduce unused JavaScript': 'Fjern ubrukt JavaScript',
  'Reduce unused CSS': 'Fjern ubrukte CSS-regler',
  'Properly size images': 'Tilpass bildestørrelser',
  'Efficiently encode images': 'Koding av bilder effektivt',
  'Serve images in next-gen formats': 'Bruk moderne bildeformater',
  'Defer offscreen images': 'Utsett lasting av bilder utenfor skjermen',
  'Reduce initial server response time': 'Reduser serverens responstid',
  'Minify JavaScript': 'Minifiser JavaScript',
  'Minify CSS': 'Minifiser CSS',
  'Enable text compression': 'Aktiver tekstkomprimering',
  'Avoid enormous network payloads': 'Unngå enorme nettverksbelastninger',
  'Avoid an excessive DOM size': 'Unngå for stor DOM-størrelse',
  'Preconnect to required origins': 'Forhåndskoble til viktige kilder',
  'Remove duplicate modules in JavaScript bundles': 'Fjern duplisert JavaScript',
  'Avoid serving legacy JavaScript to modern browsers': 'Fjern utdatert JavaScript',
  'Use video formats for animated content': 'Bruk video for animert innhold',
  'Largest Contentful Paint image was lazily loaded': 'LCP-bildet lastes for sent',
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
    const savings = typeof audit.savings === 'string' && audit.savings
      ? audit.savings.replace(/^Potential savings of\s*/i, 'Sparer ~')
      : undefined;
    return {
      id,
      title: auditTitleNo[audit.title] || audit.title || id,
      displayValue: savings,
      priority: highPriorityAudits.has(id)
        ? ('høy' as const)
        : ('middels' as const),
      category: mediumPriorityAudits.has(id) ? 'Teknisk' : 'Fart',
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
    role="group"
    aria-label="Tidsperiode for trend"
    className={`inline-flex gap-0.5 rounded-[9px] p-0.5 ${
      dark
        ? 'border border-white/15 bg-white/[0.06]'
        : 'border border-[color:var(--hair)] bg-[color:var(--subtle)]'
    }`}
  >
    {periodOptions.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`period-btn rounded-[7px] px-2.5 py-1 text-[11px] font-medium ${
          dark
            ? value === o.value
              ? 'bg-white/15 text-white'
              : 'text-white/45 hover:text-white/75'
            : value === o.value
              ? 'bg-white text-[color:var(--ink)] shadow-[0_1px_2px_rgba(26,24,18,0.07)]'
              : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
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
  data: { v: number; at?: string; label?: string }[];
  delta: number | null;
  period: number;
  setPeriod: (v: number) => void;
  gradientId: string;
}) => {
  const emptyScoreCopy =
    label === 'Teknisk'
      ? 'Måles ved første analyse'
      : label === 'Synlighet'
        ? 'Google sender søkeorddata ~1–2 uker etter tilkobling'
        : 'Ikke målt ennå';

  return (
  <div className="score-card rounded-[14px] border border-[color:var(--hair)] bg-white p-6">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
        {label}
      </p>
      <PeriodSwitch value={period} onChange={setPeriod} />
    </div>

    <div className="mb-3 mt-5">
      {score != null ? (
        <div className="flex items-baseline gap-1.5">
          <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[color:var(--ink)] tabular-nums">
            {score}
          </span>
          <span className="text-base font-normal text-[color:var(--faint)]">/100</span>
          {delta != null && delta !== 0 && (
            <span
              className={`ml-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                delta > 0
                  ? 'bg-[color:var(--inset)] text-[color:var(--green)]'
                  : 'bg-[color:var(--dangerbg)] text-[color:var(--danger)]'
              }`}
            >
              {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[13px] font-medium leading-snug text-[color:var(--muted)]">
          {emptyScoreCopy}
        </p>
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
            <XAxis dataKey="label" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeDasharray: '3 3' }}
              contentStyle={chartTooltipStyle}
              formatter={(v: any) => [v, 'Score']}
            />
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
        <div className="flex h-full items-center justify-center rounded-[10px] bg-[color:var(--subtle)] text-[10px] text-[color:var(--faint)]">
          Kjør en analyse for å se data
        </div>
      )}
    </div>

    <p className="mt-2.5 text-[10px] font-medium text-[color:var(--faint)]">
      {data.length > 0 ? `${data.length} målinger · siste ${data.length > 1 ? `${data.length} analyser` : 'analyse'}` : 'Ingen data ennå'}
    </p>
  </div>
  );
};

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
  geo = null,
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
          at: r.at,
          label: formatChartDate(r.at),
        })),
    [scoreHistory, chartPeriod],
  );
  const techTrend = useMemo(
    () =>
      filterHistoryByDays(scoreHistory, techPeriod)
        .map((r) => ({ v: r.mobilePerf ?? 0, at: r.at, label: formatChartDate(r.at) })),
    [scoreHistory, techPeriod],
  );
  const visTrend = useMemo(
    () =>
      filterHistoryByDays(scoreHistory, visPeriod)
        .map((r) => ({ v: r.mobileSeo ?? 0, at: r.at, label: formatChartDate(r.at) })),
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
      <div className="flex min-h-[420px] w-full items-center justify-center font-['Geist','DM_Sans',sans-serif]">
        <div className="inline-flex items-center gap-3 rounded-[12px] border border-[color:var(--hair)] bg-white px-6 py-4">
          <Loader2 size={18} className="animate-spin text-[color:var(--ink)]" />
          <span className="text-sm text-[color:var(--ink)]">
            Henter dashboard-data…
          </span>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="flex w-full flex-col gap-8 font-['Geist','DM_Sans',sans-serif] text-[color:var(--ink)]">
      {/* Emil Kowalski: stagger entry + custom easing CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dashFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dash-stagger { animation: dashFadeIn 280ms cubic-bezier(0.23, 1, 0.32, 1) both; }
        .dash-stagger-1 { animation-delay: 0ms; }
        .dash-stagger-2 { animation-delay: 60ms; }
        .dash-stagger-3 { animation-delay: 120ms; }
        .dash-stagger-4 { animation-delay: 180ms; }
        .dash-stagger-5 { animation-delay: 240ms; }

        .score-card {
          transition: border-color 180ms cubic-bezier(0.23, 1, 0.32, 1),
                      box-shadow 180ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .score-card:hover {
            border-color: #D8D2C5;
            box-shadow: 0 1px 2px rgba(26,24,18,0.04), 0 10px 24px -16px rgba(26,24,18,0.18);
          }
        }

        .period-btn {
          transition: color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                      background-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                      border-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                      box-shadow 150ms cubic-bezier(0.23, 1, 0.32, 1),
                      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .period-btn:active { transform: scale(0.95); }

        .nav-btn {
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
                      color 150ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .nav-btn:hover { color: #1A1A1A; }
        }
        .nav-btn:active { transform: scale(0.97); }

        .cta-btn {
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
                      background-color 150ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .cta-btn:hover { background-color: #2A2722; }
        }
        .cta-btn:active { transform: scale(0.97); }

        .task-card {
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
                      border-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                      background-color 150ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .task-card:hover { background-color: #FAF8F3; border-color: #D8D2C5; }
        }
        .task-card:active { transform: scale(0.985); }

        .link-btn {
          transition: color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .link-btn:hover { color: #1A1A1A; }
        }
        .link-btn:active { transform: scale(0.97); }

        .gsc-btn {
          transition: color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .gsc-btn:hover { color: #1A1A1A; }
        }
        .gsc-btn:active { transform: scale(0.97); }
      `}} />
      {/* ── Toolbar: meta + primær handling ─────────────────────────── */}
      <div className="dash-stagger dash-stagger-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-[color:var(--muted)] tabular-nums">
          Siste analyse:{' '}
          <span className="font-medium text-[color:var(--ink)]">{formatLastAnalysis(latestAt)}</span>
          <span className="mx-1.5 text-[#D8D2C5]">·</span>
          {scoreHistory.length} målinger i historikk
        </p>
        <button
          type="button"
          onClick={onRunAnalysis}
          className="cta-btn inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[color:var(--btn-bg)] px-4 py-2.5 text-[13px] font-medium text-white"
        >
          <RefreshCw size={13} />
          Kjør ny analyse
        </button>
      </div>

      {/* ── SAMLET SCORE (primært kort) ─────────────────────────────── */}
      <section className="dash-stagger dash-stagger-2 rounded-[16px] border border-[color:var(--hair)] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(26,24,18,0.03),0_18px_40px_-28px_rgba(26,24,18,0.22)]">
        <div className="flex min-h-[118px] flex-col gap-6 md:flex-row md:items-center md:gap-0">
          {/* Left: score */}
          <div className="shrink-0 md:w-[min(100%,320px)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
              Samlet score
            </p>
            {combinedScore != null ? (
              <div className="mt-1.5 flex flex-wrap items-end gap-x-2 gap-y-1">
                <span className="text-[76px] font-semibold leading-[0.82] tracking-[-0.055em] text-[color:var(--ink)] tabular-nums">
                  {combinedScore}
                </span>
                <span className="pb-[10px] text-[20px] font-normal text-[color:var(--faint)]">
                  /100
                </span>
                {weekDelta != null && weekDelta !== 0 && (
                  <span
                    className={`mb-[14px] inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
                      weekDelta >= 0
                        ? 'bg-[color:var(--inset)] text-[color:var(--green)]'
                        : 'bg-[color:var(--dangerbg)] text-[color:var(--danger)]'
                    }`}
                  >
                    <span aria-hidden>{weekDelta >= 0 ? '↑' : '↓'}</span>
                    {weekDelta >= 0 ? '+' : ''}
                    {weekDelta} siste uke
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-3 pr-2">
                <p className="text-[15px] font-medium leading-relaxed text-[color:var(--ink)]">
                  Kjør din første analyse — teknisk score er klar på ~60 sekunder.
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--muted)]">
                  Bruk «Kjør ny analyse» over for å komme i gang.
                </p>
              </div>
            )}
            <p className="mt-3 text-[11px] font-medium leading-snug text-[color:var(--muted)]">
              {combinedScore != null ? (
                <>
                  Basert på Lighthouse-teknisk · siste kjøring{' '}
                  {formatLastAnalysis(latestAt)}
                </>
              ) : (
                'Etter første kjøring ser du trend og samlet score her.'
              )}
            </p>
          </div>

          <div
            className="hidden h-[88px] w-px shrink-0 bg-[color:var(--subtle)] md:mx-6 md:block md:self-center"
            aria-hidden
          />

          {/* Right: trend + chart + period (én horisontal rad fra md+) */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-5">
            <div className="w-full min-w-0 md:flex-1">
              <p className="mb-2.5 text-[12px] font-medium text-[color:var(--muted)]">
                Trend siste {allTrendData.length} målinger
              </p>
              <div className="h-[84px] w-full">
                {allTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={allTrendData}
                      margin={{ top: 4, right: 2, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6B9E82" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#6B9E82" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9, fill: 'var(--faint)' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={40}
                        height={14}
                      />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip
                        cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeDasharray: '3 3' }}
                        contentStyle={chartTooltipStyle}
                        formatter={(v: any) => [v, 'Score']}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#5A8E6E"
                        strokeWidth={2}
                        fill="url(#heroGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[13px] text-[color:var(--faint)]">
                    Kjør en analyse for å se data
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-start md:justify-end md:self-center">
              <PeriodSwitch value={chartPeriod} onChange={setChartPeriod} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Four metric cards ───────────────────────────────────────── */}
      <section className="dash-stagger dash-stagger-3 flex flex-col gap-4">
        <SectionTitle>Målinger</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        <div className="rounded-[14px] border border-[color:var(--hair)] bg-white p-6">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-[color:var(--muted)]">
              Search
              <br />
              Console
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--hair)] bg-[color:var(--subtle)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--muted)]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  gscConnected ? 'bg-[#2E9E6B]' : 'bg-[#CFC9BB]'
                }`}
              />
              {gscConnected ? 'tilkoblet' : 'ikke koblet'}
            </span>
          </div>

          {gscConnected ? (
            <>
              <p className="mt-4 text-[11px] font-medium text-[color:var(--faint)]">
                Klikk · 28d
              </p>
              <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.04em] text-[color:var(--ink)] tabular-nums">
                {formatNumber(clicks)}
              </p>
              <p className="mt-2 text-xs text-[color:var(--muted)] tabular-nums">
                {formatNumber(impressions)} visninger
              </p>
              {clicks > 0 && (
                <p className="mt-3 inline-flex items-center rounded-full bg-[color:var(--inset)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--green)] tabular-nums">
                  ~{formatNumber(clicks * 8)} kr/mnd verdi
                </p>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="gsc-btn mt-5 text-[13px] font-medium text-[color:var(--ink)]"
            >
              Koble til GSC →
            </button>
          )}
        </div>

        {/* GEO — AI-synlighet */}
        <div className="rounded-[14px] border border-[color:var(--hair)] bg-white p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
              GEO — AI-synlighet
            </p>
            {geo && geo.total > 0 ? (
              <span className="inline-flex items-center rounded-full border border-[color:var(--hair)] bg-[color:var(--subtle)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink)]">
                Denne uken
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[color:var(--hair)] bg-[color:var(--subtle)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--faint)]">
                Venter
              </span>
            )}
          </div>

          {geo && geo.total > 0 ? (
            <>
              <p className="mt-5 text-[30px] font-semibold leading-none text-[color:var(--ink)] tabular-nums">
                {geo.mentioned}<span className="text-[color:var(--faint)]">/{geo.total}</span>
              </p>
              <p className="mt-1.5 text-[13px] font-medium text-[color:var(--ink)]">
                AI-svar som nevner deg
              </p>
              <div className="mt-4 space-y-1.5">
                {[
                  { key: 'chatgpt', label: 'ChatGPT' },
                  { key: 'gemini', label: 'Gemini' },
                  { key: 'perplexity', label: 'Perplexity' },
                ].map(({ key, label }) => {
                  const p = geo.byProvider?.[key];
                  return (
                    <div key={key} className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[color:var(--ink)]">{label}</span>
                      <span className={`tabular-nums ${p && p.mentioned > 0 ? 'font-semibold text-[color:var(--green)]' : 'text-[color:var(--faint)]'}`}>
                        {p ? `${p.mentioned}/${p.total}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-8 text-[13px] font-medium leading-relaxed text-[color:var(--ink)]">
              Sjekker hver uke om ChatGPT, Gemini og Perplexity nevner deg. Første resultat kommer mandag.
            </p>
          )}
        </div>
        </div>
      </section>

      {/* ── Bottom grid: tasks + events ─────────────────────────────── */}
      <section className="dash-stagger dash-stagger-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        {/* Prioriterte oppgaver */}
        <div className="flex flex-col rounded-[14px] border border-[color:var(--hair)] bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SectionTitle size="sm">Prioriterte oppgaver</SectionTitle>
              <span className="rounded-full border border-[color:var(--hair)] bg-[color:var(--subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--muted)] tabular-nums">
                {tasks.length} totalt
              </span>
            </div>
            <span className="text-[11px] font-medium text-[color:var(--faint)]">
              Sortér: prioritet ↓
            </span>
          </div>

          {!analysisResults && !realRankings.length ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[12px] border border-[color:var(--insetbd)] bg-[color:var(--inset)] p-8 text-center">
              <p className="text-sm font-medium leading-relaxed text-[color:var(--green)]">
                Etter første analyse finner og prioriterer Sikt ting du bør fikse — de dukker opp her.
              </p>
              <button
                type="button"
                onClick={onRunAnalysis}
                className="cta-btn mt-4 rounded-[10px] bg-[color:var(--btn-bg)] px-4 py-2 text-[13px] font-medium text-white"
              >
                Kjør analyse
              </button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-[12px] border border-[color:var(--insetbd)] bg-[color:var(--inset)] p-8 text-center">
              <p className="text-sm font-medium text-[color:var(--green)]">
                Alt ser bra ut.
              </p>
            </div>
          ) : (
            <>
              <ul className="flex flex-col">
                {tasks.slice(0, 5).map((t, i) => (
                  <li
                    key={t.id}
                    className={i > 0 ? 'border-t border-[color:var(--hair)]' : ''}
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate('visibility')}
                      className="task-row group flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          t.priority === 'høy' ? 'bg-[#C08A2E]' : 'bg-[#2E9E6B]'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-snug text-[color:var(--ink)]">
                          {t.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                          {[t.category, t.displayValue].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          t.priority === 'høy'
                            ? 'bg-[#F6EEDD] text-[#9A6700]'
                            : 'bg-[color:var(--inset)] text-[color:var(--green)]'
                        }`}
                      >
                        {t.priority}
                      </span>
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-[#C9C3B6] transition-transform group-hover:translate-x-0.5"
                      />
                    </button>
                  </li>
                ))}
              </ul>
              {tasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('visibility')}
                  className="link-btn mt-4 self-start text-[13px] font-medium text-[color:var(--muted)]"
                >
                  Vis alle {tasks.length} →
                </button>
              )}
            </>
          )}
        </div>

        {/* Siste hendelser */}
        <div className="flex flex-col rounded-[14px] border border-[color:var(--hair)] bg-white p-6">
          <div className="mb-4">
            <SectionTitle size="sm">Siste hendelser</SectionTitle>
          </div>

          {logs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-[12px] border border-[color:var(--hair)] bg-[color:var(--subtle)] p-8 text-center">
              <p className="text-sm leading-relaxed text-[color:var(--muted)]">
                Sikt jobber i bakgrunnen — første funn dukker opp her i løpet av kort tid.
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
                      i > 0 ? 'border-t border-[color:var(--hair)]' : ''
                    }`}
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--subtle)]">
                      <Icon size={13} className="text-[color:var(--muted)]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug text-[color:var(--ink)]">
                        {readableAction(log)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[color:var(--muted)] tabular-nums">
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
            className="link-btn mt-4 self-start text-[13px] font-medium text-[color:var(--muted)]"
          >
            Se alle hendelser →
          </button>
        </div>
      </section>
    </div>
  );
};

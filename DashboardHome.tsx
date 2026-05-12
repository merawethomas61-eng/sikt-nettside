import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { supabase } from './supabaseClient';

type PortalTab = 'home' | 'visibility' | 'keywords' | 'competitors' | 'geo' | 'workshop' | 'log' | 'settings';

type DashboardHomeProps = {
  user: any;
  clientData: any;
  formData?: any;
  onRunAnalysis: () => void;
  onNavigate: (tab: PortalTab) => void;
};

type HealthCheck = {
  id?: string;
  technical_score?: number | null;
  technical_data?: any;
  checked_at?: string;
  created_at?: string;
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

const dedupeLogs = (rows: ActivityLog[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const ts = new Date(row.created_at || '').getTime();
    const minute = Number.isFinite(ts) ? Math.floor(ts / 60000) : 0;
    const key = `${row.action || ''}|${minute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const readableAction = (log: ActivityLog) => {
  const action = log.action || '';
  const details = log.details || {};
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

const extractTasks = (latest?: HealthCheck | null): PriorityTask[] => {
  const audits = latest?.technical_data?.lighthouseResult?.audits;
  if (!audits) return [];

  return Object.entries(audits)
    .filter(([, audit]: any) => audit && audit.score !== 1 && audit.score !== null)
    .map(([id, audit]: any) => ({
      id,
      title: audit.title || id,
      displayValue: audit.displayValue,
      priority: highPriorityAudits.has(id) ? 'høy' as const : 'middels' as const,
      category: mediumPriorityAudits.has(id) ? 'Teknisk' : 'PageSpeed',
    }))
    .sort((a) => (a.priority === 'høy' ? -1 : 1))
    .slice(0, 6);
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
  period,
  setPeriod,
}: {
  label: string;
  score: number | null;
  data: { v: number }[];
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
  onRunAnalysis,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(true);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [gscConnected, setGscConnected] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [impressions, setImpressions] = useState(0);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [chartPeriod, setChartPeriod] = useState(30);
  const [technicalPeriod, setTechnicalPeriod] = useState(30);
  const [visibilityPeriod, setVisibilityPeriod] = useState(30);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: siteRows, error: siteError } = await supabase
          .from('sites')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        if (siteError) throw siteError;

        const siteId = siteRows?.[0]?.id ?? null;
        let checks: HealthCheck[] = [];
        let hasGsc = false;

        if (siteId) {
          const { data: healthRows, error: healthError } = await supabase
            .from('health_checks')
            .select('*')
            .eq('site_id', siteId)
            .order('checked_at', { ascending: false })
            .limit(90);
          if (healthError) throw healthError;
          checks = Array.isArray(healthRows) ? healthRows : [];
        }

        const { data: credentials, error: credentialError } = await supabase
          .from('api_credentials')
          .select('id')
          .eq('user_id', user.id)
          .eq('service_name', 'google_search_console')
          .limit(1);
        if (credentialError) throw credentialError;
        hasGsc = !!credentials?.length;

        let totalClicks = 0;
        let totalImpressions = 0;
        if (siteId && hasGsc) {
          const { data: keywordRows, error: keywordError } = await supabase
            .from('keywords')
            .select('clicks,impressions,avg_position')
            .eq('site_id', siteId);
          if (keywordError) throw keywordError;
          for (const row of keywordRows || []) {
            totalClicks += Number(row.clicks || 0);
            totalImpressions += Number(row.impressions || 0);
          }
        }

        const { data: activityRows, error: activityError } = await supabase
          .from('activity_logs')
          .select('id,action,details,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (activityError) throw activityError;

        if (!cancelled) {
          setHealthChecks(checks);
          setGscConnected(hasGsc);
          setClicks(totalClicks);
          setImpressions(totalImpressions);
          setLogs(dedupeLogs(Array.isArray(activityRows) ? activityRows : []).slice(0, 7));
        }
      } catch {
        if (!cancelled) {
          setHealthChecks([]);
          setGscConnected(false);
          setClicks(0);
          setImpressions(0);
          setLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard();
    return () => { cancelled = true; };
  }, [user?.id]);

  const latest = healthChecks[0] ?? null;
  const technicalScore = typeof latest?.technical_score === 'number' ? latest.technical_score : null;
  const visibilityScore = latest?.technical_data?.lighthouseResult?.categories?.seo?.score != null
    ? Math.round(latest.technical_data.lighthouseResult.categories.seo.score * 100)
    : null;
  const combinedScore = technicalScore != null && visibilityScore != null
    ? Math.round((technicalScore + visibilityScore) / 2)
    : technicalScore ?? visibilityScore;

  const allTrendData = useMemo(
    () => healthChecks.slice(0, chartPeriod).reverse().map((check) => ({ v: Number(check.technical_score || 0) })),
    [healthChecks, chartPeriod],
  );
  const technicalTrend = useMemo(
    () => healthChecks.slice(0, technicalPeriod).reverse().map((check) => ({ v: Number(check.technical_score || 0) })),
    [healthChecks, technicalPeriod],
  );
  const visibilityTrend = useMemo(
    () => healthChecks.slice(0, visibilityPeriod).reverse().map((check) => ({
      v: Math.round((check.technical_data?.lighthouseResult?.categories?.seo?.score ?? 0) * 100),
    })),
    [healthChecks, visibilityPeriod],
  );

  const weekDelta = useMemo(() => {
    if (technicalScore == null || healthChecks.length < 2) return null;
    const latestDate = new Date(latest?.checked_at || latest?.created_at || '').getTime();
    const sevenDaysAgo = Number.isFinite(latestDate) ? latestDate - 7 * 24 * 60 * 60 * 1000 : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const reference = healthChecks.find((check) => new Date(check.checked_at || check.created_at || '').getTime() <= sevenDaysAgo)
      || healthChecks[Math.min(healthChecks.length - 1, 7)];
    if (typeof reference?.technical_score !== 'number') return null;
    return technicalScore - reference.technical_score;
  }, [healthChecks, latest?.checked_at, latest?.created_at, technicalScore]);

  const tasks = useMemo(() => extractTasks(latest), [latest]);
  const domain = getDomain(formData?.websiteUrl || clientData?.websiteUrl || clientData?.website_url || '');
  const latestAt = latest?.checked_at || latest?.created_at;

  if (loading) {
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
    <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-xl border border-[#D8D8D2] bg-[#F7F7F5] p-4 font-['DM_Sans',sans-serif] text-slate-900">
      <section className="rounded-xl border border-[#CFCFC8] bg-white p-5 shadow-none">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Slik står det til med {domain}
            </h1>
            <p className="mt-2 text-sm font-normal text-slate-600">
              Siste analyse: {relativeTime(latestAt)} · {healthChecks.length} målinger i historikk
            </p>
          </div>
          <button
            type="button"
            onClick={onRunAnalysis}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#18181B] px-4 py-2 text-sm font-medium text-white shadow-none transition-colors hover:bg-[#18181B]/90"
          >
            <RefreshCw size={14} />
            Kjør ny analyse
          </button>
        </div>

        <div className="rounded-xl border border-[#2F2F33] bg-[#18181B] p-5 text-white shadow-none">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-300">Samlet score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-semibold leading-none tracking-tight text-white">{combinedScore ?? '—'}</span>
                <span className="text-sm font-normal text-white/40">/100</span>
              </div>
              <p className={`mt-3 text-xs font-normal ${
                weekDelta == null
                ? 'text-slate-400'
                  : weekDelta >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-500'
              }`}>
                {weekDelta == null ? 'Ingen uke-trend ennå' : `${weekDelta >= 0 ? '+' : ''}${weekDelta} siden siste uke`}
              </p>
            </div>

            <div>
              <div className="mb-2 flex justify-end">
                <SmallPeriodSwitch value={chartPeriod} onChange={setChartPeriod} dark />
              </div>
              <div className="h-40 rounded-xl border border-white/15 bg-[#202024] p-2">
                {allTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={allTrendData}>
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip cursor={false} />
                    <Line type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-normal text-slate-400">
                    Kjør en analyse for å se data
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs font-normal text-slate-400">Basert på Lighthouse-teknisk · siste kjøring</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ScoreCard label="Teknisk" score={technicalScore} data={technicalTrend} period={technicalPeriod} setPeriod={setTechnicalPeriod} />
        <ScoreCard label="Synlighet" score={visibilityScore} data={visibilityTrend} period={visibilityPeriod} setPeriod={setVisibilityPeriod} />

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Search Console</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${gscConnected ? 'bg-[#16a34a]' : 'bg-slate-300'}`} />
              {gscConnected ? 'tilkoblet' : 'ikke koblet'}
            </span>
          </div>
          {gscConnected ? (
            <>
              <p className="mb-2 mt-4 text-4xl font-semibold leading-none tracking-tight text-slate-900">{formatNumber(clicks)}</p>
              <p className="text-xs font-normal text-slate-500">{formatNumber(impressions)} visninger</p>
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
            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              Kommer
            </span>
          </div>
          <p className="mt-4 text-sm font-normal leading-6 text-slate-600">
            AI-synlighet i ChatGPT, Perplexity og Gemini. Lansering Q3.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className={`lg:col-span-3 ${cardClass}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Prioriterte oppgaver</h2>
              <span className="text-[11px] font-normal text-slate-500">{tasks.length}</span>
            </div>
            <span className="text-xs font-normal text-slate-500">Sortér: prioritet ↓</span>
          </div>

          {!latest ? (
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
                  className="rounded-xl border border-[#E5E5E3] bg-[#F7F7F5] p-4 text-left transition-colors hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-normal text-slate-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${task.priority === 'høy' ? 'bg-orange-500' : 'bg-yellow-400'}`} />
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">{task.category}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-5 text-slate-800">{task.title}</p>
                  {task.displayValue && <p className="mt-1 text-xs font-normal text-slate-400">{task.displayValue}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`lg:col-span-2 ${cardClass}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Siste hendelser</h2>
          </div>
          {logs.length === 0 ? (
            <div className="rounded-xl border border-[#E5E5E3] bg-[#F7F7F5] p-5 text-center">
              <p className="text-sm font-normal text-slate-600">Ingen hendelser ennå</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {logs.map((log, index) => (
                <li key={log.id || `${log.action}-${index}`} className="border-l-2 border-slate-200 pl-3">
                  <p className="text-sm font-normal leading-5 text-slate-700">{readableAction(log)}</p>
                  <p className="mt-0.5 text-xs font-normal text-slate-400">{relativeTime(log.created_at)}</p>
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

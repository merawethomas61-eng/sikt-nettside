import { GoogleSnippetPreview } from '../shared/GoogleSnippetPreview';
// ClientPortal — hele den auth-gatede portalen, trukket ut av App.tsx slik at
// den (recharts, ~8 800 linjer logikk) lazy-lastes KUN etter login. Markedssider
// og forsiden slipper dermed å sende denne koden. Importer ALDRI fra '../../App'
// her — det ville dratt monolitten tilbake inn i portal-chunken.
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowRight, Timer, ArrowDown, Eye, Trophy, Sun, BarChart2, Map as MapIcon, Users, Key, Check, Search, Zap, Target, ChevronDown, Menu, X, Sparkles, CalendarClock,
  MousePointer2, TrendingUp, Cpu, Globe, Activity, ArrowUpRight, User, MonitorCheck, Code2, PenTool,
  SearchIcon, TrendingDown, ImageIcon, ShoppingBag, Clock, AlertTriangle, MessageCircle, HelpCircle, LayoutDashboard, FileText, Link2,
  Home, Linkedin, Twitter, Mail, ShieldCheck, Wrench, Globe2, Stars, Frown, Radar, FileBarChart, AlertOctagon,
  Layers, Minus, BarChart3, GitMerge, Rocket, Shield, Lightbulb, Monitor, HeartHandshake, Lock, ChevronRight,
  BrainCircuit, Moon, BarChart4, CalendarDays, Award, Unlink, SearchCheck, Database, Server, LogOut, Coffee, Save, XCircle, AlertCircle, Edit2, ChevronsUpDown,
  Settings, Smartphone, ChevronLeft, ArrowUp, ArrowUpCircle, ArrowDownCircle, ShieldAlert, CreditCard, FileEdit, RefreshCw, LifeBuoy, Loader2, Trash2, Briefcase, Download, CheckCircle2, ArrowLeft, CheckCircle, Copy, ExternalLink, Circle,
  ClipboardCheck, Bell, Sparkle, Bot, Microscope, Send, Plus, Info, PhoneIncoming, Coins, Gauge, Type, Star, MessageSquare, QrCode, MoreHorizontal
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { toastInfo, toastSuccess, toastError, toastWarning } from '../toast';
import { supabaseRest, getStoredAccessToken } from '../supabaseRest';
import {
  DashboardCompetitorWidget,
  CompetitorChangeFeed,
  CompetitorCardEnhanced,
  useCompetitorChanges,
  useCompetitorPages,
} from '../../CompetitorMonitor';
import { DetailedHealthCheck } from '../components/DetailedHealthCheck';
import { CodeIntegrationStep } from '../../CodeIntegrationStep';
import { ActivationChecklist } from '../../ActivationChecklist';
import { JourneyTimeline } from '../../JourneyTimeline';
import { SERIF, SectionTitle, Note } from '../portalEditorial';
import { PORTAL, chartPalette, chartTooltipStyle, formatChartDate, scoreColor } from '../portalTheme';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { PrimaryButton, SecondaryButton } from '../shared/Buttons';
import { buildStripeCheckoutUrl } from '../shared/stripeLinks';

gsap.registerPlugin(ScrollTrigger);

const LazySparkline = React.lazy(() => import('../PortalCharts').then(m => ({ default: m.Sparkline })));
const Sparkline = (props: { data: number[]; color?: string; height?: number; fill?: boolean }) => (
  <React.Suspense fallback={<div style={{ height: props.height ?? 32 }} />}><LazySparkline {...props} /></React.Suspense>
);
const LazyRadialScore = React.lazy(() => import('../PortalCharts').then(m => ({ default: m.RadialScore })));
const RadialScore = (props: { value: number | null; size?: number; theme: PortalTheme }) => (
  <React.Suspense fallback={<div style={{ width: props.size ?? 96, height: props.size ?? 96 }} />}><LazyRadialScore {...props} /></React.Suspense>
);
const LazyScoreHistoryChart = React.lazy(() => import('../PortalCharts').then(m => ({ default: m.ScoreHistoryChart })));
const LazyKeywordRankChart = React.lazy(() => import('../PortalCharts').then(m => ({ default: m.KeywordRankChart })));
const LazyPositionBucketsChart = React.lazy(() => import('../PortalCharts').then(m => ({ default: m.PositionBucketsChart })));

// DashboardHome bruker recharts → lazy-last den så charts-chunken holdes ute av markedssidene.
const DashboardHome = React.lazy(() => import('../../DashboardHome').then(m => ({ default: m.DashboardHome })));

const DashboardView = ({ user, onBack }: { user: any, onBack: () => void }) => {
  const [loading, setLoading] = useState(true);
  // URL til din Looker Studio rapport
  const REPORT_URL = "https://lookerstudio.google.com/embed/reporting/b20556ef-7296-4ce3-b391-2d6acb70dc13/page/4flmF?rm=minimal";

  return (
    <div className="min-h-screen bg-[color:var(--navbg)] flex flex-col h-screen">
      <div className="bg-[color:var(--surface)] border-b border-[color:var(--hair)] px-6 py-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[color:var(--btn-bg)] rounded-lg flex items-center justify-center text-white font-bold text-xl">{user?.email?.charAt(0).toUpperCase()}</div>
          <div><h2 className="font-bold text-[color:var(--ink)]">Ditt SEO Dashboard</h2><p className="text-xs text-[color:var(--muted)]">Live data fra Google</p></div>
        </div>
        <button onClick={onBack} className="text-sm font-bold text-[color:var(--muted)] hover:text-[color:var(--ink)]">Tilbake</button>
      </div>
      <div className="flex-grow relative bg-[color:var(--surface)] w-full h-full overflow-hidden">
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--navbg)] z-10 text-[color:var(--muted)]">Henter ferske tall...</div>}
        <iframe src={REPORT_URL} className="w-full h-full border-0" frameBorder="0" allowFullScreen onLoad={() => setLoading(false)} title="SEO Rapport" />
      </div>
    </div>
  );
};



// --- HJELPEKOMPONENT: LÅST SEKSJON ---
// =====================================================================
// PORTAL UI BUILDING BLOCKS
// =====================================================================
// Felles, profesjonelle byggeklosser brukt av den redesignede ClientPortal.
// Holdt minimale (én aksent-farge, ingen gradient/blur, sentence-case labels).
// =====================================================================

type PortalTheme = 'light' | 'dark';

const portalCardClass = (theme: PortalTheme) =>
  theme === 'light'
    ? 'bg-[color:var(--surface)] border border-slate-200 rounded-2xl'
    : 'bg-slate-900 border border-white/10 rounded-2xl';

const portalTextMainClass = (theme: PortalTheme) =>
  theme === 'light' ? 'text-slate-900' : 'text-white';

const portalTextDimClass = (theme: PortalTheme) =>
  theme === 'light' ? 'text-slate-600' : 'text-slate-400';

const portalTextLabelClass = (theme: PortalTheme) =>
  theme === 'light' ? 'text-slate-500' : 'text-slate-500';

const portalDividerClass = (theme: PortalTheme) =>
  theme === 'light' ? 'border-slate-200' : 'border-white/10';

const portalSubtleBgClass = (theme: PortalTheme) =>
  theme === 'light' ? 'bg-slate-50' : 'bg-slate-950/40';

// PortalCard — én konsistent kort-stil. Erstatter dagens fire-fem varianter.
const PortalCard: React.FC<{
  theme: PortalTheme;
  className?: string;
  children: React.ReactNode;
}> = ({ theme, className = '', children }) => (
  <section className={`${portalCardClass(theme)} ${className}`}>{children}</section>
);

// CardHeader — overskrift + valgfri handling. Sentence case, ikke uppercase.
const CardHeader: React.FC<{
  theme: PortalTheme;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
}> = ({ theme, title, subtitle, action, icon, accent = 'violet' }) => {
  const isLight = theme === 'light';
  const accentBg: Record<string, string> = isLight
    ? {
        violet: 'bg-violet-50 text-violet-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
        sky: 'bg-sky-50 text-sky-600',
        slate: 'bg-slate-100 text-slate-600',
      }
    : {
        violet: 'bg-violet-500/15 text-violet-300',
        emerald: 'bg-emerald-500/15 text-emerald-300',
        amber: 'bg-amber-500/15 text-amber-300',
        rose: 'bg-rose-500/15 text-rose-300',
        sky: 'bg-sky-500/15 text-sky-300',
        slate: 'bg-[color:var(--surface)]/10 text-slate-300',
      };
  return (
    <header className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0 flex items-start gap-3">
        {icon && (
          <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${accentBg[accent]}`}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className={`text-base font-semibold tracking-tight ${portalTextMainClass(theme)}`}>{title}</h3>
          {subtitle && <p className={`text-sm mt-1 ${portalTextDimClass(theme)}`}>{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
};

// BigNumber — store, profesjonelle tall (semibold, ikke black).
const BigNumber: React.FC<{
  theme: PortalTheme;
  value: React.ReactNode;
  unit?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}> = ({ theme, value, unit, tone = 'neutral' }) => {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-rose-600'
          : portalTextMainClass(theme);
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-4xl font-semibold tracking-tight ${toneClass}`}>{value}</span>
      {unit && <span className={`text-sm ${portalTextDimClass(theme)}`}>{unit}</span>}
    </div>
  );
};


// TierTeaser — diskré "Lås opp i Standard/Premium"-linje. Erstatter LockedSection.
// Aldri full-card overlay; bare én linje med klar invitasjon nederst i et kort.
const TierTeaser: React.FC<{
  theme: PortalTheme;
  tier: 'Standard' | 'Premium';
  price: string;
  message: string;
  onUpgrade: (targetPlan?: 'Basic' | 'Standard' | 'Premium') => void;
}> = ({ theme, tier, price, message, onUpgrade }) => (
  <div
    className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
      theme === 'light'
        ? 'bg-violet-50 border border-violet-100'
        : 'bg-violet-500/10 border border-violet-500/20'
    }`}
  >
    <Sparkles size={16} className="text-violet-600 shrink-0" />
    <p className={`flex-1 text-sm ${portalTextDimClass(theme)} min-w-0`}>
      <span className={`font-medium ${portalTextMainClass(theme)}`}>{message}</span>
      <span className="hidden sm:inline">{' '}— {tier} {price}/mnd.</span>
    </p>
    <button
      type="button"
      onClick={() => onUpgrade(tier)}
      className="text-sm font-medium text-violet-600 hover:text-violet-500 shrink-0"
    >
      Lås opp →
    </button>
  </div>
);

const HoverTooltip: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative group inline-flex">
    <Info className="w-4 h-4 text-gray-400 cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
      {text}
    </div>
  </div>
);

const InlineLoading: React.FC<{ text: string; theme: PortalTheme; className?: string }> = ({ text, theme, className = '' }) => (
  <div className={`py-8 flex items-center justify-center gap-3 ${className}`}>
    <Loader2 size={16} className="text-violet-600 animate-spin shrink-0" />
    <span className={`text-sm ${portalTextDimClass(theme)}`}>{text}</span>
  </div>
);

const EmptyState: React.FC<{
  theme: PortalTheme;
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ theme, icon, title, description, action }) => (
  <div className={`rounded-xl px-5 py-10 text-center ${portalSubtleBgClass(theme)}`}>
    {icon && <div className="mb-4 flex justify-center text-slate-400">{icon}</div>}
    <p className={`text-sm font-medium ${portalTextMainClass(theme)} mb-1`}>{title}</p>
    <p className={`text-sm ${portalTextDimClass(theme)} max-w-md mx-auto`}>{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const dedupeSiktActions = (rows: any[]) => {
  const seen = new Set<string>();
  return rows.filter((row: any) => {
    const ts = new Date(row.created_at).getTime();
    const minuteBucket = Number.isFinite(ts) ? Math.floor(ts / 60000) : 0;
    const key = [
      row.action_type || row.action || '',
      row.category || '',
      row.title || '',
      row.page_url || '',
      minuteBucket,
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// KpiTile — liten KPI-rute med subtil fargeaksent. Brukes paa Hjem.
const KpiTile: React.FC<{
  theme: PortalTheme;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tooltip?: string;
  accent?: 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
  spark?: number[];
  icon?: React.ReactNode;
}> = ({ theme, label, value, hint, tooltip, accent = 'slate', spark, icon }) => {
  const isLight = theme === 'light';
  const accentColors: Record<string, { ring: string; dot: string; spark: string; iconBg: string; iconFg: string }> = {
    violet: { ring: 'border-violet-200', dot: 'bg-violet-500', spark: '#7c3aed', iconBg: isLight ? 'bg-violet-50' : 'bg-violet-500/10', iconFg: 'text-violet-600' },
    emerald: { ring: 'border-emerald-200', dot: 'bg-emerald-500', spark: '#10b981', iconBg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10', iconFg: 'text-emerald-600' },
    amber: { ring: 'border-amber-200', dot: 'bg-amber-500', spark: '#f59e0b', iconBg: isLight ? 'bg-amber-50' : 'bg-amber-500/10', iconFg: 'text-amber-600' },
    rose: { ring: 'border-rose-200', dot: 'bg-rose-500', spark: '#f43f5e', iconBg: isLight ? 'bg-rose-50' : 'bg-rose-500/10', iconFg: 'text-rose-600' },
    slate: { ring: isLight ? 'border-slate-200' : 'border-white/10', dot: 'bg-slate-400', spark: '#64748b', iconBg: isLight ? 'bg-slate-50' : 'bg-slate-800', iconFg: 'text-slate-500' },
  };
  const c = accentColors[accent];
  return (
    <div className={`rounded-xl border ${isLight ? 'bg-[color:var(--surface)]' : 'bg-slate-900/40'} ${c.ring} p-4 flex flex-col gap-2 min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className={`shrink-0 w-7 h-7 rounded-lg ${c.iconBg} ${c.iconFg} flex items-center justify-center`}>
              {icon}
            </span>
          )}
          <span className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'} truncate`}>
            {label}
          </span>
          {tooltip && <HoverTooltip text={tooltip} />}
        </div>
      </div>
      <div className={`text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'} leading-none`}>
        {value}
      </div>
      {hint && (
        <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {hint}
        </div>
      )}
      {spark && spark.length >= 2 && (
        <div className="-mb-1">
          <Sparkline data={spark} color={c.spark} height={28} />
        </div>
      )}
    </div>
  );
};

// CategoryDot — fargemerket prikk for sikt_actions-kategori i loggen.
const categoryMeta = (
  category: 'finding' | 'suggestion' | 'fix' | 'alert',
): { label: string; dot: string; bg: string; fg: string; icon: any } => {
  switch (category) {
    case 'fix':
      return { label: 'Fiks', dot: 'bg-emerald-500', bg: 'bg-emerald-50', fg: 'text-emerald-700', icon: CheckCircle2 };
    case 'suggestion':
      return { label: 'Forslag', dot: 'bg-sky-500', bg: 'bg-sky-50', fg: 'text-sky-700', icon: PenTool };
    case 'alert':
      return { label: 'Varsel', dot: 'bg-amber-500', bg: 'bg-amber-50', fg: 'text-amber-700', icon: Bell };
    default:
      return { label: 'Funn', dot: 'bg-violet-500', bg: 'bg-violet-50', fg: 'text-violet-700', icon: Search };
  }
};

// ============================================================
// KONKURRENTER — Interfaces, hook, og KonkurrenterPage
// ============================================================

interface Competitor {
  id: string;
  user_id: string;
  domain: string;
  avg_position: number | null;
  keyword_count: number;
  competitor_type: 'main' | 'local' | 'rising';
  avatar_color: string | null;
  created_at: string;
  last_scanned_at: string | null;
}

interface KeywordOpportunity {
  id: string;
  user_id: string;
  keyword: string;
  search_volume: number;
  difficulty: 'easy' | 'medium' | 'hard';
  recommendation_type: 'new_page' | 'faq' | 'expand_existing';
  recommendation_text: string;
  estimated_traffic: number;
  competitor_ids: string[];
  discovered_at: string;
  generated_at: string | null;
}

interface CompetitorKeywordRanking {
  id: string;
  competitor_id: string;
  keyword: string;
  position: number;
  url: string;
  checked_at: string;
}

// Deterministisk fargevalg basert på domenenavn
function getAvatarColor(domain: string): string {
  const palette = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#be185d'];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function formatVolume(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

/** Dekoder Supabase JWT (kun for sub / bruker-id — ikke validering). */
function getUserIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken || typeof accessToken !== 'string') return null;
  try {
    const part = accessToken.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const payload = JSON.parse(atob(b64 + pad));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Samme bruker-id som JWT / scan-API: session → getUser → JWT i localStorage → ev. fallback fra props. */
async function getCompetitorScopeUserId(fallback: string | null): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {
    /* ignore */
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {
    /* ignore */
  }
  const fromJwt = getUserIdFromAccessToken(getStoredAccessToken());
  if (fromJwt) return fromJwt;
  return fallback ?? null;
}

// Custom hook — henter konkurrenter + muligheter fra Supabase med real-time
function useCompetitorData(userId: string | null) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [opportunities, setOpportunities] = useState<KeywordOpportunity[]>([]);
  const [hasSite, setHasSite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const uid = await getCompetitorScopeUserId(userId);
    if (!uid) {
      setCompetitors([]);
      setOpportunities([]);
      setHasSite(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Tabellene er knyttet til bruker via user_id (samme som scan-competitor API).
      setHasSite(true);

      const [{ data: compRows, error: compError }, { data: oppRows, error: oppError }] = await Promise.all([
        supabase
          .from('competitors')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: true }),
        supabase
          .from('keyword_opportunities')
          .select('*')
          .eq('user_id', uid)
          .order('estimated_traffic', { ascending: false }),
      ]);

      if (compError) throw compError;
      if (oppError) throw oppError;

      setCompetitors(compRows || []);
      setOpportunities(oppRows || []);
    } catch (e: any) {
      setError(e?.message || 'Ukjent feil');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchData();
      const uid = await getCompetitorScopeUserId(userId);
      if (cancelled || !uid) return;
      channel = supabase
        .channel(`competitors-rt-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'competitors', filter: `user_id=eq.${uid}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'keyword_opportunities', filter: `user_id=eq.${uid}` }, fetchData)
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  return { competitors, opportunities, hasSite, loading, error, refetch: fetchData };
}

// ============================================================
// KonkurrenterPage
// ============================================================

// Relative-time helper (Norwegian) — used only inside KonkurrenterPage
function kpTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Nå';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t siden`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'I går';
  if (d < 7) return `${d} dager siden`;
  return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

// ─── GEO / AI-SYNLIGHET PAGE ────────────────────────────────────────────────
const GeoPage: React.FC<{ onNotify: () => void }> = ({ onNotify }) => {
  // Ett kildested: alias til PORTAL (ingen duplisert hex).
  const G = {
    bg: PORTAL.bg, card: PORTAL.card, ink: PORTAL.ink, green: PORTAL.success,
    muted: PORTAL.muted, border: PORTAL.border, sub: PORTAL.sub, faint: PORTAL.faint,
    hair: PORTAL.hair, subtle: PORTAL.subtle,
  } as const;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const pressD = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.97)'; };
  const pressU = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; };

  const [geoPrompt, setGeoPrompt] = useState('');
  const suggestions = [
    'Hvilken regnskapsfører bør jeg bruke i Bergen?',
    'Beste elektriker i Oslo for varmepumpe',
    'Anbefal en rørlegger i Trondheim sentrum',
  ];
  const openAI = (url: string) => {
    const q = geoPrompt.trim();
    window.open(q ? `${url}?q=${encodeURIComponent(q)}` : url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Geist','DM Sans',sans-serif" }}>

      {/* ── TEST OM AI NEVNER DEG (verktøy først) ──────────────────── */}
      <div id="geo-tester" style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: G.muted, margin: 0 }}>Synlighet i AI-søk</p>
          <span style={{ fontSize: 10, fontWeight: 600, background: G.green, color: '#fff', borderRadius: 100, padding: '2px 8px', letterSpacing: '0.04em' }}>Beta</span>
          <span style={{ fontSize: 11, color: G.faint }}>(GEO)</span>
        </div>
        <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12, color: G.ink, margin: '0 0 12px' }}>
          Test om AI nevner bedriften din
        </h2>
        <p style={{ fontSize: 14, color: G.sub, lineHeight: 1.6, margin: '0 0 20px', maxWidth: 560 }}>
          Stadig flere spør ChatGPT, Perplexity og Gemini i stedet for å google. Skriv inn et spørsmål en kunde kunne stilt, åpne det i AI-en, og se om bedriften din dukker opp i svaret.
        </p>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div
            style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10, background: G.subtle, border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 16px', transition: `border-color 150ms ${EASE}` }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = G.ink)}
            onBlurCapture={e => (e.currentTarget.style.borderColor = G.border)}
          >
            <Search size={15} style={{ color: G.muted, flexShrink: 0 }} />
            <input
              type="text"
              value={geoPrompt}
              onChange={e => setGeoPrompt(e.target.value)}
              placeholder="Hvilken regnskapsfører bør jeg bruke i Bergen?"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: G.ink, caretColor: G.ink }}
            />
          </div>
          <button
            onClick={() => openAI('https://chatgpt.com')}
            style={{ background: G.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: `transform 160ms ${EASE}`, flexShrink: 0 }}
            onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
          >
            <ExternalLink size={13} /> Åpne i ChatGPT
          </button>
          <button
            onClick={() => openAI('https://www.perplexity.ai/search')}
            style={{ background: G.subtle, border: `1px solid ${G.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: G.sub, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 10, whiteSpace: 'nowrap', transition: `color 150ms ${EASE}`, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = G.ink)}
            onMouseLeave={e => (e.currentTarget.style.color = G.sub)}
          >
            <ExternalLink size={12} /> Perplexity
          </button>
        </div>

        {/* Suggestion chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setGeoPrompt(s)}
              style={{ background: G.subtle, border: `1px solid ${G.border}`, borderRadius: 100, padding: '6px 14px', fontSize: 12, color: G.sub, cursor: 'pointer', transition: `all 150ms ${EASE}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G.ink; e.currentTarget.style.color = G.ink; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.sub; }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Ærlig note: manuelt inntil videre */}
        <Note tone="neutral" className="mt-[18px] flex items-start gap-2">
          <AlertTriangle size={14} style={{ color: '#9A6700', flexShrink: 0, marginTop: 2 }} />
          <span>Du må sjekke manuelt foreløpig. Automatisk sporing er på vei — se under.</span>
        </Note>
      </div>

      {/* ── PÅ VEI / VEIKART (mindre, nederst) ──────────────────────── */}
      <div id="geo-veikartet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
          <SectionTitle size="sm">På vei</SectionTitle>
          <span style={{ fontSize: 11, fontWeight: 500, color: G.muted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Lock size={11} /> Kommer senere
          </span>
        </div>
        <h2 style={{ fontSize: 'clamp(20px, 2.2vw, 26px)', fontWeight: 700, color: G.ink, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
          Det vi snart automatiserer for deg
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {([
            {
              num: '01',
              title: 'Daglig sjekk av 50+ kunde-spørsmål',
              badge: 'Under utvikling',
              green: true,
              desc: 'Vi spør ChatGPT, Perplexity og Gemini hver natt om de samme spørsmålene en kunde ville stilt. Du får varsel hvis du dukker opp — eller blir borte.',
            },
            {
              num: '02',
              title: 'Automatisk AI-sporing',
              badge: 'Kommer senere',
              green: false,
              desc: 'Plassering, sitater og sammenheng — på samme måte som Google Search Console, bare for AI-svar.',
            },
          ] as const).map(item => (
            <div key={item.num} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 28, fontWeight: 600, color: G.faint, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{item.num}</span>
                <span style={{ fontSize: 10, fontWeight: 600, background: item.green ? 'rgba(21,121,90,0.10)' : G.bg, color: item.green ? G.green : G.muted, border: `1px solid ${item.green ? 'rgba(21,121,90,0.22)' : G.border}`, borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {!item.green && <Lock size={9} />}{item.badge}
                </span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: G.ink, margin: '0 0 10px', lineHeight: 1.35 }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: G.muted, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={onNotify}
            style={{ background: G.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
            onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
          >
            Bli varslet når det lanseres <ChevronRight size={14} />
          </button>
        </div>
      </div>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ANMELDELSER — review-motor (Fase 2: ekte deeplink + e-post-utsending)
//   · review_settings: Google-profil/place-id → utledet «skriv anmeldelse»-lenke
//   · review_requests: be om anmeldelse via e-post (edge: send-review-request)
//   · Lesing av ekte snitt/antall + svar krever Google API → kommer senere
// ─────────────────────────────────────────────────────────────────────────────
type ReviewSettings = {
  user_id: string;
  business_name: string | null;
  google_place_id: string | null;
  write_review_url: string | null;
  profile_url: string | null;
  private_feedback_enabled: boolean;
};
type ReviewRequest = {
  id: string;
  customer_name: string;
  email: string | null;
  channel: string;
  status: 'ready' | 'sent' | 'opened' | 'responded' | 'failed';
  sent_at: string | null;
  opened_at: string | null;
  responded_at: string | null;
  created_at: string;
};

/** Lim inn Google «få anmeldelser»-lenke ELLER place-ID → ferdig deeplink. */
function deriveReviewLink(input: string): { write_review_url: string | null; profile_url: string | null; google_place_id: string | null } {
  const v = (input || '').trim();
  if (!v) return { write_review_url: null, profile_url: null, google_place_id: null };
  if (/^https?:\/\//i.test(v)) {
    // g.page/r/.../review, …/writereview eller en placeid-lenke peker rett til
    // anmeldelses-skjemaet. En vanlig profil-lenke lander også på profilen der
    // kunden kan vurdere — vi lagrer den som-er, men beholder place-ID om den finnes.
    const placeId = v.match(/[?&]placeid=([^&]+)/i)?.[1] ?? null;
    return {
      write_review_url: v,
      profile_url: v,
      google_place_id: placeId ? decodeURIComponent(placeId) : null,
    };
  }
  // Ser ut som et place-ID (ChIJ… / alfanumerisk, ingen mellomrom).
  if (/^[A-Za-z0-9_-]{12,}$/.test(v)) {
    return {
      google_place_id: v,
      write_review_url: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(v)}`,
      profile_url: null,
    };
  }
  return { write_review_url: null, profile_url: null, google_place_id: null };
}

function reviewStatusLabel(s: ReviewRequest['status']): string {
  switch (s) {
    case 'ready': return 'Klar';
    case 'sent': return 'Sendt';
    case 'opened': return 'Åpnet lenken';
    case 'responded': return 'Svart';
    case 'failed': return 'Feilet';
    default: return s;
  }
}

function timeAgoNo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'nå';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'i går';
  if (days < 30) return `${days} dager siden`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 mnd siden' : `${months} mnd siden`;
}

type GooglePlace = { placeId: string; name: string; address: string; rating: number | null; count: number | null };
type GoogleReview = { author: string; rating: number; text: string; when: string; photo: string | null };
type GoogleData = { rating: number | null; count: number | null; reviews: GoogleReview[]; updatedAt: string | null; baselineCount: number | null; baselineAt: string | null };
type GbpReview = { reviewId: string; author: string; rating: number; text: string; when: string; reply: string | null };

/** Kall en Supabase Edge Function med innlogget brukers token. */
async function invokeReviewEdge(fn: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? getStoredAccessToken() ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok !== false, status: res.status, data };
}

function escapeHtmlClient(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Menneskelig forklaring på hvorfor en kunde er rød/gul (admin-helse, punkt 3B). */
function healthReason(r: any): string {
  const DAY = 24 * 60 * 60 * 1000;
  const sub = (r?.subscription_status ?? '').toLowerCase();
  if (sub === 'past_due') return 'Betaling feilet (past_due) — i ferd med å falle av';
  if (sub === 'canceled' || sub === 'unpaid') return `Abonnement: ${sub}`;
  if (!r?.last_active_at) {
    const d = r?.created_at ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / DAY) : null;
    return d !== null ? `Betalte, men har aldri vært aktiv (${d} d siden signup)` : 'Betalte, men har aldri vært aktiv';
  }
  const d = r?.last_seen_at ? Math.floor((Date.now() - new Date(r.last_seen_at).getTime()) / DAY) : null;
  return d !== null ? `Stille i ${d} dager` : 'Stille en stund';
}

/** Review/AggregateRating JSON-LD fra EKTE Google-tall (matcher widgeten på siden). */
function buildReviewJsonLd(opts: { businessName: string; rating: number; count: number; url: string | null; reviews: GoogleReview[] }): string {
  const data: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: opts.businessName,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: opts.rating.toFixed(1),
      reviewCount: opts.count,
      bestRating: '5',
      worstRating: '1',
    },
  };
  if (opts.url) data.url = opts.url;
  const revs = opts.reviews
    .filter((r) => r.text && r.rating)
    .slice(0, 3)
    .map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: { '@type': 'Rating', ratingValue: String(r.rating), bestRating: '5', worstRating: '1' },
      reviewBody: r.text,
    }));
  if (revs.length) data.review = revs;
  return JSON.stringify(data, null, 2);
}

function staticStars(rating: number): string {
  const r = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) => `<span style="color:${i < r ? '#15795A' : '#D8D2C6'}">★</span>`).join('');
}

/** Selv-stendig, inline-stylet anmeldelses-widget (limes inn hvor som helst). */
function buildWidgetHtml(opts: { businessName: string; rating: number; count: number; url: string; reviews: GoogleReview[] }): string {
  const quotes = opts.reviews
    .filter((r) => r.text)
    .slice(0, 2)
    .map((r) => `      <li style="margin:0 0 12px;list-style:none">
        <div style="font-size:15px;line-height:1">${staticStars(r.rating)}</div>
        <p style="margin:5px 0 2px;font-size:13px;color:#444;line-height:1.5">&ldquo;${escapeHtmlClient(r.text)}&rdquo;</p>
        <span style="font-size:12px;color:#888">&mdash; ${escapeHtmlClient(r.author)}</span>
      </li>`)
    .join('\n');
  const url = escapeHtmlClient(opts.url);
  return `<!-- Sikt anmeldelses-widget -->
<div style="max-width:420px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border:1px solid #E9E4DA;border-radius:14px;padding:18px 20px;background:#fff">
  <div style="display:flex;align-items:center;gap:12px">
    <span style="font-size:32px;font-weight:700;color:#1A1A1A;line-height:1">${opts.rating.toFixed(1)}</span>
    <div>
      <div style="font-size:17px;line-height:1.1">${staticStars(opts.rating)}</div>
      <a href="${url}" target="_blank" rel="noopener" style="font-size:12px;color:#15795A;text-decoration:none">${opts.count} anmeldelser på Google</a>
    </div>
  </div>
  <ul style="margin:14px 0 0;padding:0">
${quotes}
  </ul>
  <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px;background:#1A1A1A;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:9px">Skriv en anmeldelse</a>
</div>`;
}

const ReviewsPage: React.FC<{
  user: any;
  companyName?: string;
  hasStandardOrHigher: boolean;
  onUpgrade: (targetPlan?: 'Basic' | 'Standard' | 'Premium') => void;
}> = ({ user, companyName, hasStandardOrHigher, onUpgrade }) => {
  // Ett kildested: alias til PORTAL (ingen duplisert hex).
  const C = {
    card: PORTAL.card, ink: PORTAL.ink, sub: PORTAL.sub, muted: PORTAL.muted,
    faint: PORTAL.faint, border: PORTAL.border, hair: PORTAL.hair, subtle: PORTAL.subtle,
    green: PORTAL.success, greenBg: PORTAL.successBg, amber: PORTAL.warn, amberBg: PORTAL.warnBg,
    red: PORTAL.danger,
  } as const;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const pressD = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.97)'; };
  const pressU = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; };
  const inputStyle: React.CSSProperties = { width: '100%', borderRadius: 10, padding: '11px 14px', fontSize: 14, border: `1px solid ${C.border}`, color: C.ink, background: C.subtle, outline: 'none', boxSizing: 'border-box' };
  const StarRow = ({ n }: { n: number }) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} style={{ color: i <= n ? C.green : C.faint }} fill={i <= n ? C.green : 'none'} />
      ))}
    </span>
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReviewSettings | null>(null);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);

  // Tilkobling
  const [editConnect, setEditConnect] = useState(false);
  const [connectInput, setConnectInput] = useState('');
  const [savingConnect, setSavingConnect] = useState(false);
  // Søk opp bedrift på Google (Places)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GooglePlace[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Ekte Google-data (snitt/antall/anmeldelser)
  const [google, setGoogle] = useState<GoogleData | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Vis på siden (widget + schema)
  const [wpConnected, setWpConnected] = useState(false);
  const [pushingSchema, setPushingSchema] = useState(false);

  // Google Business Profile (svar på anmeldelser) — scaffold, mørk til godkjent
  const [gbpConfigured, setGbpConfigured] = useState(false);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [gbpReviews, setGbpReviews] = useState<GbpReview[] | null>(null);
  const [gbpConnecting, setGbpConnecting] = useState(false);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyingId, setReplyingId] = useState<string | null>(null);

  // Be om anmeldelse
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const reviewLink = settings?.write_review_url ?? null;
  const isConnected = !!reviewLink;
  const hasPlaceId = !!settings?.google_place_id;

  const loadData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoadError(null);
    try {
      const [sRows, rRows, hRows] = await Promise.all([
        supabaseRest<ReviewSettings[]>(`review_settings?user_id=eq.${user.id}&select=*&limit=1`),
        supabaseRest<ReviewRequest[]>(`review_requests?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=50`),
        supabaseRest<{ platform: string; connection_mode: string }[]>(`client_hosts?user_id=eq.${user.id}&select=platform,connection_mode&limit=5`),
      ]);
      const s = Array.isArray(sRows) && sRows[0] ? sRows[0] : null;
      setSettings(s);
      setRequests(Array.isArray(rRows) ? rRows : []);
      setWpConnected(Array.isArray(hRows) && hRows.some((h) => h.platform === 'wordpress' && h.connection_mode === 'full'));
      if (!s?.write_review_url) setEditConnect(true);
    } catch (err: any) {
      setLoadError(err?.message || 'Kunne ikke laste anmeldelses-data.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (hasStandardOrHigher) loadData(); else setLoading(false); }, [hasStandardOrHigher, loadData]);

  const loadGoogle = useCallback(async (force = false) => {
    if (!hasStandardOrHigher) return;
    setLoadingGoogle(true); setGoogleError(null);
    try {
      const { ok, data } = await invokeReviewEdge('google-reviews', { action: 'details', force });
      if (ok) setGoogle({ rating: data.rating ?? null, count: data.count ?? null, reviews: data.reviews ?? [], updatedAt: data.updatedAt ?? null, baselineCount: data.baselineCount ?? null, baselineAt: data.baselineAt ?? null });
      else setGoogleError(data?.error || 'Kunne ikke hente Google-data.');
    } catch (e: any) {
      setGoogleError(e?.message || 'Kunne ikke hente Google-data.');
    } finally { setLoadingGoogle(false); }
  }, [hasStandardOrHigher]);

  useEffect(() => { if (hasPlaceId) loadGoogle(false); }, [hasPlaceId, loadGoogle]);

  // ── Google Business Profile (svar på anmeldelser) ──
  const loadGbpReviews = useCallback(async () => {
    try {
      const { ok, data } = await invokeReviewEdge('gbp-reviews', { action: 'reviews' });
      if (ok && Array.isArray(data.reviews)) setGbpReviews(data.reviews);
    } catch { /* mørk til godkjent */ }
  }, []);

  const loadGbpStatus = useCallback(async () => {
    if (!hasStandardOrHigher) return;
    try {
      const { data } = await invokeReviewEdge('gbp-reviews', { action: 'status' });
      setGbpConfigured(!!data?.configured);
      setGbpConnected(!!data?.connected);
      if (data?.connected) loadGbpReviews();
    } catch { /* stille — funksjonen kan være udeployet ennå */ }
  }, [hasStandardOrHigher, loadGbpReviews]);

  useEffect(() => { loadGbpStatus(); }, [loadGbpStatus]);

  // Fang opp ?gbp=… etter OAuth-redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('gbp');
    if (!g) return;
    if (g === 'connected') { toastSuccess('Google-bedriftsprofil koblet til. Du kan nå svare på anmeldelser herfra.'); loadGbpStatus(); }
    else if (g === 'denied') toastWarning('Du avbrøt tilkoblingen til Google-bedriftsprofil.');
    else if (g === 'error') toastError('Tilkoblingen til Google-bedriftsprofil feilet. Prøv igjen.');
    params.delete('gbp');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [loadGbpStatus]);

  const connectGbp = async () => {
    if (!gbpConfigured) { toastInfo('Svar-på-anmeldelser via Google kommer så snart Google godkjenner API-tilgangen vår.'); return; }
    setGbpConnecting(true);
    try {
      const { ok, data } = await invokeReviewEdge('gbp-reviews', { action: 'auth-url' });
      if (ok && data?.url) window.location.href = data.url;
      else toastError(data?.error || 'Kunne ikke starte tilkoblingen.');
    } catch (e: any) { toastError(e?.message || 'Kunne ikke starte tilkoblingen.'); }
    finally { setGbpConnecting(false); }
  };

  const submitReply = async (reviewId: string) => {
    const comment = replyText.trim();
    if (!comment) { toastWarning('Skriv et svar først.'); return; }
    setReplyingId(reviewId);
    try {
      const { ok, data } = await invokeReviewEdge('gbp-reviews', { action: 'reply', reviewId, comment });
      if (ok) {
        setGbpReviews((prev) => prev?.map((r) => (r.reviewId === reviewId ? { ...r, reply: comment } : r)) ?? prev);
        setReplyOpenId(null); setReplyText('');
        toastSuccess('Svaret er publisert på Google.');
      } else toastError(data?.error || 'Kunne ikke publisere svaret.');
    } catch (e: any) { toastError(e?.message || 'Kunne ikke publisere svaret.'); }
    finally { setReplyingId(null); }
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) { toastWarning('Skriv inn bedriftsnavn (og gjerne sted).'); return; }
    setSearching(true);
    try {
      const { ok, data } = await invokeReviewEdge('google-reviews', { action: 'search', query: q });
      if (ok) setSearchResults(data.results ?? []);
      else toastError(data?.error || 'Søket feilet. Er Google-nøkkelen satt opp?');
    } catch (e: any) { toastError(e?.message || 'Søket feilet.'); }
    finally { setSearching(false); }
  };

  const upsertSettings = async (patch: Partial<ReviewSettings>) => {
    const body = {
      user_id: user.id,
      business_name: settings?.business_name ?? companyName ?? null,
      private_feedback_enabled: settings?.private_feedback_enabled ?? false,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const [row] = await supabaseRest<ReviewSettings[]>('review_settings?on_conflict=user_id', {
      method: 'POST', body, headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    });
    setSettings(row ?? ({ ...settings, ...body } as any));
    return row;
  };

  const pickPlace = async (p: GooglePlace) => {
    setSavingConnect(true);
    try {
      await upsertSettings({
        business_name: p.name || settings?.business_name || companyName || null,
        google_place_id: p.placeId,
        write_review_url: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(p.placeId)}`,
        profile_url: null,
      });
      setEditConnect(false); setSearchResults(null); setSearchQuery('');
      toastSuccess(`Koblet til ${p.name}. Henter Google-anmeldelsene dine …`);
      loadGoogle(true);
    } catch (e: any) { toastError(e?.message || 'Kunne ikke lagre.'); }
    finally { setSavingConnect(false); }
  };

  const saveConnection = async () => {
    const derived = deriveReviewLink(connectInput);
    if (!derived.write_review_url) {
      toastWarning('Lim inn en gyldig Google-lenke (f.eks. g.page/r/…/review) eller et place-ID.');
      return;
    }
    setSavingConnect(true);
    try {
      await upsertSettings({
        google_place_id: derived.google_place_id,
        write_review_url: derived.write_review_url,
        profile_url: derived.profile_url,
      });
      setEditConnect(false);
      setConnectInput('');
      if (derived.google_place_id) {
        toastSuccess('Lagret. Henter Google-anmeldelsene dine …');
        loadGoogle(true);
      } else {
        toastSuccess('Lenken er lagret. (For ekte snitt/anmeldelser: søk opp bedriften så vi får place-ID.)');
      }
    } catch (err: any) {
      toastError(err?.message || 'Kunne ikke lagre lenken.');
    } finally {
      setSavingConnect(false);
    }
  };

  const togglePrivateFeedback = async () => {
    if (!settings) return;
    const next = !settings.private_feedback_enabled;
    setSettings({ ...settings, private_feedback_enabled: next });
    try {
      await supabaseRest(`review_settings?user_id=eq.${user.id}`, {
        method: 'PATCH',
        body: { private_feedback_enabled: next, updated_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
    } catch (err: any) {
      setSettings({ ...settings, private_feedback_enabled: !next });
      toastError(err?.message || 'Kunne ikke lagre innstillingen.');
    }
  };

  const sendRequest = async () => {
    if (!isConnected) { toastWarning('Koble til Google-lenken din først.'); return; }
    if (!name.trim() || !contact.trim()) { toastWarning('Fyll inn navn og e-post.'); return; }
    if (!contact.includes('@')) { toastWarning('Skriv inn en e-postadresse. (SMS kommer senere.)'); return; }

    setSendingId('new');
    let created: ReviewRequest | null = null;
    try {
      const [row] = await supabaseRest<ReviewRequest[]>('review_requests', {
        method: 'POST',
        body: { user_id: user.id, customer_name: name.trim(), email: contact.trim(), channel: 'email', status: 'ready' },
        headers: { Prefer: 'return=representation' },
      });
      created = row;
      setRequests((p) => [row, ...p]);
      setName(''); setContact('');

      // Faktisk sending skjer i edge-funksjonen (Resend). Den setter status → 'sent'.
      const { ok, data: out } = await invokeReviewEdge('send-review-request', { requestId: row.id });
      if (ok) {
        setRequests((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'sent', sent_at: new Date().toISOString() } : r)));
        toastSuccess(`Forespørsel sendt til ${row.customer_name}.`);
      } else {
        setRequests((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'ready' } : r)));
        toastWarning(out?.error || 'Forespørselen er lagret, men e-post-utsending er ikke aktivert ennå.');
      }
    } catch (err: any) {
      if (!created) toastError(err?.message || 'Kunne ikke opprette forespørselen.');
      else toastWarning('Forespørselen er lagret, men kunne ikke sendes nå.');
    } finally {
      setSendingId(null);
    }
  };

  const copyLink = () => {
    if (!reviewLink) { toastWarning('Koble til Google-lenken din først.'); return; }
    navigator.clipboard?.writeText(reviewLink);
    toastSuccess('Anmeldelses-lenke kopiert — del den på kvittering, e-post eller i butikk.');
  };

  // ── Vis på nettsiden (widget + schema) — krever ekte Google-tall ──
  const businessName = settings?.business_name || companyName || 'Bedriften';
  const canShowOnSite = google?.rating != null && google?.count != null && !!reviewLink;
  const widgetHtml = canShowOnSite
    ? buildWidgetHtml({ businessName, rating: google!.rating!, count: google!.count!, url: reviewLink!, reviews: google!.reviews })
    : '';
  const schemaJsonLd = canShowOnSite
    ? buildReviewJsonLd({ businessName, rating: google!.rating!, count: google!.count!, url: settings?.profile_url || reviewLink, reviews: google!.reviews })
    : '';

  const copyWidget = () => { navigator.clipboard?.writeText(widgetHtml); toastSuccess('Widget-kode kopiert. Lim den inn der du vil vise stjernene.'); };
  const copySchema = () => { navigator.clipboard?.writeText(`<script type="application/ld+json">\n${schemaJsonLd}\n</script>`); toastSuccess('Schema-kode kopiert. Lim den inn i <head> på siden.'); };

  const pushSchemaToWp = async () => {
    if (!schemaJsonLd) return;
    setPushingSchema(true);
    try {
      const token = getStoredAccessToken();
      const res = await fetch('/api/wordpress-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ field: 'site-schema', jsonld: schemaJsonLd }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out?.ok) toastSuccess('Stjerne-schema publisert på WordPress. Google kan nå vise stjerner i søkeresultatet ditt.');
      else toastError(out?.error || 'Kunne ikke publisere til WordPress.');
    } catch (e: any) {
      toastError(e?.message || 'Kunne ikke publisere til WordPress.');
    } finally {
      setPushingSchema(false);
    }
  };

  // Snitt + antall er ekte Google-data (Places). Forespørsler sendt er vår funnel.
  const sentCount = requests.filter((r) => r.status !== 'ready').length;
  // «Nye siden start»: ærlig aggregert effekt (ikke per-forespørsel — det kan vi ikke vite).
  const newSinceStart = (google?.count != null && google?.baselineCount != null)
    ? Math.max(0, google.count - google.baselineCount) : null;
  const summary: { label: string; value: string; green: boolean; star?: boolean }[] = [
    { label: 'Snittvurdering', value: google?.rating != null ? google.rating.toFixed(1) : '—', green: false, star: google?.rating != null },
    { label: 'Anmeldelser på Google', value: google?.count != null ? String(google.count) : '—', green: false },
    ...(newSinceStart != null ? [{ label: 'Nye siden start', value: `+${newSinceStart}`, green: newSinceStart > 0 }] : []),
    { label: 'Forespørsler sendt', value: String(sentCount), green: sentCount > 0 },
  ];

  // ── Basic: låst teaser ──
  if (!hasStandardOrHigher) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', fontFamily: "'Geist','DM Sans',sans-serif" }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 460 }}>
          <Lock size={28} style={{ color: C.muted, margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ color: C.ink, fontWeight: 700, fontSize: 20, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Anmeldelses-motoren er låst</h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
            Be fornøyde kunder om en Google-anmeldelse med ett trykk, og følg opp automatisk. Flere ekte anmeldelser løfter både kartpakken og hvor mange som ringer. Tilgjengelig i Standard og oppover.
          </p>
          <button
            onClick={() => onUpgrade('Standard')}
            style={{ background: C.ink, color: '#fff', padding: '11px 22px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
            onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
          >
            <Sparkles size={14} /> Oppgrader til Standard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={22} className="animate-spin" style={{ color: C.muted }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Geist','DM Sans',sans-serif" }}>

      {loadError && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderRadius: 10, padding: '12px 16px', background: 'var(--dangerbg)', border: `1px solid rgba(180,35,31,0.20)`, fontSize: 13, color: C.red }}>
          <span>{loadError}</span>
          <button onClick={loadData} style={{ fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Prøv igjen</button>
        </div>
      )}

      {/* ── Koble til Google ── */}
      {(!isConnected || editConnect) ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>Koble til Google-profilen din</h2>
          <p style={{ margin: '8px 0 16px', fontSize: 13.5, lineHeight: 1.6, color: C.sub, maxWidth: 600 }}>
            Søk opp bedriften din på Google. Da henter vi <strong style={{ color: C.ink }}>ekte snittvurdering og anmeldelser</strong>, og «be om anmeldelse» peker rett til skjemaet der kunden gir deg stjerner.
          </p>

          {/* Søk på Google (Places) */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Bedriftsnavn og sted (f.eks. «Rørlegger Hansen Oslo»)"
              style={{ ...inputStyle, flex: '1 1 320px' }}
            />
            <button
              type="button" onClick={runSearch} disabled={searching}
              onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
              style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: searching ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: `transform 160ms ${EASE}`, flexShrink: 0, opacity: searching ? 0.7 : 1 }}
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Søk
            </button>
          </div>

          {searchResults && (
            <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {searchResults.length === 0 ? (
                <p style={{ margin: 0, padding: '14px 16px', fontSize: 13, color: C.muted }}>Fant ingen treff. Prøv å legge til sted eller gateadresse.</p>
              ) : searchResults.map((p, i) => (
                <button
                  key={p.placeId} type="button" onClick={() => pickPlace(p)} disabled={savingConnect}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', background: C.card, border: 'none', borderTop: i > 0 ? `1px solid ${C.hair}` : 'none', padding: '12px 16px', cursor: savingConnect ? 'default' : 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.subtle)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.card)}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 12.5, color: C.sub }}>
                    {p.rating != null && (<><Star size={13} style={{ color: C.green }} fill={C.green} /> {p.rating.toFixed(1)}{p.count != null ? ` · ${p.count}` : ''}</>)}
                    <ChevronRight size={15} style={{ color: C.faint }} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Manuell fallback: lim inn lenke / place-ID */}
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 12.5, color: C.muted, cursor: 'pointer', fontWeight: 600 }}>Finner du ikke bedriften? Lim inn lenke eller place-ID</summary>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
              <input
                type="text" value={connectInput} onChange={(e) => setConnectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveConnection()}
                placeholder="g.page/r/…/review  eller  place-ID"
                style={{ ...inputStyle, flex: '1 1 320px' }}
              />
              <button
                type="button" onClick={saveConnection} disabled={savingConnect}
                onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
                style={{ background: C.subtle, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: savingConnect ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', flexShrink: 0, opacity: savingConnect ? 0.7 : 1 }}
              >
                {savingConnect ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Lagre
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.5, color: C.muted }}>
              En ren lenke uten place-ID lar deg sende forespørsler, men ekte snitt/anmeldelser krever at vi finner place-ID-en (bruk søket over).
            </p>
          </details>

          {isConnected && (
            <button type="button" onClick={() => { setEditConnect(false); setConnectInput(''); setSearchResults(null); }} style={{ marginTop: 14, background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer', padding: 0 }}>Avbryt</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, background: C.green, borderRadius: '50%', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Koblet til Google</span>
            <a href={reviewLink!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: C.muted, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
              {reviewLink!.replace(/^https?:\/\//, '')} <ExternalLink size={12} style={{ flexShrink: 0 }} />
            </a>
          </div>
          <button type="button" onClick={() => { setConnectInput(reviewLink || ''); setEditConnect(true); }} style={{ background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 9, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, color: C.sub, cursor: 'pointer' }}>Endre</button>
        </div>
      )}

      {/* ── Sammendrag (ærlig funnel) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {summary.map((s) => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>{s.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, color: s.green ? C.green : C.ink, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
              {s.star && <Star size={20} style={{ color: C.green }} fill={C.green} />}
            </div>
          </div>
        ))}
      </div>

      {/* ── Be om anmeldelse ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
        <SectionTitle>Be om en anmeldelse</SectionTitle>
        <p style={{ margin: '8px 0 18px', fontSize: 13.5, lineHeight: 1.6, color: C.sub, maxWidth: 560 }}>
          Etter en jobb: legg inn kunden, så sender Sikt en vennlig e-post med ett trykk til Google. Flere ekte anmeldelser løfter både kartpakken og hvor mange som ringer.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kundens navn" style={{ ...inputStyle, flex: '1 1 160px' }} />
          <input type="email" value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendRequest()} placeholder="Kundens e-post" style={{ ...inputStyle, flex: '1 1 200px' }} />
          <button
            type="button" onClick={sendRequest} disabled={sendingId !== null} onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
            style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: sendingId ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: `transform 160ms ${EASE}`, flexShrink: 0, opacity: sendingId ? 0.7 : 1 }}
          >
            {sendingId ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send forespørsel
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button" onClick={copyLink}
            style={{ background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: C.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, transition: `color 150ms ${EASE}` }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.sub)}
          >
            <Copy size={13} /> Kopier delbar lenke
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.muted }}>
            <QrCode size={14} /> Eller del som QR-kode på kvittering / i butikk
          </span>
        </div>
      </div>

      {/* ── Sendt og venter ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: C.ink }}>Sendt og venter</h3>
        {requests.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Ingen forespørsler ennå. Legg inn en kunde over.</p>
        ) : (
          <div>
            {requests.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i > 0 ? `1px solid ${C.hair}` : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{r.customer_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>
                    {r.channel === 'sms' ? 'SMS' : 'E-post'} · {timeAgoNo(r.sent_at ?? r.created_at)}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: r.status === 'failed' ? C.red : r.status === 'responded' ? C.green : C.sub, background: r.status === 'failed' ? '#FBECEB' : r.status === 'responded' ? C.greenBg : C.subtle, border: `1px solid ${r.status === 'failed' ? 'rgba(180,35,31,0.20)' : r.status === 'responded' ? 'rgba(21,121,90,0.20)' : C.border}`, borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap' }}>{reviewStatusLabel(r.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Siste anmeldelser (ekte, fra Google Places) ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>Siste anmeldelser{companyName ? ` · ${companyName}` : ''}</h3>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {!gbpConnected && (
              <button type="button" onClick={connectGbp} disabled={gbpConnecting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: gbpConnecting ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, color: C.green, padding: 0 }}>
                {gbpConnecting ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />} Svar på anmeldelser
              </button>
            )}
            {hasPlaceId && (
              <button type="button" onClick={() => loadGoogle(true)} disabled={loadingGoogle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: loadingGoogle ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, color: C.muted, padding: 0 }}>
                <RefreshCw size={13} className={loadingGoogle ? 'animate-spin' : ''} /> {google?.updatedAt ? `Oppdatert ${timeAgoNo(google.updatedAt)}` : 'Oppdater'}
              </button>
            )}
          </div>
        </div>

        {gbpConnected && gbpReviews && gbpReviews.length > 0 ? (
          <div>
            {gbpReviews.map((r, i) => (
              <div key={r.reviewId || i} style={{ padding: '14px 0', borderTop: i > 0 ? `1px solid ${C.hair}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <StarRow n={Math.round(r.rating)} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.author}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgoNo(r.when)}</span>
                </div>
                {r.text && <p style={{ margin: '7px 0 0', fontSize: 13, lineHeight: 1.55, color: C.sub }}>{r.text}</p>}
                {r.reply != null ? (
                  <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${C.greenBg}` }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.green }}>Ditt svar</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.5, color: C.sub }}>{r.reply}</p>
                  </div>
                ) : replyOpenId === r.reviewId ? (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3}
                      placeholder="Skriv et vennlig, kort svar …"
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: "'Geist','DM Sans',sans-serif" }}
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button type="button" onClick={() => submitReply(r.reviewId)} disabled={replyingId === r.reviewId} style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: replyingId === r.reviewId ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: replyingId === r.reviewId ? 0.7 : 1 }}>
                        {replyingId === r.reviewId ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Publiser svar
                      </button>
                      <button type="button" onClick={() => { setReplyOpenId(null); setReplyText(''); }} style={{ background: 'none', border: 'none', fontSize: 12.5, fontWeight: 600, color: C.muted, cursor: 'pointer' }}>Avbryt</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setReplyOpenId(r.reviewId); setReplyText(''); }} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: C.green }}>
                    Svar →
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : !hasPlaceId ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: '12px 14px', background: C.subtle, border: `1px solid ${C.hair}` }}>
            <Info size={15} style={{ color: C.muted, flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.sub }}>
              Søk opp bedriften din over for å hente <strong style={{ color: C.ink }}>ekte snittvurdering og de siste anmeldelsene</strong> fra Google.
            </p>
          </div>
        ) : loadingGoogle && !google ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', fontSize: 13, color: C.muted }}>
            <Loader2 size={15} className="animate-spin" /> Henter anmeldelser fra Google …
          </div>
        ) : googleError ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderRadius: 10, padding: '12px 14px', background: 'var(--dangerbg)', border: `1px solid rgba(180,35,31,0.20)`, fontSize: 12.5, color: C.red }}>
            <span>{googleError}</span>
            <button onClick={() => loadGoogle(true)} style={{ fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Prøv igjen</button>
          </div>
        ) : google && google.reviews.length > 0 ? (
          <div>
            {google.reviews.map((r, i) => (
              <div key={i} style={{ padding: '14px 0', borderTop: i > 0 ? `1px solid ${C.hair}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <StarRow n={Math.round(r.rating)} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.author}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap', flexShrink: 0 }}>{r.when}</span>
                </div>
                {r.text && <p style={{ margin: '7px 0 0', fontSize: 13, lineHeight: 1.55, color: C.sub }}>{r.text}</p>}
                <button
                  type="button"
                  onClick={connectGbp}
                  style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: C.green }}
                >
                  Svar →
                </button>
              </div>
            ))}
            <p style={{ margin: '12px 0 0', fontSize: 11.5, color: C.faint }}>Google viser inntil 5 anmeldelser her. Snitt og totalt antall står i toppen.</p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {google?.count ? 'Google har ikke delt tekst-anmeldelser for visning ennå. Snitt og antall står i toppen.' : 'Ingen anmeldelser å vise ennå. Be fornøyde kunder om den første over.'}
          </p>
        )}
      </div>

      {/* ── Vis stjernene på nettsiden din (widget + schema) ── */}
      {canShowOnSite && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <SectionTitle>Vis stjernene på nettsiden din</SectionTitle>
          <p style={{ margin: '8px 0 18px', fontSize: 13.5, lineHeight: 1.6, color: C.sub, maxWidth: 600 }}>
            Bygget fra dine <strong style={{ color: C.ink }}>ekte Google-tall</strong> ({google!.rating!.toFixed(1)} ★ · {google!.count} anmeldelser). Schema-koden lar Google vise gullstjerner under siden din i søk; widgeten viser dem rett på siden.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {wpConnected && (
              <button
                type="button" onClick={pushSchemaToWp} disabled={pushingSchema}
                onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
                style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: pushingSchema ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: `transform 160ms ${EASE}`, opacity: pushingSchema ? 0.7 : 1 }}
              >
                {pushingSchema ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Publiser på WordPress
              </button>
            )}
            <button type="button" onClick={copyWidget} style={{ background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: C.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Copy size={13} /> Kopier widget-kode
            </button>
            <button type="button" onClick={copySchema} style={{ background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: C.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Code2 size={13} /> Kopier schema-kode
            </button>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 12, lineHeight: 1.55, color: C.muted }}>
            {wpConnected
              ? 'WordPress er koblet til — «Publiser» legger schema rett inn for deg. Widgeten limer du inn der du vil ha den.'
              : 'Lim schema-koden inn i <head> (eller en «egendefinert HTML»-blokk), og widgeten der du vil vise stjernene. Fungerer på Wix, Squarespace, Shopify m.fl.'}
          </p>
        </div>
      )}

      {/* ── Privat tilbakemelding (valgfritt, uten gating) ── */}
      {settings && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 360px' }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C.ink }}>Spør «hvordan gikk det?» først (valgfritt)</p>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.55, color: C.sub }}>
              Legg til et lite, privat spørsmål i e-posten før Google-lenken. Den <strong style={{ color: C.ink }}>offentlige lenken vises alltid</strong> uansett — Google forbyr å skjule den for misfornøyde kunder.
            </p>
          </div>
          <button
            type="button" onClick={togglePrivateFeedback}
            aria-pressed={settings.private_feedback_enabled}
            style={{ position: 'relative', width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0, background: settings.private_feedback_enabled ? C.green : C.border, transition: `background 180ms ${EASE}` }}
          >
            <span style={{ position: 'absolute', top: 3, left: settings.private_feedback_enabled ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface)', transition: `left 180ms ${EASE}` }} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const KonkurrenterPage: React.FC<{
  user: any;
  theme: PortalTheme;
  hasStandardOrHigher: boolean;
  hasPremium: boolean;
  onUpgrade: (targetPlan?: 'Basic' | 'Standard' | 'Premium') => void;
}> = ({ user, theme, hasStandardOrHigher, hasPremium, onUpgrade }) => {
  // Colour tokens — «warm-neutral Linear»-systemet (samme som resten av dashbordet)
  // Ett kildested: alias til PORTAL (ingen duplisert hex).
  const C = {
    bg: PORTAL.bg, card: PORTAL.card, ink: PORTAL.ink, green: PORTAL.success,
    muted: PORTAL.muted, border: PORTAL.border, sub: PORTAL.sub, faint: PORTAL.faint,
    hair: PORTAL.hair, subtle: PORTAL.subtle,
  } as const;

  // Custom easing (Emil: never use default CSS easings)
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

  // Shared button press helpers
  const pressDown  = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; };
  const pressReset = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; };

  const isMobile = useIsMobile(); // stabler 2-kolonners grids + krymper modaler på telefon

  void theme; // palette is always hardcoded — theme prop kept for API compatibility

  const { competitors, opportunities, loading, error, refetch } = useCompetitorData(user?.id ?? null);
  const { changes, unreadCount, markAllRead }                    = useCompetitorChanges(user?.id, 20);

  const [showAddModal,      setShowAddModal]      = useState(false);
  const [addDomain,         setAddDomain]         = useState('');
  const [addLoading,        setAddLoading]        = useState(false);
  const [addError,          setAddError]          = useState<string | null>(null);
  const [scanningId,        setScanningId]        = useState<string | null>(null);
  const [scanAllProgress,   setScanAllProgress]   = useState<{ done: number; total: number } | null>(null);
  const [selectedComp,      setSelectedComp]      = useState<Competitor | null>(null);
  const [compRankings,      setCompRankings]      = useState<CompetitorKeywordRanking[]>([]);
  const [rankingsLoading,   setRankingsLoading]   = useState(false);
  const [oppFilter,         setOppFilter]         = useState<'all' | 'easy' | 'high_value'>('all');
  const [generateTarget,    setGenerateTarget]    = useState<KeywordOpportunity | null>(null);
  const [generateLoading,   setGenerateLoading]   = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const maxCompetitors = hasPremium ? 99 : 3;
  const totalTraffic = opportunities.reduce((s, o) => s + (o.estimated_traffic || 0), 0);
  const easyCount = opportunities.filter((o) => o.difficulty === 'easy').length;
  const highValueCount = opportunities.filter((o) => o.estimated_traffic > 500).length;

  const filteredOpps = opportunities.filter((o) => {
    if (oppFilter === 'easy') return o.difficulty === 'easy';
    if (oppFilter === 'high_value') return o.estimated_traffic > 500;
    return true;
  });

  const getAccessTokenForApi = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? getStoredAccessToken();
  };

  // --- Legg til konkurrent ---
  const handleAddCompetitor = async () => {
    const raw = addDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    if (!/^[a-z0-9][a-z0-9\-\.]{1,60}[a-z0-9](\.[a-z]{2,})$/i.test(raw)) {
      setAddError('Ugyldig domenenavn. Skriv f.eks. «konkurrent.no».');
      return;
    }
    if (competitors.length >= maxCompetitors) {
      setShowUpgradePrompt(true);
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      // 1. Lag raden i Supabase — user_id må være auth.users.id (samme som JWT). Ikke bruk bare getUser(); session/JWT er mer pålitelig i nettleseren.
      const color = getAvatarColor(raw);
      const uid = await getCompetitorScopeUserId(user?.id ?? null);
      if (!uid) {
        throw new Error('Kunne ikke hente bruker-ID. Oppdater siden og logg inn på nytt, og prøv igjen.');
      }
      const { data: newComp, error: insertError } = await supabase
        .from('competitors')
        .insert({ user_id: uid, domain: raw, avatar_color: color, competitor_type: 'main' })
        .select('*')
        .single();
      if (insertError || !newComp) throw insertError || new Error('Klarte ikke å opprette konkurrent');
      setShowAddModal(false);
      setAddDomain('');
      toastInfo(`Analyserer ${raw}… Dette tar 1–2 minutter.`);
      // 2. Kjør scan umiddelbart i bakgrunnen
      setScanningId(newComp.id);
      const token = await getAccessTokenForApi();
      if (!token) {
        toastError('Sesjon utløpt — logg inn på nytt for å skanne.');
        await refetch();
        return;
      }
      const scanRes = await fetch('/api/scan-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ competitor_id: newComp.id }),
      });
      const scanData = await scanRes.json().catch(() => ({}));
      if (isApiRateLimited(scanRes.status, scanData)) {
        toastWarning(apiRateLimitUserMessage(scanData));
      } else if (!scanRes.ok) {
        const msg = [scanData?.error, scanData?.hint].filter(Boolean).join(' — ');
        toastError(msg || 'Scanning feilet — prøv igjen om litt.');
      } else toastSuccess(scanData?.message || `${raw} er lagt til og skannet.`);
      await refetch();
    } catch (e: any) {
      setAddError(e?.message || 'Kunne ikke legge til konkurrenten.');
    } finally {
      setAddLoading(false);
      setScanningId(null);
    }
  };

  // --- Skann på nytt ---
  const handleRescan = async (comp: Competitor) => {
    setScanningId(comp.id);
    try {
      const token = await getAccessTokenForApi();
      if (!token) {
        toastError('Sesjon utløpt — logg inn på nytt for å skanne.');
        return;
      }
      const res = await fetch('/api/scan-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ competitor_id: comp.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (isApiRateLimited(res.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
      } else if (!res.ok) {
        const msg = [data?.error, data?.hint].filter(Boolean).join(' — ');
        toastError(msg || 'Scanning feilet.');
      } else toastSuccess(data?.message || 'Scanning fullført.');
      await refetch();
    } catch (e: any) {
      toastError(e?.message || 'Kunne ikke skanne konkurrenten akkurat nå.');
    } finally {
      setScanningId(null);
    }
  };

  // --- Skann alle konkurrenter (sekvensielt for å unngå timeout/rate-limit) ---
  const handleScanAll = async () => {
    if (scanAllProgress || scanningId || competitors.length === 0) return;
    const token = await getAccessTokenForApi();
    if (!token) {
      toastError('Sesjon utløpt — logg inn på nytt for å skanne.');
      return;
    }
    const list = [...competitors];
    setScanAllProgress({ done: 0, total: list.length });
    let ok = 0;
    let rateLimited = false;
    for (let i = 0; i < list.length; i++) {
      try {
        const res = await fetch('/api/scan-competitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ competitor_id: list[i].id }),
        });
        const data = await res.json().catch(() => ({}));
        if (isApiRateLimited(res.status, data)) { rateLimited = true; break; }
        if (res.ok) ok += 1;
      } catch { /* hopp over og fortsett med neste */ }
      setScanAllProgress({ done: i + 1, total: list.length });
    }
    setScanAllProgress(null);
    await refetch();
    if (rateLimited) toastWarning('Skanningen ble pauset av rate-grense. Prøv resten om litt.');
    else if (ok === list.length) toastSuccess(`Skannet ${ok} ${ok === 1 ? 'konkurrent' : 'konkurrenter'}.`);
    else toastWarning(`Skannet ${ok} av ${list.length} — noen feilet. Prøv på nytt.`);
  };

  // --- Last detaljer for valgt konkurrent ---
  const handleSelectCompetitor = useCallback(async (comp: Competitor) => {
    setSelectedComp(comp);
    setRankingsLoading(true);
    try {
      const rows = await supabaseRest<CompetitorKeywordRanking[]>(
        `competitor_keyword_rankings?competitor_id=eq.${comp.id}&select=*&order=position.asc&limit=50`,
      );
      setCompRankings(Array.isArray(rows) ? rows : []);
    } catch { setCompRankings([]); } finally { setRankingsLoading(false); }
  }, []);

  // Auto-select first competitor once data loads
  useEffect(() => {
    if (!loading && competitors.length > 0 && !selectedComp) {
      handleSelectCompetitor(competitors[0]);
    }
  }, [loading, competitors, selectedComp, handleSelectCompetitor]);

  // --- Generer side ---
  const handleGeneratePage = async () => {
    if (!generateTarget) return;
    setGenerateLoading(true);
    try {
      const token = getStoredAccessToken();
      const res = await fetch('/api/generate-page-from-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyword_opportunity_id: generateTarget.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data?.error || 'Kunne ikke generere siden.');
      } else {
        if (data?.url) toastSuccess(`Siden er publisert! ${data.url}`);
        else toastSuccess('Innholdet er generert. Publiser via din CMS-integrasjon.');
        await refetch();
      }
    } catch (e: any) {
      toastError(e?.message || 'Kunne ikke generere siden akkurat nå.');
    } finally {
      setGenerateLoading(false);
      setGenerateTarget(null);
    }
  };

  // CSV export for selected competitor rankings
  const exportCSV = () => {
    if (!compRankings.length || !selectedComp) return;
    const rows = [
      ['Søkeord', 'Posisjon', 'URL'],
      ...compRankings.map(r => [r.keyword, String(r.position), r.url || '']),
    ];
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${selectedComp.domain}-rangeringer.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derived values
  const competitorMap: Record<string, string> = {};
  competitors.forEach(c => { competitorMap[c.id] = c.domain; });

  const lastScannedGlobal = competitors
    .filter(c => c.last_scanned_at)
    .sort((a, b) => new Date(b.last_scanned_at!).getTime() - new Date(a.last_scanned_at!).getTime())[0]
    ?.last_scanned_at;

  const formatScanDate = (d: string | null | undefined) => {
    if (!d) return null;
    const dt = new Date(d);
    return dt.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
      + ' · '
      + dt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  };

  // ISO week number
  const weekNumber = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const ys = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  })();

  const changeConfig: Record<string, { symbol: string; positive: boolean }> = {
    new_page:      { symbol: '↑', positive: true  },
    removed_page:  { symbol: '↓', positive: false },
    new_keyword:   { symbol: '✦', positive: true  },
    rank_improved: { symbol: '↑', positive: true  },
    rank_dropped:  { symbol: '↓', positive: false },
  };

  // === BASIC — Locked state ===
  if (!hasStandardOrHigher) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', fontFamily: "'Geist','DM Sans',sans-serif" }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 440 }}>
          <Lock size={28} style={{ color: C.muted, margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ color: C.ink, fontWeight: 700, fontSize: 20, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Konkurrent-analyse er låst</h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
            Se hvilke søkeord konkurrentene rangerer på som du mangler. Tilgjengelig i Standard og oppover.
          </p>
          <button
            onClick={() => onUpgrade('Standard')}
            style={{ background: C.ink, color: '#fff', padding: '11px 22px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
            onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
          >
            <Sparkles size={14} /> Oppgrader til Standard
          </button>
        </div>
      </div>
    );
  }

  // === STANDARD / PREMIUM ===
  return (
    <div style={{ fontFamily: "'Geist','DM Sans',sans-serif" }}>
      {/* ── ACTION BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 20, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
          {hasPremium ? 'Premium' : 'Standard'} · {competitors.length} av {maxCompetitors} konkurrenter
          {lastScannedGlobal ? ` · sist skannet ${formatScanDate(lastScannedGlobal)}` : ''}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {scanningId && !scanAllProgress && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.green }}>
              <span style={{ width: 7, height: 7, background: C.green, borderRadius: '50%', display: 'inline-block' }} />
              Skanner aktiv
            </span>
          )}
          {competitors.length > 0 && (
            <button
              onClick={handleScanAll}
              disabled={!!scanAllProgress || !!scanningId}
              style={{ background: C.bg, color: C.ink, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: (scanAllProgress || scanningId) ? 'not-allowed' : 'pointer', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, opacity: (scanAllProgress || scanningId) ? 0.6 : 1, transition: `transform 160ms ${EASE}` }}
              onMouseDown={e => { if (!scanAllProgress && !scanningId) pressDown(e); }} onMouseUp={pressReset} onMouseLeave={pressReset}
            >
              {scanAllProgress ? (
                <><Loader2 size={14} className="animate-spin" /> Skanner {scanAllProgress.done}/{scanAllProgress.total}</>
              ) : (
                <><RefreshCw size={14} /> Skann alle</>
              )}
            </button>
          )}
          <button
            onClick={() => { if (competitors.length >= maxCompetitors) { setShowUpgradePrompt(true); return; } setShowAddModal(true); }}
            style={{ background: C.ink, color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6, transition: `transform 160ms ${EASE}` }}
            onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
          >
            <Plus size={14} /> Legg til konkurrent
          </button>
        </div>
      </div>

      {/* ── SINGLE-COLUMN LAYOUT ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* SAMMENDRAG-KORT */}
          {loading ? (
            <div style={{ height: 88, display: 'flex', alignItems: 'center' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: C.muted }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Konkurrenter overvåket', value: String(competitors.length), green: false },
                { label: 'Åpne muligheter', value: String(opportunities.length), green: false },
                { label: 'Mulige besøk /mnd', value: `+${formatVolume(totalTraffic)}`, green: true },
              ].map((s) => (
                <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, margin: 0 }}>{s.label}</p>
                  <p style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, margin: '10px 0 0', color: s.green ? C.green : C.ink, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--dangerbg)', border: '1px solid #ffd0d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span>{error}</span>
              <button onClick={refetch} style={{ fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Prøv igjen</button>
            </div>
          )}

          {/* COMPETITOR TABS */}
          {!loading && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {competitors.map(c => {
                const isActive  = selectedComp?.id === c.id;
                const isScanning = scanningId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCompetitor(c)}
                    style={{
                      background: isActive ? C.ink : C.card,
                      border:     `1px solid ${isActive ? C.ink : C.border}`,
                      borderRadius: 12,
                      padding: '12px 18px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: `all 180ms ${EASE}`,
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = C.ink; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = C.border; }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#fff' : C.ink, margin: 0 }}>{c.domain}</p>
                    <p style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.55)' : C.muted, margin: '4px 0 0' }}>
                      {isScanning ? 'Analyserer…' : c.keyword_count > 0
                        ? `${c.keyword_count} søkeord · snitt #${c.avg_position ?? '?'}`
                        : 'Ikke skannet ennå'}
                    </p>
                  </button>
                );
              })}
              {competitors.length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '12px 18px', cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 600 }}
                >
                  + Legg til din første konkurrent
                </button>
              )}
            </div>
          )}

          {/* SELECTED COMPETITOR DETAIL (inline) */}
          {selectedComp && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 28px' }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Konkurrent</p>
                  <h2 style={{ fontSize: 'clamp(20px, 2.2vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: 0, lineHeight: 1.1 }}>{selectedComp.domain}</h2>
                  <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>
                    {selectedComp.last_scanned_at
                      ? `Sist skannet ${new Date(selectedComp.last_scanned_at).toLocaleString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : 'Aldri skannet'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Søkeord</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: 0, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>{selectedComp.keyword_count ? selectedComp.keyword_count : 'Skann for å telle'}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Snittplassering</p>
                    <p style={{ fontSize: 36, fontWeight: 600, color: C.ink, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {selectedComp.avg_position ? `#${selectedComp.avg_position}` : 'Måles ved skann'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
                    <button
                      onClick={() => handleRescan(selectedComp)}
                      disabled={scanningId === selectedComp.id}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', cursor: scanningId === selectedComp.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.ink, opacity: scanningId === selectedComp.id ? 0.5 : 1, transition: `transform 160ms ${EASE}` }}
                      onMouseDown={e => { if (!scanningId) pressDown(e); }}
                      onMouseUp={pressReset} onMouseLeave={pressReset}
                    >
                      {scanningId === selectedComp.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Skann
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Fjern ${selectedComp.domain}?`)) return;
                        try {
                          await supabase.from('competitors').delete().eq('id', selectedComp.id);
                          setSelectedComp(null); setCompRankings([]);
                          await refetch(); toastSuccess('Konkurrent fjernet.');
                        } catch (e: any) { toastError(e?.message || 'Kunne ikke fjerne.'); }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.muted, padding: '7px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, transition: `color 150ms ${EASE}` }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#c0392b')}
                      onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                    >
                      <Trash2 size={13} /> Fjern
                    </button>
                  </div>
                </div>
              </div>

              {/* Rankings */}
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>Søkeord de rangerer på · topp 20</p>
                  <button
                    onClick={exportCSV}
                    disabled={!compRankings.length}
                    style={{ fontSize: 11, fontWeight: 600, color: C.muted, background: 'none', border: 'none', cursor: compRankings.length ? 'pointer' : 'not-allowed', padding: '4px 8px', borderRadius: 6, transition: `color 150ms ${EASE}` }}
                    onMouseEnter={e => { if (compRankings.length) e.currentTarget.style.color = C.ink; }}
                    onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                  >
                    Eksporter CSV
                  </button>
                </div>
                {rankingsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', justifyContent: 'center' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: C.muted }} />
                    <span style={{ fontSize: 13, color: C.muted }}>Laster rangeringer…</span>
                  </div>
                ) : compRankings.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '24px 0', margin: 0 }}>
                    Ingen rangeringer ennå — trykk «Skann». Første tall kommer vanligvis innen noen minutter.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 2, background: C.border, borderRadius: 10, overflow: 'hidden' }}>
                    {compRankings.slice(0, 20).map(r => (
                      <div key={r.id} style={{ background: C.card, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums', borderRadius: 6, padding: '2px 7px', alignSelf: 'flex-start',
                          color: r.position <= 3 ? '#15795A' : r.position <= 10 ? '#3F7D33' : r.position <= 20 ? '#9A6700' : C.muted,
                          background: r.position <= 3 ? '#E8F1EB' : r.position <= 10 ? '#EEF4E9' : r.position <= 20 ? '#F6EEDD' : C.bg }}>
                          #{r.position}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.keyword}</p>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 10, color: C.muted, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: `color 120ms ${EASE}` }}
                              onMouseEnter={e => (e.currentTarget.style.color = C.ink)}
                              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                            >
                              {r.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPPORTUNITIES */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <SectionTitle>Søkeord du kan ta</SectionTitle>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: C.muted }}>
                  {opportunities.length} totalt · {easyCount} lette · {highValueCount} høy verdi
                </span>
                {(['all', 'easy', 'high_value'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setOppFilter(f)}
                    style={{
                      padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: oppFilter === f ? C.ink : C.card,
                      color:      oppFilter === f ? '#fff' : C.muted,
                      border: `1px solid ${oppFilter === f ? C.ink : C.border}`,
                      transition: `all 150ms ${EASE}`,
                    }}
                  >
                    {f === 'all' ? 'Alle' : f === 'easy' ? 'Lette' : 'Høy verdi'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 }}>
                <Loader2 size={16} className="animate-spin" style={{ color: C.muted }} />
                <span style={{ fontSize: 13, color: C.muted }}>Analyserer søkeord-gap…</span>
              </div>
            ) : filteredOpps.length === 0 ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: 'center' }}>
                <Search size={32} style={{ color: C.border, margin: '0 auto 12px', display: 'block' }} />
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
                  {opportunities.length === 0
                    ? 'Legg til eller skann konkurrenter. Søkeord-gap vises her etter neste skann.'
                    : 'Ingen treff i dette filteret.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
                {filteredOpps.map((opp, i) => {
                  const diffLabel = opp.difficulty === 'easy' ? 'Lett' : opp.difficulty === 'medium' ? 'Middels' : 'Vanskelig';
                  const diffDots  = opp.difficulty === 'easy' ? '●' : opp.difficulty === 'medium' ? '●●' : '●●●';
                  const diffColor = opp.difficulty === 'easy' ? C.green : opp.difficulty === 'medium' ? C.muted : C.ink;
                  const rankedBy  = (opp.competitor_ids || []).slice(0, 3).map((id: string) => competitorMap[id]).filter(Boolean);
                  return (
                    <div
                      key={opp.id}
                      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, animationDelay: `${i * 45}ms` }}
                      className="sikt-stagger-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.3, flex: 1 }}>{opp.keyword}</h3>
                        <span style={{ fontSize: 10, fontWeight: 600, color: diffColor, flexShrink: 0, whiteSpace: 'nowrap' }}>{diffDots} {diffLabel}</span>
                      </div>
                      {opp.recommendation_text && (
                        <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 }}>{opp.recommendation_text}</p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Søk per måned</p>
                          <p style={{ fontSize: 22, fontWeight: 600, color: C.ink, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                            {formatVolume(opp.search_volume)}<span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>/mnd</span>
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Mulige besøk</p>
                          <p style={{ fontSize: 22, fontWeight: 600, color: C.green, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                            +{opp.estimated_traffic}<span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}> besøk</span>
                          </p>
                        </div>
                      </div>
                      {rankedBy.length > 0 && (
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, margin: '0 0 6px' }}>Hvem ligger der i dag</p>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {rankedBy.map((domain: string) => (
                              <span key={domain} style={{ fontSize: 10, fontWeight: 700, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 8px', color: C.ink }}>
                                {domain}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => setGenerateTarget(opp)}
                        style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', transition: `transform 160ms ${EASE}` }}
                        onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
                      >
                        <Sparkles size={11} /> Generer side
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!hasPremium && competitors.length >= 3 && (
              <div style={{ marginTop: 12, padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Overvåk ubegrenset antall konkurrenter</p>
                <button
                  onClick={() => onUpgrade('Premium')}
                  style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: `transform 160ms ${EASE}` }}
                  onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
                >
                  Premium → 4 990 kr
                </button>
              </div>
            )}
          </div>
        {/* ── ENDRINGER (full bredde, nederst) ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SectionTitle size="sm">Endringer hos konkurrentene</SectionTitle>
              {unreadCount > 0 && (
                <span style={{ background: C.ink, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 100, padding: '2px 8px', fontVariantNumeric: 'tabular-nums' }}>{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 12, fontWeight: 500, color: C.sub, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: `color 120ms ${EASE}` }}
                onMouseEnter={e => (e.currentTarget.style.color = C.ink)}
                onMouseLeave={e => (e.currentTarget.style.color = C.sub)}
              >
                Merk alt lest
              </button>
            )}
          </div>
          {changes.length === 0 ? (
            <p style={{ fontSize: 13, color: C.muted, padding: '8px 0', margin: 0 }}>Ingen endringer enda. Varsler dukker opp her etter neste skann.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 24px' }}>
              {changes.slice(0, 8).map((change) => {
                const cfg = changeConfig[change.change_type] || { symbol: '●', positive: true };
                return (
                  <div
                    key={change.id}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.hair}`, opacity: change.is_read ? 0.5 : 1, transition: `opacity 150ms ${EASE}` }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: cfg.positive ? 'rgba(21,121,90,0.10)' : 'rgba(26,26,26,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.positive ? C.green : C.muted }}>{cfg.symbol}</span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.ink, margin: 0, lineHeight: 1.4 }}>{change.title}</p>
                      {change.detail && (
                        <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{change.detail}</p>
                      )}
                      <p style={{ fontSize: 10, fontWeight: 500, color: C.faint, margin: '4px 0 0' }}>{kpTimeAgo(change.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>{/* end single column */}

      {/* ── MODALS ── */}

      {/* ADD COMPETITOR */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)', backdropFilter: 'blur(6px)' }} onClick={() => { setShowAddModal(false); setAddError(null); setAddDomain(''); }} />
          <div style={{ position: 'relative', background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }} className="sikt-stagger-item">
            <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink, margin: '0 0 6px' }}>Legg til konkurrent</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 18px', lineHeight: 1.5 }}>Skriv inn domenenavnet uten «https://» eller «www.»</p>
            <input
              type="text" value={addDomain} onChange={e => setAddDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCompetitor()}
              placeholder="konkurrent.no" autoFocus
              style={{ width: '100%', borderRadius: 10, padding: '11px 14px', fontSize: 14, border: `1px solid ${C.border}`, color: C.ink, background: C.bg, outline: 'none', boxSizing: 'border-box', marginBottom: 8, transition: `border-color 150ms ${EASE}` }}
              onFocus={e => (e.currentTarget.style.borderColor = C.ink)}
              onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
            />
            {addError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 12px' }}>{addError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleAddCompetitor} disabled={addLoading || !addDomain.trim()}
                style={{ flex: 1, background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: addLoading || !addDomain.trim() ? 'not-allowed' : 'pointer', opacity: addLoading || !addDomain.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
                onMouseDown={e => { if (!addLoading && addDomain.trim()) pressDown(e); }}
                onMouseUp={pressReset} onMouseLeave={pressReset}
              >
                {addLoading ? <><Loader2 size={13} className="animate-spin" /> Analyserer…</> : 'Legg til og skann'}
              </button>
              <button onClick={() => { setShowAddModal(false); setAddError(null); setAddDomain(''); }}
                style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Avbryt</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE PAGE */}
      {generateTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)', backdropFilter: 'blur(6px)' }} onClick={() => { if (!generateLoading) setGenerateTarget(null); }} />
          <div style={{ position: 'relative', background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }} className="sikt-stagger-item">
            <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink, margin: '0 0 8px' }}>Generer side for «{generateTarget.keyword}»?</h3>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <ul style={{ fontSize: 12, color: C.muted, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <li>✦ AI skriver SEO-optimalisert innhold på 800–1200 ord</li>
                <li>✦ Optimaliserer meta-tittel og meta-beskrivelse</li>
                {generateTarget.recommendation_type === 'faq' && <li>✦ Strukturerer som FAQ med schema markup</li>}
                <li>✦ Publiserer via din CMS-integrasjon (hvis tilkoblet)</li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGeneratePage} disabled={generateLoading}
                style={{ flex: 1, background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: generateLoading ? 'not-allowed' : 'pointer', opacity: generateLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
                onMouseDown={e => { if (!generateLoading) pressDown(e); }}
                onMouseUp={pressReset} onMouseLeave={pressReset}
              >
                {generateLoading ? <><Loader2 size={13} className="animate-spin" /> AI skriver…</> : <><Sparkles size={13} /> Ja, generer</>}
              </button>
              <button onClick={() => { if (!generateLoading) setGenerateTarget(null); }}
                style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Avbryt</button>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE PROMPT */}
      {showUpgradePrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)', backdropFilter: 'blur(6px)' }} onClick={() => setShowUpgradePrompt(false)} />
          <div style={{ position: 'relative', background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.12)', textAlign: 'center' }} className="sikt-stagger-item">
            <div style={{ width: 48, height: 48, background: C.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Sparkles size={20} style={{ color: C.ink }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink, margin: '0 0 8px' }}>Grense nådd</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 22px', lineHeight: 1.6 }}>
              Du har nådd grensen på 3 konkurrenter med Standard. Oppgrader til Premium for ubegrenset overvåkning.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowUpgradePrompt(false); onUpgrade('Premium'); }}
                style={{ flex: 1, background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
              >Oppgrader til Premium</button>
              <button onClick={() => setShowUpgradePrompt(false)}
                style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Lukk</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// --- SIKT ACTIONS: flerlinje-logging fra skann (kun ekte tall fra respons) ---
type SiktLogEntry = {
  actionType: string;
  category: 'finding' | 'suggestion' | 'fix' | 'alert';
  title: string;
  details?: Record<string, unknown>;
  pageUrl?: string;
};

const buildAnalysisLogEntries = (mobile: AnalysisResult, pageUrl: string): SiktLogEntry[] => {
  const entries: SiktLogEntry[] = [
    { actionType: 'analysis_run', category: 'finding', title: `Mobil ytelse: ${mobile.performance}/100 (Lighthouse)`, details: { score: mobile.performance }, pageUrl },
    { actionType: 'analysis_run', category: 'finding', title: `Mobil SEO: ${mobile.seo}/100`, details: { seo: mobile.seo }, pageUrl },
    { actionType: 'analysis_run', category: 'finding', title: `Mobil tilgjengelighet: ${mobile.accessibility}/100`, details: { accessibility: mobile.accessibility }, pageUrl },
    { actionType: 'analysis_run', category: 'finding', title: `Mobil beste praksis: ${mobile.bestPractices}/100`, details: { best_practices: mobile.bestPractices }, pageUrl },
  ];
  const failed = (mobile.diagnostics || []).filter((d) => !d.passed);
  if (failed.length > 0) {
    entries.push({
      actionType: 'analysis_run',
      category: 'finding',
      title: `${failed.length} tekniske sjekkpunkter trenger oppmerksomhet`,
      details: { checks: failed.map((d) => d.title) },
      pageUrl,
    });
  }
  const opps = mobile.opportunities || [];
  if (opps.length > 0) {
    entries.push({
      actionType: 'analysis_run',
      category: 'finding',
      title: `${opps.length} forbedringsmuligheter identifisert på mobil`,
      details: { count: opps.length },
      pageUrl,
    });
    opps.slice(0, 3).forEach((o) => {
      entries.push({
        actionType: 'analysis_run',
        category: 'suggestion',
        title: o.savings ? `${o.title} (${o.savings})` : o.title,
        details: { savings: o.savings || null },
        pageUrl,
      });
    });
  }
  return entries.slice(0, 8);
};

const buildContentScanLogEntries = (pages: any[], pageUrl?: string): SiktLogEntry[] => {
  if (!pages.length) return [];
  const critical = pages.filter((p) => p.status === 'Kritisk').length;
  const warning = pages.filter((p) => p.status === 'Advarsel').length;
  const good = pages.filter((p) => p.status === 'Bra').length;
  const missingMeta = pages.filter((p) => (p.issues || []).some((i: string) => /meta/i.test(i))).length;
  const missingH1 = pages.filter((p) => (p.issues || []).some((i: string) => /H1/i.test(i))).length;
  const entries: SiktLogEntry[] = [
    { actionType: 'content_scan', category: 'finding', title: `Skannet ${pages.length} sider på nettsiden`, details: { total_pages: pages.length }, pageUrl },
  ];
  if (critical > 0) entries.push({ actionType: 'content_scan', category: 'finding', title: `${critical} sider med kritisk innhold`, details: { critical }, pageUrl });
  if (warning > 0) entries.push({ actionType: 'content_scan', category: 'finding', title: `${warning} sider med advarsler (tynt innhold m.m.)`, details: { warning }, pageUrl });
  if (good > 0) entries.push({ actionType: 'content_scan', category: 'finding', title: `${good} sider uten alvorlige innholdsfunn`, details: { good }, pageUrl });
  if (missingMeta > 0) entries.push({ actionType: 'content_scan', category: 'suggestion', title: `${missingMeta} sider mangler meta-beskrivelse`, details: { missing_meta: missingMeta }, pageUrl });
  if (missingH1 > 0) entries.push({ actionType: 'content_scan', category: 'suggestion', title: `${missingH1} sider mangler H1`, details: { missing_h1: missingH1 }, pageUrl });
  return entries.slice(0, 6);
};

const buildLinkScanLogEntries = (linkPages: any[], pageUrl?: string): SiktLogEntry[] => {
  if (!linkPages.length) return [];
  const isolated = linkPages.filter((p) => p.status === 'Isolert' || p.inlinks === 0).length;
  const healthy = linkPages.filter((p) => p.status === 'Bra').length;
  const entries: SiktLogEntry[] = [
    { actionType: 'link_scan', category: 'finding', title: `Kartla lenker på ${linkPages.length} sider`, details: { total_pages: linkPages.length }, pageUrl },
  ];
  if (isolated > 0) entries.push({ actionType: 'link_scan', category: 'finding', title: `${isolated} isolerte sider uten innkommende lenker`, details: { isolated }, pageUrl });
  if (healthy > 0) entries.push({ actionType: 'link_scan', category: 'finding', title: `${healthy} sider med god lenkestruktur`, details: { healthy }, pageUrl });
  return entries.slice(0, 4);
};

type ContentFixFieldType = 'meta-description' | 'seo-title' | 'h1' | 'content';

type WordPressFetchYoast = {
  installed: boolean;
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
};

type WordPressFetchResponse = {
  ok: boolean;
  page: {
    id: number;
    type: string;
    slug: string;
    link: string;
    title: string;
    content: string;
    excerpt: string;
  };
  yoast: WordPressFetchYoast;
};

type PageContextQaEntry = {
  question: string;
  answer: string;
};

type PageContextAnswersLegacy = {
  goal: string;
  audience: string;
  differentiator: string;
};

type PageContextAnswersQa = {
  qa: PageContextQaEntry[];
};

type PageContextAnswers = PageContextAnswersLegacy | PageContextAnswersQa;

type ContextQuestion = {
  question: string;
  options: string[];
  optional?: boolean;
};

type ContentFixCacheEntry = {
  pageData: WordPressFetchResponse;
  aiSuggestion: string | null;
  fieldType: ContentFixFieldType;
  pageContextAnswers?: PageContextAnswers | null;
  contextQuestions?: ContextQuestion[];
};

type ContentFixActiveState = {
  todoId: string | null;
  loading:
    | 'fetching'
    | 'generating-questions'
    | 'questionnaire'
    | 'generating'
    | 'idle'
    | 'error';
  error: string | null;
};

const PAGE_CONTEXT_GOAL_OPTIONS = [
  'Få henvendelser / kontakt',
  'Selge et produkt eller en tjeneste',
  'Bygge tillit og troverdighet',
  'Informere eller forklare noe',
] as const;

const PAGE_CONTEXT_AUDIENCE_OPTIONS = [
  'Privatkunder',
  'Bedrifter',
  'Lokale kunder i nærområdet',
  'Hele landet / bredt publikum',
] as const;

const FALLBACK_QUESTIONS: ContextQuestion[] = [
  {
    question: 'Hva er hovedmålet med denne siden?',
    options: [...PAGE_CONTEXT_GOAL_OPTIONS],
  },
  {
    question: 'Hvem snakker siden til?',
    options: [...PAGE_CONTEXT_AUDIENCE_OPTIONS],
  },
  {
    question: 'Hva skiller deg fra konkurrentene?',
    options: [],
    optional: true,
  },
];

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseContextQuestionsResponse(raw: string): ContextQuestion[] | null {
  try {
    const parsed = JSON.parse(stripJsonFences(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const questionsRaw = (parsed as { questions?: unknown }).questions;
    if (!Array.isArray(questionsRaw)) return null;
    if (questionsRaw.length === 0) return [];

    const questions: ContextQuestion[] = [];
    for (const item of questionsRaw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const question = typeof row.question === 'string' ? row.question.trim() : '';
      if (!question) continue;
      const options = Array.isArray(row.options)
        ? row.options
            .filter((opt): opt is string => typeof opt === 'string' && opt.trim().length > 0)
            .map((opt) => opt.trim())
        : [];
      questions.push({ question, options });
    }

    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}

const RATE_LIMIT_USER_MESSAGE =
  'Vi har mange forespørsler akkurat nå — prøv igjen om et minutt.';

function isApiRateLimited(status: number, data: Record<string, unknown> | null | undefined): boolean {
  return status === 429 || data?.error === 'rate_limited';
}

function apiRateLimitUserMessage(data: Record<string, unknown> | null | undefined): string {
  const msg = data?.message;
  return typeof msg === 'string' && msg.trim() ? msg : RATE_LIMIT_USER_MESSAGE;
}

// Trekker ut ny meta-tittel/-beskrivelse fra et AI-kodeforslag, slik at vi kan
// vise kunden en ekte Google-forhåndsvisning («slik ser du ut i søk»).
function extractSerpPreview(
  sol: { codePatch?: unknown; effectiveUrl?: unknown } | null | undefined,
  fallbackUrl?: string,
): { title: string | null; description: string | null; host: string } | null {
  if (!sol) return null;
  const code = typeof sol.codePatch === 'string' ? sol.codePatch : '';
  if (!code) return null;
  const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch =
    code.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    code.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const title = titleMatch?.[1]?.trim() || null;
  const description = descMatch?.[1]?.trim() || null;
  if (!title && !description) return null;
  let host = '';
  const rawUrl = (typeof sol.effectiveUrl === 'string' && sol.effectiveUrl) || fallbackUrl || '';
  try {
    host = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }
  return { title, description, host };
}

function buildContextQuestionsPrompt(pageData: WordPressFetchResponse): string {
  const contentRaw = decodeHtmlEntities(stripHtmlTags(pageData.page.content || ''));
  const content = truncateText(contentRaw, 2000);
  return `Du skal hjelpe med å forbedre teksten på denne siden. Her er sidens innhold: ${content}. Lag 2-4 spørsmål som hjelper deg å forstå siden godt nok til å skrive best mulig innhold. Hvis du allerede forstår nok, returner færre eller ingen spørsmål. Hvert spørsmål skal ha 3-4 konkrete svaralternativer tilpasset denne siden. Kunden kan også skrive eget svar. Svar KUN med gyldig JSON, ingen forklaring, på dette formatet: {"questions":[{"question":"...","options":["...","..."]}]}`;
}

async function generateContextQuestions(
  pageData: WordPressFetchResponse,
  signal: AbortSignal,
  token: string,
): Promise<ContextQuestion[]> {
  try {
    const aiRes = await fetch('/api/openai-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: buildContextQuestionsPrompt(pageData),
        model: 'gpt-4o-mini',
        maxTokens: 600,
      }),
      signal,
    });
    const aiData = await aiRes.json().catch(() => ({}));
    if (signal.aborted) return [];
    if (isApiRateLimited(aiRes.status, aiData)) {
      toastWarning(apiRateLimitUserMessage(aiData));
      return FALLBACK_QUESTIONS;
    }
    if (!aiRes.ok) return FALLBACK_QUESTIONS;

    const parsed = parseContextQuestionsResponse(String(aiData.content || ''));
    if (parsed === null) return FALLBACK_QUESTIONS;
    return parsed;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
      throw err;
    }
    return FALLBACK_QUESTIONS;
  }
}

function normalizePageContextAnswers(raw: unknown): PageContextAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  if (Array.isArray(o.qa)) {
    const qa = o.qa
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const question = typeof row.question === 'string' ? row.question.trim() : '';
        const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((entry): entry is PageContextQaEntry => entry != null);
    if (qa.length > 0) return { qa };
    return null;
  }

  const goal = typeof o.goal === 'string' ? o.goal.trim() : '';
  const audience = typeof o.audience === 'string' ? o.audience.trim() : '';
  const differentiator = typeof o.differentiator === 'string' ? o.differentiator.trim() : '';
  if (!goal || !audience) return null;
  return { goal, audience, differentiator };
}

function buildPageContextPromptBlock(normalized: PageContextAnswers): string {
  if ('qa' in normalized && normalized.qa.length > 0) {
    return `\n\nKontekst om siden (oppgitt av kunden):
${normalized.qa.map((x) => `- ${x.question}: ${x.answer}`).join('\n')}

Bruk denne konteksten til å gjøre forslaget relevant. Ikke dikt opp fakta utover det som er oppgitt.`;
  }
  if ('goal' in normalized) {
    return `\n\nKontekst om siden (oppgitt av kunden):
- Sidens hovedmål: ${normalized.goal}
- Målgruppe: ${normalized.audience}${normalized.differentiator ? `\n- Det som skiller bedriften ut: ${normalized.differentiator}` : ''}

Bruk denne konteksten til å gjøre forslaget relevant for kundens faktiske situasjon. Ikke dikt opp fakta om bedriften utover det som er oppgitt.`;
  }
  return '';
}

async function savePageContextAnswers(
  pageUrl: string,
  answers: PageContextAnswers,
  userId: string,
  clientHostId: string | null,
): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('sikt_page_context').upsert(
      {
        user_id: userId,
        client_host_id: clientHostId,
        page_url: pageUrl,
        answers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,page_url' },
    );
    if (error) {
      console.warn('[Verksted] Kunne ikke lagre page context:', error.message);
    }
  } catch (err: unknown) {
    console.warn('[Verksted] Kunne ikke lagre page context:', err);
  }
}

const INITIAL_CONTENT_FIX_ACTIVE: ContentFixActiveState = {
  todoId: null,
  loading: 'idle',
  error: null,
};

function detectFieldType(issueString: string): ContentFixFieldType {
  const lower = (issueString || '').toLowerCase();
  if (
    lower.includes('meta') &&
    (lower.includes('beskrivelse') || lower.includes('description'))
  ) {
    return 'meta-description';
  }
  if (
    (lower.includes('seo') || lower.includes('meta')) &&
    (lower.includes('tittel') || lower.includes('title'))
  ) {
    return 'seo-title';
  }
  if (lower.includes('h1')) {
    return 'h1';
  }
  if (lower.includes('innhold') || lower.includes('tynt') || lower.includes('thin')) {
    return 'content';
  }
  return 'content';
}

type ContentChangeRow = {
  id: string;
  page_url: string;
  field: string;
  old_value: string | null;
  new_value: string;
  pushed_at: string;
  client_host_id: string | null;
};

// --- B1: Frittstående endringslogg --------------------------------------
// Gjør løftet «full endringslogg + 1-klikks angre» synlig sant. Lister alle
// aktive endringer Sikt har pushet til siden (sikt_changes) med før→etter og
// en angre-knapp per rad. Gjenbruker den eksisterende rollback-flyten via
// onRollback (executeContentFixRollback), så ingen ny backend-logikk trengs.
const CHANGE_FIELD_LABELS: Record<string, string> = {
  'seo-title': 'Sidetittel',
  'meta-description': 'Meta-beskrivelse',
  'h1': 'Overskrift (H1)',
  'content': 'Innhold',
};

const ChangelogPanel = ({
  changes,
  onRollback,
  colors,
}: {
  changes: ContentChangeRow[];
  onRollback: (changeId: string) => Promise<void>;
  colors: { card: string; ink: string; muted: string; border: string; sub: string; subtle: string; green: string };
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const sorted = [...changes].sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
  );
  const handle = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try { await onRollback(id); } finally { setBusyId(null); }
  };
  const prettyUrl = (u: string) => (u || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };
  return (
    <section style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: colors.subtle, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.ink }}>
          <FileEdit size={17} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.ink }}>Endringslogg</h2>
          <p style={{ margin: 0, fontSize: 12.5, color: colors.muted }}>Alt Sikt har endret på siden din — angre når som helst.</p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p style={{ marginTop: 14, fontSize: 13.5, color: colors.muted, background: colors.subtle, border: `1px dashed ${colors.border}`, borderRadius: 12, padding: '14px 16px' }}>
          Ingen aktive endringer enda. Når Sikt fikser noe på siden din, dukker det opp her — med før- og etterverdi og ett-klikks angre.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((c) => {
            const busy = busyId === c.id;
            const otherBusy = !!busyId && !busy;
            return (
              <li key={c.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, background: colors.subtle }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.sub }}>
                      {CHANGE_FIELD_LABELS[c.field] || c.field}
                    </span>
                    <div style={{ fontSize: 12.5, color: colors.muted, marginTop: 2, wordBreak: 'break-word' }}>
                      {prettyUrl(c.page_url)}{c.pushed_at ? ` · ${fmt(c.pushed_at)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handle(c.id)}
                    disabled={busy || otherBusy}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
                      color: colors.ink, background: 'var(--surface)', border: `1px solid ${colors.border}`,
                      borderRadius: 999, padding: '7px 14px', cursor: busy || otherBusy ? 'default' : 'pointer',
                      opacity: otherBusy ? 0.5 : 1, whiteSpace: 'nowrap',
                    }}
                  >
                    {busy ? <><Loader2 size={13} className="animate-spin" /> Angrer …</> : 'Angre'}
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.old_value != null && c.old_value !== '' && (
                    <div style={{ fontSize: 12.5, color: colors.muted, textDecoration: 'line-through', wordBreak: 'break-word' }}>
                      {c.old_value}
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.green, wordBreak: 'break-word' }}>
                    {c.new_value}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

type TodoChangeData = {
  field: string;
  old_value: string | null;
  new_value: string;
  pushed_at: string;
};

function pathLabelFromPageUrl(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    return parsed.pathname.replace(/\/$/, '') || '/';
  } catch {
    return pageUrl;
  }
}

function pageTitleFromPageUrl(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    const path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '/') return 'Forside';
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'Forside';
    return last.charAt(0).toUpperCase() + last.slice(1);
  } catch {
    return 'Forside';
  }
}

function solvedTitleForField(field: string): string {
  if (field === 'meta-description') return 'Mangler meta description (løst)';
  if (field === 'seo-title') return 'Mangler SEO-tittel (løst)';
  if (field === 'h1') return 'Mangler H1 (løst)';
  if (field === 'content') return 'Tynt innhold (løst)';
  return 'Innhold endret (løst)';
}

function formatPushedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}


function SnippetPreviewVariantToggle({
  value,
  onChange,
  ink,
  borderColor,
}: {
  value: 'desktop' | 'mobile';
  onChange: (next: 'desktop' | 'mobile') => void;
  ink: string;
  borderColor: string;
  muted: string;
}) {
  const options: Array<{ key: 'desktop' | 'mobile'; label: string }> = [
    { key: 'desktop', label: 'Desktop' },
    { key: 'mobile', label: 'Mobil' },
  ];
  return (
    <div
      role="group"
      aria-label="Forhåndsvisning"
      style={{
        display: 'inline-flex',
        border: `1px solid ${borderColor}`,
        borderRadius: 9,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            style={{
              border: 'none',
              background: active ? ink : '#FFFFFF',
              color: active ? '#FFFFFF' : ink,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), color 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 100ms ease-out',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const CONTENT_FIX_VALUE_COPY: Record<
  ContentFixFieldType,
  {
    title: string;
    whatItIs: string;
    whyItMatters: string;
    recommendations: string[];
  }
> = {
  'meta-description': {
    title: 'Hva du tjener på en god meta-beskrivelse',
    whatItIs: 'Den 2-3 setninger lange teksten under tittelen i Google-søk.',
    whyItMatters:
      'Påvirker hvor mange som klikker på linken din. Påvirker ikke rangering direkte. Hvis siden mangler meta-beskrivelse, lager Google én automatisk — sjelden like overbevisende.',
    recommendations: [
      '120–155 tegn (vises i sin helhet uten å bli kuttet av)',
      'Inkluder hovednøkkelordet for siden',
      'Avslutt med en handlingsoppfordring',
    ],
  },
  'seo-title': {
    title: 'Hva du tjener på en god SEO-tittel',
    whatItIs: 'Tittelen som vises som klikkbar link i Google-søk.',
    whyItMatters:
      'Det første brukere ser. En av de viktigste enkeltfaktorene for både klikk-frekvens og hvordan Google rangerer siden.',
    recommendations: [
      '50–60 tegn (vises i sin helhet)',
      'Inkluder hovednøkkelordet tidlig i tittelen',
      'Beskriv konkret hva siden tilbyr',
    ],
  },
  h1: {
    title: 'Hva du tjener på en god H1-overskrift',
    whatItIs: 'Sidens hovedoverskrift, det største synlige tekstelementet på siden.',
    whyItMatters:
      'Forteller Google og besøkende hva siden handler om. Mangler den, mister du en grunnleggende strukturmarkør for både SEO og brukeropplevelse.',
    recommendations: [
      'Én tydelig H1 per side',
      'Inkluder hovednøkkelordet',
      'Hold den beskrivende og konkret',
    ],
  },
  content: {
    title: 'Hva du tjener på dypere innhold',
    whatItIs: 'Antall ord i sidens hovedinnhold.',
    whyItMatters:
      'Sider under 300 ord regnes ofte som tynt innhold av Google. Dypere innhold gir flere kontekst-signaler for hva siden handler om.',
    recommendations: [
      'Minimum 300 ord for grunnleggende SEO',
      '1000+ ord for konkurranseutsatte søk',
      'Strukturer med tydelige underoverskrifter',
    ],
  },
};

function ContentFixValueCard({
  fieldType,
  borderColor,
}: {
  fieldType: ContentFixFieldType;
  borderColor: string;
}) {
  const copy = CONTENT_FIX_VALUE_COPY[fieldType];
  const sectionTitleStyle = {
    margin: '0 0 6px',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  };
  const bodyStyle = { margin: 0, color: 'var(--ink)', fontSize: 13, lineHeight: 1.6 };
  return (
    <div
      style={{
        background: 'var(--navbg)',
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: '18px 20px',
      }}
    >
      <p style={{ margin: '0 0 16px', color: 'var(--ink)', fontSize: 15, fontWeight: 700 }}>{copy.title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <p style={sectionTitleStyle}>Hva det er</p>
          <p style={bodyStyle}>{copy.whatItIs}</p>
        </div>
        <div>
          <p style={sectionTitleStyle}>Hvorfor det påvirker deg</p>
          <p style={bodyStyle}>{copy.whyItMatters}</p>
        </div>
        <div>
          <p style={sectionTitleStyle}>Sikt anbefaler</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', fontSize: 13, lineHeight: 1.6 }}>
            {copy.recommendations.map((item) => (
              <li key={item} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function getContentFixCharLimit(fieldType: ContentFixFieldType): number | null {
  if (fieldType === 'meta-description') return 155;
  if (fieldType === 'seo-title') return 60;
  return null;
}

function getContentFixCharCounter(count: number, fieldType: ContentFixFieldType) {
  const max = getContentFixCharLimit(fieldType);
  if (max == null) {
    return { color: 'var(--muted)', label: `${count} tegn`, overMax: false };
  }
  const ratio = count / max;
  let color = '#52A447';
  if (ratio > 1) color = '#C42E2E';
  else if (ratio >= 0.8) color = '#D97706';
  return { color, label: `${count} / ${max}`, overMax: count > max };
}

function findPlaceholders(text: string): string[] {
  const m = (text || '').match(/\[[^\]\n]{1,80}\]/g);
  return m ? Array.from(new Set(m)) : [];
}

function ContentFixPreviewSection({
  fieldType,
  pageData,
  editedSuggestion,
  previewVariant,
  onPreviewVariantChange,
  borderColor,
  green,
  muted,
  ink,
}: {
  fieldType: ContentFixFieldType;
  pageData: WordPressFetchResponse;
  editedSuggestion: string;
  previewVariant: 'desktop' | 'mobile';
  onPreviewVariantChange: (next: 'desktop' | 'mobile') => void;
  borderColor: string;
  green: string;
  muted: string;
  ink: string;
}) {
  const pageLink = pageData.page.link || '';
  const beforeTitle = decodeHtmlEntities(
    pageData.yoast?.title?.trim() || pageData.page.title || '',
  );
  const beforeDescription = decodeHtmlEntities(pageData.yoast?.description?.trim() || '');
  const beforeH1 = decodeHtmlEntities(pageData.page.title || '(Tom)');

  const previewCardStyle = (accent?: 'green') => ({
    background: 'var(--surface)',
    border: `1px solid ${borderColor}`,
    borderTop: accent === 'green' ? `3px solid ${green}` : undefined,
    borderRadius: 12,
    padding: accent === 'green' ? '12px 14px 14px' : '12px 14px 14px',
    overflow: 'hidden' as const,
  });

  const labelStyle = {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 700,
    color: muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  };

  if (fieldType === 'meta-description' || fieldType === 'seo-title') {
    const beforeSnippet = {
      title: beforeTitle,
      url: pageLink,
      description: beforeDescription,
      variant: previewVariant,
    };
    const afterSnippet =
      fieldType === 'meta-description'
        ? { title: beforeTitle, url: pageLink, description: editedSuggestion, variant: previewVariant }
        : { title: editedSuggestion, url: pageLink, description: beforeDescription, variant: previewVariant };
    const previewGridClass =
      previewVariant === 'mobile' ? 'ws-content-preview-stack' : 'ws-content-diff-grid';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <SnippetPreviewVariantToggle
            value={previewVariant}
            onChange={onPreviewVariantChange}
            ink={ink}
            borderColor={borderColor}
            muted={muted}
          />
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: muted }}>Slik ser det ut i Google</p>
        <div className={previewGridClass} key={previewVariant}>
          <div style={previewCardStyle()}>
            <p style={labelStyle}>Før</p>
            <GoogleSnippetPreview {...beforeSnippet} />
          </div>
          <div style={previewCardStyle('green')}>
            <p style={{ ...labelStyle, color: green }}>Etter</p>
            <GoogleSnippetPreview {...afterSnippet} />
          </div>
        </div>
      </div>
    );
  }

  if (fieldType === 'h1') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: muted }}>Slik ser overskriften ut på siden</p>
        <div className="ws-content-diff-grid">
          <div style={previewCardStyle()}>
            <p style={labelStyle}>Før</p>
            <div style={{ background: 'var(--navbg)', borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 4px rgba(26,26,26,0.04)' }}>
              <h1 style={{ margin: 0, color: ink, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{beforeH1}</h1>
            </div>
          </div>
          <div style={previewCardStyle('green')}>
            <p style={{ ...labelStyle, color: green }}>Etter</p>
            <div style={{ background: 'var(--navbg)', borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 4px rgba(26,26,26,0.04)' }}>
              <h1 style={{ margin: 0, color: ink, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                {editedSuggestion.trim() || '(Tom)'}
              </h1>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fieldType === 'content') {
    return null;
  }

  return null;
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
    }
  } catch { /* fallback */ }
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      return doc.documentElement.textContent || '';
    }
  } catch { /* fallback */ }
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&hellip;/gi, '…')
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&rdquo;/gi, '\u201D')
    .replace(/&ldquo;/gi, '\u201C');
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

function buildContentFixAiPrompt(
  fieldType: ContentFixFieldType,
  pageData: WordPressFetchResponse,
  pageContextAnswers?: PageContextAnswers | null,
): string {
  const title = decodeHtmlEntities(stripHtmlTags(pageData.page.title || ''));
  const contextRaw = decodeHtmlEntities(
    stripHtmlTags(pageData.page.excerpt || pageData.page.content || ''),
  );
  const context = truncateText(contextRaw, 500);

  switch (fieldType) {
    case 'meta-description':
      return `Skriv en konkret meta-beskrivelse på norsk for denne nettsiden, maks 155 tegn. Bruk informasjonen fra sidens innhold til å gjøre den relevant. Returner KUN meta-beskrivelsen, ingen forklaring eller anførselstegn.\n\nSidetittel: ${title}\n\nInnhold:\n${context}`;
    case 'seo-title':
      return `Skriv en SEO-tittel på norsk, maks 60 tegn. Bruk informasjonen fra sidens innhold til å gjøre den relevant og klikkbar. Returner KUN tittelen, ingen forklaring eller anførselstegn.\n\nSidetittel: ${title}\n\nInnhold:\n${context}`;
    case 'h1':
      return `Forslå en H1-overskrift basert på sideinnholdet. Returner KUN overskriften, ingen forklaring eller anførselstegn.\n\nNåværende sidetittel: ${title}\n\nInnhold:\n${context}`;
    case 'content':
    default: {
      const normalized = pageContextAnswers ? normalizePageContextAnswers(pageContextAnswers) : null;
      const contextBlock = normalized ? buildPageContextPromptBlock(normalized) : '';
      return `Du skal skrive forbedret brødtekst for denne nettsiden. Behold tema og tone fra eksisterende innhold.

Returner kun selve den forbedrede sideteksten som rene avsnitt, klar til å være sidens innhold. Ikke skriv etiketter som "Sidetittel:" eller "Ny tekst:", ikke forklar endringene, ikke gjenta sidens tittel, og ikke inkluder metadata eller kommentarer. Skriv teksten slik en besøkende skal lese den på siden — naturlige avsnitt, ikke en rapport om hva som er endret.

Bakgrunn for deg (skal ikke gjenspeiles ordrett i svaret):
- Sidens tittel er «${title}» (ikke gjenta denne i brødteksten)
- Nåværende innhold på siden:
${truncateText(contextRaw, 800)}${contextBlock}`;
    }
  }
}

const ContentPageContextQuestionnaire: React.FC<{
  questions: ContextQuestion[];
  onSubmit: (answers: PageContextAnswers) => void;
  onSkip: () => void;
}> = ({ questions, onSubmit, onSkip }) => {
  const [responses, setResponses] = useState<Array<{ choice: string | null; custom: string }>>(() =>
    questions.map(() => ({ choice: null, custom: '' })),
  );

  useEffect(() => {
    setResponses(questions.map(() => ({ choice: null, custom: '' })));
  }, [questions]);

  const resolvedAnswers = responses.map((r) => r.custom.trim() || r.choice?.trim() || '');
  const canSubmit = questions.every((q, i) => q.optional || Boolean(resolvedAnswers[i]));

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    border: `1px solid ${selected ? '#52A447' : '#EBEBE6'}`,
    background: selected ? 'rgba(82,164,71,0.1)' : '#FFFFFF',
    color: 'var(--ink)',
    borderRadius: 999,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease, border-color 160ms ease',
    textAlign: 'left' as const,
  });

  const pressHandlers = {
    onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'scale(0.97)';
    },
    onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'scale(1)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'scale(1)';
    },
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 4,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--hair)',
    background: 'var(--navbg)',
    color: 'var(--ink)',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 16,
        padding: '24px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
      }}
    >
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Før vi lager forslag
        </p>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
          Hjelp Sikt å forstå siden din
        </h3>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--muted)' }}>
          {questions.length === 1
            ? 'Et kort svar gir et mer relevant innholdsforslag. Svarene lagres for denne siden.'
            : `${questions.length} korte svar gir et mer relevant innholdsforslag. Svarene lagres for denne siden.`}
        </p>
      </div>

      {questions.map((q, index) => {
        const response = responses[index] || { choice: null, custom: '' };
        const hasCustom = Boolean(response.custom.trim());
        const useTextarea = q.options.length === 0;

        return (
          <div key={`${q.question}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
              {q.question}
              {q.optional ? (
                <span style={{ fontWeight: 500, color: 'var(--muted)' }}> (valgfritt)</span>
              ) : null}
            </p>
            {q.options.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {q.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    {...pressHandlers}
                    style={chipStyle(response.choice === option && !hasCustom)}
                    onClick={() => {
                      setResponses((prev) => {
                        const next = [...prev];
                        next[index] = { choice: option, custom: '' };
                        return next;
                      });
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {useTextarea ? (
              <textarea
                value={response.custom}
                onChange={(e) => {
                  const value = e.target.value;
                  setResponses((prev) => {
                    const next = [...prev];
                    next[index] = { choice: null, custom: value };
                    return next;
                  });
                }}
                placeholder="Skriv ditt svar …"
                rows={3}
                style={{ ...fieldStyle, lineHeight: 1.55, resize: 'vertical' }}
              />
            ) : (
              <input
                type="text"
                value={response.custom}
                onChange={(e) => {
                  const value = e.target.value;
                  setResponses((prev) => {
                    const next = [...prev];
                    const current = next[index] || { choice: null, custom: '' };
                    next[index] = { choice: value.trim() ? null : current.choice, custom: value };
                    return next;
                  });
                }}
                placeholder="Eller skriv ditt eget …"
                style={fieldStyle}
              />
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <button
          type="button"
          disabled={!canSubmit}
          {...pressHandlers}
          onClick={() => {
            if (!canSubmit) return;
            const qa = questions
              .map((q, i) => ({
                question: q.question,
                answer: resolvedAnswers[i] || '',
              }))
              .filter((entry, i) => {
                if (questions[i].optional && !entry.answer) return false;
                return Boolean(entry.answer);
              });
            onSubmit({ qa });
          }}
          style={{
            border: 'none',
            borderRadius: 11,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? '#52A447' : '#EBEBE6',
            color: canSubmit ? '#FFFFFF' : '#808080',
            transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease',
          }}
        >
          Lag forslag
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--muted)',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Hopp over
        </button>
      </div>
    </div>
  );
};

function getWixFieldInstruction(fieldType: ContentFixFieldType): string {
  switch (fieldType) {
    case 'meta-description':
      return 'I Wix: Pages & Menu → klikk siden → SEO Basics → lim inn i Meta description → Publiser.';
    case 'seo-title':
      return 'I Wix: Pages & Menu → klikk siden → SEO Basics → lim inn i Title tag → Publiser.';
    case 'h1':
      return 'I Wix-editoren: klikk på overskriften øverst på siden, endre teksten, og Publiser.';
    case 'content':
    default:
      return 'I Wix-editoren: klikk på tekstområdet, lim inn den nye teksten, og Publiser.';
  }
}

function buildAdvisoryPageDataFromContentScan(
  pageUrl: string,
  pages: ContentPage[],
): WordPressFetchResponse | null {
  const match = pages.find((p) => p.fullUrl === pageUrl);
  if (!match) return null;
  let slug = '/';
  try {
    slug = new URL(pageUrl).pathname || '/';
  } catch {
    slug = match.url || '/';
  }
  const title = match.title.replace(/\.\.\.$/, '').trim() || match.url;
  return {
    ok: true,
    page: {
      id: 0,
      type: 'page',
      slug,
      link: pageUrl,
      title,
      content: '',
      excerpt: '',
    },
    yoast: { installed: false },
  };
}

function getContentFixCurrentValue(
  fieldType: ContentFixFieldType,
  pageData: WordPressFetchResponse,
): { value: string; hint?: string } {
  switch (fieldType) {
    case 'meta-description':
      return {
        value:
          (pageData.yoast?.description?.trim()
            ? decodeHtmlEntities(pageData.yoast.description.trim())
            : '') ||
          '(Tom — siden har ingen meta-beskrivelse)',
      };
    case 'seo-title':
      return {
        value: decodeHtmlEntities(
          pageData.yoast?.title?.trim() || pageData.page.title || '(Tom)',
        ),
      };
    case 'h1':
      return {
        value: decodeHtmlEntities(pageData.page.title || '(Tom)'),
        hint: 'Vi viser sidetittelen som referanse — H1 må sjekkes i selve innholdet',
      };
    case 'content':
    default: {
      const plain = decodeHtmlEntities(
        stripHtmlTags(pageData.page.excerpt || pageData.page.content || ''),
      );
      return { value: truncateText(plain, 300) || '(Tom innhold)' };
    }
  }
}

// --- HOVEDKOMPONENT: CLIENT PORTAL ---
// Her tar vi imot ALLE verktøyene fra App (theme, setView, selectedPlan osv.)
// Vi døper om 'clientData' til 'startData' midlertidig her oppe:
const ClientPortal = ({ user, clientData: startData, onLogout, theme, themePref, setTheme, setView, selectedPlan, onSelectPlan }: any) => {
  const getStableMetrics = (keyword: string) => {
    let hash = 0;
    for (let i = 0; i < keyword.length; i++) {
      hash = keyword.charCodeAt(i) + ((hash << 5) - hash);
    }
    const positiveHash = Math.abs(hash);
    const volume = (positiveHash % 200) * 10 + 50;
    const competition = positiveHash % 3;
    return { volume, competition };
  };

  const [locationInput, setLocationInput] = useState('Oslo');
  const [showSuggestions, setShowSuggestions] = useState(false);
  // En liste over norske kommuner (utvalg - du kan legge til flere selv)
  const NORWEGIAN_MUNICIPALITIES = [
    "Agdenes", "Alstahaug", "Alta", "Alvdal", "Alver", "Andøy", "Aremark", "Arendal", "Asker", "Askvoll", "Askøy", "Aukra", "Aure", "Aurland", "Aurskog-Høland", "Austevoll", "Austrheim", "Averøy",
    "Balsfjord", "Bamble", "Bardu", "Beiarn", "Bergen", "Berlevåg", "Bindal", "Birkenes", "Bjerkreim", "Bjørnafjorden", "Bodø", "Bokn", "Bremanger", "Brønnøy", "Bygland", "Bykle", "Bærum", "Bø", "Bømlo", "Båtsfjord",
    "Dovre", "Drammen", "Drangedal", "Dyrøy", "Dønna",
    "Eidfjord", "Eidskog", "Eidsvoll", "Eigersund", "Elverum", "Enebakk", "Engerdal", "Etne", "Etnedal", "Evenes", "Evje og Hornnes",
    "Farsund", "Fauske", "Fedje", "Fitjar", "Fjaler", "Fjord", "Flakstad", "Flatanger", "Flekkefjord", "Flesberg", "Flå", "Folldal", "Fredrikstad", "Frogn", "Froland", "Frosta", "Frøya", "Fyresdal", "Færder",
    "Gamvik", "Gausdal", "Gildeskål", "Giske", "Gjemnes", "Gjerdrum", "Gjerstad", "Gjesdal", "Gjøvik", "Gloppen", "Gol", "Gran", "Grane", "Gratangen", "Grimstad", "Grong", "Grue", "Gulen",
    "Hadsel", "Halden", "Hamar", "Hamarøy", "Hammerfest", "Hareid", "Harstad", "Hasvik", "Hattfjelldal", "Haugesund", "Heim", "Hemnes", "Hemsedal", "Herøy", "Hitra", "Hjartdal", "Hjelmeland", "Hol", "Hole", "Holmestrand", "Holtålen", "Horten", "Hurdal", "Hustadvika", "Hvaler", "Hyllestad", "Hægebostad", "Høyanger", "Høylandet", "Hå",
    "Ibestad", "Inderøy", "Indre Østfold", "Iveland",
    "Jevnaker",
    "Karasjok", "Karlsøy", "Karmøy", "Kautokeino", "Klepp", "Kongsberg", "Kongsvinger", "Kragerø", "Kristiansand", "Kristiansund", "Krødsherad", "Kvam", "Kvinesdal", "Kvinnherad", "Kviteseid", "Kvitsøy", "Kvæfjord", "Kvænangen", "Kåfjord",
    "Larvik", "Lavangen", "Lebesby", "Leirfjord", "Leka", "Lenvik", "Lesja", "Levanger", "Lier", "Lierne", "Lillehammer", "Lillesand", "Lillestrøm", "Lindesnes", "Lom", "Loppa", "Lund", "Lunner", "Lurøy", "Luster", "Lyngdal", "Lyngen", "Lærdal", "Lødingen", "Lørenskog", "Løten",
    "Malvik", "Marker", "Masfjorden", "Melhus", "Meløy", "Meråker", "Midt-Telemark", "Midtre Gauldal", "Modalen", "Modum", "Molde", "Moskenes", "Moss", "Målselv", "Måsøy",
    "Namsos", "Namsskogan", "Nannestad", "Narvik", "Nes", "Nesbyen", "Nesna", "Nesodden", "Nissedal", "Nittedal", "Nome", "Nord-Aurdal", "Nord-Fron", "Nord-Odal", "Nordkapp", "Nordre Follo", "Nordre Land", "Nordreisa", "Nore og Uvdal", "Notodden", "Nærøysund",
    "Oppdal", "Orkland", "Os", "Osen", "Oslo", "Overhalla",
    "Porsanger", "Porsgrunn",
    "Rakkestad", "Rana", "Randaberg", "Rauma", "Rendalen", "Rennebu", "Rindal", "Ringebu", "Ringerike", "Ringsaker", "Risør", "Rollag", "Rælingen", "Rødøy", "Røros", "Røst", "Råde",
    "Salangen", "Saltdal", "Samnanger", "Sande", "Sandefjord", "Sandnes", "Sarpsborg", "Sauda", "Sel", "Selbu", "Seljord", "Senja", "Sigdal", "Siljan", "Sirdal", "Skaun", "Skien", "Skiptvet", "Skjervøy", "Skjåk", "Smøla", "Snåsa", "Sogndal", "Sokndal", "Sola", "Solund", "Sortland", "Stad", "Stange", "Stavanger", "Steinkjer", "Stjordal", "Stord", "Stor-Elvdal", "Storfjord", "Stranda", "Stryn", "Sula", "Suldal", "Sunndal", "Sunnfjord", "Surnadal", "Sveio", "Sykkylven", "Sømna", "Sør-Aurdal", "Sør-Fron", "Sør-Odal", "Sør-Varanger", "Sørfold", "Sørreisa",
    "Tana", "Time", "Tingvoll", "Tinn", "Tjeldsund", "Tokke", "Tolga", "Tromsø", "Trondheim", "Trysil", "Træna", "Tvedestrand", "Tydal", "Tynset", "Tysnes", "Tysvær", "Tønsberg",
    "Ullensaker", "Ullensvang", "Ulstein", "Ulvik", "Utsira",
    "Vadsø", "Vaksdal", "Valle", "Vang", "Vanylven", "Vardø", "Vefsn", "Vega", "Vegårshei", "Vennesla", "Verdal", "Vestby", "Vestnes", "Vestre Slidre", "Vestre Toten", "Vestvågøy", "Vevelstad", "Vik", "Vindafjord", "Vinje", "Volda", "Voss", "Værøy", "Vågan", "Våler",
    "Øksnes", "Ørland", "Ørsta", "Østre Toten", "Øvre Eiker", "Øyer", "Øygarden", "Øystre Slidre",
    "Åfjord", "Ål", "Ålesund", "Åmli", "Åmot", "Årdal", "Ås", "Åseral", "Åsnes"
  ];

  // 1. STATE & VARIABLER
  // VIKTIG: Vi har SLETTET [clientData, setClientData] herfra fordi den kommer fra props!
  const [formData, setFormData] = useState<any>({});
  // Den redesignede portalen har 8 faner i en sidebar. Verksted er egen fane (ikke drawer).
  type PortalTab = 'home' | 'visibility' | 'keywords' | 'competitors' | 'geo' | 'workshop' | 'reviews' | 'log' | 'settings' | 'health';
  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  // Eier-only «Kundehelse»-fane (punkt 3B). Allowlist; ekte gating skjer i edge-fn.
  const isFounder = ['siktseo@gmail.com'].includes((user?.email || '').toLowerCase());
  const [healthData, setHealthData] = useState<{ rows: any[]; summary: Record<string, number> } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(startData);
  const isMobile = useIsMobile(); // responsiv stabling i inline-style-faner (Verksted/Innstillinger)

  // Sidebar mobile-state (under 768px viser vi hamburger).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userFooterMenuOpen, setUserFooterMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // mobil «Mer»-bunnark (kun < sm)
  // Sidebar desktop-collapse: skyver sidebar sammen til kun-ikoner. Persistert.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('sikt_sidebar_collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sikt_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [sidebarCollapsed]);
  useEffect(() => {
    if (sidebarCollapsed) setUserFooterMenuOpen(false);
  }, [sidebarCollapsed]);
  // Synlighet-fane: «sammendrag først» — tekniske detaljer skjult bak en bryter.
  const [visibilitySubTab, setVisibilitySubTab] = useState<'pagespeed' | 'content' | 'links'>('pagespeed');
  const [showVisibilityDetails, setShowVisibilityDetails] = useState(false);
  // Verksted-fane: hvilket problem som er ekspandert inline.
  const [expandedWorkshopProblem, setExpandedWorkshopProblem] = useState<string | null>(null);
  const [contentFixCache, setContentFixCache] = useState<Record<string, ContentFixCacheEntry>>({});
  const [editedSuggestions, setEditedSuggestions] = useState<Record<string, string>>({});
  const [snippetPreviewVariant, setSnippetPreviewVariant] = useState<'desktop' | 'mobile'>('desktop');
  const [contentFixActive, setContentFixActive] = useState<ContentFixActiveState>(INITIAL_CONTENT_FIX_ACTIVE);
  const [contentFixRetry, setContentFixRetry] = useState(0);
  const contentFixAbortRef = useRef<AbortController | null>(null);
  const questionsGeneratedRef = useRef<Record<string, boolean>>({});
  const contentFixCacheRef = useRef(contentFixCache);
  contentFixCacheRef.current = contentFixCache;
  const lastSyncedAiRef = useRef<Record<string, string>>({});
  const [pushState, setPushState] = useState<
    'idle' | 'content-warning' | 'confirming' | 'pushing' | 'success' | 'error'
  >('idle');
  const [pushError, setPushError] = useState<string | null>(null);
  const [lastChangeId, setLastChangeId] = useState<string | null>(null);
  const [lastOldValue, setLastOldValue] = useState<string | null>(null);
  const [lastH1Rendered, setLastH1Rendered] = useState<boolean | null>(null);
  const [rollbackState, setRollbackState] = useState<'idle' | 'confirming' | 'rolling_back' | 'success' | 'error'>('idle');
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [contentChanges, setContentChanges] = useState<ContentChangeRow[]>([]);
  // Verksted-filter: alle / aapne / loste
  const [workshopFilter, setWorkshopFilter] = useState<'all' | 'open' | 'done'>('all');
  const [workshopQuery, setWorkshopQuery] = useState('');
  // Hjem: vis alle todos, ikke bare topp 3
  const [showAllTodos, setShowAllTodos] = useState(false);

  // Settings-tab: hvilken seksjon som redigeres akkurat nå (kun én om gangen).
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showWpWizard, setShowWpWizard] = useState(false);
  const [connectWizardPlatform, setConnectWizardPlatform] = useState<string | null>(null);
  const [wpWizardStep, setWpWizardStep] = useState<1 | 2 | 3>(1);
  const [wixSiteUrl, setWixSiteUrl] = useState('');
  const [wixSiteUrlError, setWixSiteUrlError] = useState<string | null>(null);
  const [wixConnecting, setWixConnecting] = useState(false);
  const [wixConnectError, setWixConnectError] = useState<string | null>(null);
  const [wpSiteUrl, setWpSiteUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [wpSiteUrlError, setWpSiteUrlError] = useState<string | null>(null);
  const [wpConnecting, setWpConnecting] = useState(false);
  const [wpConnectError, setWpConnectError] = useState<string | null>(null);
  const [wpConnectResult, setWpConnectResult] = useState<{ site: string; wpUser: string } | null>(null);
  // Shopify (full auto-fiks via Admin API-token)
  const [shopDomain, setShopDomain] = useState('');
  const [shopToken, setShopToken] = useState('');
  const [shopConnecting, setShopConnecting] = useState(false);
  const [shopConnectError, setShopConnectError] = useState<string | null>(null);
  const [shopConnectResult, setShopConnectResult] = useState<{ site: string; name: string } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [planChangeTarget, setPlanChangeTarget] = useState<{ key: string; name: string; price: string; type: 'upgrade' | 'downgrade' } | null>(null);
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    weeklyReport: true, criticalAlerts: true, rankChanges: false,
    // Kunde-styrt rapport-e-post (frekvens / klokkeslett / innhold):
    reportFrequency: 'weekly' as string, // 'off'|'weekly'|'biweekly'|'monthly'|'twice_week'|'thrice_week'
    reportHour: 8,                        // 6–22, norsk tid
    reportAnchorDay: 1,                   // ISO ukedag 1=man … 7=søn
    reportSections: {
      results: true, opportunity: true, work: true,
      competitors: true, aiVisibility: true, lifetime: true,
    },
  });
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // Oppsigelse: grunn-survey før redirect til Stripe-portalen (fanger churn-grunn).
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelComment, setCancelComment] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelDone, setCancelDone] = useState(false);
  // Plan-baserte bruksgrenser: analyser brukt inneværende måned (fra clients).
  const [analysesMonth, setAnalysesMonth] = useState<string | null>(null);
  const [analysesUsed, setAnalysesUsed] = useState(0);

  // Host-tilkoblings-info (fra client_hosts-tabellen). null = ikke hentet ennå eller
  // ingen rad finnes. Relevante felt: connectionMode ('light' | 'full' | 'skipped'),
  // platform, repoUrl, adminUrl, notes, lastChangedAt.
  const [hostConnection, setHostConnection] = useState<any>(null);

  // Konkurrenter: ekte domener fra dine Google-resultater (SERP), kan fjernes manuelt
  const [trackedCompetitors, setTrackedCompetitors] = useState<{ id: string; domain: string; title?: string; url?: string; serpRank: number; sourceKeyword?: string }[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`sikt_competitors_${user.id}`);
      if (raw) setTrackedCompetitors(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [user?.id]);

  const persistCompetitors = (list: typeof trackedCompetitors) => {
    setTrackedCompetitors(list);
    if (user?.id) {
      try { localStorage.setItem(`sikt_competitors_${user.id}`, JSON.stringify(list)); } catch { /* ignore */ }
    }
  };

  const loadCompetitorsFromSerp = () => {
    const rawUrl = (formData.websiteUrl || clientData?.websiteUrl || '').trim();
    if (!rawUrl) { toastWarning('Legg inn nettside-URL under Innstillinger først.'); return; }
    const cleanDomain = rawUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
    const out: typeof trackedCompetitors = [];
    const seen = new Set<string>();
    for (const r of realRankings || []) {
      const myPos = typeof (r as any).position === 'number' ? (r as any).position : 101;
      for (const c of (r as any).competitors || []) {
        try {
          if (!c?.url) continue;
          const cp = typeof c.position === 'number' ? c.position : 999;
          if (myPos <= 100) {
            if (cp >= myPos) continue;
          } else {
            if (cp > 20) continue;
          }
          const host = new URL(c.url).hostname.replace(/^www\./i, '').toLowerCase();
          if (!host || host === cleanDomain) continue;
          if (seen.has(host)) continue;
          seen.add(host);
          out.push({
            id: host,
            domain: host,
            title: c.title,
            url: c.url,
            serpRank: cp,
            sourceKeyword: (r as any).keyword,
          });
        } catch { /* ignore */ }
      }
    }
    out.sort((a, b) => a.serpRank - b.serpRank);
    const cap = hasPremium ? 12 : hasStandardOrHigher ? 6 : 4;
    if (out.length === 0) {
      toastWarning('Ingen konkurrenter funnet. Kjør «Kjør Analyse» på søkeord-fanen først — vi henter da ekte treff fra Google.');
      return;
    }
    persistCompetitors(out.slice(0, cap));
    toastSuccess(`La til ${Math.min(out.length, cap)} konkurrenter fra søkeresultater (bedre plassering enn deg i listen).`);
  };

  const removeCompetitor = (id: string) => {
    persistCompetitors(trackedCompetitors.filter((c) => c.id !== id));
  };

  // --- GEO / AI-synlighet chat ---
  const [geoChatInput, setGeoChatInput] = useState('');
  const [geoChatLoading, setGeoChatLoading] = useState(false);
  const [geoChatReply, setGeoChatReply] = useState<string | null>(null);

  // --- UKENS KVITTERING (Sikt-handlinger) ---
  const [siktActions, setSiktActions] = useState<any[]>([]);
  // --- GODKJENNINGS-KØ (hybrid auto-fiks: synlige felt som venter på ja) ---
  const [fixQueue, setFixQueue] = useState<any[]>([]);
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);
  // --- GEO (AI-synlighet: ukentlig sjekk om ChatGPT/Gemini/Perplexity nevner deg) ---
  const [geoSummary, setGeoSummary] = useState<any>(null);
  const [geoState, setGeoState] = useState<any>(null);      // geo_state: llms.txt + score
  const [geoFaqs, setGeoFaqs] = useState<any[]>([]);        // ventende FAQ til godkjenning
  const [geoFaqBusyId, setGeoFaqBusyId] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = denne uken, -1 = forrige, osv.
  const [receiptCategoryFilter, setReceiptCategoryFilter] = useState<'all' | 'finding' | 'suggestion' | 'fix' | 'alert'>('all');

  // --- OVERSIKT-KORT (Besøkende + Synlighet) — periode-velger paa Hjem ---
  const [overviewPeriod, setOverviewPeriod] = useState<'1M' | '2M' | '3M'>('1M');

  // --- HUKOMMELSE FOR "LØS PROBLEMET" - ARBEIDSROMMET ---
  // Brukes av WorkshopDrawer-overlayet i Hjem-fanen.
  const [activeSolveProblem, setActiveSolveProblem] = useState<any>(null);
  const [aiIsThinking, setAiIsThinking] = useState(false);
  const [aiSolution, setAiSolution] = useState<any>(null);



  // Denne funksjonen avfyres automatisk når kunden velger et problem i Verkstedet.
  // Sender webhost + URL til serveren, slik at AI kan hente HTML og finne eksakt kode
  // å fjerne/erstatte (når webhost er koblet til).
  const runContentFixAi = useCallback(
    async (
      todoId: string,
      pageData: WordPressFetchResponse,
      fieldType: ContentFixFieldType,
      signal: AbortSignal,
      pageContextAnswers?: PageContextAnswers | null,
    ) => {
      const token = getStoredAccessToken();
      if (!token) {
        if (signal.aborted) return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: 'Du må være logget inn.' }
            : prev,
        );
        return;
      }

      try {
        const aiRes = await fetch('/api/openai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: buildContentFixAiPrompt(fieldType, pageData, pageContextAnswers),
            model: 'gpt-4o-mini',
            maxTokens: 450,
          }),
          signal,
        });
        const aiData = await aiRes.json().catch(() => ({}));
        if (signal.aborted) return;
        if (isApiRateLimited(aiRes.status, aiData)) {
          toastWarning(apiRateLimitUserMessage(aiData));
          setContentFixActive((prev) =>
            prev.todoId === todoId
              ? { ...prev, loading: 'error', error: apiRateLimitUserMessage(aiData) }
              : prev,
          );
          return;
        }
        if (!aiRes.ok) {
          setContentFixActive((prev) =>
            prev.todoId === todoId
              ? {
                  ...prev,
                  loading: 'error',
                  error:
                    typeof aiData?.error === 'string'
                      ? aiData.error
                      : `Feil ${aiRes.status}`,
                }
              : prev,
          );
          return;
        }
        const aiSuggestion = decodeHtmlEntities(String(aiData.content || '').trim());
        setContentFixCache((prev) => ({
          ...prev,
          [todoId]: {
            pageData,
            fieldType,
            aiSuggestion,
            pageContextAnswers: pageContextAnswers ?? prev[todoId]?.pageContextAnswers ?? null,
          },
        }));
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'idle', error: null }
            : prev,
        );
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: err?.message || 'Kunne ikke nå AI.' }
            : prev,
        );
      }
    },
    [],
  );

  const startContentFixGeneration = useCallback(
    async (
      todoId: string,
      pageUrl: string,
      pageData: WordPressFetchResponse,
      answers: PageContextAnswers | null,
      saveAnswers: boolean,
    ) => {
      if (saveAnswers && answers && user?.id) {
        await savePageContextAnswers(
          pageUrl,
          answers,
          user.id,
          hostConnection?.id ?? null,
        );
      }

      contentFixAbortRef.current?.abort();
      const ac = new AbortController();
      contentFixAbortRef.current = ac;

      setContentFixCache((prev) => ({
        ...prev,
        [todoId]: {
          ...(prev[todoId] || { pageData, fieldType: 'content', aiSuggestion: null }),
          pageData,
          fieldType: 'content',
          aiSuggestion: null,
          pageContextAnswers: answers,
        },
      }));
      delete lastSyncedAiRef.current[todoId];
      setContentFixActive((prev) =>
        prev.todoId === todoId
          ? { ...prev, loading: 'generating', error: null }
          : prev,
      );
      await runContentFixAi(todoId, pageData, 'content', ac.signal, answers);
    },
    [user?.id, hostConnection?.id, runContentFixAi],
  );

  const regenerateContentFixAi = useCallback(() => {
    const todoId = contentFixActive.todoId;
    if (!todoId) return;
    const entry = contentFixCache[todoId];
    if (!entry?.pageData || !entry.fieldType) return;
    contentFixAbortRef.current?.abort();
    const ac = new AbortController();
    contentFixAbortRef.current = ac;
    setContentFixCache((prev) => ({
      ...prev,
      [todoId]: { ...entry, aiSuggestion: null },
    }));
    delete lastSyncedAiRef.current[todoId];
    setContentFixActive((prev) =>
      prev.todoId === todoId
        ? { ...prev, loading: 'generating', error: null }
        : prev,
    );
    runContentFixAi(
      todoId,
      entry.pageData,
      entry.fieldType,
      ac.signal,
      entry.pageContextAnswers ?? null,
    );
  }, [contentFixActive.todoId, contentFixCache, runContentFixAi]);

  const activeAiSuggestion =
    contentFixActive.todoId != null
      ? contentFixCache[contentFixActive.todoId]?.aiSuggestion ?? null
      : null;

  useEffect(() => {
    const todoId = contentFixActive.todoId;
    if (!todoId || activeAiSuggestion == null) return;
    if (lastSyncedAiRef.current[todoId] === activeAiSuggestion) return;
    lastSyncedAiRef.current[todoId] = activeAiSuggestion;
    setEditedSuggestions((prev) => ({ ...prev, [todoId]: activeAiSuggestion }));
  }, [contentFixActive.todoId, activeAiSuggestion]);

  const resetContentFixPushUi = useCallback(() => {
    setPushState('idle');
    setPushError(null);
    setRollbackState('idle');
    setRollbackError(null);
    setLastChangeId(null);
    setLastOldValue(null);
    setLastH1Rendered(null);
  }, []);

  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;

  const fetchContentChanges = useCallback(async () => {
    if (!supabase || !userIdRef.current) {
      setContentChanges([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('sikt_changes')
        .select('id, page_url, field, old_value, new_value, pushed_at, client_host_id')
        .eq('status', 'active');
      if (error) {
        console.warn('[Verksted] Kunne ikke hente sikt_changes:', error.message);
        return;
      }
      const rows = Array.isArray(data) ? (data as ContentChangeRow[]) : [];
      const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());
      setContentChanges(uniqueRows);
    } catch (err: any) {
      console.warn('[Verksted] Kunne ikke hente sikt_changes:', err?.message || err);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'workshop' || !userIdRef.current) return;
    fetchContentChanges();
  }, [activeTab, fetchContentChanges]);

  useEffect(() => {
    resetContentFixPushUi();
  }, [expandedWorkshopProblem, resetContentFixPushUi]);

  useEffect(() => {
    if (pushState === 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pushState === 'pushing' || rollbackState === 'rolling_back') return;
      resetContentFixPushUi();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushState, rollbackState, resetContentFixPushUi]);

  useEffect(() => {
    if (pushState !== 'idle') return;
    if (rollbackState !== 'confirming' && rollbackState !== 'error') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setRollbackState('idle');
      setRollbackError(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushState, rollbackState]);

  const executeContentFixPush = useCallback(
    async (
      pageUrl: string,
      field: 'meta-description' | 'seo-title' | 'h1' | 'content',
      newValue: string,
    ) => {
      if (findPlaceholders(newValue).length > 0) return;
      setPushState('pushing');
      setPushError(null);
      const token = getStoredAccessToken();
      if (!token) {
        setPushState('error');
        setPushError('Du må være logget inn.');
        return;
      }
      try {
        const res = await fetch('/api/wordpress-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pageUrl, field, newValue }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPushState('error');
          setPushError(
            typeof data?.error === 'string' ? data.error : `Feil ${res.status}`,
          );
          return;
        }
        setLastChangeId(typeof data?.changeId === 'string' ? data.changeId : null);
        const prevOld =
          data?.previous && Object.prototype.hasOwnProperty.call(data.previous, 'oldValue')
            ? data.previous.oldValue
            : null;
        setLastOldValue(typeof prevOld === 'string' ? prevOld : null);
        setLastH1Rendered(
          field === 'h1' && typeof data?.h1Rendered === 'boolean' ? data.h1Rendered : null,
        );
        setPushState('success');
        fetchContentChanges();
      } catch (err: any) {
        setPushState('error');
        setPushError(err?.message || 'Kunne ikke pushe til WordPress.');
      }
    },
    [fetchContentChanges],
  );

  // --- GODKJENNINGS-KØ: hent + godkjenn/avvis synlige fikser fra cron-auto-fix ---
  const fetchFixQueue = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await supabaseRest<any[]>(
        `sikt_fix_queue?user_id=eq.${user.id}&status=eq.pending&order=created_at.desc&limit=20`,
      );
      setFixQueue(Array.isArray(rows) ? rows : []);
    } catch { /* stille — kø er valgfri */ }
  }, [user?.id]);

  useEffect(() => { fetchFixQueue(); }, [fetchFixQueue]);

  const fetchGeo = useCallback(async () => {
    if (!user?.id) return;
    try {
      const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const rows = await supabaseRest<any[]>(
        `geo_checks?user_id=eq.${user.id}&checked_at=gte.${since}&select=provider,mentioned,checked_at&order=checked_at.desc&limit=200`,
      );
      if (!Array.isArray(rows) || rows.length === 0) { setGeoSummary(null); return; }
      const byProvider: Record<string, { total: number; mentioned: number }> = {};
      let total = 0, mentioned = 0;
      for (const r of rows) {
        total += 1;
        if (r.mentioned) mentioned += 1;
        const p = r.provider || 'ukjent';
        byProvider[p] = byProvider[p] || { total: 0, mentioned: 0 };
        byProvider[p].total += 1;
        if (r.mentioned) byProvider[p].mentioned += 1;
      }
      setGeoSummary({ total, mentioned, byProvider, lastCheckedAt: rows[0].checked_at });
    } catch { setGeoSummary(null); }

    // GEO-state (llms.txt + score) og ventende FAQ-utkast til godkjenning
    try {
      const st = await supabaseRest<any[]>(
        `geo_state?user_id=eq.${user.id}&select=geo_score,llms_published_at,schema_published_at,llms_txt&limit=1`,
      );
      setGeoState(Array.isArray(st) && st.length ? st[0] : null);
    } catch { setGeoState(null); }
    try {
      const faqs = await supabaseRest<any[]>(
        `geo_faqs?user_id=eq.${user.id}&status=eq.pending&select=id,question,answer,created_at&order=created_at.desc&limit=20`,
      );
      setGeoFaqs(Array.isArray(faqs) ? faqs : []);
    } catch { setGeoFaqs([]); }
  }, [user?.id]);

  useEffect(() => { fetchGeo(); }, [fetchGeo]);

  // Godkjenn/avvis et FAQ-utkast. Godkjente mates inn i llms.txt + FAQPage-schema
  // ved neste optimaliserings-kjøring.
  const resolveGeoFaq = useCallback(async (id: string, approve: boolean) => {
    setGeoFaqBusyId(id);
    try {
      await supabaseRest(`geo_faqs?id=eq.${id}`, {
        method: 'PATCH',
        body: { status: approve ? 'approved' : 'rejected', resolved_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
      setGeoFaqs((prev) => prev.filter((f) => f.id !== id));
      if (approve) toastSuccess('Godkjent — publiseres i llms.txt og FAQ-schema ved neste kjøring.');
    } catch (err: any) {
      toastError(err?.message || 'Kunne ikke lagre.');
    } finally {
      setGeoFaqBusyId(null);
    }
  }, []);

  const approveQueuedFix = useCallback(async (item: any) => {
    const token = getStoredAccessToken();
    if (!token) { toastError('Du må være logget inn.'); return; }
    setQueueBusyId(item.id);
    try {
      const res = await fetch('/api/wordpress-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pageUrl: item.page_url, field: item.field, newValue: item.suggested_value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toastError(typeof data?.error === 'string' ? data.error : 'Kunne ikke publisere endringen.');
        return;
      }
      await supabaseRest(`sikt_fix_queue?id=eq.${item.id}`, {
        method: 'PATCH',
        body: { status: 'approved', resolved_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
      setFixQueue((prev) => prev.filter((q) => q.id !== item.id));
      toastSuccess('Publisert til siden din.');
    } catch (err: any) {
      toastError(err?.message || 'Noe gikk galt.');
    } finally {
      setQueueBusyId(null);
    }
  }, []);

  const rejectQueuedFix = useCallback(async (item: any) => {
    setQueueBusyId(item.id);
    try {
      await supabaseRest(`sikt_fix_queue?id=eq.${item.id}`, {
        method: 'PATCH',
        body: { status: 'rejected', resolved_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
      setFixQueue((prev) => prev.filter((q) => q.id !== item.id));
    } catch (err: any) {
      toastError(err?.message || 'Noe gikk galt.');
    } finally {
      setQueueBusyId(null);
    }
  }, []);

  const executeContentFixRollback = useCallback(async (
    changeIdOverride?: string,
    options?: { deferListRefetch?: boolean },
  ) => {
    setRollbackState('rolling_back');
    setRollbackError(null);
    const token = getStoredAccessToken();
    if (!token) {
      setRollbackState('error');
      setRollbackError('Du må være logget inn.');
      return;
    }
    const targetChangeId = changeIdOverride || lastChangeId;
    if (!targetChangeId) {
      setRollbackState('error');
      setRollbackError('Fant ikke endrings-ID. Lukk og prøv push på nytt.');
      return;
    }
    try {
      const res = await fetch('/api/wordpress-rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ changeId: targetChangeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRollbackState('error');
        setRollbackError(
          typeof data?.error === 'string' ? data.error : `Feil ${res.status}`,
        );
        return;
      }
      setRollbackState('success');
      if (!options?.deferListRefetch) {
        fetchContentChanges();
      }
    } catch (err: any) {
      setRollbackState('error');
      setRollbackError(err?.message || 'Kunne ikke rulle tilbake endringen.');
    }
  }, [lastChangeId, fetchContentChanges]);

  useEffect(() => {
    const fetchAiSolution = async () => {
      if (!activeSolveProblem) return;
      if (expandedWorkshopProblem?.startsWith('content-')) return;

      setAiIsThinking(true);
      setAiSolution(null);

      try {
        const accessToken = getStoredAccessToken();
        if (!accessToken) {
          setAiSolution({
            steps: [{ title: 'Ikke innlogget', description: 'Logg inn på nytt og prøv «Gå til dybde» igjen.' }],
            codePatch: null,
          });
          return;
        }
        const response = await fetch('/api/solve-problem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            url: formData.websiteUrl || clientData?.websiteUrl || '',
            problemTitle: activeSolveProblem.raw?.title || activeSolveProblem.title || 'Ukjent feil',
            problemDetails: activeSolveProblem,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (isApiRateLimited(response.status, data)) {
          const msg = apiRateLimitUserMessage(data);
          toastWarning(msg);
          setAiSolution({
            steps: [{ title: 'Midlertidig begrensning', description: msg }],
            explanation: msg,
            codePatch: null,
          });
          return;
        }
        if (!response.ok) {
          const msg = data?.error || data?.message || `HTTP ${response.status}`;
          setAiSolution({
            steps: [{ title: 'AI-serveren svarte med feil', description: String(msg) }],
            explanation: String(msg),
            codePatch: null,
          });
          return;
        }
        setAiSolution(data);
      } catch (error: any) {
        console.error(error);
        setAiSolution({
          steps: [{ title: 'Nettverksfeil', description: error?.message || 'Ukjent feil. Sjekk internett og at OPENAI_API_KEY er satt i Vercel.' }],
          explanation: error?.message || 'Ukjent feil',
          codePatch: null,
        });
      } finally {
        setAiIsThinking(false);
      }
    };

    fetchAiSolution();
  }, [activeSolveProblem, expandedWorkshopProblem]);

  // Når vi får ny data fra App (sjefen), oppdaterer vi vår lokale data
  useEffect(() => {
    if (startData) {
      // Dev-modus: hvis brukeren har byttet plan lokalt, overstyr package_name
      let seed = startData;
      try {
        const devPlan = typeof window !== 'undefined' ? localStorage.getItem('sikt_dev_plan') : null;
        if (devPlan) seed = { ...startData, package_name: devPlan };
      } catch { /* ignore */ }
      setClientData(seed);
      setFormData(seed);
      setLoading(false);
    }
  }, [startData]);

  // Analyse State
  const [analysisResults, setAnalysisResults] = useState<{ mobile: AnalysisResult; desktop: AnalysisResult } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Forbereder...');

  // Historikk for teknisk score (mobil) — lagres lokalt per bruker, norsk tidsstempel i visning
  const [scoreHistory, setScoreHistory] = useState<{ at: string; mobilePerf: number; mobileSeo: number; desktopPerf: number }[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const arr = JSON.parse(localStorage.getItem(`sikt_portal_score_history_${user.id}`) || '[]');
      setScoreHistory(Array.isArray(arr) ? arr : []);
    } catch { setScoreHistory([]); }
  }, [user?.id]);

  // Markér første åpning av portalen — brukes til å vise ekstra-vennlig hilsen
  // i StatusHero ved første besøk. Ingen mørklegging av meny eller onboarding-banner.
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const seenKey = `sikt_portal_first_seen_${user.id}`;
      if (localStorage.getItem(seenKey) !== '1') {
        setIsFirstVisit(true);
        localStorage.setItem(seenKey, '1');
      }
    } catch { /* ignore */ }
  }, [user?.id]);

  const [showFirstAnalysisBanner, setShowFirstAnalysisBanner] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const checkFirstAnalysis = async () => {
      try {
        const siteRows = await supabaseRest<any[]>(
          `sites?user_id=eq.${user.id}&select=id&limit=1`,
        );
        const site = Array.isArray(siteRows) && siteRows.length ? siteRows[0] : null;

        if (!site?.id) {
          if (!cancelled) setShowFirstAnalysisBanner(true);
          return;
        }

        const healthRows = await supabaseRest<any[]>(
          `health_checks?site_id=eq.${site.id}&select=id&limit=1`,
        );
        if (!cancelled) setShowFirstAnalysisBanner(!(Array.isArray(healthRows) && healthRows.length > 0));
      } catch {
        if (!cancelled) setShowFirstAnalysisBanner(false);
      }
    };

    checkFirstAnalysis();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!showFirstAnalysisBanner) return;
    const timer = setTimeout(() => setShowFirstAnalysisBanner(false), 60000);
    return () => clearTimeout(timer);
  }, [showFirstAnalysisBanner]);

  // Gjenopprett siste analyse fra cache (samme domene som i profilen)
  useEffect(() => {
    if (!user?.id) return;
    const urlNow = (formData.websiteUrl || clientData?.websiteUrl || '').trim();
    if (!urlNow) return;
    try {
      const raw = localStorage.getItem(`sikt_analysis_cache_${user.id}`);
      if (!raw) return;
      const { url: cachedUrl, results } = JSON.parse(raw);
      const norm = (s: string) => String(s || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
      if (results?.mobile && results?.desktop && norm(cachedUrl) === norm(urlNow)) {
        setAnalysisResults(results);
      }
    } catch { /* ignore */ }
  }, [user?.id, formData.websiteUrl, clientData?.websiteUrl]);

  const [saving, setSaving] = useState(false);

  // SØKEORD STATE (EKTE DATA)
  const [keywordsToTrack, setKeywordsToTrack] = useState<any[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [realRankings, setRealRankings] = useState<any[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  // Internt brukt av data-fetching-hooks og handlers — beholdes for kompatibilitet
  // (den nye UI-en bruker realRankings, men disse settes fortsatt for fremtidig bruk).
  const [, setHasSearched] = useState(false);
  const [keywordData, setKeywordData] = useState<KeywordData[]>([]);

  // GOOGLE SEARCH CONSOLE STATE
  const [gscConnected, setGscConnected] = useState(false);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscKeywords, setGscKeywords] = useState<any[]>([]);
  const [showGscPreCheck, setShowGscPreCheck] = useState(false);
  const [activationDismissed, setActivationDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(`sikt_activation_dismissed_${user?.id || ''}`) === '1'; } catch { return false; }
  });
  const dismissActivation = () => {
    setActivationDismissed(true);
    try { localStorage.setItem(`sikt_activation_dismissed_${user?.id || ''}`, '1'); } catch { /* ignore */ }
  };
  const [journeyDismissed, setJourneyDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(`sikt_journey_dismissed_${user?.id || ''}`) === '1'; } catch { return false; }
  });
  const dismissJourney = () => {
    setJourneyDismissed(true);
    try { localStorage.setItem(`sikt_journey_dismissed_${user?.id || ''}`, '1'); } catch { /* ignore */ }
  };
  const [selectedKwId, setSelectedKwId] = useState<string | null>(null);
  const [kwFilter, setKwFilter] = useState<'all' | 'mine' | 'gsc'>('all');
  const [kwSearch, setKwSearch] = useState('');
  const [kwChartRange, setKwChartRange] = useState<'28d' | '90d' | '12mnd'>('28d');
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [scores, setScores] = useState<{ technical: number | null; visibility: number | null }>({
    technical: null,
    visibility: null,
  });
  const [scoresLoading, setScoresLoading] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 86) return { color: 'text-green-600', label: 'Utmerket', emoji: '🟢' };
    if (score >= 71) return { color: 'text-blue-600', label: 'Bra', emoji: '✓' };
    if (score >= 51) return { color: 'text-yellow-600', label: 'Trenger forbedring', emoji: '🟡' };
    return { color: 'text-red-600', label: 'Kritisk', emoji: '🔴' };
  };

  // Sjekk om GSC allerede er koblet til
  useEffect(() => {
    const checkGscConnection = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('api_credentials')
          .select('id')
          .eq('user_id', user.id)
          .eq('service_name', 'google_search_console')
          .maybeSingle();
        if (error) throw error;
        if (data) setGscConnected(true);
      } catch {
        setGscConnected(false);
      }
    };
    checkGscConnection();
  }, [user?.id]);

  useEffect(() => {
    const fetchScores = async () => {
      if (!user?.id) return;
      setScoresLoading(true);
      try {
        const { data: site } = await supabase
          .from('sites')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!site?.id) {
          setScores({ technical: null, visibility: null });
          return;
        }

        const { data: techCheck } = await supabase
          .from('health_checks')
          .select('technical_score')
          .eq('site_id', site.id)
          .not('technical_score', 'is', null)
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: visCheck } = await supabase
          .from('health_checks')
          .select('visibility_score')
          .eq('site_id', site.id)
          .not('visibility_score', 'is', null)
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setScores({
          technical: techCheck?.technical_score ?? null,
          visibility: visCheck?.visibility_score ?? null,
        });
      } catch (err) {
        console.error('Error:', err);
        toastError('Kunne ikke hente data. Prøv igjen senere.');
      } finally {
        setScoresLoading(false);
      }
    };
    fetchScores();
  }, [user?.id]);

  // Hent GSC-søkeord fra databasen
  const handleFetchGscKeywords = async () => {
    if (!user?.id) return;
    setGscLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!site?.id) {
        toastError('Ingen nettside funnet. Kjør en PageSpeed-analyse først.');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-search-console`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ site_id: site.id }),
        }
      );

      const result = await res.json().catch(() => ({}));

      if (result.success) {
        const { data: keywords, error: keywordsError } = await supabase
          .from('keywords')
          .select('keyword, position, clicks, impressions, ctr')
          .eq('site_id', site.id)
          .order('clicks', { ascending: false })
          .limit(50);
        if (keywordsError) throw keywordsError;

        if (keywords && keywords.length > 0) {
          setGscKeywords(keywords);
          toastSuccess(`Hentet ${keywords.length} søkeord fra Google Search Console!`);
        } else {
          toastSuccess('Tilkoblet! Ingen søkeorddata ennå — dette tar noen uker for nye nettsider.');
        }
      } else {
        toastError('Kunne ikke hente søkeorddata: ' + (result.error || 'ukjent feil'));
      }
    } catch (err: any) {
      toastError('Noe gikk galt: ' + (err?.message || 'ukjent feil'));
    } finally {
      setGscLoading(false);
    }
  };

  // Start OAuth-flyt for Google Search Console
  const handleConnectGsc = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const scope = 'https://www.googleapis.com/auth/webmasters.readonly';

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(user?.id || '')}`;

    window.location.href = oauthUrl;
  };

  // Håndter redirect tilbake fra Google OAuth.
  // Kjører på nytt når user?.id blir tilgjengelig slik at vi ikke prøver å
  // hente data eller navigere til fane før brukeren er logget inn.
  useEffect(() => {
    if (!user?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('gsc') === 'connected') {
      setGscConnected(true);
      setActiveTab('keywords');
      toastSuccess('Google Search Console koblet til! Henter søkeorddata...');
      window.history.replaceState({}, '', window.location.pathname);
      handleFetchGscKeywords();
    } else if (params.get('gsc_error')) {
      toastError('Kunne ikke koble til Google Search Console. Prøv igjen.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user?.id]);

  // --- VIKTIG: VARIABLER & HJELPERE (Må defineres FØR de brukes) ---
  const getPackageLevel = (pkgName: string) => {
    const name = pkgName?.toLowerCase() || '';
    if (name.includes('premium')) return 3;
    if (name.includes('standard')) return 2;
    return 1;
  };

  const planBundle = `${clientData?.package_name || ''} ${selectedPlan || ''} ${typeof window !== 'undefined' ? (localStorage.getItem('sikt_dev_plan') || '') : ''}`;
  const hasPremium = /premium/i.test(planBundle) || /⭐\s*⭐\s*⭐/.test(planBundle);
  const hasStandardOrHigher = hasPremium || /standard/i.test(planBundle);
  const dbPackageLevel = clientData ? getPackageLevel(clientData.package_name) : 1;
  const bundlePackageLevel = hasPremium ? 3 : hasStandardOrHigher ? 2 : 1;
  const currentLevel = Math.max(dbPackageLevel, bundlePackageLevel);

  // ── Plan-baserte bruksgrenser (analyser per måned) ─────────────────
  // Basic < Standard < Premium (ubegrenset). Justér tallene her ved behov.
  const ANALYSIS_LIMITS: Record<number, number> = { 1: 10, 2: 50, 3: Infinity };
  const analysisLimit = ANALYSIS_LIMITS[currentLevel] ?? 10;
  const currentMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const analysesUsedThisMonth = analysesMonth === currentMonthKey ? analysesUsed : 0;
  const analysesRemaining =
    analysisLimit === Infinity ? Infinity : Math.max(0, analysisLimit - analysesUsedThisMonth);

  // Sidebar-navigasjon (8 faner). Hvert ikon gir rask gjenkjennelse selv naar
  // navnet er kort. Tier-faner (konkurrenter, geo) er ALLTID synlige — innholdet
  // viser TierTeaser hvis brukeren ikke har riktig pakke.
  const navItems: { id: PortalTab; label: string; icon: any }[] = [
    { id: 'home', label: 'Hjem', icon: Home },
    { id: 'visibility', label: 'Synlighet', icon: Activity },
    { id: 'keywords', label: 'Søkeord', icon: Search },
    { id: 'competitors', label: 'Konkurrenter', icon: Radar },
    { id: 'geo', label: 'AI-synlighet', icon: BrainCircuit },
    { id: 'workshop', label: 'Verksted', icon: Wrench },
    { id: 'reviews', label: 'Anmeldelser', icon: Star },
  ];
  // Kundehelse er kun for eier — skjult fra vanlige kunder.
  if (isFounder) navItems.push({ id: 'health', label: 'Kundehelse', icon: Gauge });

  // Last client_health når eier åpner fanen (via admin-health edge-fn).
  useEffect(() => {
    if (!isFounder || activeTab !== 'health') return;
    let cancelled = false;
    (async () => {
      setHealthLoading(true); setHealthError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-health`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.ok) setHealthData({ rows: json.rows ?? [], summary: json.summary ?? {} });
        else setHealthError(json?.error || `Feil (${res.status})`);
      } catch (e: any) {
        if (!cancelled) setHealthError(String(e?.message || e));
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isFounder, activeTab]);

  // 2. DATA FETCHING (Profil)
  useEffect(() => {
    const fetchClientData = async () => {
      if (!user?.email) return;
      try {
        // Bruker rå fetch (supabaseRest) for å omgå auth-lock-deadlock i supabase-js.
        const rows = await supabaseRest<any[]>(
          `clients?user_id=eq.${user.id}&select=*&limit=1`,
        );
        const raw = Array.isArray(rows) && rows.length ? rows[0] : null;

        if (raw) {
          // DB-en bruker snake_case. Vi mapper til camelCase som resten av UI-koden forventer.
          const mapped = {
            ...raw,
            companyName: raw.company_name ?? raw.companyName ?? '',
            contactPerson: raw.contact_person ?? raw.contactPerson ?? '',
            websiteUrl: raw.website_url ?? raw.websiteUrl ?? '',
            targetAudience: raw.target_audience ?? raw.targetAudience ?? '',
            email: raw.email ?? '',
            phone: raw.phone ?? '',
            industry: raw.industry ?? '',
            // Ukentlig lås for URL
            urlLastChangedAt: raw.url_last_changed_at ?? null,
          };

          setClientData(mapped);
          setFormData({
            contactPerson: mapped.contactPerson,
            companyName: mapped.companyName,
            email: mapped.email,
            phone: mapped.phone,
            websiteUrl: mapped.websiteUrl,
            industry: mapped.industry,
            targetAudience: mapped.targetAudience,
          });

          // Hent lagrede søkeord/resultater fra nettleseren (fallback)
          const savedKeywords = localStorage.getItem(`keywords_${user.id}`);
          if (savedKeywords) setKeywordsToTrack(JSON.parse(savedKeywords));

          const savedRankings = localStorage.getItem(`rankings_${user.id}`);
          if (savedRankings) {
            const parsedRankings = JSON.parse(savedRankings);
            setRealRankings(parsedRankings);
            setKeywordData(parsedRankings);
            setHasSearched(true);
          }

          // Primærkilde: hent alle brukerens søkeord fra Supabase
          try {
            const keywordRows = await supabaseRest<any[]>(
              `user_keywords?user_id=eq.${user.id}&select=keyword,location,keyword_data`,
            );
            if (Array.isArray(keywordRows) && keywordRows.length > 0) {
              const parsedRows = keywordRows
                .map((row: any) => row.keyword_data || { keyword: row.keyword, location: row.location })
                .filter(Boolean);
              setKeywordsToTrack(parsedRows.map((r: any) => ({ keyword: r.keyword, location: r.location })));
              setKeywordData(parsedRows);
              setRealRankings(parsedRows);
              setHasSearched(true);
              localStorage.setItem(`keywords_${user.id}`, JSON.stringify(parsedRows.map((r: any) => ({ keyword: r.keyword, location: r.location }))));
              localStorage.setItem(`rankings_${user.id}`, JSON.stringify(parsedRows));
            }
          } catch (kwErr: any) {
            console.warn('[ClientPortal] Kunne ikke hente user_keywords:', kwErr?.message || kwErr);
          }
        }

        // Hent host-tilkoblings-info fra client_hosts (kan være tom)
        try {
          const hostRows = await supabaseRest<any[]>(
            `client_hosts?user_id=eq.${user.id}&select=*&limit=1`,
          );
          const hostRaw = Array.isArray(hostRows) && hostRows.length ? hostRows[0] : null;
          if (hostRaw) {
            setHostConnection({
              platform: hostRaw.platform ?? null,
              connectionMode: hostRaw.connection_mode ?? 'skipped',
              repoUrl: hostRaw.repo_url ?? '',
              adminUrl: hostRaw.admin_url ?? '',
              notes: hostRaw.notes ?? '',
              lastChangedAt: hostRaw.last_changed_at ?? null,
            });
          } else {
            setHostConnection(null);
          }
        } catch (hostErr: any) {
          console.warn('[ClientPortal] Kunne ikke hente client_hosts:', hostErr?.message || hostErr);
        }
      } catch (err: any) {
        console.error('[ClientPortal] Kunne ikke hente clients:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchClientData();
  }, [user]);

  // 3. ANIMASJON (Analyse)
  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev;
          const newProgress = prev + (Math.random() * 2);
          if (newProgress < 20) setProgressText('Kobler til Google...');
          else if (newProgress < 40) setProgressText('Laster ned nettsiden...');
          else if (newProgress < 60) setProgressText('Analyserer kode og bilder...');
          else if (newProgress < 80) setProgressText('Sjekker mobiltilpasning...');
          else setProgressText('Genererer enkel rapport...');
          return newProgress;
        });
      }, 200);
    } else { setProgress(100); }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // --- HANDLERS (Generelle) ---
  // Mottar oppdatert formData fra PortalSettings (camelCase) og lagrer til DB med snake_case.
  // URL er låst i 7 dager etter hver endring (urlLastChangedAt). Host-info lagres i egen
  // tabell (client_hosts) via ConnectHost-flyten, ikke her.
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const handleSaveSettings = async (incomingFormData?: any) => {
    const merged = incomingFormData || {};
    if (!confirm("Vil du lagre endringene?")) return;
    setSaving(true);
    try {
      const urlChanged = merged.websiteUrl !== undefined
        && merged.websiteUrl !== (clientData?.websiteUrl ?? '');

      // Ukentlig lås: sjekk hvor lang tid det er siden forrige URL-endring
      const lastAt = clientData?.urlLastChangedAt ? new Date(clientData.urlLastChangedAt).getTime() : 0;
      const sinceLast = Date.now() - lastAt;
      if (urlChanged && lastAt > 0 && sinceLast < MS_PER_WEEK) {
        const daysLeft = Math.ceil((MS_PER_WEEK - sinceLast) / (24 * 60 * 60 * 1000));
        toastError(`Nettadressen kan endres på nytt om ${daysLeft} dag${daysLeft === 1 ? '' : 'er'}.`);
        setSaving(false);
        return;
      }

      // Bygg patch med kun snake_case kolonner som faktisk finnes i DB
      const patch: Record<string, any> = {};
      if (merged.companyName !== undefined) patch.company_name = merged.companyName;
      if (merged.contactPerson !== undefined) patch.contact_person = merged.contactPerson;
      if (merged.email !== undefined) patch.email = merged.email;
      if (merged.phone !== undefined) patch.phone = merged.phone;
      if (merged.industry !== undefined) patch.industry = merged.industry;
      if (merged.targetAudience !== undefined) patch.target_audience = merged.targetAudience;
      if (urlChanged) {
        patch.website_url = merged.websiteUrl;
        patch.url_last_changed_at = new Date().toISOString();
      }

      await supabaseRest(`clients?user_id=eq.${user.id}`, {
        method: 'PATCH',
        body: patch,
        headers: { Prefer: 'return=representation' },
      });

      // Oppdater lokal state umiddelbart
      setClientData({
        ...clientData,
        ...merged,
        urlLastChangedAt: urlChanged ? patch.url_last_changed_at : clientData?.urlLastChangedAt,
      });

      if (urlChanged) toastSuccess("Nettadresse lagret. Kan endres igjen om 7 dager.");
      else toastSuccess("Endringer lagret.");
    } catch (err: any) {
      console.error('[handleSaveSettings] feil:', err?.message || err);
      toastError("Kunne ikke lagre: " + (err?.message || 'ukjent feil'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = (targetPlan?: 'Basic' | 'Standard' | 'Premium') => {
    try {
      const fallbackPlan: 'Standard' | 'Premium' = currentLevel <= 1 ? 'Standard' : 'Premium';
      const selectedTarget = (targetPlan || fallbackPlan).toUpperCase();
      // Lenkene leses fra miljøvariabler (VITE_STRIPE_*_LINK) via stripeLinks.
      const checkoutUrl = buildStripeCheckoutUrl(selectedTarget, {
        email: user?.email || '',
        userId: user?.id || '',
      });
      if (!checkoutUrl) {
        toastError('Fant ikke riktig planlenke. Sjekk at VITE_STRIPE_*_LINK er satt.');
        return;
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Error:', err);
      if (typeof onSelectPlan === 'function') onSelectPlan(targetPlan || 'Standard');
      else toastError('Kunne ikke starte betaling. Prøv igjen senere.');
    }
  };

  const sendGeoChat = async () => {
    const q = geoChatInput.trim();
    if (!q || geoChatLoading || !hasPremium) return;
    const token = getStoredAccessToken();
    if (!token) {
      toastError('Du må være logget inn. Prøv å logge inn på nytt.');
      return;
    }
    setGeoChatLoading(true);
    setGeoChatReply(null);
    try {
      const ctx = [clientData?.companyName, formData.websiteUrl || clientData?.websiteUrl, clientData?.industry].filter(Boolean).join(' · ');
      const prompt = `Du er Sikt AI, en norsk rådgiver for synlighet i Google og generativ søk (ChatGPT m.fl.). Bedriftskontekst: ${ctx || 'ikke oppgitt'}. Svar kort, konkret og på norsk (maks ca. 150 ord). Ingen hallusinerte tall om rangering — gi metode og prioritering.\n\nSpørsmål: ${q}`;
      const res = await fetch('/api/openai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, model: 'gpt-4o-mini', maxTokens: 450 }),
      });
      const data = await res.json().catch(() => ({}));
      if (isApiRateLimited(res.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
        setGeoChatReply(null);
        return;
      }
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : (data?.message || `Feil ${res.status}`));
      const text = String(data.content || '').trim();
      setGeoChatReply(text || 'Tomt svar fra modellen.');
    } catch (e: any) {
      toastError(e?.message || 'Kunne ikke nå AI.');
      setGeoChatReply(null);
    } finally {
      setGeoChatLoading(false);
    }
  };

  // --- INNHOLDS-/LENKE-DATA (brukes av runContentScan/runLinkScan + cache) ---
  const [contentPages, setContentPages] = useState<ContentPage[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // EKTE INNHOLDSSKANNER (Bruker Vercel Backend)
  const runContentScan = async (forceRefresh = false) => {
    if (!formData.websiteUrl) { toastWarning("Legg inn URL i innstillinger først."); return; }

    if (contentPages.length > 0 && !forceRefresh) return;

    setIsScanning(true);
    setIsScanningLinks(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/scan-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ url: formData.websiteUrl })
      });

      const data = await response.json().catch(() => ({}));

      if (isApiRateLimited(response.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
        return;
      }

      if (!response.ok || data.error) {
        toastError("Feil ved skanning: " + data.error);
        return;
      }

      if (data.pages && data.pages.length > 0) {
        setContentPages(data.pages);

        const formattedLinkPages = data.pages.map((p: any, index: number) => ({
          id: `link-${index}`,
          url: p.url,
          title: p.title,
          inlinks: p.inlinks,
          outlinks: p.outlinks,
          status: p.inlinks === 0 ? 'Isolert' : p.status === 'Kritisk' ? 'Kritisk' : 'Bra',
          brokenLinks: 0,
          linkScore: p.score,
          anchorIssues: [],
          hubType: index === 0 ? 'Pillar' : 'Cluster',
          suggestedInlinks: []
        }));

        setLinkPages(formattedLinkPages);

        if (user?.id) {
          await logSiktActionsBatch(buildContentScanLogEntries(data.pages, formData.websiteUrl));
        }
      } else {
        toastWarning("Fant ingen sider på dette domenet. Er URL-en riktig?");
      }

    } catch (error: any) {
      toastError(error?.message || "Nettverksfeil under skanning.");
    } finally {
      setIsScanning(false);
      setIsScanningLinks(false);
    }
  };
  const [linkPages, setLinkPages] = useState<LinkPage[]>([]);
  const [selectedLinkPage, setSelectedLinkPage] = useState<LinkPage | null>(null);
  const [isScanningLinks, setIsScanningLinks] = useState(false);


  // --- HENT SIKT-HANDLINGER NÅR LOGGEN ÅPNES ---
  useEffect(() => {
    if (activeTab !== 'log' || !user?.id) return;

    const fetchActions = async () => {
      setLoadingReceipt(true);
      try {
        // Hent de siste 60 dagene, så filtrerer vi per uke i UI-laget
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const { data, error } = await supabase
          .from('sikt_actions')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', sixtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          // Tabellen finnes trolig ikke ennå — vis tom tilstand
          console.warn('sikt_actions ikke tilgjengelig:', error.message);
          setSiktActions([]);
        } else {
          setSiktActions(dedupeSiktActions(Array.isArray(data) ? data : []));
        }
      } catch {
        setSiktActions([]);
      } finally {
        setLoadingReceipt(false);
      }
    };

    fetchActions();
  }, [activeTab, user?.id]);

  // «Merk som gjort» på forslag/varsler — oppdaterer status i sikt_actions
  // (RLS tillater update på egne rader) og speiler i UI umiddelbart.
  const markActionDone = async (actionId: string, done: boolean) => {
    const newStatus = done ? 'done' : 'open';
    setSiktActions((prev: any[]) => prev.map((a: any) =>
      a.id === actionId ? { ...a, status: newStatus, done_at: done ? new Date().toISOString() : null } : a
    ));
    try {
      const { error } = await supabase
        .from('sikt_actions')
        .update({ status: newStatus, done_at: done ? new Date().toISOString() : null })
        .eq('id', actionId);
      if (error) throw error;
      if (done) toastSuccess('Markert som gjort.');
    } catch (e: any) {
      // Rull tilbake hvis databasen avviste (f.eks. migrasjon ikke kjørt ennå)
      setSiktActions((prev: any[]) => prev.map((a: any) =>
        a.id === actionId ? { ...a, status: done ? 'open' : 'done' } : a
      ));
      toastError('Kunne ikke lagre: ' + (e?.message || 'ukjent feil'));
    }
  };

  // --- LENKE-SKANNER (kalles ikke fra UI ennå, men beholdt for fremtidig bruk) ---
  const runLinkScan = async () => {
    if (!formData.websiteUrl) { toastWarning("Legg inn URL i innstillinger først."); return; }

    setIsScanningLinks(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/scan-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ url: formData.websiteUrl })
      });

      const data = await response.json().catch(() => ({}));

      if (isApiRateLimited(response.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
        return;
      }

      if (!response.ok || data.error) {
        toastError("Feil ved skanning: " + data.error);
        return;
      }

      if (data.pages && data.pages.length > 0) {
        // Formaterer dataen perfekt for Lenke-tabellen din
        const formattedLinkPages = data.pages.map((p: any, index: number) => ({
          id: `link-${index}`,
          url: p.url,
          title: p.title,
          inlinks: p.inlinks,
          outlinks: p.outlinks,
          status: p.inlinks === 0 ? 'Isolert' : p.status === 'Kritisk' ? 'Kritisk' : 'Bra',
          brokenLinks: 0,
          linkScore: p.score,
          anchorIssues: [],
          hubType: index === 0 ? 'Pillar' : 'Cluster',
          suggestedInlinks: []
        }));

        setLinkPages(formattedLinkPages);

        // Bonus: Siden vi allerede hentet all dataen, fyller vi Innholds-fanen samtidig!
        setContentPages(data.pages);

        if (user?.id) {
          await logSiktActionsBatch(buildLinkScanLogEntries(formattedLinkPages, formData.websiteUrl));
        }
      } else {
        toastWarning("Fant ingen lesbare sider på dette domenet.");
      }

    } catch (error: any) {
      toastError(error?.message || "Nettverksfeil under lenkeskanning.");
    } finally {
      setIsScanningLinks(false);
    }
  };

  // Denne sørger for at dataene dine lastes inn igjen når du refresher siden
  useEffect(() => {
    const savedRankings = localStorage.getItem(`rankings_${user.id}`);
    if (savedRankings) {
      try {
        const parsed = JSON.parse(savedRankings);
        setKeywordData(parsed);
        setHasSearched(true);
      } catch (e) {
        console.error("Kunne ikke laste lagrede data", e);
      }
    }
  }, [user.id]);

  // --- AUTO-LOAD CACHE (innhold/lenker hentes ved bruk i drawer/scan) ---
  useEffect(() => {
    if (!formData.websiteUrl) return;
    if (contentPages.length === 0) {
      const contentCache = localStorage.getItem(`content_cache_${formData.websiteUrl}`);
      if (contentCache) {
        try {
          const { data, timestamp } = JSON.parse(contentCache);
          if (Date.now() - timestamp < 86400000) setContentPages(data);
        } catch (e) { /* ignore */ }
      }
    }
    if (linkPages.length === 0) {
      const linkCache = localStorage.getItem(`link_cache_${formData.websiteUrl}`);
      if (linkCache) {
        try {
          const { data, timestamp } = JSON.parse(linkCache);
          if (Date.now() - timestamp < 86400000) setLinkPages(data);
        } catch (e) { /* ignore */ }
      }
    }
  }, [formData.websiteUrl, contentPages.length, linkPages.length]);

  // --- SØKEORDSGRENSER ---
  const getKeywordLimit = (level: number) => {
    if (level >= 3) return 50; // Premium
    if (level === 2) return 15; // Standard
    return 3; // Basic
  };
  const currentKeywordLimit = getKeywordLimit(currentLevel);
  const keywordsUsed = keywordsToTrack.length;
  const canAddMoreKeywords = keywordsUsed < currentKeywordLimit;

  // --- LEGG TIL SØKEORD (Med grense-sjekk) ---
  const handleAddKeyword = () => {
    if (!canAddMoreKeywords) {
      toastWarning(`Du har nådd grensen på ${currentKeywordLimit} søkeord for din nåværende plan. Oppgrader for å overvåke flere ord.`);
      return;
    }
    if (newKeywordInput.trim() && locationInput.trim()) {
      const newEntry = { keyword: newKeywordInput.trim(), location: locationInput.trim() };
      const updated = [...keywordsToTrack, newEntry];
      setKeywordsToTrack(updated);
      setNewKeywordInput('');
      localStorage.setItem(`keywords_${user.id}`, JSON.stringify(updated));

      // Sørg for at det nyopprettede ordet faktisk er synlig. «Google»-filteret
      // viser kun GSC-ord, så egne ord ville ellers «forsvinne» fra lista til man
      // selv byttet tilbake til «Alle»/«Egne». Marker det også i listen.
      if (kwFilter === 'gsc') setKwFilter('all');
      setSelectedKwId(`tracked-${newEntry.keyword}-${newEntry.location}`);

      // Logg til Ukens kvittering
      if (user?.id) {
        supabase.from('sikt_actions').insert({
          user_id: user.id,
          action_type: 'keyword_added',
          category: 'finding',
          title: `La til søkeord «${newEntry.keyword}» for overvåkning i ${newEntry.location}`,
          details: { keyword: newEntry.keyword, location: newEntry.location },
        }).then(() => {}, () => {});
      }
    } else {
      toastWarning("Du må skrive både søkeord og velge en kommune.");
    }
  };

  // --- STRENG SLETTING ---
  const handleRemoveKeyword = (keywordToRemove: string, locationToRemove: string) => {
    const isConfirmed = window.confirm(
      `STRENG ADVARSEL: \n\nHvis du sletter "${keywordToRemove}", sletter du all historikk og grafdata for dette ordet for alltid.\n\nSEO handler om å bygge data over tid. Vi anbefaler sterkt å beholde ordet.\n\nEr du 100% sikker på at du vil slette det?`
    );
    if (!isConfirmed) return;

    // Fjern fra listen over ord
    const updatedKeywords = keywordsToTrack.filter((k: any) =>
      !(k.keyword === keywordToRemove && k.location === locationToRemove)
    );
    setKeywordsToTrack(updatedKeywords);
    localStorage.setItem(`keywords_${user.id}`, JSON.stringify(updatedKeywords));

    // Fjern fra resultat-listen
    const updatedRankings = realRankings.filter(r =>
      !(r.keyword === keywordToRemove && r.location === locationToRemove)
    );
    setRealRankings(updatedRankings);
    localStorage.setItem(`rankings_${user.id}`, JSON.stringify(updatedRankings));
  };


  const handleCheckRankings = async () => {
    if (!formData.websiteUrl) { toastWarning("Legg inn URL i innstillinger."); return; }


    // --- 1. SØKEORDSKVOTE & AUTOMATISK LEGG TIL ---
    const currentKeywordLimit = currentLevel >= 3 ? 50 : currentLevel === 2 ? 15 : 3;
    let activeList = [...keywordsToTrack];

    // Sjekk om brukeren har skrevet noe nytt i søkefeltet
    if (newKeywordInput.trim()) {
      if (!locationInput.trim()) { toastWarning("Du må fylle ut sted (f.eks Oslo) for å søke."); return; }
      if (activeList.length >= currentKeywordLimit) {
        toastWarning(`Søkeordskvoten din på ${currentKeywordLimit} er full!`);
        return;
      }

      const newEntry = { keyword: newKeywordInput.trim(), location: locationInput.trim() };
      activeList = [...activeList, newEntry];
      setKeywordsToTrack(activeList);

      // Vi sletter localStorage her, siden vi lagrer alt i Supabase lenger ned
      setNewKeywordInput(''); // Tømmer feltet
      if (kwFilter === 'gsc') setKwFilter('all'); // hold det nye ordet synlig
    }

    if (activeList.length === 0) { toastWarning("Legg til et søkeord."); return; }

    setRankingLoading(true);
    setHasSearched(true);

    const cleanDomain = formData.websiteUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase()
      .trim();

    // Robust treff: sammenlign på hostname (ikke substring) så vi unngår
    // falske treff (f.eks. «mittsikt.no» mot «sikt.no») og bom på www/sti.
    const linkMatchesDomain = (link: string) => {
      try {
        const host = new URL(link).hostname.replace(/^www\./, '').toLowerCase();
        return host === cleanDomain || host.endsWith('.' + cleanDomain);
      } catch {
        return link.toLowerCase().includes(cleanDomain);
      }
    };

    const rankToken = getStoredAccessToken();
    if (!rankToken) {
      toastWarning('Sesjonen din er utløpt. Logg inn på nytt.');
      setRankingLoading(false);
      return;
    }

    try {
      let rateLimitNotified = false;
      const promises = activeList.map(async (entry: any) => {
        const keyword = typeof entry === 'string' ? entry : entry.keyword;
        const location = typeof entry === 'string' ? 'Oslo' : entry.location;

        try {
          // Snakker med den trygge Vercel-serveren din (backend)
          const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${rankToken}`
            },
            body: JSON.stringify({ keyword, location })
          });

          const data = await response.json().catch(() => ({}));

          if (isApiRateLimited(response.status, data)) {
            if (!rateLimitNotified) {
              rateLimitNotified = true;
              toastWarning(apiRateLimitUserMessage(data));
            }
            return null;
          }

          if (!response.ok || data.error) {
            return null; // Hopper over dette ordet hvis serveren feiler
          }

          let position = 301; // sentinel: «utenfor topp 300»
          let url = '-';
          let extractedCompetitors: any[] = [];
          let resultType = 'Tekst';

          if (data.organic_results) {
            const found = data.organic_results.find((r: any) => r.link && linkMatchesDomain(r.link));
            if (found) {
              position = found.position;
              url = found.link; // Hele URL-en — detaljpanelet kutter origin for visning og bruker lenken som href.
            }
            extractedCompetitors = data.organic_results.slice(0, 5).map((r: any) => ({
              position: r.position, title: r.title, url: r.link, snippet: r.snippet
            }));

            // Lazy paginering: kun hvis IKKE funnet i topp 100 og det finnes flere sider.
            // Henter side 2 (101–200) så side 3 (201–300), stopper straks domenet finnes.
            // Søkeord i topp 100 koster fortsatt bare ett oppslag.
            if (!found && data.organic_results.length >= 100) {
              for (const startAt of [100, 200]) {
                try {
                  const moreRes = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rankToken}` },
                    body: JSON.stringify({ keyword, location, start: startAt }),
                  });
                  const moreData = await moreRes.json().catch(() => ({}));
                  if (!moreRes.ok || moreData.error || isApiRateLimited(moreRes.status, moreData)) break;
                  const more = Array.isArray(moreData.organic_results) ? moreData.organic_results : [];
                  const moreFound = more.find((r: any) => r.link && linkMatchesDomain(r.link));
                  if (moreFound) {
                    position = moreFound.position;
                    url = moreFound.link;
                    break;
                  }
                  if (more.length < 100) break; // ingen flere sider å hente
                } catch { break; }
              }
            }
          }

          // Sjekk hva slags resultater Google viser
          if (data.local_results) resultType += ", Kart";
          if (data.inline_images) resultType += ", Bilder";

          // Ekte data (eller estimater basert på live tall) for volum og KD
          const totalResults = data.search_information?.total_results || 10000;
          const kd = Math.min(100, Math.max(10, Math.round((totalResults / 1000000) * 10)));
          const intent = ['Kjøp', 'Info', 'Lokal'][Math.floor(Math.random() * 3)];

          // --- 2. EKTE HISTORIKK-LOGIKK ---
          const todayDate = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });

          // Finn tidligere data for dette søkeordet for å beholde grafen
          const existingKeywordData = realRankings.find((r: any) => r.keyword === keyword && r.location === location);
          let newHistory = existingKeywordData?.history ? [...existingKeywordData.history] : [];

          // Sjekk om vi allerede har et punkt for i dag
          const hasToday = newHistory.some((h: any) => h.date === todayDate);

          if (hasToday) {
            // Oppdater dagens posisjon hvis man søker flere ganger samme dag
            newHistory = newHistory.map((h: any) => h.date === todayDate ? { ...h, rank: position } : h);
          } else {
            // Legg til ny måling
            newHistory.push({ date: todayDate, rank: position });
          }

          // Behold maks de siste 30 dagene
          if (newHistory.length > 30) newHistory.shift();

          // Kalkuler ekte endring (Change) siden forrige måling
          let change = 0;
          if (newHistory.length > 1) {
            const previousRank = newHistory[newHistory.length - 2].rank;
            change = previousRank - position;
          }

          return {
            keyword,
            location,
            position,
            url,
            change: change,
            volume: resultType,
            competition: totalResults,
            kd,
            intent,
            history: newHistory,
            competitors: extractedCompetitors
          } as any;

        } catch {
          return null;
        }
      });

      const results = (await Promise.all(promises)).filter(Boolean) as any[];
      setKeywordData(results);
      setRealRankings(results);
      setKeywordsToTrack(results.map((r: any) => ({ keyword: r.keyword, location: r.location })));

      // Logg til Ukens kvittering
      const top10 = results.filter((r: any) => r.position <= 10).length;
      const top3 = results.filter((r: any) => r.position <= 3).length;
      if (user?.id) {
        supabase.from('sikt_actions').insert({
          user_id: user.id,
          action_type: 'keyword_check',
          category: 'finding',
          title: `Sjekket rangering for ${results.length} søkeord — ${top10} på side 1, ${top3} i topp 3`,
          details: { total: results.length, top10, top3 },
          page_url: formData.websiteUrl,
        }).then(() => {}, () => {});
      }

      // --- 3. LAGRE TIL SUPABASE (ERSTATTER LOCALSTORAGE) ---
      for (const result of results) {
        // 1. Sjekk om ordet allerede finnes i databasen for denne kunden
        const { data: existing, error: existingError } = await supabase
          .from('user_keywords')
          .select('id')
          .eq('user_id', user.id)
          .eq('keyword', result.keyword)
          .eq('location', result.location)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing) {
          // 2. Hvis det finnes, oppdaterer vi grafen og historikken
          const { error: updateError } = await supabase
            .from('user_keywords')
            .update({ keyword_data: result })
            .eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          // 3. Hvis det er helt nytt, legger vi det inn i databasen
          const { error: insertError } = await supabase
            .from('user_keywords')
            .insert({
              user_id: user.id,
              keyword: result.keyword,
              location: result.location,
              keyword_data: result
            });
          if (insertError) throw insertError;
        }
      }

      // Behold lokal cache i tillegg til Supabase for rask last ved refresh.
      localStorage.setItem(`keywords_${user.id}`, JSON.stringify(activeList));
      localStorage.setItem(`rankings_${user.id}`, JSON.stringify(results));

    } catch (error: any) {
      toastError(error?.message || "Feil ved henting av data.");
    } finally {
      setRankingLoading(false);
    }
  };

  // --- ANALYSE LOGIKK (PageSpeed) ---
  const formatLighthouseData = (data: any): AnalysisResult => {
    const lh = data.lighthouseResult;
    const cats = lh.categories;
    const audits = lh.audits;
    const field = data.loadingExperience?.metrics;

    const getMetric = (fieldKey: string, labKey: string, unit: 's' | 'ms' | 'unitless') => {
      if (field && field[fieldKey]) {
        const val = field[fieldKey].percentile;
        if (unit === 's') return { value: `${(val / 1000).toFixed(1)}s`, score: field[fieldKey].category === 'FAST' ? 0.9 : 0.5 };
        if (unit === 'ms') return { value: `${val}ms`, score: field[fieldKey].category === 'FAST' ? 0.9 : 0.5 };
        if (unit === 'unitless') return { value: (val / 100).toFixed(2), score: field[fieldKey].category === 'FAST' ? 0.9 : 0.5 };
      }
      const audit = audits[labKey];
      if (!audit) return { value: '-', score: 0 };
      if (unit === 's') return { value: `${(audit.numericValue / 1000).toFixed(1)}s`, score: audit.score };
      if (unit === 'ms') return { value: `${Math.round(audit.numericValue)}ms`, score: audit.score };
      return { value: audit.numericValue.toFixed(2), score: audit.score };
    };

    const fcp = getMetric('FIRST_CONTENTFUL_PAINT_MS', 'first-contentful-paint', 's');
    const lcp = getMetric('LARGEST_CONTENTFUL_PAINT_MS', 'largest-contentful-paint', 's');
    const cls = getMetric('CUMULATIVE_LAYOUT_SHIFT_SCORE', 'cumulative-layout-shift', 'unitless');
    const tbtAudit = audits['total-blocking-time'];
    const tbt = { value: tbtAudit ? `${Math.round(tbtAudit.numericValue)}ms` : '-', score: tbtAudit ? tbtAudit.score : 0 };

    const opportunities = Object.values(audits)
      .filter((audit: any) => audit.details && audit.details.type === 'opportunity' && (audit.score !== null && audit.score < 0.9))
      .sort((a: any, b: any) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0))
      .slice(0, 5)
      .map((audit: any) => ({ title: audit.title, description: audit.description.split('[')[0], savings: audit.displayValue || '' }));

    const diagnostics = [
      { title: "Sikker tilkobling (HTTPS)", passed: audits['is-on-https']?.score === 1 },
      { title: "Mobilvennlig tekst", passed: audits['font-size']?.score === 1 },
      { title: "Mobilvennlige knapper", passed: audits['tap-targets']?.score === 1 },
      { title: "Synlig for Google (SEO)", passed: audits['is-crawlable']?.score === 1 },
      { title: "Har beskrivelse (Meta)", passed: audits['meta-description']?.score === 1 },
      { title: "Bilder har tekst (UU)", passed: audits['image-alt']?.score === 1 },
      { title: "Ingen kodefeil", passed: audits['errors-in-console']?.score === 1 },
    ];

    const extras = {
      screenshot: audits['final-screenshot']?.details?.data,
      serverTime: audits['server-response-time']?.displayValue,
      totalWeight: audits['total-byte-weight']?.displayValue
    };

    return {
      performance: Math.round(cats.performance.score * 100),
      seo: Math.round(cats.seo.score * 100),
      accessibility: Math.round(cats.accessibility.score * 100),
      bestPractices: Math.round(cats['best-practices'].score * 100),
      seoDetails: { metaDescription: audits['meta-description'], documentTitle: audits['document-title'], linkText: audits['link-text'], viewport: audits['viewport'] },
      fcp, lcp, cls, tbt,
      opportunities, diagnostics, extras
    };
  };

  // --- SIKT ACTIONS LOGGER ---
  // Kalles når Sikt gjør noe for brukeren, slik at det dukker opp i "Ukens kvittering"
  // Feiler stille hvis tabellen ikke finnes enda (for bakoverkompatibilitet)
  const logSiktAction = async (params: {
    actionType: string;
    category: 'finding' | 'suggestion' | 'fix' | 'alert';
    title: string;
    details?: any;
    pageUrl?: string;
    beforeValue?: string;
    afterValue?: string;
  }) => {
    if (!user?.id) return;
    const localRow = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      user_id: user.id,
      action_type: params.actionType,
      category: params.category,
      title: params.title,
      details: params.details ?? null,
      page_url: params.pageUrl ?? null,
      before_value: params.beforeValue ?? null,
      after_value: params.afterValue ?? null,
    };
    setSiktActions((prev) => dedupeSiktActions([localRow, ...prev]));
    try {
      await supabaseRest('sikt_actions', {
        method: 'POST',
        body: {
          user_id: user.id,
          action_type: params.actionType,
          category: params.category,
          title: params.title,
          details: params.details ?? null,
          page_url: params.pageUrl ?? null,
          before_value: params.beforeValue ?? null,
          after_value: params.afterValue ?? null,
        },
        headers: { Prefer: 'return=minimal' },
      });
    } catch (err) {
      try {
        const key = `sikt_actions_fallback_${user.id}`;
        const q = JSON.parse(localStorage.getItem(key) || '[]');
        q.push({ ...params, savedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(q.slice(-50)));
      } catch { /* ignore */ }
    }
  };

  const logSiktActionsBatch = async (entries: SiktLogEntry[]) => {
    for (const entry of entries) {
      await logSiktAction(entry);
    }
  };

  const runRealAnalysis = async () => {
    const url = formData.websiteUrl || clientData?.websiteUrl;
    if (!url) { setAnalyzeError("Mangler URL. Legg inn nettadresse under Innstillinger."); return; }
    // Plan-grense: stopp før kjøring hvis månedens analyser er brukt opp.
    if (!isMockUser && analysisLimit !== Infinity && analysesUsedThisMonth >= analysisLimit) {
      const planLabel = ({ 1: 'Basic', 2: 'Standard', 3: 'Premium' } as Record<number, string>)[currentLevel] || 'planen din';
      const msg = `Du har brukt månedens ${analysisLimit} analyser på ${planLabel}-planen.${currentLevel < 3 ? ' Oppgrader for flere.' : ''}`;
      setAnalyzeError(msg);
      try { toastError(msg); } catch { /* ignore */ }
      return;
    }
    setIsAnalyzing(true); setAnalyzeError(null);
    let formattedUrl = String(url).trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

    const token = getStoredAccessToken();
    if (!token) {
      setAnalyzeError("Du må være logget inn for å kjøre analyse.");
      setIsAnalyzing(false);
      return;
    }

    let lastErr = 'Ukjent feil';
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          setAnalyzeError(`Prøver på nytt (${attempt + 1}/3) …`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
        }

        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-pagespeed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            url: formattedUrl,
            user_id: user?.id
          }),
        });

        const errBody = await res.json().catch(() => ({}));

        if (isApiRateLimited(res.status, errBody)) {
          setAnalyzeError(apiRateLimitUserMessage(errBody));
          return;
        }

        // Server-side plan-grense nådd → vis melding + oppgrader, ikke prøv igjen.
        if (res.status === 403 && errBody?.error === 'analysis_limit_reached') {
          const planLabel = ({ 1: 'Basic', 2: 'Standard', 3: 'Premium' } as Record<number, string>)[currentLevel] || 'planen din';
          const lim = errBody?.usage?.limit ?? analysisLimit;
          if (errBody?.usage) { setAnalysesMonth(errBody.usage.month); setAnalysesUsed(errBody.usage.used); }
          const msg = `Du har brukt månedens ${lim} analyser på ${planLabel}-planen.${currentLevel < 3 ? ' Oppgrader for flere.' : ''}`;
          setAnalyzeError(msg);
          try { toastError(msg); } catch { /* ignore */ }
          return;
        }

        if (res.ok) {
          const { mobile: mobileRaw, desktop: desktopRaw } = errBody;
          const mobile = formatLighthouseData(mobileRaw);
          const desktop = formatLighthouseData(desktopRaw);
          setAnalysisResults({ mobile, desktop });
          setAnalyzeError(null);

          try {
            localStorage.setItem(`sikt_analysis_cache_${user.id}`, JSON.stringify({ url: formattedUrl, results: { mobile, desktop }, timestamp: Date.now() }));
          } catch { /* ignore */ }

          const histEntry = {
            at: new Date().toISOString(),
            mobilePerf: mobile.performance,
            mobileSeo: mobile.seo,
            desktopPerf: desktop.performance,
          };
          setScoreHistory((prev) => {
            const next = [...prev, histEntry].slice(-30);
            try { localStorage.setItem(`sikt_portal_score_history_${user.id}`, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
          });

          await logSiktActionsBatch(buildAnalysisLogEntries(mobile, formattedUrl));
          // Server teller opp kvoten og returnerer ny status — synk lokalt.
          if (errBody?.usage) { setAnalysesMonth(errBody.usage.month); setAnalysesUsed(errBody.usage.used); }
          return;
        }

        lastErr = errBody.error || `HTTP ${res.status}`;
        // Logger detaljer til console (aldri til UI)
        if (errBody.detail) console.error('[runRealAnalysis] Google-detail:', errBody.detail);
        console.error('[runRealAnalysis] response', res.status, errBody);
        if (![429, 500, 502, 503].includes(res.status)) break;
      }

      throw new Error(lastErr);
    } catch (err: any) {
      const msg = err?.message || lastErr;
      console.error('[runRealAnalysis] Feil:', err);
      // Fjern eventuelle API-nøkler fra feilmeldingen (mønster: AIza + 35 tegn)
      const safeMsg = msg.replace(/AIza[A-Za-z0-9_-]{35}/g, '[nøkkel skjult]')
                         .replace(/api_key:[^\s'"]+/gi, 'api_key:[skjult]');
      if (/PAGESPEED_API_KEY/i.test(safeMsg)) {
        setAnalyzeError('Serveren mangler PAGESPEED_API_KEY. Legg den til i .env.local og restart dev-serveren.');
      } else if (/suspended/i.test(safeMsg)) {
        setAnalyzeError('PageSpeed API-nøkkelen er suspendert av Google. Lag en ny nøkkel i Google Cloud Console og oppdater den i Vercel → Environment Variables.');
      } else if (/API key not valid|API_KEY_INVALID/i.test(safeMsg)) {
        setAnalyzeError('PageSpeed-nøkkelen ble avvist av Google. Sjekk at nøkkelen er gyldig og at PageSpeed Insights API er aktivert i samme prosjekt.');
      } else if (/quota|RESOURCE_EXHAUSTED/i.test(safeMsg)) {
        setAnalyzeError('PageSpeed-kvoten er brukt opp. Vent et minutt eller sjekk kvotene dine i Google Cloud.');
      } else if (/HTTP 5\d\d|Intern feil|PageSpeed feilet|feilet/i.test(safeMsg)) {
        setAnalyzeError('Kunne ikke kjøre PageSpeed akkurat nå. Prøv igjen om litt.');
      } else {
        setAnalyzeError(safeMsg);
      }
    } finally { setIsAnalyzing(false); }
  };

  // ===================================================================
  // AUTO-SCAN — fyrer av PageSpeed + innholds-scan + lenke-scan i bakgrunnen
  // foerste gang brukeren entrer portalen og har en URL satt. Respekterer cache
  // (24t for innhold/lenker, 12t for PageSpeed) saa vi ikke spinner unoedig.
  // ===================================================================
  const autoScanFiredRef = useRef(false);
  const [autoScanInfo, setAutoScanInfo] = useState<{ active: boolean; label: string }>({ active: false, label: '' });

  useEffect(() => {
    if (autoScanFiredRef.current) return;
    if (loading) return;
    if (!user?.id) return;
    const url = (formData.websiteUrl || clientData?.websiteUrl || '').trim();
    if (!url) return;

    autoScanFiredRef.current = true;

    (async () => {
      // PageSpeed: bare hvis vi mangler resultater eller cache er > 12t
      const pageSpeedStale = (() => {
        try {
          const raw = localStorage.getItem(`sikt_analysis_cache_${user.id}`);
          if (!raw) return true;
          const parsed = JSON.parse(raw);
          const norm = (s: string) => String(s || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
          if (norm(parsed.url) !== norm(url)) return true;
          // 12 timer
          const ts = parsed.timestamp || 0;
          return Date.now() - ts > 12 * 60 * 60 * 1000;
        } catch { return true; }
      })();

      // Hopp over hvis suksess-sidens første-analyse allerede har levert et
      // rå-resultat eller fortsatt er underveis — da hydrerer vi det i stedet
      // for å kjøre en NY analyse (unngår dobbel kvote-bruk).
      const firstAnalysisHandledElsewhere = (() => {
        try {
          if (localStorage.getItem(`sikt_first_analysis_raw_${user.id}`)) return true;
          const pend = localStorage.getItem(`sikt_first_analysis_pending_${user.id}`);
          if (pend && Date.now() - Number(pend) < 120000) return true;
        } catch { /* ignore */ }
        return false;
      })();

      try {
        if (!analysisResults && !isAnalyzing && pageSpeedStale && !firstAnalysisHandledElsewhere) {
          setAutoScanInfo({ active: true, label: 'Sjekker PageSpeed mot Google…' });
          await runRealAnalysis();
        }
      } catch (e) { console.warn('[auto-scan] pagespeed:', e); }

      try {
        if (contentPages.length === 0) {
          setAutoScanInfo({ active: true, label: 'Skanner innhold på sidene dine…' });
          await runContentScan();
        }
      } catch (e) { console.warn('[auto-scan] content:', e); }

      try {
        if (linkPages.length === 0) {
          setAutoScanInfo({ active: true, label: 'Sjekker lenker for brudd…' });
          await runLinkScan();
        }
      } catch (e) { console.warn('[auto-scan] links:', e); }

      setAutoScanInfo({ active: false, label: '' });
    })();
  }, [loading, user?.id, formData.websiteUrl, clientData?.websiteUrl]);

  // ===================================================================
  // FØRSTE-ANALYSE-HYDRERING — promoterer rå-resultatet fra suksess-siden
  // (sikt_first_analysis_raw) til analyse-cachen, så dashbordet viser ekte
  // tall MED EN GANG uten å kjøre en ny analyse. Poller i ~90 s i tilfelle
  // bakgrunns-analysen fortsatt fullføres når kunden kommer inn.
  // ===================================================================
  useEffect(() => {
    if (!user?.id) return;
    const urlNow = (formData.websiteUrl || clientData?.websiteUrl || '').trim();
    if (!urlNow) return;
    const norm = (s: string) => String(s || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
    let tries = 0;

    const tryHydrate = (): boolean => {
      try {
        // Allerede en cache? La cache-restore/auto-scan håndtere det.
        if (localStorage.getItem(`sikt_analysis_cache_${user.id}`)) return true;
        const raw = localStorage.getItem(`sikt_first_analysis_raw_${user.id}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed?.mobileRaw || !parsed?.desktopRaw) return true;
        if (parsed.url && norm(parsed.url) !== norm(urlNow)) return true; // annen side enn nå
        const mobile = formatLighthouseData(parsed.mobileRaw);
        const desktop = formatLighthouseData(parsed.desktopRaw);
        setAnalysisResults({ mobile, desktop });
        const formattedUrl = parsed.url || urlNow;
        try {
          localStorage.setItem(`sikt_analysis_cache_${user.id}`, JSON.stringify({ url: formattedUrl, results: { mobile, desktop }, timestamp: parsed.timestamp || Date.now() }));
        } catch { /* ignore */ }
        setScoreHistory((prev) => {
          const next = [...prev, { at: new Date().toISOString(), mobilePerf: mobile.performance, mobileSeo: mobile.seo, desktopPerf: desktop.performance }].slice(-30);
          try { localStorage.setItem(`sikt_portal_score_history_${user.id}`, JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
        try { localStorage.removeItem(`sikt_first_analysis_raw_${user.id}`); } catch { /* ignore */ }
        try { localStorage.removeItem(`sikt_first_analysis_pending_${user.id}`); } catch { /* ignore */ }
        void logSiktActionsBatch(buildAnalysisLogEntries(mobile, formattedUrl));
        return true;
      } catch { return true; }
    };

    if (tryHydrate()) return;
    const iv = setInterval(() => {
      tries += 1;
      if (tryHydrate() || tries >= 30) clearInterval(iv); // 30 × 3 s ≈ 90 s
    }, 3000);
    return () => clearInterval(iv);
  }, [user?.id, formData.websiteUrl, clientData?.websiteUrl]);

  // VIKTIG: Vi gjør IKKE en early return for loading her. Det vil bryte React
  // Rules of Hooks fordi useMemo (todos) lenger ned ikke ville bli kalt under
  // loading. Vi bruker en flag i stedet og rendrer loading-skjermen helt nederst,
  // etter at alle hooks er deklarert.

  // ===================================================================
  // DESIGN-TOKENS — én konsistent palett for hele portalen.
  // ===================================================================
  const themed: PortalTheme = theme === 'light' ? 'light' : 'dark';
  const isLight = themed === 'light';
  const rootBg = isLight ? 'bg-[color:var(--subtle)] text-[color:var(--ink)]' : 'bg-slate-950 text-slate-100';
  const textMain = portalTextMainClass(themed);
  const textDim = portalTextDimClass(themed);
  const textLabel = portalTextLabelClass(themed);
  const divider = portalDividerClass(themed);
  const subtleBg = portalSubtleBgClass(themed);
  const navBg = isLight ? 'bg-[color:var(--surface)]/90' : 'bg-slate-950/90';
  const navBorder = divider;

  const navBtnClass = (active: boolean) =>
    active
      ? `px-4 py-2 rounded-lg text-sm font-medium ${isLight ? 'bg-slate-900 text-white' : 'bg-[color:var(--surface)] text-slate-900'}`
      : `px-4 py-2 rounded-lg text-sm font-medium ${textDim} hover:${textMain} transition-colors`;

  // ===================================================================
  // AVLEDET DATA — alt vi trenger for å vise et meningsfylt Hjem.
  // ===================================================================
  const firstName = (clientData?.contactPerson || clientData?.companyName || user?.email || '').toString().split(/[\s@]/)[0] || 'der';
  const websiteUrl = (formData.websiteUrl || clientData?.websiteUrl || '').trim();

  // ===================================================================
  // SCORE-MODELL — Sikt-scoren paa Hjem er en kombinasjon av tre faktorer:
  //   1. TEKNISK HELSE   (0-100) — Core Web Vitals, Lighthouse, hastighet, HTTPS, mobil
  //                                 Datakilde: Google PageSpeed API
  //   2. GOOGLE SYNLIGHET(0-100) — rangering paa soekeord, organisk synlighet
  //                                 Datakilde: SERP / Google Search Console
  //   3. GEO SCORE       (0-100) — AI-sitering, llms.txt, schema for LLM (kun Premium)
  //                                 Datakilde: intern GEO-analyse
  //
  // `totalScore` beholdes som "ren teknisk score" og brukes paa PageSpeed-fanen.
  // `combinedScore` er snittet av tilgjengelige komponenter og vises paa Hjem.
  // ===================================================================

  // 1) TEKNISK HELSE — gjennomsnitt av de fire Lighthouse-kategoriene (mobil)
  const perfMobile = analysisResults?.mobile?.performance ?? null;
  const seoMobile = analysisResults?.mobile?.seo ?? null;
  const bpMobile = analysisResults?.mobile?.bestPractices ?? null;
  const a11yMobile = analysisResults?.mobile?.accessibility ?? null;
  const totalScore = analysisResults
    ? Math.round(((perfMobile ?? 0) + (seoMobile ?? 0) + (bpMobile ?? 0) + (a11yMobile ?? 0)) / 4)
    : null;
  const technicalScore = totalScore;

  // 2) GOOGLE SYNLIGHET — bygd fra posisjon paa sporede soekeord.
  // Hvert soekeord faar poeng etter posisjon (1-3=100, 4-10=80, 11-20=50, 21-50=25, ellers 10).
  // Ikke-rangerte soekeord teller med i nevneren slik at de drar scoren ned — det er reelt.
  const visibilityScore: number | null = (() => {
    if (!realRankings || realRankings.length === 0) return null;
    const sum = realRankings.reduce((acc: number, r: any) => {
      const p = typeof r?.position === 'number' ? r.position : null;
      if (p == null) return acc + 10;
      if (p <= 3) return acc + 100;
      if (p <= 10) return acc + 80;
      if (p <= 20) return acc + 50;
      if (p <= 50) return acc + 25;
      return acc + 10;
    }, 0);
    return Math.round(sum / realRankings.length);
  })();

  // 3) GEO SCORE — AI-sitering, llms.txt, schema markup for LLM (kun premium).
  // Datakilde: geo_state.geo_score (nevne-rate 60% + llms.txt 20 + godkjente FAQ 20),
  // skrevet av optimaliserings-motoren. Null for ikke-Premium → utelatt fra snittet.
  const geoScore: number | null =
    hasPremium && geoState?.geo_score != null ? Number(geoState.geo_score) : null;

  // 4) KOMBINERT SIKT-SCORE — snitt av tilgjengelige komponenter.
  // Hvis brukeren ikke har Premium, regnes scoren ut fra to komponenter (teknisk + synlighet).
  const combinedScore: number | null = (() => {
    const parts: number[] = [];
    if (technicalScore != null) parts.push(technicalScore);
    if (visibilityScore != null) parts.push(visibilityScore);
    if (geoScore != null) parts.push(geoScore);
    if (parts.length === 0) return null;
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  })();

  const scoreTone: 'good' | 'warn' | 'bad' | 'neutral' =
    combinedScore == null ? 'neutral' : combinedScore >= 80 ? 'good' : combinedScore >= 60 ? 'warn' : 'bad';

  // Søkeord-grense (brukes i Sokeord- og Innstillinger-fanen)
  const keywordLimit = getKeywordLimit(currentLevel);

  // Pakke-pris-tekst (brukes i settings + teaser)
  const planPrices: Record<string, string> = { BASIC: '790 kr', STANDARD: '1 690 kr', PREMIUM: '4 990 kr' };
  const planNames: Record<string, string> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };
  const activePlanKey: 'BASIC' | 'STANDARD' | 'PREMIUM' =
    /premium/i.test(planBundle) ? 'PREMIUM' : /standard/i.test(planBundle) ? 'STANDARD' : 'BASIC';

  // Webhost-status (for settings-fanen). Kun connection_mode 'full' telles som ekte tilkobling.
  const hostMode: string = hostConnection?.connectionMode || 'none';
  const hostIsFullyConnected = hostMode === 'full';
  const hostWasLightOnly = hostMode === 'light';
  const hostIsAdvisory = hostMode === 'advisory';

  // URL-lås (én endring per uke)
  const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
  const urlLastChangedMs = clientData?.urlLastChangedAt ? new Date(clientData.urlLastChangedAt).getTime() : 0;
  const urlMsUntilUnlock = urlLastChangedMs ? Math.max(0, MS_WEEK - (Date.now() - urlLastChangedMs)) : 0;
  const urlLocked = urlMsUntilUnlock > 0;
  const urlDaysLeft = Math.ceil(urlMsUntilUnlock / (24 * 60 * 60 * 1000));

  // Dev-modus for plan-bytte (kun lokal `vite dev`)
  const isDevMode = import.meta.env.DEV;
  const isMockUser = user?.id === 'dev-mock-user-id' || user?.app_metadata?.provider === 'dev' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id || '');

  // ── Churn-instrumentering: aktivitets-tidsstempel ──────────────────
  // Skriver clients.last_active_at (maks 1×/døgn) og last_login_at (1×/økt)
  // så vi kan se hvem som glir mot churn (client_health-viewet). Bruker samme
  // update-own-RLS som plan-bytte. Stille no-op ved feil — aldri blokkér UI.
  useEffect(() => {
    if (!user?.id || isMockUser) return;
    const iso = new Date().toISOString();
    const day = iso.slice(0, 10);
    const patch: Record<string, string> = {};

    let newSession = true;
    try { newSession = !sessionStorage.getItem('sikt_session_started'); } catch { /* ignore */ }
    if (newSession) patch.last_login_at = iso;

    let lastActiveDay: string | null = null;
    try { lastActiveDay = localStorage.getItem(`sikt_active_day_${user.id}`); } catch { /* ignore */ }
    if (lastActiveDay !== day) patch.last_active_at = iso;

    if (Object.keys(patch).length === 0) return;

    supabaseRest(`clients?user_id=eq.${user.id}`, {
      method: 'PATCH',
      body: patch,
      headers: { Prefer: 'return=minimal' },
    }).catch(() => { /* instrumentering skal aldri kaste mot brukeren */ });

    try { sessionStorage.setItem('sikt_session_started', '1'); } catch { /* ignore */ }
    try { localStorage.setItem(`sikt_active_day_${user.id}`, day); } catch { /* ignore */ }
  }, [user?.id, isMockUser]);

  // ── Plan-grenser: last inn antall analyser brukt denne måneden ─────
  useEffect(() => {
    if (!user?.id || isMockUser) return;
    supabaseRest<{ analyses_month: string | null; analyses_count: number }[]>(
      `clients?user_id=eq.${user.id}&select=analyses_month,analyses_count&limit=1`,
    ).then((rows) => {
      const r = Array.isArray(rows) ? rows[0] : null;
      if (r) { setAnalysesMonth(r.analyses_month ?? null); setAnalysesUsed(r.analyses_count ?? 0); }
    }).catch(() => { /* ignore */ });
  }, [user?.id, isMockUser]);

  // ── Varsel-preferanser: hydrer fra DB så bryterne overlever reload ──
  useEffect(() => {
    if (!user?.id || isMockUser) {
      try {
        const raw = localStorage.getItem('sikt_notif_prefs');
        if (raw) {
          const parsed = JSON.parse(raw);
          // Dyp-merge reportSections så et delsett ikke nuller ut resten.
          setNotifPrefs((p) => ({ ...p, ...parsed, reportSections: { ...p.reportSections, ...(parsed?.reportSections ?? {}) } }));
        }
      } catch { /* ignore */ }
      return;
    }
    supabaseRest<{ notification_preferences: Record<string, any> | null }[]>(
      `clients?user_id=eq.${user.id}&select=notification_preferences&limit=1`,
    ).then((rows) => {
      const prefs = Array.isArray(rows) ? rows[0]?.notification_preferences : null;
      if (prefs && typeof prefs === 'object') {
        setNotifPrefs((p) => ({ ...p, ...prefs, reportSections: { ...p.reportSections, ...((prefs as any).reportSections ?? {}) } }));
      }
    }).catch(() => { /* behold defaults ved feil */ });
  }, [user?.id, isMockUser]);

  // Merk: opptelling av analyse-kvoten skjer nå server-side i scan-pagespeed
  // (kan ikke omgås). Frontend leser status fra svaret (usage) + ved innlasting.

  // Lokal handler for plan-bytte (dev) — speiler den gamle logikken fra PortalSettings
  const performPlanChange = async () => {
    if (!planChangeTarget || !user?.id) return;
    setSwitchingPlan(true);
    try {
      if (isMockUser) {
        setClientData((prev: any) => ({ ...(prev || {}), package_name: planChangeTarget.name }));
        try { localStorage.setItem('sikt_dev_plan', planChangeTarget.name); } catch { /* ignore */ }
        toastSuccess(`Byttet til ${planChangeTarget.name} (dev-modus, kun lokalt).`);
      } else {
        await supabaseRest(`clients?user_id=eq.${user.id}`, {
          method: 'PATCH',
          body: { package_name: planChangeTarget.name },
          headers: { Prefer: 'return=representation' },
        });
        toastSuccess(`Byttet til ${planChangeTarget.name}.`);
        setTimeout(() => window.location.reload(), 800);
      }
      setPlanChangeTarget(null);
    } catch (err: any) {
      toastError('Kunne ikke bytte plan: ' + (err?.message || 'ukjent feil'));
    } finally {
      setSwitchingPlan(false);
    }
  };

  const resetWpWizardForm = () => {
    setConnectWizardPlatform(null);
    setWpWizardStep(1);
    setWpSiteUrl('');
    setWpUsername('');
    setWpAppPassword('');
    setWpSiteUrlError(null);
    setWpConnecting(false);
    setWpConnectError(null);
    setWpConnectResult(null);
    setWixSiteUrl('');
    setWixSiteUrlError(null);
    setWixConnecting(false);
    setWixConnectError(null);
    setShopDomain('');
    setShopToken('');
    setShopConnecting(false);
    setShopConnectError(null);
    setShopConnectResult(null);
  };

  const openHostConnectWizard = (platform?: string) => {
    resetWpWizardForm();
    setConnectWizardPlatform(platform ?? null);
    setShowWpWizard(true);
  };

  // Rådgiver-plattformer (ingen åpen skrive-API → forslag kunden limer inn selv).
  // WordPress (og senere Shopify) er «full» auto-fiks og håndteres separat.
  const ADVISORY_PLATFORMS: { id: string; label: string; hint: string }[] = [
    { id: 'ai_built', label: 'AI-bygd side (Claude, v0, Cursor …)', hint: 'Forslag du limer inn i AI-verktøyet' },
    { id: 'webflow', label: 'Webflow', hint: 'Forslag du limer inn' },
    { id: 'wix', label: 'Wix', hint: 'Forslag du limer inn' },
    { id: 'squarespace', label: 'Squarespace', hint: 'Forslag du limer inn' },
    { id: 'ghost', label: 'Ghost', hint: 'Forslag du limer inn' },
    { id: 'other', label: 'Annet / egen side', hint: 'Forslag du limer inn' },
  ];
  const platformLabelMap: Record<string, string> = {
    ai_built: 'AI-bygd side', webflow: 'Webflow', wix: 'Wix',
    squarespace: 'Squarespace', ghost: 'Ghost', other: 'egen side',
  };
  const FULL_PLATFORMS: Record<string, string> = { wordpress: 'WordPress', shopify: 'Shopify' };
  const platformLabel = (p?: string | null) =>
    FULL_PLATFORMS[p || ''] || platformLabelMap[p || ''] || p || 'Plattform';
  // Rådgiver = alt som ikke er en full auto-fiks-plattform (WordPress/Shopify).
  const advisoryPlatform = connectWizardPlatform && !FULL_PLATFORMS[connectWizardPlatform] ? connectWizardPlatform : null;

  const openWpWizard = () => {
    openHostConnectWizard();
  };

  const closeWpWizard = () => {
    if (wpConnecting || wixConnecting || shopConnecting) return;
    setShowWpWizard(false);
    resetWpWizardForm();
  };

  const wpStep2Valid =
    wpSiteUrl.trim().startsWith('https://') &&
    !!wpUsername.trim() &&
    !!wpAppPassword.trim();

  const wixStepValid = wixSiteUrl.trim().startsWith('https://');

  const connectAdvisory = async () => {
    const platform = advisoryPlatform;
    if (!platform || !wixStepValid) return;
    if (!user?.id || !supabase) {
      setWixConnectError('Du må være innlogget for å koble til.');
      return;
    }
    setWixConnecting(true);
    setWixConnectError(null);
    try {
      const { error } = await supabase.from('client_hosts').upsert(
        {
          user_id: user.id,
          platform,
          connection_mode: 'advisory',
          admin_url: wixSiteUrl.trim(),
          access_token_encrypted: null,
          repo_url: null,
          notes: null,
          last_changed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        setWixConnectError(error.message || 'Kunne ikke lagre tilkoblingen.');
        return;
      }
      setHostConnection({
        platform,
        connectionMode: 'advisory',
        repoUrl: '',
        adminUrl: wixSiteUrl.trim(),
        notes: '',
        lastChangedAt: new Date().toISOString(),
      });
      toastSuccess(`${platformLabel(platform)} er koblet til. Sikt lager forslag du limer inn selv.`);
      setShowWpWizard(false);
      resetWpWizardForm();
    } catch {
      setWixConnectError('Kunne ikke lagre tilkoblingen. Prøv igjen.');
    } finally {
      setWixConnecting(false);
    }
  };

  const resetDeleteAccountModal = () => {
    setDeleteAccountConfirmText('');
    setDeleteAccountError(null);
    setDeletingAccount(false);
  };

  const closeDeleteAccountModal = () => {
    if (deletingAccount) return;
    setShowDeleteAccountModal(false);
    resetDeleteAccountModal();
  };

  // ── Oppsigelse ────────────────────────────────────────────────────
  // Stripe «no-code» customer-portal login-lenke. Konfigureres i Stripe
  // Dashboard → Settings → Billing → Customer portal → «login page».
  // Tom streng = ikke satt opp ennå → vi viser bekreftelse + e-post-fallback
  // i stedet for å sende kunden til en død lenke.
  const STRIPE_BILLING_PORTAL_URL = '';
  const CANCEL_REASONS: { id: string; label: string }[] = [
    { id: 'too_expensive', label: 'For dyrt' },
    { id: 'no_value', label: 'Fikk ikke nok verdi' },
    { id: 'too_hard', label: 'For vanskelig å bruke' },
    { id: 'hired_someone', label: 'Ansatte noen / byrå i stedet' },
    { id: 'switching', label: 'Bytter til et annet verktøy' },
    { id: 'other', label: 'Annet' },
  ];

  const openCancelModal = () => {
    setCancelReason('');
    setCancelComment('');
    setCancelError(null);
    setCancelDone(false);
    setCancelSubmitting(false);
    setShowCancelModal(true);
  };
  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setShowCancelModal(false);
  };

  const submitCancellation = async () => {
    if (!cancelReason) { setCancelError('Velg en grunn først.'); return; }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      // Dev-modus: ikke skriv mot prod-tabellen.
      if (!isMockUser && user?.id) {
        await supabaseRest('cancellation_feedback', {
          method: 'POST',
          body: {
            user_id: user.id,
            package_name: clientData?.package_name || null,
            reason: cancelReason,
            comment: cancelComment.trim() || null,
          },
          headers: { Prefer: 'return=minimal' },
        });
      }
      // Selve oppsigelsen skjer i Stripe (webhooken fanger subscription.deleted).
      if (STRIPE_BILLING_PORTAL_URL) {
        window.location.href =
          `${STRIPE_BILLING_PORTAL_URL}?prefilled_email=${encodeURIComponent(user?.email || '')}`;
        return;
      }
      // Portal ikke konfigurert ennå → bekreft at vi har registrert det.
      setCancelDone(true);
    } catch {
      setCancelError('Kunne ikke registrere oppsigelsen. Prøv igjen, eller skriv til support@siktseo.com.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (deleteAccountConfirmText !== 'SLETT') return;
    setDeletingAccount(true);
    setDeleteAccountError(null);
    const { error } = await supabase.rpc('delete_current_user');
    if (error) {
      setDeleteAccountError(error.message || 'Kunne ikke slette kontoen.');
      setDeletingAccount(false);
      return;
    }
    try {
      await supabase.auth.signOut();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key === 'sikt_pending_plan') {
          localStorage.removeItem(key);
        }
      });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('sikt_current_view');
      }
      setShowDeleteAccountModal(false);
      resetDeleteAccountModal();
      onLogout();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Kunne ikke logge ut etter sletting.';
      setDeleteAccountError(msg);
      setDeletingAccount(false);
    }
  };

  const disconnectAdvisory = async () => {
    if (!user?.id || !supabase) {
      setDisconnectError('Du må være innlogget for å koble fra.');
      return;
    }
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      const { error } = await supabase.from('client_hosts').upsert(
        {
          user_id: user.id,
          connection_mode: 'skipped',
          platform: null,
          admin_url: null,
          access_token_encrypted: null,
          last_changed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        setDisconnectError(error.message || 'Kunne ikke frakoble.');
        return;
      }
      setHostConnection(null);
      setShowDisconnectConfirm(false);
      toastSuccess('Tilkoblingen er fjernet.');
    } catch {
      setDisconnectError('Kunne ikke frakoble. Prøv igjen.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const connectWordPress = async () => {
    if (!wpStep2Valid) return;
    const accessToken = getStoredAccessToken();
    setWpWizardStep(3);
    setWpConnectError(null);
    setWpConnectResult(null);
    if (!accessToken) {
      setWpConnectError('Du må være innlogget for å koble til.');
      return;
    }
    setWpConnecting(true);
    try {
      const res = await fetch('/api/wordpress-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          siteUrl: wpSiteUrl.trim(),
          wpUsername: wpUsername.trim(),
          appPassword: wpAppPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWpConnectError(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
        return;
      }
      setWpConnectResult({
        site: data.site || wpSiteUrl.trim(),
        wpUser: data.wpUser || wpUsername.trim(),
      });
      setHostConnection({
        platform: 'wordpress',
        connectionMode: 'full',
        repoUrl: '',
        adminUrl: data.site || wpSiteUrl.trim(),
        notes: wpUsername.trim(),
        lastChangedAt: new Date().toISOString(),
      });
    } catch {
      setWpConnectError('Kunne ikke nå Sikt-serveren. Sjekk internett og prøv igjen.');
    } finally {
      setWpConnecting(false);
    }
  };

  const shopStepValid = !!shopDomain.trim() && !!shopToken.trim();

  const connectShopify = async () => {
    if (!shopStepValid) return;
    const accessToken = getStoredAccessToken();
    setShopConnectError(null);
    setShopConnectResult(null);
    if (!accessToken) {
      setShopConnectError('Du må være innlogget for å koble til.');
      return;
    }
    setShopConnecting(true);
    try {
      const res = await fetch('/api/wordpress-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ platform: 'shopify', shopDomain: shopDomain.trim(), accessToken: shopToken.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShopConnectError(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
        return;
      }
      setShopConnectResult({ site: data.site || shopDomain.trim(), name: data.wpUser || shopDomain.trim() });
      setHostConnection({
        platform: 'shopify',
        connectionMode: 'full',
        repoUrl: '',
        adminUrl: data.site || shopDomain.trim(),
        notes: data.wpUser || '',
        lastChangedAt: new Date().toISOString(),
      });
      toastSuccess('Shopify er koblet til. Sikt fikser SEO automatisk.');
      setShowWpWizard(false);
      resetWpWizardForm();
    } catch {
      setShopConnectError('Kunne ikke nå Sikt-serveren. Sjekk internett og prøv igjen.');
    } finally {
      setShopConnecting(false);
    }
  };

  const disconnectWordPress = async () => {
    const accessToken = getStoredAccessToken();
    setDisconnectError(null);
    if (!accessToken) {
      setDisconnectError('Du må være innlogget for å koble fra.');
      return;
    }
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/wordpress-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDisconnectError(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
        return;
      }
      setHostConnection((prev: any) => (prev ? { ...prev, connectionMode: 'skipped' } : null));
      setShowDisconnectConfirm(false);
      setDisconnectError(null);
      toastInfo('Frakoblet fra WordPress.');
    } catch {
      setDisconnectError('Kunne ikke nå Sikt-serveren. Sjekk internett og prøv igjen.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  useEffect(() => {
    if (!showWpWizard && !showDisconnectConfirm) return;
    const wizardBusy = wpConnecting || wixConnecting;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDisconnectConfirm) {
        if (!isDisconnecting) {
          setShowDisconnectConfirm(false);
          setDisconnectError(null);
        }
        return;
      }
      if (showWpWizard && !wpConnecting && !wixConnecting) closeWpWizard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showWpWizard, showDisconnectConfirm, wpConnecting, wixConnecting, isDisconnecting]);

  // Generell lagrer for varsel-preferanser: optimistisk, PATCH, revert ved feil.
  const patchNotifPrefs = (partial: Partial<typeof notifPrefs>) => {
    const prev = notifPrefs;
    const next = { ...prev, ...partial };
    setNotifPrefs(next); // optimistisk — UI svarer umiddelbart
    if (isMockUser) {
      try { localStorage.setItem('sikt_notif_prefs', JSON.stringify(next)); } catch { /* ignore */ }
      return;
    }
    if (!user?.id) return;
    // Lagre i clients.notification_preferences (samme update-own-RLS som plan-bytte).
    supabaseRest(`clients?user_id=eq.${user.id}`, {
      method: 'PATCH',
      body: { notification_preferences: next },
      headers: { Prefer: 'return=minimal' },
    }).catch((err: any) => {
      setNotifPrefs(prev); // revert ved feil
      toastError('Kunne ikke lagre varselvalget: ' + (err?.message || 'ukjent feil'));
    });
  };

  const toggleNotif = (key: 'weeklyReport' | 'criticalAlerts' | 'rankChanges') => {
    patchNotifPrefs({ [key]: !notifPrefs[key] });
  };

  const toggleSection = (key: keyof typeof notifPrefs.reportSections) => {
    patchNotifPrefs({ reportSections: { ...notifPrefs.reportSections, [key]: !notifPrefs.reportSections[key] } });
  };

  // ===================================================================
  // TODOS — aggregert "i dag"-liste fra alle kilder, sortert etter impact.
  // Brukes paa Hjem (3 oeverst + "mer") og er kilden til Verksted-fanen.
  // ===================================================================
  type TodoKind = 'pagespeed' | 'keyword' | 'content' | 'content-page' | 'onboarding' | 'competitor' | 'geo';
  type Todo = {
    id: string;
    kind: TodoKind;
    title: string;
    desc: string;
    impact: number; // 0-100, hoyere = viktigere
    action: { label: string; onClick: () => void };
    raw?: any; // for verksted-drawer (PageSpeed-opportunity)
    pageUrl?: string;
    pageTitle?: string;
    status?: 'open' | 'solved';
    changeId?: string;
    changeData?: TodoChangeData;
  };

  const todos = useMemo<Todo[]>(() => {
    const items: Todo[] = [];

    // 1. Onboarding-rest - hoyest prioritet hvis ufullstendig
    if (!websiteUrl) {
      items.push({
        id: 'onboarding-url',
        kind: 'onboarding',
        title: 'Legg inn nettsiden din',
        desc: 'Sikt trenger nettadressen for å sjekke synlighet og rangering.',
        impact: 100,
        action: { label: 'Legg til', onClick: () => { setActiveTab('settings'); setEditingSection('profile'); } },
      });
    } else if (!analysisResults) {
      items.push({
        id: 'onboarding-analysis',
        kind: 'onboarding',
        title: 'Kjør første tekniske sjekk',
        desc: 'Test mot Google og få Lighthouse-resultatet på 30 sekunder.',
        impact: 95,
        action: { label: isAnalyzing ? 'Kjører…' : 'Kjør analyse', onClick: () => runRealAnalysis() },
      });
    }
    if (websiteUrl && keywordsToTrack.length === 0) {
      items.push({
        id: 'onboarding-keywords',
        kind: 'onboarding',
        title: 'Legg til søkeord du vil rangere på',
        desc: 'Sikt sjekker plasseringen din på Google for hvert ord du sporer.',
        impact: 88,
        action: { label: 'Legg til', onClick: () => setActiveTab('keywords') },
      });
    }
    if (hasStandardOrHigher && !hostIsFullyConnected) {
      items.push({
        id: 'onboarding-cms',
        kind: 'onboarding',
        title: hostWasLightOnly ? 'Koble til WordPress (på nytt)' : 'Koble til WordPress',
        desc: 'Lar Sikt pushe fikser direkte til siden din med et trygt Application Password.',
        impact: 80,
        action: { label: 'Koble til', onClick: () => { setActiveTab('settings'); openWpWizard(); } },
      });
    }

    // 2. PageSpeed-opportunities (mobile, hoy impact = stor savings)
    if (analysisResults?.mobile?.opportunities) {
      for (const o of analysisResults.mobile.opportunities) {
        const savingsMs = (o as any).numericValue ?? 0;
        const savingsLabel = o.savings || (savingsMs > 0 ? `Sparer ${(savingsMs/1000).toFixed(1)}s` : '');
        items.push({
          id: `ps-${o.title}`,
          kind: 'pagespeed',
          title: o.title,
          desc: savingsLabel || 'Forbedring foreslått av Lighthouse',
          impact: Math.min(85, 40 + Math.round(savingsMs / 100)),
          action: {
            label: 'Åpne',
            onClick: () => {
              setActiveSolveProblem({ raw: o, title: o.title });
              setActiveTab('workshop');
              setExpandedWorkshopProblem(`ps-${o.title}`);
            },
          },
          raw: o,
        });
      }
    }

    // 2b. Innhold — én todo per issue per side (maks 20 viktigste etter impact)
    const contentPageTodos: Todo[] = [];
    for (const p of contentPages) {
      if (!p.fullUrl || typeof p.fullUrl !== 'string' || !p.fullUrl.trim()) continue;
      let resolvedPageUrl: string;
      try {
        resolvedPageUrl = new URL(p.url, p.fullUrl).toString();
      } catch {
        continue;
      }
      const issueList = Array.isArray(p.issues) ? p.issues : [];
      const impactByStatus =
        p.status === 'Kritisk' ? 75 : p.status === 'Advarsel' ? 60 : 40;
      for (const issue of issueList) {
        if (!issue || typeof issue !== 'string') continue;
        contentPageTodos.push({
          id: `content-${p.url}-${issue}`,
          kind: 'content-page',
          title: issue,
          desc: `Side: ${p.url}`,
          impact: impactByStatus,
          pageUrl: resolvedPageUrl,
          pageTitle: p.title,
          action: {
            label: 'Åpne i Verksted',
            onClick: () => {
              setActiveTab('workshop');
              setExpandedWorkshopProblem(`content-${p.url}-${issue}`);
            },
          },
        });
      }
    }
    contentPageTodos.sort((a, b) => b.impact - a.impact);

    const uniqueChanges = Array.from(
      new Map(contentChanges.map((change) => [change.id, change])).values(),
    ) as ContentChangeRow[];
    const handledChangeIds = new Set<string>();
    const openContentTodos: Todo[] = [];
    const solvedContentTodos: Todo[] = [];

    for (const todo of contentPageTodos) {
      if (todo.status === 'solved') {
        if (todo.changeId) handledChangeIds.add(todo.changeId);
        solvedContentTodos.push(todo);
        continue;
      }

      const issue = todo.title.includes(' — ')
        ? todo.title.split(' — ')[0]
        : todo.title;
      const field = detectFieldType(issue);
      const match = uniqueChanges.find(
        (change) =>
          !handledChangeIds.has(change.id) &&
          change.page_url === todo.pageUrl &&
          change.field === field,
      );

      if (match) {
        handledChangeIds.add(match.id);
        solvedContentTodos.push({
          ...todo,
          status: 'solved',
          changeId: match.id,
          changeData: {
            field: match.field,
            old_value: match.old_value,
            new_value: match.new_value,
            pushed_at: match.pushed_at,
          },
        });
      } else {
        openContentTodos.push({ ...todo, status: 'open' });
      }
    }

    items.push(...openContentTodos.slice(0, 20));
    items.push(...solvedContentTodos);

    for (const change of uniqueChanges) {
      if (handledChangeIds.has(change.id)) continue;
      if (change.field !== 'meta-description' && change.field !== 'seo-title' && change.field !== 'h1' && change.field !== 'content') continue;

      handledChangeIds.add(change.id);
      const pathLabel = pathLabelFromPageUrl(change.page_url);
      items.push({
        id: `solved-${change.id}`,
        kind: 'content-page',
        status: 'solved',
        changeId: change.id,
        changeData: {
          field: change.field,
          old_value: change.old_value,
          new_value: change.new_value,
          pushed_at: change.pushed_at,
        },
        pageUrl: change.page_url,
        pageTitle: pageTitleFromPageUrl(change.page_url),
        title: solvedTitleForField(change.field),
        desc: `Side: ${pathLabel}`,
        impact: 35,
        action: {
          label: 'Åpne i Verksted',
          onClick: () => {
            setActiveTab('workshop');
            setExpandedWorkshopProblem(`solved-${change.id}`);
          },
        },
      });
    }

    // 3. Sokeord pa pos 4-20 (lavt-hengende frukt)
    for (const r of realRankings) {
      const pos = (r as any).position;
      if (pos > 3 && pos < 20) {
        items.push({
          id: `kw-${r.keyword}-${r.location}`,
          kind: 'keyword',
          title: `«${r.keyword}» — plass ${pos}`,
          desc: pos <= 10 ? `${pos - 3} plasser unna topp 3` : `${pos - 10} plasser unna side 1`,
          impact: 70 - (pos - 4) * 2,
          action: { label: 'Se søkeord', onClick: () => setActiveTab('keywords') },
        });
      }
    }

    return Array.from(new Map(items.map((todo) => [todo.id, todo])).values())
      .sort((a, b) => b.impact - a.impact);
  }, [analysisResults, realRankings, websiteUrl, hostIsFullyConnected, hostWasLightOnly, keywordsToTrack.length, hasStandardOrHigher, isAnalyzing, contentPages, contentChanges]);

  const todayTodos = todos.slice(0, 3);
  const moreTodos = todos.slice(3);
  const todosRef = useRef(todos);
  todosRef.current = todos;
  const contentPagesRef = useRef(contentPages);
  contentPagesRef.current = contentPages;
  const hostConnectionRef = useRef(hostConnection);
  hostConnectionRef.current = hostConnection;

  const workshopContentFixFieldType = useMemo((): ContentFixFieldType | null => {
    const todoId = expandedWorkshopProblem;
    if (!todoId?.startsWith('content-')) return null;
    const todo = todosRef.current.find(
      (t) => t.id === todoId && t.kind === 'content-page',
    );
    if (!todo) return null;
    const issue = todo.title.includes(' — ')
      ? todo.title.split(' — ')[0]
      : todo.title;
    return detectFieldType(issue);
  }, [expandedWorkshopProblem]);

  useEffect(() => {
    if (rollbackState !== 'success') return;
    const todo = todosRef.current.find((t) => t.id === expandedWorkshopProblem);
    if (todo?.status !== 'solved') return;
    const timer = setTimeout(() => {
      fetchContentChanges();
      setExpandedWorkshopProblem(null);
      resetContentFixPushUi();
    }, 2000);
    return () => clearTimeout(timer);
  }, [rollbackState, expandedWorkshopProblem, resetContentFixPushUi, fetchContentChanges]);

  useEffect(() => {
    const abortInFlight = () => {
      contentFixAbortRef.current?.abort();
      contentFixAbortRef.current = null;
    };

    if (!expandedWorkshopProblem?.startsWith('content-')) {
      abortInFlight();
      return;
    }

    const todo = todosRef.current.find(
      (t) => t.id === expandedWorkshopProblem && t.kind === 'content-page',
    );
    const todoId = expandedWorkshopProblem;

    if (todo?.status === 'solved') {
      abortInFlight();
      return;
    }

    if (!todo?.pageUrl) {
      abortInFlight();
      setContentFixActive({
        todoId,
        loading: 'error',
        error: 'Mangler side-URL for dette funnet.',
      });
      return;
    }

    const cached = contentFixCacheRef.current[todoId];
    if (cached?.pageData && cached?.aiSuggestion) {
      setContentFixActive({ todoId, loading: 'idle', error: null });
      return () => abortInFlight();
    }
    if (cached?.pageData && cached?.contextQuestions && cached.contextQuestions.length > 0) {
      setContentFixActive({ todoId, loading: 'questionnaire', error: null });
      return () => abortInFlight();
    }
    if (cached?.pageData && cached?.pageContextAnswers != null) {
      return () => abortInFlight();
    }
    if (questionsGeneratedRef.current[todoId] && cached?.pageData) {
      if (cached.contextQuestions && cached.contextQuestions.length > 0) {
        setContentFixActive({ todoId, loading: 'questionnaire', error: null });
      }
      return;
    }

    const fieldType = workshopContentFixFieldType ?? detectFieldType(
      todo.title.includes(' — ') ? todo.title.split(' — ')[0] : todo.title,
    );

    abortInFlight();
    const ac = new AbortController();
    contentFixAbortRef.current = ac;

    setContentFixActive({
      todoId,
      loading: 'fetching',
      error: null,
    });

    const run = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        if (ac.signal.aborted) return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: 'Du må være logget inn.' }
            : prev,
        );
        return;
      }

      try {
        let pageData: WordPressFetchResponse;
        // Rådgiver-plattformer (AI-bygd, Webflow, Wix, Squarespace, Ghost, annet) har ingen
        // skrive-API → bruk innholdsskann-data, ikke WordPress-fetch (som ville feilet med
        // «WordPress er ikke tilkoblet»). Kun WordPress/Shopify-full går mot wordpress-fetch.
        const hostPlatform = hostConnectionRef.current?.platform;
        const hostIsAdvisoryConn =
          hostConnectionRef.current?.connectionMode === 'advisory' ||
          (!!hostPlatform && !FULL_PLATFORMS[hostPlatform]);
        if (hostIsAdvisoryConn) {
          const advisoryPageData = buildAdvisoryPageDataFromContentScan(
            todo.pageUrl,
            contentPagesRef.current,
          );
          if (ac.signal.aborted) return;
          if (!advisoryPageData) {
            setContentFixActive((prev) =>
              prev.todoId === todoId
                ? {
                    ...prev,
                    loading: 'error',
                    error:
                      'Kjør innholdsskanning under Synlighet først, så Sikt vet hvilken side dette gjelder.',
                  }
                : prev,
            );
            return;
          }
          pageData = advisoryPageData;
        } else {
          const fetchRes = await fetch('/api/wordpress-fetch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ pageUrl: todo.pageUrl }),
            signal: ac.signal,
          });
          const fetchData = await fetchRes.json().catch(() => ({}));
          if (ac.signal.aborted) return;
          if (!fetchRes.ok) {
            setContentFixActive((prev) =>
              prev.todoId === todoId
                ? {
                    ...prev,
                    loading: 'error',
                    error:
                      typeof fetchData?.error === 'string'
                        ? fetchData.error
                        : `Feil ${fetchRes.status}`,
                  }
                : prev,
            );
            return;
          }

          pageData = fetchData as WordPressFetchResponse;
        }
        setContentFixCache((prev) => ({
          ...prev,
          [todoId]: { pageData, fieldType, aiSuggestion: null },
        }));

        if (fieldType === 'content') {
          let savedAnswers: PageContextAnswers | null = null;
          if (supabase) {
            try {
              const { data: ctxRow, error: ctxErr } = await supabase
                .from('sikt_page_context')
                .select('answers')
                .eq('page_url', todo.pageUrl)
                .maybeSingle();
              if (ctxErr) {
                console.warn('[Verksted] Kunne ikke hente page context:', ctxErr.message);
              } else {
                savedAnswers = normalizePageContextAnswers(ctxRow?.answers);
              }
            } catch (ctxCatch: unknown) {
              console.warn('[Verksted] Kunne ikke hente page context:', ctxCatch);
            }
          }
          if (ac.signal.aborted) return;

          if (savedAnswers) {
            questionsGeneratedRef.current[todoId] = true;
            setContentFixCache((prev) => ({
              ...prev,
              [todoId]: {
                pageData,
                fieldType,
                aiSuggestion: null,
                pageContextAnswers: savedAnswers,
              },
            }));
            setContentFixActive((prev) =>
              prev.todoId === todoId ? { ...prev, loading: 'generating' } : prev,
            );
            await runContentFixAi(todoId, pageData, fieldType, ac.signal, savedAnswers);
            return;
          }

          if (questionsGeneratedRef.current[todoId]) {
            const lockedEntry = contentFixCacheRef.current[todoId];
            if (lockedEntry?.contextQuestions && lockedEntry.contextQuestions.length > 0) {
              setContentFixActive((prev) =>
                prev.todoId === todoId ? { ...prev, loading: 'questionnaire', error: null } : prev,
              );
              return;
            }
            return;
          }

          questionsGeneratedRef.current[todoId] = true;

          setContentFixActive((prev) =>
            prev.todoId === todoId ? { ...prev, loading: 'generating-questions', error: null } : prev,
          );

          let contextQuestions: ContextQuestion[];
          try {
            contextQuestions = await generateContextQuestions(pageData, ac.signal, token);
          } catch (err: unknown) {
            if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
              return;
            }
            contextQuestions = FALLBACK_QUESTIONS;
          }
          if (ac.signal.aborted) return;

          if (contextQuestions.length === 0) {
            setContentFixActive((prev) =>
              prev.todoId === todoId ? { ...prev, loading: 'generating' } : prev,
            );
            await runContentFixAi(todoId, pageData, fieldType, ac.signal, null);
            return;
          }

          setContentFixCache((prev) => ({
            ...prev,
            [todoId]: {
              pageData,
              fieldType,
              aiSuggestion: null,
              contextQuestions,
            },
          }));
          setContentFixActive((prev) =>
            prev.todoId === todoId ? { ...prev, loading: 'questionnaire', error: null } : prev,
          );
          return;
        }

        setContentFixActive((prev) =>
          prev.todoId === todoId ? { ...prev, loading: 'generating' } : prev,
        );
        await runContentFixAi(todoId, pageData, fieldType, ac.signal);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: err?.message || 'Kunne ikke hente fra WordPress.' }
            : prev,
        );
      }
    };

    run();
    return () => abortInFlight();
  }, [expandedWorkshopProblem, workshopContentFixFieldType, contentFixRetry]);

  // Aktivitetsfeed paa Hjem - siste 8 sikt_actions
  const homeFeedActions = dedupeSiktActions(siktActions || []).slice(0, 8);

  // KPI-data for Hjem-tilene
  const top10Count = realRankings.filter((r: any) => r.position && r.position <= 10).length;
  const top3Count = realRankings.filter((r: any) => r.position && r.position <= 3).length;
  const actionsLast7d = (siktActions || []).filter((a: any) => {
    const ts = new Date(a.created_at).getTime();
    return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const fixesLast7d = (siktActions || []).filter((a: any) => {
    const ts = new Date(a.created_at).getTime();
    return a.category === 'fix' && Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const scoreSpark = scoreHistory.slice(-12).map((h) =>
    Math.round(((h.mobilePerf ?? 0) + (h.mobileSeo ?? 0)) / 2),
  );
  const scoreDelta = scoreHistory.length >= 2
    ? Math.round(((scoreHistory[scoreHistory.length - 1].mobilePerf + scoreHistory[scoreHistory.length - 1].mobileSeo) / 2)
        - ((scoreHistory[scoreHistory.length - 2].mobilePerf + scoreHistory[scoreHistory.length - 2].mobileSeo) / 2))
    : 0;

  // Posisjon-fordeling for Sokeord-fanen (Topp 3 / 4-10 / 11-20 / 21+)
  const positionBuckets = [
    { name: 'Topp 3', value: realRankings.filter((r: any) => r.position && r.position <= 3).length, fill: '#15795A' },
    { name: '4–10', value: realRankings.filter((r: any) => r.position && r.position > 3 && r.position <= 10).length, fill: '#52A447' },
    { name: '11–20', value: realRankings.filter((r: any) => r.position && r.position > 10 && r.position <= 20).length, fill: '#9A6700' },
    { name: '21+', value: realRankings.filter((r: any) => !r.position || r.position > 20).length, fill: '#B3AD9F' },
  ];

  // Aktivitets-mini-graf for KPI-tilene (siste 7 dager, telle pr dag)
  const activityByDay = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (6 - i));
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return (siktActions || []).filter((a: any) => {
      const ts = new Date(a.created_at).getTime();
      return ts >= dayStart.getTime() && ts < dayEnd.getTime();
    }).length;
  });

  // Loading-skjerm: vises etter at ALLE hooks er deklarert, slik at vi ikke
  // bryter React Rules of Hooks naar `loading` flipper fra true -> false.
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-[color:var(--subtle)]' : 'bg-slate-950'} font-['Geist','DM_Sans',sans-serif]`}>
        <div className={`rounded-[16px] border ${isLight ? 'border-[color:var(--hair)] bg-[color:var(--surface)]' : `${divider} bg-slate-900/60`} px-6 py-5 flex items-center gap-3`}>
          <Loader2 size={18} className={`${isLight ? 'text-[color:var(--ink)]' : 'text-violet-600'} animate-spin`} />
          <div>
            <p className={`text-sm font-medium ${isLight ? 'text-[color:var(--ink)]' : textMain}`}>Laster portalen</p>
            <p className={`text-xs ${isLight ? 'text-[color:var(--muted)]' : textDim}`}>Henter profil, score og siste aktivitet.</p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = (clientData?.contactPerson || clientData?.companyName || user?.email || 'Bruker').toString();
  const footerInitials = (() => {
    const n = displayName.trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return n.slice(0, 2).toUpperCase() || '?';
  })();
  const footerPlanLabel = `${planNames[activePlanKey]} plan`;
  const domainLabel = websiteUrl
    .replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  const tabFadeInClass = 'animate-in fade-in slide-in-from-bottom-2 duration-150 ease-out motion-reduce:slide-in-from-bottom-0';

  return (
    <div className={`sikt-portal min-h-screen ${rootBg} antialiased`} data-theme={themed}>
      {/* Tema-tokens: lys = dagens eksakte verdier (uendret), mørk = override.
          Hardkodede farger peker på var(--token) → hele portalen flipper med data-theme. */}
      <style>{`
.sikt-portal{--ink:#1A1A1A;--sub:#5C574C;--muted:#8A8578;--faint:#B3AD9F;--hair:#E9E4DA;--surface:#FFFFFF;--subtle:#FAF8F3;--green:#15795A;--navbg:#F5F5F0;--inset:#E8F1EB;--insetbd:#D6EEDF;--inset-ink:#2F5C45;--danger:#B4231F;--dangerbg:#FBECEB;--btn-bg:#1A1A1A;}
.sikt-portal[data-theme="dark"]{--ink:#E8E6E1;--sub:#B8B3A8;--muted:#9A958B;--faint:#6F6A60;--hair:rgba(255,255,255,0.10);--surface:#16181D;--subtle:#1E2127;--green:#3DA77B;--navbg:#121317;--inset:rgba(61,167,123,0.12);--insetbd:rgba(61,167,123,0.28);--inset-ink:#8FD3B0;--danger:#E0796B;--dangerbg:rgba(224,121,107,0.14);--btn-bg:#33373F;}
.sikt-portal[data-theme="dark"] input::placeholder,.sikt-portal[data-theme="dark"] textarea::placeholder{color:var(--faint);opacity:1;}
`}</style>

      {/* ===== NY: STICKY HORISONTAL TOPP-NAV ===== */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--navbg)', borderBottom: '1px solid var(--hair)' }}>
        {/* Desktop nav */}
        {/* display styres KUN av klassene (hidden / sm:flex). En inline display:flex
            her ville overstyrt `hidden` → desktop-navet vises da også på mobil og
            stikker utenfor skjermen i bredden (knekker hele mobil-layouten). */}
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '14px 32px', alignItems: 'center', gap: 24 }}
             className="hidden sm:flex">

          {/* VENSTRE: logo + nettside-velger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <button
              onClick={() => setActiveTab('home')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--btn-bg)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>S</span>
            </button>
          </div>

          {/* MIDT: sentrert pill-meny */}
          <nav style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: 999, padding: 5 }}>
              {navItems.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                let badge: number | null = null;
                if (item.id === 'workshop' || item.id === 'home') {
                  const c = todos.length;
                  if (c > 0) badge = c;
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 16px', borderRadius: 999, fontSize: 14,
                      fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                      border: 'none',
                      background: active ? '#1A1A1A' : 'transparent',
                      color: active ? '#FFFFFF' : '#808080',
                      transition: 'background 160ms cubic-bezier(0.23,1,0.32,1), color 160ms cubic-bezier(0.23,1,0.32,1), transform 140ms cubic-bezier(0.23,1,0.32,1)',
                    }}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                    {badge !== null && (
                      <span style={{
                        minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                        fontSize: 11, fontWeight: 700, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: active ? 'rgba(255,255,255,0.18)' : '#EBEBE6',
                        color: active ? '#FFFFFF' : '#1A1A1A',
                      }}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* HØYRE: konto + oppgrader */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentLevel < 3 && (
              <button
                onClick={() => handleUpgrade()}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'opacity 160ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.65'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
              >
                Oppgrader
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserFooterMenuOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={userFooterMenuOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: 999, padding: '5px 10px 5px 5px', cursor: 'pointer', transition: 'background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
              >
                <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--btn-bg)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{footerInitials}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                <ChevronsUpDown size={14} style={{ color: 'var(--muted)' }} />
              </button>
              {userFooterMenuOpen && (
                <div
                  role="menu"
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 180, background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: 12, padding: 6, zIndex: 50, boxShadow: '0 18px 40px -20px rgba(26,26,26,0.25)' }}
                >
                  <button
                    role="menuitem"
                    onClick={() => { setActiveTab('settings'); setUserFooterMenuOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <Settings size={15} /> Innstillinger
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setActiveTab('log'); setUserFooterMenuOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <ClipboardCheck size={15} /> Sikt-logg
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { onLogout(); setUserFooterMenuOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: 'var(--danger)', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff0f0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <LogOut size={15} /> Logg ut
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MOBIL (< sm): slank merkevare-topp. All navigasjon ligger i bunnmenyen under. */}
        <div className="sm:hidden" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--hair)' }}>
          <button
            onClick={() => setActiveTab('home')}
            aria-label="Til Hjem"
            style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--btn-bg)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>S</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Sikt</span>
          </button>
        </div>
      </header>

      {/* ===== MOBIL BUNNMENY + «Mer»-ark (kun < sm) ===== */}
      {(() => {
        const PRIMARY: PortalTab[] = ['home', 'visibility', 'workshop', 'reviews'];
        const primaryItems = PRIMARY
          .map(id => navItems.find(n => n.id === id))
          .filter(Boolean) as typeof navItems;
        const overflowItems = navItems.filter(n => !PRIMARY.includes(n.id));
        const moreActive = activeTab === 'settings' || activeTab === 'log'
          || overflowItems.some(n => n.id === activeTab);
        const tabBadge = (id: PortalTab): number | null =>
          ((id === 'home' || id === 'workshop') && todos.length > 0 ? todos.length : null);

        return (
          <>
            <nav
              className="sm:hidden"
              aria-label="Hovedmeny"
              style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45,
                display: 'flex', alignItems: 'stretch',
                background: 'var(--navbg)', borderTop: '1px solid var(--hair)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {primaryItems.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                const badge = tabBadge(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '8px 2px 9px', background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--green)' : 'var(--muted)', transition: 'color 160ms' }}
                  >
                    <span style={{ position: 'relative', display: 'inline-flex' }}>
                      <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                      {badge !== null && (
                        <span style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green)', color: '#fff' }}>{badge}</span>
                      )}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em' }}>{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setMoreOpen(true)}
                aria-label="Mer"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '8px 2px 9px', background: 'none', border: 'none', cursor: 'pointer', color: (moreActive || moreOpen) ? 'var(--green)' : 'var(--muted)', transition: 'color 160ms' }}
              >
                <MoreHorizontal size={21} strokeWidth={(moreActive || moreOpen) ? 2.4 : 2} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em' }}>Mer</span>
              </button>
            </nav>

            {moreOpen && (
              <div
                className="sm:hidden"
                role="dialog"
                aria-modal="true"
                aria-label="Mer"
                style={{ position: 'fixed', inset: 0, zIndex: 60 }}
              >
                <button
                  aria-label="Lukk"
                  onClick={() => setMoreOpen(false)}
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer' }}
                />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--hair)', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: '10px 12px calc(14px + env(safe-area-inset-bottom))', boxShadow: '0 -18px 40px -20px rgba(0,0,0,0.3)' }}>
                  <div aria-hidden style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--hair)', margin: '4px auto 12px' }} />
                  {overflowItems.map(item => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    const badge = tabBadge(item.id);
                    return (
                      <button
                        key={item.id}
                        role="menuitem"
                        onClick={() => { setActiveTab(item.id); setMoreOpen(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', fontSize: 15, fontWeight: 600, color: active ? 'var(--green)' : 'var(--ink)', background: active ? 'var(--inset)' : 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <Icon size={19} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {badge !== null && (
                          <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green)', color: '#fff' }}>{badge}</span>
                        )}
                      </button>
                    );
                  })}
                  <div aria-hidden style={{ height: 1, background: 'var(--hair)', margin: '8px 4px' }} />
                  <button
                    role="menuitem"
                    onClick={() => { setActiveTab('settings'); setMoreOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Settings size={19} /> Innstillinger
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setActiveTab('log'); setMoreOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <ClipboardCheck size={19} /> Sikt-logg
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { onLogout(); setMoreOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', fontSize: 15, fontWeight: 600, color: 'var(--danger)', background: 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <LogOut size={19} /> Logg ut
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}

    <main style={{ maxWidth: 1320, margin: '0 auto', width: '100%', overflowX: 'clip' }}
          className="px-4 sm:px-6 lg:px-8 pt-6 pb-28 sm:py-10">

        {/* =============================================================== */}
        {/* HJEM — én skjerm, vertikal feed. Maks én primær handling synlig. */}
        {/* =============================================================== */}
        {activeTab === 'home' && (
          <div key={activeTab} className="space-y-6">
            <header className="font-['Geist','DM_Sans',sans-serif]">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em] text-[color:var(--ink)]" style={{ fontFamily: SERIF }}>Dashboard</h1>
              <p className="text-base mt-3 max-w-[58ch] text-[color:var(--muted)]" style={{ lineHeight: 1.6 }}>Slik står det til med {domainLabel || 'nettsiden din'}.</p>
              {analysisLimit !== Infinity && (
                <p className="text-xs mt-1.5 text-[color:var(--muted)] tabular-nums">
                  {analysesUsedThisMonth} av {analysisLimit} analyser brukt denne måneden
                  {analysesRemaining === 0 && currentLevel < 3 && (
                    <button
                      type="button"
                      onClick={() => handleUpgrade()}
                      className="ml-2 font-semibold text-[color:var(--green)] underline"
                    >
                      Oppgrader
                    </button>
                  )}
                </p>
              )}
              <div aria-hidden className="mt-6" style={{ borderTop: '1px solid var(--hair)' }} />
            </header>

            {/* Punkt 2: forventnings-note for nye kunder (≤6 uker) — SEO tar uker, ikke dager. */}
            {(() => {
              const acts = Array.isArray(siktActions) ? siktActions : [];
              const earliest = acts.length
                ? acts.reduce((min: number, a: any) => Math.min(min, new Date(a.created_at).getTime()), Date.now())
                : Date.now();
              const weeks = Math.max(1, Math.round((Date.now() - earliest) / (7 * 24 * 60 * 60 * 1000)));
              if (weeks > 6) return null;
              const fixes = acts.filter((a: any) => a.category === 'fix').length;
              const finds = acts.filter((a: any) => a.category === 'finding').length;
              return (
                <div className="rounded-[14px] border border-[color:var(--hair)] bg-[color:var(--subtle)] p-5 sm:p-6 font-['Geist','DM_Sans',sans-serif] flex gap-4">
                  <div aria-hidden className="mt-0.5 shrink-0"><Clock size={18} className="text-[#6D28D9]" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--ink)] mb-1">Hva du kan forvente de første ukene</h3>
                    <p className="text-sm text-[color:var(--ink)] leading-relaxed">
                      Resultater i Google tar typisk <strong className="text-[color:var(--ink)]">4–12 uker</strong> — du er i uke {weeks}. Mens vi venter bygger Sikt grunnmuren: så langt <strong className="text-[color:var(--ink)]">{fixes} {fixes === 1 ? 'fiks' : 'fikser'}</strong> og <strong className="text-[color:var(--ink)]">{finds} funn</strong>. Følg de ledende tegnene (fikser gjort, feil løst) her — ikke bare rangeringene.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Godkjenningskø: synlige fikser Sikt har klargjort, venter på ditt ja */}
            {fixQueue.length > 0 && (
              <div className="rounded-[14px] border border-[color:var(--hair)] bg-[color:var(--surface)] p-5 sm:p-6 font-['Geist','DM_Sans',sans-serif]">
                <div className="flex items-center gap-2 mb-1">
                  <SectionTitle>Venter på din godkjenning</SectionTitle>
                  <span className="ml-auto text-[11px] font-semibold text-[color:var(--green)] bg-[color:var(--inset)] px-2 py-0.5 rounded-full tabular-nums">{fixQueue.length}</span>
                </div>
                <p className="text-sm text-[color:var(--muted)] mb-4">Sikt har klargjort disse synlige endringene. Godkjenn for å publisere dem rett til siden din.</p>
                <div className="space-y-3">
                  {fixQueue.map((item) => {
                    const label = item.field === 'h1' ? 'Overskrift (H1)' : item.field === 'content' ? 'Sideinnhold' : item.field;
                    const busy = queueBusyId === item.id;
                    return (
                      <div key={item.id} className="rounded-[12px] border border-[color:var(--hair)] p-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink)] bg-[color:var(--subtle)] px-2 py-0.5 rounded">{label}</span>
                          <span className="text-xs text-[color:var(--muted)] truncate max-w-full">{item.page_url}</span>
                        </div>
                        <p className="text-sm font-semibold text-[color:var(--ink)] mb-1">{item.suggested_value}</p>
                        {item.explanation && <p className="text-xs text-[color:var(--muted)] mb-3 leading-relaxed">{item.explanation}</p>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => approveQueuedFix(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[color:var(--btn-bg)] text-white text-xs font-semibold ui-motion disabled:opacity-60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#2A2722]"
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            Godkjenn og publiser
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => rejectQueuedFix(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[color:var(--hair)] text-[color:var(--ink)] text-xs font-semibold ui-motion disabled:opacity-60"
                          >
                            <X size={13} /> Avvis
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={`${tabFadeInClass} space-y-6`}>
              {!activationDismissed && (
                <ActivationChecklist
                  theme={themed}
                  websiteUrl={websiteUrl}
                  hasAnalysis={!!analysisResults}
                  isAnalyzing={isAnalyzing}
                  gscConnected={gscConnected}
                  hasStandardOrHigher={hasStandardOrHigher}
                  hostIsFullyConnected={hostIsFullyConnected}
                  hostWasLightOnly={hostWasLightOnly}
                  onAddUrl={() => { setActiveTab('settings'); setEditingSection('profile'); }}
                  onRunAnalysis={() => runRealAnalysis()}
                  onConnectGsc={() => { setActiveTab('keywords'); setShowGscPreCheck(true); }}
                  onConnectWp={() => { openWpWizard(); }}
                  onDismiss={dismissActivation}
                />
              )}
              <React.Suspense fallback={<div className="h-64" />}>
                <DashboardHome
                  user={user}
                  clientData={clientData}
                  formData={formData}
                  analysisResults={analysisResults}
                  scoreHistory={scoreHistory}
                  siktActions={siktActions}
                  realRankings={realRankings}
                  gscConnected={gscConnected}
                  gscKeywords={gscKeywords}
                  isAnalyzing={isAnalyzing}
                  geo={geoSummary}
                  onRunAnalysis={runRealAnalysis}
                  onNavigate={setActiveTab}
                />
              </React.Suspense>
              {!journeyDismissed && (
                <div className="mt-12">
                  <JourneyTimeline theme={themed} onDismiss={dismissJourney} />
                </div>
              )}
              <div className="mt-12 pb-20">
                <DashboardCompetitorWidget
                  userId={user.id}
                  theme={themed}
                  onNavigate={() => setActiveTab('competitors')}
                />
              </div>
            </div>
          </div>
        )}
        {isFounder && activeTab === 'health' && (
          <div key={activeTab} className="space-y-6 font-['Geist','DM_Sans',sans-serif]">
            <header>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em] text-[color:var(--ink)]" style={{ fontFamily: SERIF }}>Kundehelse</h1>
              <p className="text-base mt-3 max-w-[58ch] text-[color:var(--muted)]" style={{ lineHeight: 1.6 }}>Hvem er i ferd med å falle av — og hvorfor. Kun synlig for deg.</p>
              <div aria-hidden className="mt-6" style={{ borderTop: '1px solid var(--hair)' }} />
            </header>

            {healthLoading && <div className="text-sm text-[color:var(--muted)]">Laster …</div>}
            {healthError && <div className="text-sm text-[color:var(--danger)]">Kunne ikke laste: {healthError}</div>}

            {healthData && (
              <>
                <div className="flex gap-3 flex-wrap">
                  {([['red','🔴','Røde'],['yellow','🟡','Gule'],['green','🟢','Grønne']] as const).map(([k, dot, label]) => (
                    <div key={k} className="rounded-[12px] border border-[color:var(--hair)] bg-[color:var(--surface)] px-4 py-3 min-w-[96px]">
                      <div className="text-2xl font-bold text-[color:var(--ink)] tabular-nums" style={{ fontFamily: SERIF }}>{healthData.summary[k] ?? 0}</div>
                      <div className="text-xs text-[color:var(--muted)] mt-0.5">{dot} {label}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[14px] border border-[color:var(--hair)] bg-[color:var(--surface)] overflow-hidden">
                  {healthData.rows.length === 0 ? (
                    <div className="p-6 text-sm text-[color:var(--muted)]">Ingen kunder ennå.</div>
                  ) : (
                    <div className="divide-y divide-[color:var(--hair)]">
                      {healthData.rows.map((r: any) => {
                        const dot = r.health === 'red' ? '🔴' : r.health === 'yellow' ? '🟡' : '🟢';
                        return (
                          <div key={r.user_id} className="flex items-center gap-3 p-4 flex-wrap">
                            <span className="text-base shrink-0">{dot}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-[color:var(--ink)] truncate">{r.email || '(ukjent)'} <span className="font-normal text-[color:var(--muted)]">· {r.package_name || '—'}</span></div>
                              <div className="text-xs text-[color:var(--muted)] mt-0.5">{healthReason(r)}</div>
                            </div>
                            {r.email && (
                              <a href={`mailto:${r.email}?subject=${encodeURIComponent('Hei fra Sikt')}`} className="text-xs font-semibold text-[color:var(--green)] underline whitespace-nowrap shrink-0">Nå ut</a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {false && activeTab === 'home' && (
          <div className="space-y-6">
            {showFirstAnalysisBanner && (
              <div className={`rounded-xl border ${divider} ${isLight ? 'bg-violet-50' : 'bg-violet-950/30'} px-4 py-3 flex items-start justify-between gap-3`}>
                <p className={`text-sm ${textMain}`}>
                  👋 Velkommen til Sikt! Vi analyserer nettsiden din nå. Resultatene vises her om 30-60 sekunder.
                </p>
                <button
                  type="button"
                  onClick={() => setShowFirstAnalysisBanner(false)}
                  className={`shrink-0 p-1 rounded-md ${textDim} hover:${textMain}`}
                  aria-label="Lukk velkomstmelding"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* HERO — radial-score + greeting + neste handling. Subtil violet aksent. */}
            <div
              className={`rounded-2xl border ${divider} ${isLight ? 'bg-gradient-to-br from-white to-violet-50/40' : 'bg-gradient-to-br from-slate-900/60 to-violet-950/40'} px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${textDim}`}>
                  {isFirstVisit ? `Velkommen, ${firstName}.` : `Hei ${firstName}.`}
                </p>
                <h1 className={`text-2xl sm:text-3xl font-semibold tracking-tight mt-1 ${textMain}`}>
                  {combinedScore == null ? (
                    'Klar for første sjekk?'
                  ) : (
                    <>
                      Sikt-scoren din er{' '}
                      <span className={scoreTone === 'good' ? 'text-emerald-600' : scoreTone === 'warn' ? 'text-amber-600' : 'text-rose-600'}>
                        {combinedScore >= 80 ? 'sterk' : combinedScore >= 60 ? 'god' : 'svak'}
                      </span>
                      .
                    </>
                  )}
                </h1>
                <p className={`text-sm mt-2 ${textDim}`}>
                  {!websiteUrl
                    ? 'Legg inn nettsiden din i Innstillinger, så starter Sikt å jobbe.'
                    : !analysisResults
                      ? 'Kjør første tekniske sjekk og få Lighthouse-resultatet på 30 sekunder.'
                      : todos.length === 0
                        ? 'Ingenting krever oppmerksomhet akkurat nå. Bra jobbet.'
                        : `Du har ${todos.length} ${todos.length === 1 ? 'oppgave' : 'oppgaver'} å se på i dag.`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!websiteUrl ? (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('settings'); setEditingSection('profile'); }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                    >
                      <Globe size={14} /> Legg til nettside
                    </button>
                  ) : !analysisResults ? (
                    <button
                      type="button"
                      onClick={() => runRealAnalysis()}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
                    >
                      <Activity size={14} /> {isAnalyzing ? 'Kjører…' : 'Kjør første analyse'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('log')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                    >
                      <ClipboardCheck size={14} /> Se Sikt-loggen
                    </button>
                  )}
                  {analysisResults && scoreHistory.length > 0 && (
                    <span className={`inline-flex items-center text-xs ${textLabel} px-2`}>
                      Sjekket {new Date(scoreHistory[scoreHistory.length - 1].at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 shrink-0">
                  <RadialScore value={combinedScore} theme={themed} size={108} />
                  {/* Sub-score breakdown — viser hva totalscoren består av med tydelig fallback */}
                  <div className="flex flex-wrap items-start justify-center gap-2 max-w-[300px]">
                    {(() => {
                      const tech = scores.technical;
                      const vis = scores.visibility;
                      const toneClass = (v: number | null) => {
                        const tone: 'good' | 'warn' | 'bad' | 'neutral' =
                          v == null ? 'neutral' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad';
                        return tone === 'good'
                          ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20')
                          : tone === 'warn'
                            ? (isLight ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-amber-500/10 text-amber-300 border-amber-500/20')
                            : tone === 'bad'
                              ? (isLight ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-rose-500/10 text-rose-300 border-rose-500/20')
                              : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-white/10');
                      };

                      return (
                        <>
                          <div className="flex flex-col items-center gap-1">
                            <div className={`rounded-lg border px-2 py-1 text-center ${toneClass(tech)}`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[11px] font-medium">Technical Score</span>
                                <HoverTooltip text="Score fra 0-100 basert på lastetid, mobile-vennlighet, sikkerhet og SEO-teknisk." />
                              </div>
                              {scoresLoading ? (
                                <div className="flex items-center justify-center p-2">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                </div>
                              ) : tech == null ? (
                                <div className="text-center">
                                  <div className="text-4xl font-bold text-gray-400">—</div>
                                  <button
                                    onClick={() => runRealAnalysis()}
                                    className="mt-2 text-sm text-blue-600 hover:underline"
                                  >
                                    Kjør analyse
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${getScoreColor(tech).color}`}>{tech}</span>
                                  <span className="text-[11px] text-gray-600">{getScoreColor(tech).emoji} {getScoreColor(tech).label}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-1">
                            <div className={`rounded-lg border px-2 py-1 text-center ${toneClass(vis)}`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[11px] font-medium">Visibility Score</span>
                                <HoverTooltip text="Synlighetsscore fra 0-100 basert på søkeordsdata fra Google Search Console." />
                              </div>
                              {!gscConnected ? (
                                <div className="text-center">
                                  <Link2 className="w-8 h-8 text-gray-400 mb-2 mx-auto" />
                                  <button
                                    onClick={() => setActiveTab('keywords')}
                                    className="text-sm text-blue-600 hover:underline"
                                  >
                                    Koble til
                                  </button>
                                </div>
                              ) : scoresLoading ? (
                                <div className="flex items-center justify-center p-2">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                </div>
                              ) : vis == null ? (
                                <div className="text-center">
                                  <div className="text-4xl font-bold text-gray-400">—</div>
                                  <div className="text-xs text-gray-500 mt-1">Henter data...</div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${getScoreColor(vis).color}`}>{vis}</span>
                                  <span className="text-[11px] text-gray-600">{getScoreColor(vis).emoji} {getScoreColor(vis).label}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-1">
                            <div className={`rounded-lg border px-2 py-1 text-center ${toneClass(null)}`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[11px] font-medium">GEO</span>
                                <HoverTooltip text="GEO viser synlighet i AI-søk. Full automatisk scoring lanseres i Q3 2026." />
                              </div>
                              <div className="text-center">
                                <div className="text-4xl font-bold text-gray-400">—</div>
                                <div className="text-xs text-gray-500 mt-1">Kommer Q3 2026</div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
            </div>

            {analyzeError && (
              <div className={`rounded-xl px-4 py-3 text-sm border ${isLight ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>
                {analyzeError}
              </div>
            )}
            {isAnalyzing && (
              <div className={`rounded-xl border ${divider} px-5 py-4`}>
                <p className={`text-sm ${textMain} mb-2`}>{progressText}</p>
                <div className={`h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                  <div className="h-full bg-violet-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {autoScanInfo.active && !isAnalyzing && (
              <div className={`rounded-xl border ${isLight ? 'bg-violet-50/60 border-violet-100' : 'bg-violet-500/10 border-violet-500/20'} px-4 py-3 flex items-center gap-3`}>
                <Loader2 size={14} className="text-violet-600 animate-spin shrink-0" />
                <p className={`text-sm ${isLight ? 'text-violet-900' : 'text-violet-200'} flex-1 min-w-0 truncate`}>
                  Sikt jobber i bakgrunnen — {autoScanInfo.label}
                </p>
              </div>
            )}

            {/* OVERSIKT-KORT — Besøkende + Synlighet med periode-velger */}
            {(() => {
              // Besøkende: ingen GA-kobling ennå — klar for ekte data fra Google Analytics API.
              // Synlighet: bruker visibilityScore (ekte data fra søkeordrangeringer).
              const periodLabel = overviewPeriod === '1M' ? '1 måned' : overviewPeriod === '2M' ? '2 måneder' : '3 måneder';

              // Endrings-pil for synlighet basert paa scoreHistory (mobileSeo-trenden).
              const synlighetDelta: number | null = (() => {
                if (scoreHistory.length < 2) return null;
                const latest = scoreHistory[scoreHistory.length - 1].mobileSeo;
                // finn referansepunkt basert paa periode
                const months = overviewPeriod === '1M' ? 1 : overviewPeriod === '2M' ? 2 : 3;
                const msBack = months * 30 * 24 * 60 * 60 * 1000;
                const ref = [...scoreHistory].reverse().find((h) => Date.now() - new Date(h.at).getTime() >= msBack);
                if (!ref) return null;
                return Math.round(latest - ref.mobileSeo);
              })();

              const visDeltaColor = synlighetDelta == null ? textLabel
                : synlighetDelta > 0 ? 'text-emerald-600'
                : synlighetDelta < 0 ? 'text-rose-600'
                : textLabel;

              return (
                <div className={`rounded-2xl border ${divider} ${isLight ? 'bg-[color:var(--surface)]' : 'bg-slate-900/40'} px-5 py-5 sm:px-6`}>
                  {/* Header rad */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className={`text-sm font-semibold uppercase tracking-wide ${textLabel}`}>Din oversikt</h2>
                    </div>
                    {/* Periode-velger */}
                    <div className={`inline-flex rounded-lg border ${divider} p-0.5 gap-0.5`}>
                      {(['1M', '2M', '3M'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setOverviewPeriod(p)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                            overviewPeriod === p
                              ? (isLight ? 'bg-slate-900 text-white' : 'bg-[color:var(--surface)] text-slate-900')
                              : `${textDim} hover:${textMain}`
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* To KPI-bokser side om side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* BESØKENDE */}
                    <div className={`rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/8 bg-slate-800/40'} p-4`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-xs font-medium uppercase tracking-wide ${textLabel} inline-flex items-center gap-1`}>
                          Besøkende
                          <HoverTooltip text="Antall brukere fra Google Analytics for valgt periode. Vises når Analytics er koblet til." />
                        </span>
                        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/10 text-violet-400'}`}>
                          <Users size={12} />
                        </span>
                      </div>
                      {/* Ingen GA-data ennå */}
                      <p className={`text-3xl font-semibold ${textMain} leading-none mb-1`}>—</p>
                      <p className={`text-xs ${textDim}`}>
                        Koble til Google Analytics for å se besøkende de siste{' '}
                        <button
                          type="button"
                          onClick={() => { setActiveTab('settings'); }}
                          className="text-violet-600 hover:text-violet-500 font-medium underline underline-offset-2"
                        >
                          {periodLabel}
                        </button>
                      </p>
                    </div>

                    {/* SYNLIGHET */}
                    <div className={`rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/8 bg-slate-800/40'} p-4`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-xs font-medium uppercase tracking-wide ${textLabel} inline-flex items-center gap-1`}>
                          Synlighet
                          <HoverTooltip text="0-100 basert på plasseringene dine for sporede søkeord. Topp 3 gir mest poeng." />
                        </span>
                        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          <Search size={12} />
                        </span>
                      </div>
                      <div className="flex items-end gap-2 mb-1">
                        <p className={`text-3xl font-semibold ${textMain} leading-none`}>
                          {visibilityScore != null ? `${visibilityScore}` : '—'}
                        </p>
                        {visibilityScore != null && (
                          <span className={`text-sm ${textDim} mb-0.5`}>/ 100</span>
                        )}
                        {synlighetDelta != null && synlighetDelta !== 0 && (
                          <span className={`text-sm font-semibold mb-0.5 ${visDeltaColor}`}>
                            {synlighetDelta > 0 ? `+${synlighetDelta}` : synlighetDelta}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${textDim}`}>
                        {visibilityScore == null
                          ? 'Kjør søkeordsjekk for å måle synlighet'
                          : synlighetDelta == null
                            ? `Basert på ${realRankings.length} sporede søkeord`
                            : `${synlighetDelta >= 0 ? 'Økt' : 'Redusert'} siste ${periodLabel} · ${realRankings.length} søkeord`}
                      </p>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* KPI-RAD — fire tiles med subtile fargeaksenter + sparklines. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiTile
                theme={themed}
                label="Sikt-score"
                value={combinedScore == null ? '—' : `${combinedScore}`}
                hint={
                  combinedScore == null
                    ? 'Ikke målt enda'
                    : (
                        <span>
                          Tek {technicalScore ?? '—'} · Syn {visibilityScore ?? '—'}
                          {hasPremium ? <> · GEO {geoScore ?? '—'}</> : null}
                        </span>
                      )
                }
                accent={scoreTone === 'good' ? 'emerald' : scoreTone === 'warn' ? 'amber' : scoreTone === 'bad' ? 'rose' : 'slate'}
                spark={scoreSpark.length >= 2 ? scoreSpark : undefined}
                icon={<Activity size={14} />}
                tooltip="Samlet score fra teknisk helse, søkesynlighet og GEO når tilgjengelig. Høyere betyr bedre."
              />
              <KpiTile
                theme={themed}
                label="Topp 10 søkeord"
                value={top10Count}
                hint={
                  realRankings.length === 0
                    ? 'Ikke sjekket enda'
                    : top3Count > 0
                      ? <>{top3Count} på topp 3</>
                      : <>{realRankings.length - top10Count} utenfor topp 10</>
                }
                accent={top10Count > 0 ? 'violet' : 'slate'}
                icon={<Search size={14} />}
                tooltip="Antall sporede søkeord der siden din vises blant topp 10 i Google-resultatene."
              />
              <KpiTile
                theme={themed}
                label="Aktivitet 7d"
                value={actionsLast7d}
                hint={fixesLast7d > 0 ? <>{fixesLast7d} {fixesLast7d === 1 ? 'fiks' : 'fikser'}</> : 'Ingen fikser enda'}
                accent={actionsLast7d > 0 ? 'emerald' : 'slate'}
                spark={activityByDay.some((v) => v > 0) ? activityByDay : undefined}
                icon={<Sparkles size={14} />}
                tooltip="Antall funn, forslag, varsler og fikser Sikt har registrert de siste 7 dagene."
              />
              <KpiTile
                theme={themed}
                label="Å fikse"
                value={todos.length}
                hint={todos.length === 0 ? 'Alt på stell' : <>{todayTodos.length} prioritert</>}
                accent={todos.length > 5 ? 'amber' : todos.length > 0 ? 'violet' : 'emerald'}
                icon={<Wrench size={14} />}
                tooltip="Antall prioriterte oppgaver Sikt mener bør løses basert på analyser og søkeordsdata."
              />
            </div>

            {/* I DAG — 3 prioriterte oppgaver (eller tom-tilstand med proaktive forslag) */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader
                theme={themed}
                icon={<Target size={16} />}
                accent={todos.length === 0 ? 'emerald' : todos.length > 5 ? 'amber' : 'violet'}
                title="I dag"
                subtitle={todos.length === 0 ? 'Ingenting krever oppmerksomhet akkurat nå.' : `${todos.length} ${todos.length === 1 ? 'oppgave' : 'oppgaver'} sortert etter effekt`}
                action={
                  todos.length > 3 && (
                    <span className={`text-xs ${textLabel}`}>
                      Topp 3 av {todos.length}
                    </span>
                  )
                }
              />

              {todos.length === 0 ? (
                <div className={`rounded-xl px-5 py-8 ${subtleBg} space-y-4`}>
                  <p className={`text-sm ${textMain}`}>Alt ser bra ut. Her er noen ting du kan gjøre uansett:</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-3">
                      <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                      <button onClick={() => runRealAnalysis()} className="text-violet-600 hover:text-violet-500 font-medium">Kjør en ny teknisk sjekk</button>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                      <button onClick={() => setActiveTab('keywords')} className="text-violet-600 hover:text-violet-500 font-medium">Legg til flere søkeord å spore</button>
                    </li>
                    {hasStandardOrHigher && !hostIsFullyConnected && (
                      <li className="flex items-center gap-3">
                        <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                        <button onClick={() => { setActiveTab('settings'); openWpWizard(); }} className="text-violet-600 hover:text-violet-500 font-medium">Koble til WordPress for auto-fiks</button>
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                <ul className={`divide-y ${divider} -mx-2`}>
                  {todayTodos.map((t) => {
                    const kindStyle: Record<TodoKind, { label: string; bg: string; fg: string }> = {
                      pagespeed:  { label: 'P', bg: isLight ? 'bg-violet-100'  : 'bg-violet-500/15',  fg: 'text-violet-700' },
                      keyword:    { label: 'K', bg: isLight ? 'bg-emerald-100' : 'bg-emerald-500/15', fg: 'text-emerald-700' },
                      content:    { label: 'I', bg: isLight ? 'bg-sky-100'     : 'bg-sky-500/15',     fg: 'text-sky-700' },
                      'content-page': { label: 'S', bg: isLight ? 'bg-sky-100' : 'bg-sky-500/15', fg: 'text-sky-700' },
                      onboarding: { label: '!', bg: isLight ? 'bg-amber-100'   : 'bg-amber-500/15',   fg: 'text-amber-700' },
                      competitor: { label: 'C', bg: isLight ? 'bg-rose-100'    : 'bg-rose-500/15',    fg: 'text-rose-700' },
                      geo:        { label: 'A', bg: isLight ? 'bg-violet-100'  : 'bg-violet-500/15',  fg: 'text-violet-700' },
                    };
                    const k = kindStyle[t.kind];
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={t.action.onClick}
                          className={`w-full flex items-start gap-4 px-2 py-4 text-left rounded-lg hover:${subtleBg} transition-colors group`}
                        >
                          <span className={`shrink-0 w-8 h-8 rounded-lg ${k.bg} ${k.fg} text-sm font-bold flex items-center justify-center mt-0.5`}>
                            {k.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${textMain}`}>{t.title}</p>
                            <p className={`text-xs mt-1 ${textDim}`}>{t.desc}</p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 text-sm font-medium text-violet-600 group-hover:text-violet-500 mt-1.5`}>
                            {t.action.label} <ChevronRight size={14} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {moreTodos.length > 0 && (
                <div className={`pt-5 mt-2 border-t ${divider}`}>
                  <button
                    type="button"
                    onClick={() => setShowAllTodos((v) => !v)}
                    className={`text-sm font-medium ${textDim} hover:${textMain} inline-flex items-center gap-1`}
                  >
                    {showAllTodos ? `Skjul ${moreTodos.length} ekstra` : `Vis ${moreTodos.length} flere å fikse`}
                    <ChevronDown size={14} className={`transition-transform ${showAllTodos ? 'rotate-180' : ''}`} />
                  </button>
                  {showAllTodos && (
                    <ul className={`mt-3 divide-y ${divider}`}>
                      {moreTodos.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={t.action.onClick}
                            className={`w-full flex items-center justify-between gap-3 py-3 text-left hover:${subtleBg} px-2 rounded-lg`}
                          >
                            <div className="min-w-0">
                              <p className={`text-sm ${textMain} truncate`}>{t.title}</p>
                              <p className={`text-xs mt-0.5 ${textDim} truncate`}>{t.desc}</p>
                            </div>
                            <ChevronRight size={14} className={`shrink-0 ${textDim}`} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </PortalCard>

            {/* DETTE HAR SIKT GJORT SIDEN SIST — aktivitetsfeed */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader
                theme={themed}
                icon={<Activity size={16} />}
                accent="sky"
                title="Dette har Sikt gjort siden sist"
                subtitle={homeFeedActions.length > 0 ? 'Aktivitet i bakgrunnen — fikser, funn og varsler.' : 'Sikt har ikke logget noe enda.'}
                action={
                  homeFeedActions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('log')}
                      className="text-sm font-medium text-violet-600 hover:text-violet-500 inline-flex items-center gap-1"
                    >
                      Se hele loggen <ArrowRight size={14} />
                    </button>
                  )
                }
              />

              {homeFeedActions.length === 0 ? (
                <div className={`rounded-xl px-5 py-6 text-center ${subtleBg}`}>
                  <p className={`text-sm ${textDim}`}>
                    {hasStandardOrHigher ? 'Sikt jobber i bakgrunnen — kom tilbake i morgen.' : 'Kjør en analyse, så dukker første funn opp her.'}
                  </p>
                </div>
              ) : (
                <ol className="relative pl-6">
                  {/* Vertikal tidslinje-strek */}
                  <span className={`absolute top-2 bottom-2 left-[7px] w-px ${isLight ? 'bg-slate-200' : 'bg-[color:var(--surface)]/10'}`} aria-hidden />
                  {homeFeedActions.map((a: any) => {
                    const meta = categoryMeta(a.category);
                    const ts = new Date(a.created_at);
                    const diffMs = Date.now() - ts.getTime();
                    const diffH = Math.round(diffMs / (1000 * 60 * 60));
                    const diffD = Math.round(diffMs / (1000 * 60 * 60 * 24));
                    const ago = diffH < 1 ? 'nå' : diffH < 24 ? `${diffH}t` : diffD === 1 ? '1 dg' : `${diffD} dg`;
                    return (
                      <li key={a.id} className="relative flex items-start gap-3 py-3">
                        <span
                          className={`absolute -left-6 mt-1.5 w-3.5 h-3.5 rounded-full ${meta.dot} ring-4 ${isLight ? 'ring-white' : 'ring-slate-900'} shrink-0`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${textMain} truncate`}>{a.title}</p>
                          <p className={`text-xs mt-0.5 ${textDim}`}>{meta.label}</p>
                        </div>
                        <span className={`shrink-0 text-xs ${textLabel} font-mono tabular-nums`}>{ago}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </PortalCard>
          </div>
        )}

        {/* =============================================================== */}
        {/* SYNLIGHET — sub-faner: PageSpeed, Innhold, Lenker.              */}
        {/* =============================================================== */}
        {activeTab === 'visibility' && (() => {
          // Ett kildested: bruk PORTAL direkte (ikke duplisert hex). Se portalTheme.ts.
          const palette = PORTAL;
          const latestRun = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null;
          const latestLabel = latestRun
            ? new Date(latestRun.at).toLocaleString('nb-NO', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
            : 'Ingen analyse ennå';
          const contentCriticalCount = contentPages.filter((p: any) => p?.status === 'Kritisk').length;
          const linksIsolatedCount = linkPages.filter((p: any) => p?.status === 'Isolert' || p?.inlinks === 0 || p?.isolated).length;
          const pagesWithIssues = contentPages.filter((p: any) => (p.issues || []).length > 0).length;

          const metricTone = (score: number): 'good' | 'warn' | 'bad' => (score >= 0.9 ? 'good' : score >= 0.5 ? 'warn' : 'bad');
          const scoreTone = (value: number): 'good' | 'warn' | 'bad' => (value >= 80 ? 'good' : value >= 60 ? 'warn' : 'bad');
          const tonePill = (tone: 'good' | 'warn' | 'bad') => {
            if (tone === 'good') return { bg: palette.successBg, fg: palette.success, label: 'Bra' };
            if (tone === 'warn') return { bg: palette.warnBg, fg: palette.warn, label: 'Middels' };
            return { bg: palette.dangerBg, fg: palette.danger, label: 'Svak' };
          };
          const toneColor = (tone: 'good' | 'warn' | 'bad' | null) =>
            tone === 'good' ? palette.success : tone === 'warn' ? palette.warn : tone === 'bad' ? palette.danger : palette.muted;

          // --- Tre pilarer → én samlet synlighetsscore ---
          const fartScore = analysisResults ? totalScore : null;
          const innholdScore = contentPages.length ? Math.round(((contentPages.length - pagesWithIssues) / contentPages.length) * 100) : null;
          const lenkerScore = linkPages.length ? Math.round((1 - linksIsolatedCount / linkPages.length) * 100) : null;
          const pillarScores = [fartScore, innholdScore, lenkerScore].filter((v): v is number => v != null);
          const overall = pillarScores.length ? Math.round(pillarScores.reduce((a, b) => a + b, 0) / pillarScores.length) : null;
          const overallTone: 'good' | 'warn' | 'bad' | null = overall == null ? null : overall >= 80 ? 'good' : overall >= 60 ? 'warn' : 'bad';
          const overallLabel = overall == null ? '' : overallTone === 'good' ? 'God' : overallTone === 'warn' ? 'Trenger arbeid' : 'Svak';
          const hasAnyData = !!analysisResults || contentPages.length > 0 || linkPages.length > 0;

          const pillars: { name: string; tone: 'good' | 'warn' | 'bad' | null; status: string }[] = [
            {
              name: 'Fart',
              tone: fartScore == null ? null : scoreTone(fartScore),
              status: fartScore == null ? 'ikke målt ennå' : fartScore >= 80 ? 'siden er rask' : fartScore >= 60 ? 'litt treg' : 'for treg',
            },
            {
              name: 'Innhold',
              tone: contentPages.length === 0 ? null : contentCriticalCount > 0 ? 'bad' : pagesWithIssues > 0 ? 'warn' : 'good',
              status: contentPages.length === 0 ? 'ikke skannet ennå' : pagesWithIssues > 0 ? `${pagesWithIssues} ${pagesWithIssues === 1 ? 'side' : 'sider'} å forbedre` : 'alt ser bra ut',
            },
            {
              name: 'Lenker',
              tone: linkPages.length === 0 ? null : linksIsolatedCount > 0 ? 'warn' : 'good',
              status: linkPages.length === 0 ? 'ikke skannet ennå' : linksIsolatedCount > 0 ? `${linksIsolatedCount} ${linksIsolatedCount === 1 ? 'side' : 'sider'} er isolert` : 'alt henger sammen',
            },
          ];

          const anyRunning = isAnalyzing || isScanning || isScanningLinks;
          const runAll = () => {
            if (anyRunning) return;
            runRealAnalysis();
            runContentScan(contentPages.length > 0);
            runLinkScan();
          };

          return (
            <div key={activeTab} className="space-y-6 font-['Geist','DM_Sans',sans-serif]" style={{ color: palette.ink }}>
              <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: palette.ink, fontFamily: SERIF }}>Synlighet</h1>
                  <p className="text-base mt-3" style={{ color: palette.muted }}>Hvor godt nettsiden din virker for Google og besøkende — på ett blikk.</p>
                </div>
                {hasAnyData && (
                  <button
                    type="button"
                    onClick={runAll}
                    disabled={anyRunning}
                    className="inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-[10px] transition-transform active:scale-[0.97] disabled:opacity-60"
                    style={{ background: palette.ink, color: '#fff' }}
                  >
                    <RefreshCw size={14} className={anyRunning ? 'animate-spin' : ''} />
                    {anyRunning ? 'Oppdaterer…' : 'Oppdater'}
                  </button>
                )}
              </header>

              <div className={`${tabFadeInClass} space-y-8`}>
                {!hasAnyData ? (
                  <section className="rounded-[16px] p-8 sm:p-12 text-center" style={{ background: palette.insetBg, border: `1px solid ${palette.insetBorder}` }}>
                    <div className="grid h-12 w-12 mx-auto place-items-center rounded-full" style={{ background: palette.card, border: `1px solid ${palette.insetBorder}` }}>
                      <Activity size={20} style={{ color: palette.insetInk }} />
                    </div>
                    <p className="mt-4 text-[17px] font-semibold tracking-[-0.01em]" style={{ color: palette.insetInk }}>Kjør din første synlighets-sjekk</p>
                    <p className="mt-2 text-sm leading-relaxed max-w-md mx-auto" style={{ color: palette.insetInk, opacity: 0.82 }}>
                      Sikt måler hvor raskt siden laster, om innholdet er i orden, og om sidene henger sammen. Det tar rundt 30 sekunder.
                    </p>
                    <button
                      type="button"
                      onClick={runAll}
                      disabled={anyRunning}
                      className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-[10px] transition-transform active:scale-[0.97] disabled:opacity-60"
                      style={{ background: palette.ink, color: '#fff' }}
                    >
                      <RefreshCw size={14} className={anyRunning ? 'animate-spin' : ''} />
                      {anyRunning ? 'Sjekker…' : 'Kjør sjekk'}
                    </button>
                  </section>
                ) : (
                  <>
                    {/* ── SAMMENDRAG: én score + tre pilarer ───────────────── */}
                    <section className="rounded-[16px] p-6 sm:p-8 shadow-[0_1px_2px_rgba(26,24,18,0.03),0_18px_40px_-28px_rgba(26,24,18,0.22)]" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                      <div className="grid gap-7 md:grid-cols-[auto_1px_1fr] md:gap-10 md:items-center">
                        <div className="shrink-0 md:w-[260px]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: palette.muted }}>Synlighetsscore</p>
                          <div className="mt-1.5 flex flex-wrap items-end gap-x-2 gap-y-1">
                            <span className="text-[76px] font-semibold leading-[0.82] tracking-[-0.055em] tabular-nums" style={{ color: palette.ink }}>{overall ?? '—'}</span>
                            <span className="pb-[10px] text-[20px] font-normal" style={{ color: palette.faint }}>/100</span>
                            {overall != null && (
                              <span className="mb-[14px] inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tonePill(overallTone as any).bg, color: tonePill(overallTone as any).fg }}>
                                {overallLabel}
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-[11px] font-medium leading-snug" style={{ color: palette.muted }}>
                            Sist oppdatert {latestLabel}
                          </p>
                        </div>

                        <div className="hidden md:block md:self-stretch" style={{ width: 1, background: palette.border }} aria-hidden />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {pillars.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => setShowVisibilityDetails(true)}
                              className="rounded-[14px] p-4 text-left transition-colors"
                              style={{ background: palette.subtle, border: `1px solid ${palette.border}` }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="grid h-6 w-6 place-items-center rounded-full shrink-0" style={{ background: p.tone === 'good' ? palette.successBg : p.tone == null ? palette.bg : p.tone === 'warn' ? palette.warnBg : palette.dangerBg }}>
                                  {p.tone === 'good'
                                    ? <Check size={13} style={{ color: palette.success }} />
                                    : p.tone == null
                                      ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.faint }} />
                                      : <AlertTriangle size={12} style={{ color: toneColor(p.tone) }} />}
                                </span>
                                <span className="text-sm font-semibold" style={{ color: palette.ink }}>{p.name}</span>
                              </div>
                              <p className="mt-2 text-[13px] leading-snug" style={{ color: palette.sub }}>{p.status}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* ── Bryter for tekniske detaljer ─────────────────────── */}
                    <button
                      type="button"
                      onClick={() => setShowVisibilityDetails((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
                      style={{ color: palette.sub }}
                    >
                      <ChevronRight size={15} style={{ color: palette.muted, transform: showVisibilityDetails ? 'rotate(90deg)' : 'none', transition: 'transform 180ms cubic-bezier(0.23,1,0.32,1)' }} />
                      {showVisibilityDetails ? 'Skjul tekniske detaljer' : 'Vis tekniske detaljer'}
                    </button>

                    {showVisibilityDetails && (
                      <div className="space-y-8">
                        {/* ── FART ──────────────────────────────────────── */}
                        <section>
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <SectionTitle size="sm">Fart</SectionTitle>
                            <span className="text-xs" style={{ color: palette.muted }}>Siste måling: {latestLabel}</span>
                          </div>

                          {!analysisResults ? (
                            <Note tone="neutral">
                              Trykk «Oppdater» øverst, så måler vi farten på ca. 30 sekunder.
                            </Note>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                  { plain: 'Hvor raskt siden laster', term: 'LCP', value: analysisResults.mobile.lcp.value, score: analysisResults.mobile.lcp.score },
                                  { plain: 'Hvor raskt siden reagerer', term: 'TBT', value: analysisResults.mobile.tbt.value, score: analysisResults.mobile.tbt.score },
                                  { plain: 'Hvor stabilt innholdet ligger', term: 'CLS', value: analysisResults.mobile.cls.value, score: analysisResults.mobile.cls.score },
                                ].map((m, i) => {
                                  const tone = tonePill(metricTone(m.score));
                                  return (
                                    <article key={i} className="rounded-[14px] p-4" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                                      <div className="flex items-start justify-between gap-2 mb-3">
                                        <p className="text-[13px] font-semibold leading-snug" style={{ color: palette.ink }}>{m.plain}</p>
                                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0" style={{ background: tone.bg, color: tone.fg }}>
                                          {tone.label}
                                        </span>
                                      </div>
                                      <p className="text-[34px] font-semibold leading-none tabular-nums" style={{ color: palette.ink }}>{m.value}</p>
                                      <p className="text-[11px] mt-2" style={{ color: palette.faint }}>{m.term}</p>
                                    </article>
                                  );
                                })}
                              </div>

                              <div className="rounded-[14px] p-4 space-y-3" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold" style={{ color: palette.ink }}>Delkarakterer</p>
                                  <span className="text-xs" style={{ color: palette.muted }}>0–100</span>
                                </div>
                                {[
                                  { label: 'Fart', value: Math.round(perfMobile ?? 0) },
                                  { label: 'Synlig for Google (SEO)', value: Math.round(seoMobile ?? 0) },
                                  { label: 'Teknisk kvalitet', value: Math.round(bpMobile ?? 0) },
                                  { label: 'Tilgjengelighet', value: Math.round(a11yMobile ?? 0) },
                                ].map((row, i) => {
                                  const tone = tonePill(scoreTone(row.value));
                                  return (
                                    <div key={i} className="space-y-1">
                                      <div className="flex items-center justify-between gap-2 text-sm">
                                        <span style={{ color: palette.ink }}>{row.label}</span>
                                        <div className="inline-flex items-center gap-2">
                                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                                            {tone.label}
                                          </span>
                                          <span className="font-semibold tabular-nums" style={{ color: palette.ink }}>{row.value}</span>
                                        </div>
                                      </div>
                                      <div className="h-2 rounded-full overflow-hidden" style={{ background: palette.hair }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${row.value}%`, background: scoreTone(row.value) === 'good' ? palette.success : scoreTone(row.value) === 'warn' ? palette.warn : palette.danger }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="rounded-[14px] p-4" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <p className="text-sm font-semibold" style={{ color: palette.ink }}>Ting du kan forbedre</p>
                                    <span className="text-xs" style={{ color: palette.muted }}>Trykk for å løse i Verkstedet</span>
                                  </div>

                                  {(analysisResults.mobile.opportunities || []).length === 0 ? (
                                    <p className="text-sm" style={{ color: palette.muted }}>Ingen konkrete forslag funnet i siste kjøring.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {analysisResults.mobile.opportunities.slice(0, 6).map((o: any, i: number) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => {
                                            setActiveSolveProblem({ raw: o, title: o.title });
                                            setActiveTab('workshop');
                                            setExpandedWorkshopProblem(`ps-${o.title}`);
                                          }}
                                          className="w-full rounded-[10px] px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors hover:bg-[color:var(--subtle)]"
                                          style={{ border: `1px solid ${palette.border}` }}
                                        >
                                          <span className="inline-flex items-start gap-2 min-w-0">
                                            <AlertTriangle size={13} style={{ color: palette.warn }} className="shrink-0 mt-0.5" />
                                            <span className="min-w-0">
                                              <span className="block text-sm font-medium truncate" style={{ color: palette.ink }}>{o.title}</span>
                                              {o.savings ? <span className="block text-xs" style={{ color: palette.muted }}>{o.savings}</span> : null}
                                            </span>
                                          </span>
                                          <ArrowRight size={14} style={{ color: palette.muted }} className="shrink-0" />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-[14px] p-4" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <p className="text-sm font-semibold" style={{ color: palette.ink }}>Utvikling over tid</p>
                                    <div className="text-xs flex items-center gap-3" style={{ color: palette.muted }}>
                                      <span className="inline-flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ background: palette.success }} />
                                        Fart
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ background: palette.ink }} />
                                        SEO
                                      </span>
                                    </div>
                                  </div>

                                  {scoreHistory.length < 2 ? (
                                    <p className="text-sm" style={{ color: palette.muted }}>Grafen vises når du har minst to målepunkter.</p>
                                  ) : (
                                    <div className="h-52">
                                      <React.Suspense fallback={<div className="w-full h-full" />}>
                                        <LazyScoreHistoryChart scoreHistory={scoreHistory} palette={palette} />
                                      </React.Suspense>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </section>

                        {/* ── INNHOLD ───────────────────────────────────── */}
                        <section>
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <SectionTitle size="sm">Innhold</SectionTitle>
                            <span className="text-xs" style={{ color: contentCriticalCount > 0 ? palette.danger : palette.muted }}>
                              {contentPages.length} sider · {contentCriticalCount} kritiske
                            </span>
                          </div>

                          {contentPages.length === 0 ? (
                            <Note tone="neutral">
                              Trykk «Oppdater» øverst, så går vi gjennom sidene for tittel, beskrivelse, overskrifter og alt-tekster.
                            </Note>
                          ) : (
                            <div className="rounded-[14px] overflow-hidden" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[680px]">
                                  <thead>
                                    <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
                                      <th className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3" style={{ color: palette.muted }}>Side</th>
                                      <th className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3" style={{ color: palette.muted }}>Adresse</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3" style={{ color: palette.muted }}>Funn</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {contentPages.slice(0, 30).map((p: any, i: number) => {
                                      const issues = (p.issues || []).length;
                                      const critical = p?.status === 'Kritisk' || issues >= 3;
                                      return (
                                        <tr key={i} className="transition-colors hover:bg-[color:var(--subtle)]" style={{ borderTop: i === 0 ? 'none' : `1px solid ${palette.hair}` }}>
                                          <td className="px-4 py-3.5 text-sm font-medium" style={{ color: palette.ink }}>{p.title || p.url}</td>
                                          <td className="px-4 py-3.5 text-[13px] font-mono" style={{ color: palette.muted }}>{p.url}</td>
                                          <td className="px-4 py-3.5 text-right">
                                            <span
                                              className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
                                              style={{
                                                background: issues === 0 ? palette.successBg : critical ? palette.dangerBg : palette.warnBg,
                                                color: issues === 0 ? palette.success : critical ? palette.danger : palette.warn,
                                              }}
                                            >
                                              {issues === 0 ? 'Alt bra' : `${issues} funn`}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </section>

                        {/* ── LENKER ────────────────────────────────────── */}
                        <section>
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <SectionTitle size="sm">Lenker</SectionTitle>
                            <span className="text-xs" style={{ color: linksIsolatedCount > 0 ? palette.warn : palette.muted }}>
                              {linkPages.length} sider · {linksIsolatedCount} isolert
                            </span>
                          </div>

                          {linkPages.length === 0 ? (
                            <Note tone="neutral">
                              Trykk «Oppdater» øverst, så kartlegger vi hvordan sidene lenker til hverandre.
                            </Note>
                          ) : (
                            <div className="rounded-[14px] overflow-hidden" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[680px]">
                                  <thead>
                                    <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
                                      <th className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3" style={{ color: palette.muted }}>Side</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3" style={{ color: palette.muted }}>Lenker inn</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3" style={{ color: palette.muted }}>Lenker ut</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3" style={{ color: palette.muted }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {linkPages.slice(0, 30).map((p: any, i: number) => {
                                      const brokenCount = Array.isArray(p.brokenLinks) ? p.brokenLinks.length : Number(p.brokenLinks || 0);
                                      const isolated = p?.status === 'Isolert' || p?.inlinks === 0 || p?.isolated;
                                      const statusText = isolated ? 'Isolert' : brokenCount > 0 ? `${brokenCount} brutte` : 'Bra';
                                      const statusTone = isolated ? 'warn' : brokenCount > 0 ? 'bad' : 'good';
                                      const tone = tonePill(statusTone);
                                      return (
                                        <tr key={i} className="transition-colors hover:bg-[color:var(--subtle)]" style={{ borderTop: i === 0 ? 'none' : `1px solid ${palette.hair}` }}>
                                          <td className="px-4 py-3.5 text-sm font-medium" style={{ color: palette.ink }}>{p.title || p.url}</td>
                                          <td className="px-4 py-3.5 text-sm text-right tabular-nums" style={{ color: palette.ink }}>{p.inlinks ?? 0}</td>
                                          <td className="px-4 py-3.5 text-sm text-right tabular-nums" style={{ color: palette.ink }}>{p.outlinks ?? 0}</td>
                                          <td className="px-4 py-3.5 text-right">
                                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                                              {statusText}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </section>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* SOKEORD — egen fane.                                            */}
        {/* =============================================================== */}
        {activeTab === 'keywords' && (
          <div key={activeTab} className="space-y-6 font-['Geist','DM_Sans',sans-serif]">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: 'var(--ink)', fontFamily: SERIF }}>Søkeord</h1>
                <p className="text-base mt-3" style={{ color: 'var(--muted)' }}>
                  Ordene folk finner deg på i Google — og hvordan du ligger an.
                </p>
              </div>
              {keywordsToTrack.length > 0 && (
                <button
                  onClick={handleCheckRankings}
                  disabled={rankingLoading}
                  className="inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-[10px] transition-transform active:scale-[0.97] disabled:opacity-60"
                  style={{ background: 'var(--btn-bg)', color: '#fff' }}
                >
                  <Search size={14} className={rankingLoading ? 'animate-pulse' : ''} />
                  {rankingLoading ? 'Sjekker…' : 'Sjekk plassering nå'}
                </button>
              )}
            </header>
            <div className={`${tabFadeInClass} space-y-6`}>

            {/* GSC connection banner */}
            {!gscConnected && (
              <div className="rounded-[14px] p-4 flex items-center gap-4 justify-between flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--hair)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--subtle)' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Følg dine egne søkeord nå — uten Google-tilkobling</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Legg dem til nedenfor, så måler vi Google-plasseringen din med en gang. Koble til Google (valgfritt) for å få flere søkeord foreslått automatisk.</p>
                  </div>
                </div>
                {!showGscPreCheck ? (
                  <button
                    onClick={() => setShowGscPreCheck(true)}
                    className="shrink-0 inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-[10px] transition-transform active:scale-[0.97]"
                    style={{ background: 'var(--btn-bg)', color: '#fff' }}
                  >
                    Koble til (valgfritt)
                  </button>
                ) : (
                  <GscPreCheck onConfirm={handleConnectGsc} onCancel={() => setShowGscPreCheck(false)} theme={themed} />
                )}
              </div>
            )}

            {/* Sammendrag-stripe: svaret før detaljene */}
            {(() => {
              const positions = [
                ...gscKeywords.map((k: any) => k.position).filter((p: any) => p != null),
                ...realRankings.map((r: any) => r.position).filter((p: any) => p != null),
              ] as number[];
              const totalTracked = gscKeywords.length + keywordsToTrack.length;
              if (totalTracked === 0) return null;
              const onPage1 = positions.filter((p) => p <= 10).length;
              const avg = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
              const changes = realRankings.map((r: any) => r.change).filter((c: any) => c != null) as number[];
              const avgTrend = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
              const items: { label: string; value: string; trend?: number | null }[] = [
                { label: 'Søkeord du følger', value: String(totalTracked) },
                { label: 'På side 1 av Google', value: positions.length ? String(onPage1) : '—' },
                { label: 'Snittplassering', value: avg != null ? avg.toFixed(1) : '—', trend: avgTrend },
              ];
              return (
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {items.map((it) => (
                    <div key={it.label} className="rounded-[14px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--hair)' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted)' }}>{it.label}</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-[30px] font-semibold leading-none tabular-nums" style={{ color: 'var(--ink)' }}>{it.value}</span>
                        {it.trend != null && it.trend !== 0 && (
                          <span className="text-xs font-semibold tabular-nums" style={{ color: it.trend > 0 ? '#15795A' : '#B4231F' }}>
                            {it.trend > 0 ? '▲' : '▼'}{Math.abs(it.trend).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })()}

            {/* Two-panel keyword layout */}
            {(() => {
              const combinedList: Array<{
                id: string; keyword: string; source: 'gsc' | 'tracked';
                location?: string; position: number | null; change: number | null;
                clicks?: number; impressions?: number; ctr?: number;
                kd?: number | null; intent?: string | null; competition?: number | null; volume?: string | null;
                history: any[]; url?: string | null; competitors?: any[];
              }> = [
                ...gscKeywords.map((kw: any) => ({
                  id: `gsc-${kw.keyword}`,
                  keyword: kw.keyword,
                  source: 'gsc' as const,
                  position: kw.position != null ? parseFloat(kw.position.toFixed(1)) : null,
                  change: null,
                  clicks: kw.clicks,
                  impressions: kw.impressions,
                  ctr: kw.ctr,
                  history: [],
                })),
                ...keywordsToTrack.map((k: any) => {
                  const r = realRankings.find((r: any) => r.keyword === k.keyword && r.location === k.location);
                  return {
                    id: `tracked-${k.keyword}-${k.location}`,
                    keyword: k.keyword,
                    location: k.location,
                    source: 'tracked' as const,
                    position: r?.position ?? null,
                    change: r?.change ?? null,
                    kd: r?.kd ?? null,
                    intent: r?.intent ?? null,
                    competition: r?.competition ?? null,
                    volume: r?.volume ?? null,
                    history: r?.history ?? [],
                    url: r?.url ?? null,
                    competitors: r?.competitors ?? [],
                  };
                }),
              ];

              const filtered = combinedList.filter(kw => {
                if (kwFilter === 'mine' && kw.source !== 'tracked') return false;
                if (kwFilter === 'gsc' && kw.source !== 'gsc') return false;
                if (kwSearch && !kw.keyword.toLowerCase().includes(kwSearch.toLowerCase())) return false;
                return true;
              });

              const selected = selectedKwId ? combinedList.find(k => k.id === selectedKwId) ?? null : null;

              const chartData = (() => {
                if (!selected?.history?.length) return [];
                const days = kwChartRange === '28d' ? 28 : kwChartRange === '90d' ? 90 : 365;
                return selected.history.slice(-Math.min(days, selected.history.length));
              })();

              return (
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* LEFT: keyword list */}
                  <div className="flex flex-col gap-3 shrink-0 w-full lg:w-[280px]">
                    {/* Search */}
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
                      <input
                        type="text"
                        value={kwSearch}
                        onChange={e => setKwSearch(e.target.value)}
                        placeholder={`Søk i ${combinedList.length} søkeord…`}
                        className="w-full rounded-[10px] pl-8 pr-3 py-2 text-sm outline-none focus:border-[color:var(--ink)] transition-colors"
                        style={{ background: 'var(--surface)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
                      />
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-1.5">
                      {(['all', 'mine', 'gsc'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setKwFilter(f)}
                          className="flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors"
                          style={{
                            background: kwFilter === f ? '#1A1A1A' : '#F2EFE8',
                            color: kwFilter === f ? '#fff' : '#8A8578',
                          }}
                        >
                          {f === 'all' ? 'Alle' : f === 'mine' ? 'Egne' : 'Google'}
                        </button>
                      ))}
                    </div>

                    {/* Keyword list */}
                    <div className="flex-1 overflow-y-auto rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--hair)', maxHeight: 420 }}>
                      {filtered.length === 0 ? (
                        <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                          {kwSearch
                            ? 'Ingen treff på søket — prøv et annet ord'
                            : gscConnected
                              ? 'Google sender flere søkeord fortløpende — typisk 1–2 uker etter tilkobling. Vi sier fra når listen fylles.'
                              : 'Legg til søkeordene du vil følge nedenfor — vi måler Google-plasseringen ved første sjekk. Kobler du til Google senere, fyller vi på med flere automatisk.'}
                        </div>
                      ) : (
                        <ul>
                          {filtered.map((kw, i) => {
                            const isSelected = selectedKwId === kw.id;
                            const posUp = kw.change !== null && kw.change > 0;
                            const posDown = kw.change !== null && kw.change < 0;
                            return (
                              <li
                                key={kw.id}
                                onClick={() => setSelectedKwId(isSelected ? null : kw.id)}
                                className="px-3 py-2.5 cursor-pointer"
                                style={{
                                  background: isSelected ? '#FAF8F3' : 'transparent',
                                  borderBottom: i < filtered.length - 1 ? '1px solid var(--hair)' : 'none',
                                  borderLeft: isSelected ? '3px solid #1A1A1A' : '3px solid transparent',
                                  transition: 'background 150ms ease-out',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{kw.keyword}</p>
                                  <div className="flex items-center gap-1 shrink-0 tabular-nums">
                                    {kw.position !== null && (() => {
                                      const p = kw.position as number;
                                      const label = kw.source === 'gsc' ? p.toFixed(1) : p >= 301 ? '300+' : `#${p}`;
                                      const c = p <= 3 ? '#15795A' : p <= 10 ? '#3F7D33' : p <= 20 ? '#9A6700' : '#8A8578';
                                      const bg = p <= 3 ? '#E8F1EB' : p <= 10 ? '#EEF4E9' : p <= 20 ? '#F6EEDD' : '#F2EFE8';
                                      return (
                                        <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ color: c, background: bg }}>{label}</span>
                                      );
                                    })()}
                                    {posUp && <span className="text-[11px] font-semibold" style={{ color: 'var(--green)' }}>▲{Math.abs(kw.change as number).toFixed(1)}</span>}
                                    {posDown && <span className="text-[11px] font-semibold" style={{ color: 'var(--danger)' }}>▼{Math.abs(kw.change as number).toFixed(1)}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
                                  >
                                    {kw.source === 'gsc' ? 'Google' : 'Egen'}
                                  </span>
                                  {kw.location && (
                                    <span className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{kw.location}</span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Add keyword */}
                    <div className="rounded-[14px] p-3" style={{ background: 'var(--surface)', border: '1px solid var(--hair)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--ink)' }}>Legg til søkeord</p>
                      {canAddMoreKeywords ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={newKeywordInput}
                            onChange={e => setNewKeywordInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                            placeholder="f.eks. rørlegger oslo"
                            className="w-full rounded-[10px] px-3 py-2 text-xs outline-none"
                            style={{ background: 'var(--subtle)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={locationInput}
                              onChange={e => setLocationInput(e.target.value)}
                              placeholder="Sted"
                              className="flex-1 rounded-[10px] px-3 py-2 text-xs outline-none min-w-0"
                              style={{ background: 'var(--subtle)', border: '1px solid var(--hair)', color: 'var(--ink)' }}
                            />
                            <button
                              onClick={handleAddKeyword}
                              className="px-3 py-2 rounded-[10px] text-xs font-semibold transition-transform active:scale-[0.97] shrink-0 flex items-center justify-center"
                              style={{ background: 'var(--btn-bg)', color: '#fff' }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                            {keywordsToTrack.length}/{keywordLimit} søkeord brukt
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          Grensen på {keywordLimit} søkeord er nådd.{' '}
                          <button onClick={() => handleUpgrade()} className="underline font-medium" style={{ color: 'var(--ink)' }}>
                            Oppgrader
                          </button>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: detail panel */}
                  <div className="flex-1 min-w-0 rounded-[14px] overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--hair)' }}>
                    {!selected ? (
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center" style={{ minHeight: 400 }}>
                        <BarChart3 size={36} style={{ color: '#D8D2C5', marginBottom: 12 }} />
                        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>Velg et søkeord</p>
                        <p className="text-xs max-w-xs" style={{ color: 'var(--muted)' }}>
                          Klikk på et søkeord i listen for å se plassering, graf og hva som har skjedd.
                        </p>
                      </div>
                    ) : (
                      <div className="p-5 flex flex-col gap-5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>{selected.keyword}</h2>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                              {selected.source === 'gsc'
                                ? `Fra Google · ${gscKeywords.length} søkeord hentet`
                                : `${selected.location} · Egen sporing${selected.history.length > 0 ? ` · ${selected.history.length} målinger` : ''}`}
                            </p>
                          </div>
                          {selected.source === 'tracked' && (
                            <button
                              onClick={() => { handleRemoveKeyword(selected.keyword, selected.location!); setSelectedKwId(null); }}
                              className="text-xs transition-colors shrink-0 hover:underline"
                              style={{ color: 'var(--muted)' }}
                            >
                              Fjern
                            </button>
                          )}
                        </div>

                        {/* Stat cards */}
                        {(() => {
                          const overCap = selected.source === 'tracked' && selected.position != null && (selected.position as number) >= 301;
                          const posLabel = selected.position == null
                            ? '—'
                            : selected.source === 'gsc'
                              ? (selected.position as number).toFixed(1)
                              : overCap ? '300+' : `#${selected.position}`;
                          const fmtCompact = (n: number) =>
                            n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} mill`
                              : n >= 10_000 ? `${Math.round(n / 1000)} k`
                                : n.toLocaleString('no-NO');

                          const stats: { label: string; value: string; delta?: number | null; hint?: string }[] =
                            selected.source === 'gsc'
                              ? [
                                { label: 'Snittplassering', value: posLabel, delta: selected.change },
                                { label: 'Klikk', value: selected.clicks != null ? (selected.clicks as number).toLocaleString('no-NO') : '—' },
                                { label: 'Vist i søk', value: selected.impressions != null ? (selected.impressions as number).toLocaleString('no-NO') : '—' },
                                { label: 'Andel som klikker', value: selected.ctr != null ? `${((selected.ctr as number) * 100).toFixed(1)} %` : '—' },
                              ]
                              : [
                                { label: 'Plassering på Google', value: posLabel, delta: selected.change, hint: overCap ? 'Ikke i topp 300' : undefined },
                                { label: 'Konkurranse', value: selected.competition != null ? fmtCompact(selected.competition as number) : '—', hint: selected.competition != null ? 'treff i Google' : undefined },
                                { label: 'Vanskelighetsgrad', value: selected.kd != null ? `${selected.kd}` : '—', hint: selected.kd != null ? 'av 100' : undefined },
                                { label: 'Søkeintensjon', value: (selected.intent as string) || '—' },
                              ];
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {stats.map(stat => {
                                const positive = (stat.delta ?? 0) > 0;
                                return (
                                  <div key={stat.label} className="rounded-[12px] p-3.5" style={{ background: 'var(--subtle)', border: '1px solid var(--hair)' }}>
                                    <p className="text-[11px] font-medium mb-1.5 leading-snug" style={{ color: 'var(--muted)' }}>{stat.label}</p>
                                    <p className="text-[26px] font-semibold leading-none tabular-nums truncate" style={{ color: 'var(--ink)' }}>{stat.value}</p>
                                    {stat.delta != null && stat.delta !== 0 && (
                                      <p className="text-xs font-semibold mt-1.5 tabular-nums" style={{ color: positive ? '#15795A' : '#B4231F' }}>
                                        {positive ? '▲' : '▼'}{Math.abs(stat.delta as number).toFixed(1)}
                                      </p>
                                    )}
                                    {stat.hint && (stat.delta == null || stat.delta === 0) && (
                                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--faint)' }}>{stat.hint}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {selected.source === 'gsc' && selected.clicks == null && (
                          <p className="-mt-2 text-xs" style={{ color: 'var(--muted)' }}>Klikk, visninger og andel kommer 1–2 uker etter at Google er koblet til.</p>
                        )}

                        {/* Position chart */}
                        {chartData.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Plassering over tid</p>
                              <div className="flex gap-1">
                                {(['28d', '90d', '12mnd'] as const).map(r => (
                                  <button
                                    key={r}
                                    onClick={() => setKwChartRange(r)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                                    style={{
                                      background: kwChartRange === r ? '#1A1A1A' : '#F2EFE8',
                                      color: kwChartRange === r ? '#fff' : '#8A8578',
                                    }}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{ height: 176 }}>
                              <React.Suspense fallback={<div className="w-full h-full" />}>
                                <LazyKeywordRankChart data={chartData} />
                              </React.Suspense>
                            </div>
                          </div>
                        ) : selected.source === 'tracked' ? (
                          <div className="rounded-[12px] p-5 text-center" style={{ background: 'var(--subtle)' }}>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>Kjør «Sjekk plassering nå» for å se historikk her.</p>
                          </div>
                        ) : null}

                        {/* Bottom: landing pages + event log */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Landing pages */}
                          <div className="rounded-[12px] p-4" style={{ border: '1px solid var(--hair)' }}>
                            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>Hvilken side vises i Google</p>
                            {selected.source === 'tracked' && selected.url ? (
                              <div>
                                <div className="grid grid-cols-[1fr_auto] gap-x-3 pb-1.5 mb-1.5" style={{ borderBottom: '1px solid var(--hair)' }}>
                                  <p className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Side</p>
                                  <p className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Plass</p>
                                </div>
                                <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center py-1.5">
                                  <a
                                    href={selected.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs truncate hover:underline"
                                    style={{ color: 'var(--green)' }}
                                  >
                                    {(selected.url as string).replace(/^https?:\/\/[^/]+/, '') || '/'}
                                  </a>
                                  <span className="text-xs font-semibold tabular-nums text-right" style={{ color: 'var(--ink)' }}>
                                    {selected.position == null ? '—' : (selected.position as number) >= 301 ? '300+' : `#${selected.position}`}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                                {selected.source === 'gsc'
                                  ? 'Vises ikke via Google-koblingen ennå.'
                                  : 'Kjør «Sjekk plassering nå» for å finne siden.'}
                              </p>
                            )}
                          </div>

                          {/* Event log */}
                          <div className="rounded-[12px] p-4" style={{ border: '1px solid var(--hair)' }}>
                            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>Hva har skjedd</p>
                            {(() => {
                              const events: Array<{ text: string; sub?: string }> = [];
                              if (selected.source === 'tracked') {
                                if (selected.history.length >= 2) {
                                  const first = selected.history[0];
                                  const last = selected.history[selected.history.length - 1];
                                  if (first.rank !== last.rank) {
                                    events.push({
                                      text: `Plassering ${first.rank > last.rank ? 'forbedret' : 'svekket'} fra ${first.rank} → ${last.rank}`,
                                      sub: last.date,
                                    });
                                  }
                                }
                                if (selected.history.length > 0) {
                                  events.push({ text: 'Første plassering sjekket', sub: selected.history[0].date });
                                }
                                events.push({ text: 'Ord lagt til manuelt', sub: selected.location });
                              } else {
                                if (selected.position != null) {
                                  events.push({ text: `Snittplassering ${(selected.position as number).toFixed(1)}`, sub: 'Siste 28 dager' });
                                }
                                if (selected.clicks) {
                                  events.push({ text: `${(selected.clicks as number).toLocaleString('no-NO')} klikk fra Google-søk`, sub: 'Siste 28 dager' });
                                }
                                events.push({ text: 'Hentet fra Google', sub: '' });
                              }
                              if (!events.length) {
                                return <p className="text-xs" style={{ color: 'var(--muted)' }}>Sikt jobber i bakgrunnen — det første dukker opp her etter neste sjekk.</p>;
                              }
                              return (
                                <ul className="space-y-2.5">
                                  {events.map((ev, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#15795A' }} />
                                      <div>
                                        <p className="text-xs" style={{ color: 'var(--ink)' }}>{ev.text}</p>
                                        {ev.sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>{ev.sub}</p>}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Topp-resultater i Google (SERP-konkurrenter) */}
                        {selected.source === 'tracked' && selected.competitors && selected.competitors.length > 0 && (
                          <div className="rounded-[12px] p-4" style={{ border: '1px solid var(--hair)' }}>
                            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>Hvem ligger øverst i Google</p>
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 pb-1.5 mb-1" style={{ borderBottom: '1px solid var(--hair)' }}>
                              <p className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Plass</p>
                              <p className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Resultat</p>
                            </div>
                            <ul>
                              {selected.competitors.slice(0, 5).map((c: any, i: number) => {
                                const host = (() => { try { return new URL(c.url).hostname.replace(/^www\./, ''); } catch { return c.url; } })();
                                const count = Math.min(5, selected.competitors!.length);
                                return (
                                  <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 items-start py-2" style={{ borderBottom: i < count - 1 ? '1px solid var(--hair)' : 'none' }}>
                                    <span className="text-xs font-semibold tabular-nums mt-0.5" style={{ color: 'var(--ink)' }}>#{c.position}</span>
                                    <div className="min-w-0">
                                      <a href={c.url} target="_blank" rel="noreferrer" className="text-xs font-medium truncate block hover:underline" style={{ color: 'var(--ink)' }}>{c.title || host}</a>
                                      <span className="text-[10px] truncate block" style={{ color: 'var(--muted)' }}>{host}</span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Position distribution */}
            {realRankings.length > 0 && (
              <div className="rounded-[14px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--hair)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>Hvor du ligger på Google</p>
                <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Antall søkeord i hvert plasserings-sjikt.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {positionBuckets.map((b) => (
                    <div key={b.name} className="rounded-[12px] p-3" style={{ background: 'var(--subtle)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.fill }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{b.name}</p>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{b.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ height: 112 }}>
                  <React.Suspense fallback={<div className="w-full h-full" />}>
                    <LazyPositionBucketsChart data={positionBuckets} />
                  </React.Suspense>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* KONKURRENTER — KonkurrenterPage (egen komponent)              */}
        {/* =============================================================== */}
        {activeTab === 'competitors' && (
          <div key={activeTab} className="space-y-6">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: 'var(--ink)', fontFamily: SERIF }}>Konkurrenter</h1>
                <p className={`text-base mt-3 ${textDim}`}>Følg konkurrentene dine og oppdag åpne muligheter.</p>
              </div>
            </header>
            <div className={tabFadeInClass}>
              <KonkurrenterPage
                user={user}
                theme={themed}
                hasStandardOrHigher={hasStandardOrHigher}
                hasPremium={hasPremium}
                onUpgrade={handleUpgrade}
              />
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* AI-SYNLIGHET (GEO) — alltid synlig */}
        {/* =============================================================== */}
        {activeTab === 'geo' && (
          <div key={activeTab} className="space-y-6 font-['Geist','DM_Sans',sans-serif]">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: 'var(--ink)', fontFamily: SERIF }}>AI-synlighet</h1>
                <p className="text-base mt-3" style={{ color: 'var(--muted)' }}>Om bedriften din nevnes når kunder spør ChatGPT, Gemini og Perplexity.</p>
              </div>
            </header>
            <div className={`${tabFadeInClass} space-y-6`}>
              {hasPremium && (geoState?.geo_score != null || geoFaqs.length > 0) && (
                <div className="rounded-[16px] p-5 sm:p-6" style={{ background: 'var(--surface)', border: '1px solid var(--hair)' }}>
                  {geoState?.geo_score != null && (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted)' }}>AI-synlighet (GEO-score)</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums" style={{ color: 'var(--ink)' }}>{Number(geoState.geo_score)}</span>
                          <span className="text-base" style={{ color: 'var(--faint)' }}>/100</span>
                        </div>
                      </div>
                      <div className="text-[12px] space-y-1 text-right" style={{ color: 'var(--ink)' }}>
                        <p>{geoState.llms_published_at ? '✓ AI-fil publisert' : '— AI-fil ikke publisert ennå'} <span style={{ color: 'var(--faint)' }}>(llms.txt)</span></p>
                        <p>{geoState.schema_published_at ? '✓ FAQ for AI publisert' : '— FAQ for AI ikke publisert ennå'} <span style={{ color: 'var(--faint)' }}>(FAQ-schema)</span></p>
                      </div>
                    </div>
                  )}

                  {geoFaqs.length > 0 && (
                    <div className={geoState?.geo_score != null ? 'mt-5 pt-5 border-t' : ''} style={geoState?.geo_score != null ? { borderColor: 'var(--hair)' } : undefined}>
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Godkjenn svar Sikt foreslår</p>
                      <p className="text-[12px] mt-1 mb-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
                        For spørsmål der AI-ene ikke nevnte deg. Godkjente svar legges i filene som hjelper ChatGPT, Gemini og Perplexity å sitere deg.
                      </p>
                      <div className="space-y-3">
                        {geoFaqs.map((f) => (
                          <div key={f.id} className="rounded-[12px] border p-4" style={{ borderColor: 'var(--hair)', background: 'var(--subtle)' }}>
                            <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{f.question}</p>
                            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'var(--ink)' }}>{f.answer}</p>
                            <div className="flex items-center gap-3 mt-3">
                              <button
                                type="button"
                                disabled={geoFaqBusyId === f.id}
                                onClick={() => resolveGeoFaq(f.id, true)}
                                className="inline-flex items-center gap-1.5 rounded-[10px] text-white px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50 transition-colors"
                                style={{ background: 'var(--btn-bg)' }}
                              >
                                <CheckCircle2 size={13} /> Godkjenn og publiser
                              </button>
                              <button
                                type="button"
                                disabled={geoFaqBusyId === f.id}
                                onClick={() => resolveGeoFaq(f.id, false)}
                                className="text-[12px] font-semibold disabled:opacity-50"
                                style={{ color: 'var(--muted)' }}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <GeoPage onNotify={() => toastInfo('Vi sier fra når automatisk GEO-sporing åpner for betatest.')} />
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* ANMELDELSER — review-motor (Fase 1)                             */}
        {/* =============================================================== */}
        {activeTab === 'reviews' && (
          <div key={activeTab} className="space-y-6 font-['Geist','DM_Sans',sans-serif]">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: 'var(--ink)', fontFamily: SERIF }}>Anmeldelser</h1>
                <p className="text-base mt-3" style={{ color: 'var(--muted)' }}>Få flere fornøyde kunder til å si det offentlig — det løfter både Google og telefonen.</p>
              </div>
            </header>
            <div className={`${tabFadeInClass}`}>
              <ReviewsPage
                user={user}
                companyName={clientData?.companyName}
                hasStandardOrHigher={hasStandardOrHigher}
                onUpgrade={handleUpgrade}
              />
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* VERKSTED — liste-view, ekspander inline for AI-løsning.         */}
        {/* =============================================================== */}
        {activeTab === 'workshop' && (() => {
          const workshopKinds: TodoKind[] = ['pagespeed', 'content-page', 'keyword'];
          const problems = todos
            .filter((t) => workshopKinds.includes(t.kind))
            .map((todo) => ({
              id: todo.id,
              kind: todo.kind,
              title: todo.title,
              desc: todo.desc,
              raw: todo.raw,
              status: todo.status ?? 'open',
              pageUrl: todo.pageUrl,
              pageTitle: todo.pageTitle,
              changeId: todo.changeId,
              changeData: todo.changeData,
            }));
          // Ett kildested: alias til PORTAL (ingen duplisert hex).
          const W = {
            bg: PORTAL.bg, card: PORTAL.card, ink: PORTAL.ink, green: PORTAL.success,
            muted: PORTAL.muted, border: PORTAL.border, sub: PORTAL.sub, faint: PORTAL.faint,
            hair: PORTAL.hair, subtle: PORTAL.subtle,
          } as const;
          const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
          const pressDown = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.97)'; };
          const pressReset = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; };
          const filteredProblems =
            (workshopFilter === 'all' ? problems :
              workshopFilter === 'open' ? problems.filter((p) => p.status !== 'solved') :
              problems.filter((p) => p.status === 'solved'))
              .filter((p) => {
                const q = workshopQuery.trim().toLowerCase();
                if (!q) return true;
                return `${p.title} ${p.desc} ${p.raw?.description || ''}`.toLowerCase().includes(q);
              });
          const selectedProblem =
            problems.find((p) => p.id === expandedWorkshopProblem) ||
            filteredProblems[0] ||
            problems[0] ||
            null;
          const selectedIndex = selectedProblem ? problems.findIndex((p) => p.id === selectedProblem.id) : -1;
          const openCount = problems.filter((p) => p.status !== 'solved').length;
          const doneCount = problems.filter((p) => p.status === 'solved').length;
          const latestScore = scoreHistory[scoreHistory.length - 1];
          const analyzedLabel = latestScore?.at
            ? new Date(latestScore.at).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : (analysisResults ? 'Siste analyse' : 'Ikke analysert');
          const siteLabel = websiteUrl
            ? websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
            : 'Ingen nettside';
          const copyTicket = () => {
            if (!selectedProblem) return;
            const text = [
              `Funn: ${selectedProblem.title}`,
              `Beskrivelse: ${selectedProblem.raw?.description || selectedProblem.desc}`,
              `Besparelse: ${selectedProblem.raw?.savings || 'Ikke oppgitt av Lighthouse'}`,
              `Kilde: Google Lighthouse / PageSpeed mobil`,
            ].join('\n');
            navigator.clipboard?.writeText(text);
            toastSuccess('Kopiert som ticket.');
          };
          const selectProblem = (p: typeof problems[number]) => {
            setExpandedWorkshopProblem(p.id);
            if (p.kind === 'content-page') {
              setActiveSolveProblem(null);
              setAiSolution(null);
              setAiIsThinking(false);
            } else {
              setActiveSolveProblem({ raw: p.raw, title: p.title });
            }
          };
          const contentFixReady =
            selectedProblem?.kind === 'content-page' &&
            contentFixActive.todoId === selectedProblem.id;
          const contentFixEntry = contentFixReady ? contentFixCache[selectedProblem.id] : undefined;
          const contentFixLoading = !contentFixReady
            ? 'fetching'
            : contentFixActive.loading === 'idle' &&
                !contentFixEntry?.pageData &&
                !contentFixActive.error
              ? 'fetching'
              : contentFixActive.loading;
          const showYoastMissingNote =
            contentFixReady &&
            contentFixEntry?.pageData &&
            contentFixEntry.pageData.yoast?.installed === false &&
            (contentFixEntry.fieldType === 'meta-description' || contentFixEntry.fieldType === 'seo-title');
          // Push (auto-fiks) kun for WordPress-full. Alle andre (rådgiver-plattformer
          // OG ikke-tilkoblede) får kopier-og-lim-inn-handlinger i stedet.
          const showPushPlaceholder =
            hostIsFullyConnected &&
            contentFixReady &&
            contentFixEntry?.pageData &&
            (contentFixEntry.fieldType === 'content' ||
              contentFixEntry.fieldType === 'h1' ||
              (contentFixEntry.pageData.yoast?.installed === true &&
                (contentFixEntry.fieldType === 'meta-description' ||
                  contentFixEntry.fieldType === 'seo-title')));
          const showWixAdvisoryActions =
            !hostIsFullyConnected &&
            contentFixReady &&
            contentFixEntry?.pageData &&
            contentFixEntry.fieldType;
          const goRelative = (delta: number) => {
            if (!problems.length) return;
            const current = selectedIndex >= 0 ? selectedIndex : 0;
            const next = Math.min(problems.length - 1, Math.max(0, current + delta));
            selectProblem(problems[next]);
          };

          return (
            <div key={activeTab} className="space-y-6 font-['Geist','DM_Sans',sans-serif]">
              <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: 'var(--ink)', fontFamily: SERIF }}>Verksted</h1>
                  <p className="text-base mt-3" style={{ color: 'var(--muted)' }}>Ting du kan fikse på nettsiden — med AI-hjelp.</p>
                </div>
              </header>
              <div className={`${tabFadeInClass} space-y-6`}>
              <ChangelogPanel
                changes={contentChanges}
                onRollback={(id) => executeContentFixRollback(id)}
                colors={W}
              />
              <style>{`
                @keyframes ws-fade-up {
                  from { opacity: 0; transform: translateY(6px); }
                  to   { opacity: 1; transform: translateY(0);   }
                }
                @media (prefers-reduced-motion: reduce) {
                  @keyframes ws-fade-up {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                  }
                }
                @keyframes ws-spin {
                  to { transform: rotate(360deg); }
                }
                @media (prefers-reduced-motion: reduce) {
                  .ws-content-spin { animation: none !important; }
                }
                .ws-content-diff-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 16px;
                }
                .ws-content-preview-stack {
                  display: grid;
                  grid-template-columns: 1fr;
                  gap: 12px;
                }
                @keyframes ws-snippet-fade {
                  from { opacity: 0; transform: translateY(4px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .ws-snippet-preview-enter {
                  animation: ws-snippet-fade 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
                }
                @media (prefers-reduced-motion: reduce) {
                  @keyframes ws-snippet-fade {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                  .ws-snippet-preview-enter {
                    animation-duration: 0ms;
                  }
                }
                @media (max-width: 768px) {
                  .ws-content-diff-grid { grid-template-columns: 1fr; }
                }
              `}</style>
              <div>

                {/* ── BODY (detalj = innrammet kort, oversikt = vanlig side) ── */}
                <div style={expandedWorkshopProblem !== null ? { border: `1px solid ${W.border}`, background: W.card, borderRadius: 16, overflow: 'hidden' } : undefined}>

                  {expandedWorkshopProblem === null ? (
                    /* ═══════════════════════════════════
                       SCREEN A — OVERSIKT
                       ═══════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>


                      {/* Sammendrag-kort */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                        {[
                          { label: 'Ting å fikse', value: problems.length, dim: false },
                          { label: 'Åpne', value: openCount, dim: false },
                          { label: 'Løst', value: doneCount, dim: doneCount === 0 },
                        ].map((s) => (
                          <div key={s.label} style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, padding: '16px 18px' }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: W.muted }}>{s.label}</p>
                            <p style={{ margin: '10px 0 0', fontSize: 30, fontWeight: 600, lineHeight: 1, color: s.dim ? W.faint : W.ink, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Søk */}
                      {problems.length > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 9, background: W.card, border: `1px solid ${W.border}`, borderRadius: 10, padding: '10px 14px', maxWidth: 420, transition: `border-color 160ms ${EASE}`, cursor: 'text' }}
                          onFocusCapture={e => (e.currentTarget.style.borderColor = W.ink)}
                          onBlurCapture={e => (e.currentTarget.style.borderColor = W.border)}
                        >
                          <Search size={15} style={{ color: W.muted, flexShrink: 0 }} />
                          <input
                            value={workshopQuery}
                            onChange={e => setWorkshopQuery(e.target.value)}
                            placeholder="Søk i ting å fikse…"
                            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: W.ink, fontSize: 14 }}
                          />
                        </label>
                      )}

                      {/* Filter tabs + list */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex' }}>
                            {([
                              { key: 'all'  as const, label: `Alle ${problems.length}` },
                              { key: 'open' as const, label: `Åpne ${openCount}` },
                              { key: 'done' as const, label: `Løste ${doneCount}` },
                            ]).map((tab) => {
                              const active = workshopFilter === tab.key;
                              return (
                                <button
                                  key={tab.key}
                                  type="button"
                                  onClick={() => setWorkshopFilter(tab.key)}
                                  style={{ background: 'none', border: 'none', padding: '10px 16px', fontSize: 14, fontWeight: active ? 600 : 400, color: active ? W.ink : W.muted, cursor: 'pointer', position: 'relative', transition: `color 160ms ${EASE}` }}
                                >
                                  {tab.label}
                                  {active && <span style={{ position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, background: W.ink, borderRadius: 2 }} />}
                                </button>
                              );
                            })}
                          </div>
                          <p style={{ margin: 0, color: W.muted, fontSize: 12 }}>Sortert etter gevinst</p>
                        </div>
                        <div style={{ height: 1, background: W.border }} />

                        {filteredProblems.length === 0 ? (
                          <div style={{ padding: '32px 0' }}>
                            <p style={{ margin: '0 0 8px', color: W.ink, fontSize: 16, fontWeight: 700 }}>
                              {problems.length === 0 ? 'Ingen aktive problemer' : 'Ingen problemer i dette filteret'}
                            </p>
                            <p style={{ margin: '0 0 16px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                              {problems.length === 0
                                ? 'Kjør en analyse under Synlighet → PageSpeed for å finne ting å fikse.'
                                : workshopQuery.trim()
                                  ? 'Ingen funn matcher søket. Tøm søket eller bytt filter.'
                                  : 'Bytt filter for å se andre problemer.'}
                            </p>
                            {workshopQuery.trim() && (
                              <button
                                type="button"
                                onClick={() => setWorkshopQuery('')}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                Tøm søk
                              </button>
                            )}
                          </div>
                        ) : (
                          filteredProblems.map((p, listIdx) => {
                            const num = String(problems.findIndex(x => x.id === p.id) + 1).padStart(2, '0');
                            return (
                              <div
                                key={p.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => selectProblem(p)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProblem(p); } }}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '36px 1fr auto',
                                  alignItems: 'center',
                                  gap: 16,
                                  padding: '18px 4px',
                                  borderBottom: `1px solid ${W.border}`,
                                  cursor: 'pointer',
                                  background: 'transparent',
                                  transition: `background 120ms ${EASE}`,
                                  animation: `ws-fade-up 220ms ${EASE} both`,
                                  animationDelay: `${listIdx * 40}ms`,
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(26,26,26,0.03)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                              >
                                <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted, fontWeight: 600 }}>{num}</span>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: W.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</p>
                                  <p style={{ margin: 0, fontSize: 12, color: p.raw?.savings ? W.green : W.muted }}>{p.desc}</p>
                                </div>
                                <p style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 13, fontWeight: 600, color: p.raw?.savings ? W.green : 'transparent', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{p.raw?.savings || '\u00a0'}</p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Tier teaser */}
                      {!hasStandardOrHigher && (
                        <div style={{ background: W.ink, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(21,121,90,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Sparkles size={16} style={{ color: '#6EE7B7' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ margin: '0 0 3px', color: '#fff', fontSize: 14, fontWeight: 700 }}>Lås opp AI-løsninger for alt du kan fikse</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Inkluderer automatisk re-analyse hver natt, søkeordsposisjon og konkurrent-sporing.</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600 }}>1 690 kr <span style={{ fontWeight: 400, fontSize: 11 }}>/mnd</span></p>
                            <button
                              type="button"
                              onClick={() => handleUpgrade('Standard')}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: 'var(--surface)', color: W.ink, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Oppgrader <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : selectedProblem?.kind === 'content-page' && selectedProblem.status === 'solved' && selectedProblem.changeData && hostIsFullyConnected ? (
                    /* ═══════════════════════════════════
                       SCREEN B — INNHOLD (løst via push)
                       ═══════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: isMobile ? '14px 16px' : '16px 48px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${W.border}` }}>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedWorkshopProblem(null);
                            resetContentFixPushUi();
                          }}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <ChevronLeft size={12} /> Verksted
                        </button>
                        <span style={{ color: W.border, fontSize: 14 }}>/</span>
                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted }}>
                          Innhold · {String(selectedIndex + 1).padStart(2, '0')} av {String(problems.length).padStart(2, '0')}
                        </span>
                      </div>

                      <div style={{ padding: isMobile ? '20px 16px' : '28px 48px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                          <h2 style={{ margin: '0 0 10px', color: W.ink, fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                            {selectedProblem.title}
                          </h2>
                          {selectedProblem.pageUrl && (
                            <p style={{ margin: 0, fontSize: 13, color: W.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>Side:</span>
                              <a
                                href={selectedProblem.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: W.ink, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                {selectedProblem.pageUrl}
                                <ExternalLink size={13} style={{ flexShrink: 0 }} />
                              </a>
                            </p>
                          )}
                        </div>

                        {rollbackState === 'success' ? (
                          <div style={{ background: 'rgba(21,121,90,0.08)', border: `1px solid ${W.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <CheckCircle2 size={22} style={{ color: W.green, flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <p style={{ margin: '0 0 6px', color: W.ink, fontSize: 16, fontWeight: 700 }}>Rullet tilbake ✓</p>
                              <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                Feltet er satt tilbake til den gamle verdien på WordPress.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ background: 'rgba(21,121,90,0.08)', border: `1px solid ${W.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                              <CheckCircle2 size={22} style={{ color: W.green, flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <p style={{ margin: '0 0 6px', color: W.ink, fontSize: 16, fontWeight: 700 }}>Pushet til WordPress ✓</p>
                                <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                  Pushet {formatPushedAt(selectedProblem.changeData.pushed_at)}
                                </p>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                              <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: '14px 16px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: W.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Verdi før push</p>
                                <p style={{
                                  margin: 0,
                                  color: W.ink,
                                  fontSize: 14,
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-wrap',
                                  ...(selectedProblem.changeData.field === 'content'
                                    ? { maxHeight: 240, overflowY: 'auto' as const }
                                    : {}),
                                }}>
                                  {selectedProblem.changeData.old_value && selectedProblem.changeData.old_value.trim()
                                    ? selectedProblem.changeData.old_value
                                    : '(Tom)'}
                                </p>
                              </div>
                              <div style={{ background: 'rgba(21,121,90,0.06)', border: `1px solid ${W.border}`, borderRadius: 12, padding: '14px 16px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: W.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sikt-AI sitt forslag</p>
                                <p style={{
                                  margin: 0,
                                  color: W.ink,
                                  fontSize: 14,
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-wrap',
                                  ...(selectedProblem.changeData.field === 'content'
                                    ? { maxHeight: 240, overflowY: 'auto' as const }
                                    : {}),
                                }}>
                                  {selectedProblem.changeData.new_value}
                                </p>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedWorkshopProblem(null);
                                  resetContentFixPushUi();
                                }}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                Lukk
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRollbackError(null);
                                  setRollbackState('confirming');
                                }}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                Angre push
                              </button>
                            </div>
                          </>
                        )}

                        {rollbackState === 'success' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => {
                                fetchContentChanges();
                                setExpandedWorkshopProblem(null);
                                resetContentFixPushUi();
                              }}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Lukk
                            </button>
                          </div>
                        )}

                        {rollbackState !== 'idle' && rollbackState !== 'success' && selectedProblem.changeData && (() => {
                          const solvedOldValueLabel =
                            selectedProblem.changeData.old_value && selectedProblem.changeData.old_value.trim()
                              ? `'${selectedProblem.changeData.old_value}'`
                              : '(tom)';
                          const rollbackBusy = rollbackState === 'rolling_back';
                          return (
                            <div
                              style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 50,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 16,
                              }}
                            >
                              <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => {
                                  if (rollbackBusy) return;
                                  setRollbackState('idle');
                                  setRollbackError(null);
                                }}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(26,26,26,0.45)',
                                  border: 'none',
                                  cursor: rollbackBusy ? 'default' : 'pointer',
                                }}
                              />
                              <div
                                style={{
                                  position: 'relative',
                                  width: '100%',
                                  maxWidth: 480,
                                  background: W.card,
                                  border: `1px solid ${W.border}`,
                                  borderRadius: 16,
                                  padding: '24px 22px',
                                  boxShadow: '0 16px 48px rgba(26,26,26,0.12)',
                                }}
                              >
                                <h3 style={{ margin: '0 0 10px', color: W.ink, fontSize: 18, fontWeight: 700 }}>
                                  Rull tilbake endringen?
                                </h3>
                                <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                  Vi setter feltet tilbake til den gamle verdien: {solvedOldValueLabel}
                                </p>

                                {rollbackState === 'error' && rollbackError && (
                                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                                    <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13, lineHeight: 1.5 }}>{rollbackError}</p>
                                  </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                  {rollbackBusy ? (
                                    <button
                                      type="button"
                                      disabled
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', opacity: 0.7 }}
                                    >
                                      <Loader2 size={14} className="ws-content-spin" style={{ animation: 'ws-spin 1s linear infinite' }} />
                                      Ruller tilbake …
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRollbackState('idle');
                                          setRollbackError(null);
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!selectedProblem.changeId) return;
                                          executeContentFixRollback(selectedProblem.changeId, { deferListRefetch: true });
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Rull tilbake nå
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                  ) : selectedProblem?.kind === 'content-page' ? (
                    /* ═══════════════════════════════════
                       SCREEN B — INNHOLD (WordPress diff)
                       ═══════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: isMobile ? '14px 16px' : '16px 48px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${W.border}` }}>
                        <button
                          type="button"
                          onClick={() => setExpandedWorkshopProblem(null)}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <ChevronLeft size={12} /> Verksted
                        </button>
                        <span style={{ color: W.border, fontSize: 14 }}>/</span>
                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted }}>
                          Innhold · {String(selectedIndex + 1).padStart(2, '0')} av {String(problems.length).padStart(2, '0')}
                        </span>
                      </div>

                      <div style={{ padding: isMobile ? '20px 16px' : '28px 48px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                            <span style={{ background: W.ink, color: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Innhold</span>
                            <span style={{ border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: W.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: W.green, flexShrink: 0 }} /> Åpen
                            </span>
                          </div>
                          <h2 style={{ margin: '0 0 10px', color: W.ink, fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                            {selectedProblem.title}
                          </h2>
                          {selectedProblem.pageUrl && (
                            <p style={{ margin: 0, fontSize: 13, color: W.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>Side:</span>
                              <a
                                href={selectedProblem.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: W.ink, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                {selectedProblem.pageUrl}
                                <ExternalLink size={13} style={{ flexShrink: 0 }} />
                              </a>
                            </p>
                          )}
                        </div>

                        {showYoastMissingNote && (
                          <div style={{ background: W.bg, border: `1px solid ${W.border}`, borderRadius: 12, padding: '14px 16px' }}>
                            <p style={{ margin: 0, color: W.muted, fontSize: 13, lineHeight: 1.55 }}>
                              Vi ser at Yoast SEO ikke er installert. For å pushe meta-felter må Yoast være aktivt på siden.
                            </p>
                          </div>
                        )}

                        {contentFixLoading === 'fetching' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                            <Loader2 size={20} className="ws-content-spin" style={{ color: W.green, animation: 'ws-spin 1s linear infinite', flexShrink: 0 }} />
                            <p style={{ margin: 0, color: W.ink, fontSize: 14, fontWeight: 600 }}>Henter nåværende side fra WordPress …</p>
                          </div>
                        )}

                        {contentFixLoading === 'generating-questions' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                            <Loader2 size={20} className="ws-content-spin" style={{ color: W.green, animation: 'ws-spin 1s linear infinite', flexShrink: 0 }} />
                            <p style={{ margin: 0, color: W.ink, fontSize: 14, fontWeight: 600 }}>Sikt leser siden …</p>
                          </div>
                        )}

                        {contentFixLoading === 'error' && (
                          <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                            <p style={{ margin: 0, color: 'var(--danger)', fontSize: 14, lineHeight: 1.5 }}>{contentFixActive.error || 'Noe gikk galt.'}</p>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedProblem?.id) {
                                  delete questionsGeneratedRef.current[selectedProblem.id];
                                  setContentFixCache((prev) => {
                                    const next = { ...prev };
                                    delete next[selectedProblem.id];
                                    return next;
                                  });
                                }
                                setContentFixRetry((n) => n + 1);
                              }}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Prøv igjen
                            </button>
                          </div>
                        )}

                        {contentFixLoading === 'questionnaire' &&
                          contentFixEntry?.pageData &&
                          contentFixEntry.fieldType === 'content' &&
                          contentFixEntry.contextQuestions &&
                          contentFixEntry.contextQuestions.length > 0 &&
                          selectedProblem.pageUrl && (
                          <ContentPageContextQuestionnaire
                            questions={contentFixEntry.contextQuestions}
                            onSubmit={(answers) => {
                              startContentFixGeneration(
                                selectedProblem.id,
                                selectedProblem.pageUrl!,
                                contentFixEntry.pageData,
                                answers,
                                true,
                              );
                            }}
                            onSkip={() => {
                              startContentFixGeneration(
                                selectedProblem.id,
                                selectedProblem.pageUrl!,
                                contentFixEntry.pageData,
                                null,
                                false,
                              );
                            }}
                          />
                        )}

                        {contentFixLoading === 'generating' && contentFixEntry?.pageData && contentFixEntry.fieldType && (() => {
                          const cur = getContentFixCurrentValue(contentFixEntry.fieldType, contentFixEntry.pageData);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                              <ContentFixValueCard fieldType={contentFixEntry.fieldType} borderColor={W.border} />
                              <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, padding: '18px 20px' }}>
                                <p style={{ margin: '0 0 8px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Nåværende</p>
                                {cur.hint && <p style={{ margin: '0 0 8px', color: W.muted, fontSize: 11, lineHeight: 1.45 }}>{cur.hint}</p>}
                                <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cur.value}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Loader2 size={20} className="ws-content-spin" style={{ color: W.green, animation: 'ws-spin 1s linear infinite', flexShrink: 0 }} />
                                <p style={{ margin: 0, color: W.ink, fontSize: 14, fontWeight: 600 }}>Sikt-AI lager et forslag …</p>
                              </div>
                            </div>
                          );
                        })()}

                        {contentFixLoading === 'idle' && contentFixEntry?.aiSuggestion && contentFixEntry.pageData && contentFixEntry.fieldType && (() => {
                          const cur = getContentFixCurrentValue(contentFixEntry.fieldType, contentFixEntry.pageData);
                          const todoId = selectedProblem.id;
                          const editedSuggestion =
                            editedSuggestions[todoId] ?? contentFixEntry.aiSuggestion ?? '';
                          const charCounter = getContentFixCharCounter(
                            editedSuggestion.length,
                            contentFixEntry.fieldType,
                          );
                          const placeholders = findPlaceholders(editedSuggestion);
                          const pushBlockedByPlaceholders = placeholders.length > 0;
                          return (
                            <>
                              <ContentFixValueCard fieldType={contentFixEntry.fieldType} borderColor={W.border} />
                              <ContentFixPreviewSection
                                fieldType={contentFixEntry.fieldType}
                                pageData={contentFixEntry.pageData}
                                editedSuggestion={editedSuggestion}
                                previewVariant={snippetPreviewVariant}
                                onPreviewVariantChange={setSnippetPreviewVariant}
                                borderColor={W.border}
                                green={W.green}
                                muted={W.muted}
                                ink={W.ink}
                              />
                              <div className="ws-content-diff-grid">
                                <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, padding: '18px 20px', minHeight: 120 }}>
                                  <p style={{ margin: '0 0 10px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Nåværende</p>
                                  {cur.hint && <p style={{ margin: '0 0 8px', color: W.muted, fontSize: 11, lineHeight: 1.45 }}>{cur.hint}</p>}
                                  <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{cur.value}</p>
                                </div>
                                <div style={{ background: 'rgba(21,121,90,0.06)', border: `1px solid ${W.border}`, borderRadius: 14, padding: '18px 20px', minHeight: 120 }}>
                                  <p style={{ margin: '0 0 10px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sikt foreslår</p>
                                  <textarea
                                    value={editedSuggestion}
                                    onChange={(e) => {
                                      setEditedSuggestions((prev) => ({
                                        ...prev,
                                        [todoId]: e.target.value,
                                      }));
                                    }}
                                    placeholder="Sikt-AI sitt forslag vil vises her …"
                                    rows={5}
                                    style={{
                                      width: '100%',
                                      boxSizing: 'border-box',
                                      margin: 0,
                                      padding: '10px 12px',
                                      border: `1px solid ${W.border}`,
                                      borderRadius: 10,
                                      background: 'var(--surface)',
                                      color: W.ink,
                                      fontSize: 14,
                                      lineHeight: 1.65,
                                      fontFamily: 'inherit',
                                      resize: 'vertical',
                                      minHeight: 88,
                                      outline: 'none',
                                    }}
                                    onFocus={(e) => {
                                      e.currentTarget.style.borderColor = W.green;
                                    }}
                                    onBlur={(e) => {
                                      e.currentTarget.style.borderColor = W.border;
                                    }}
                                  />
                                  <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: charCounter.color }}>
                                    {charCounter.label}
                                  </p>
                                  {charCounter.overMax && (
                                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#C42E2E', lineHeight: 1.45 }}>
                                      Lengre enn anbefalt — kan bli kuttet av i søk
                                    </p>
                                  )}
                                  {placeholders.length > 0 && (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        background: 'rgba(245,158,11,0.08)',
                                        border: '1px solid rgba(245,158,11,0.35)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                      }}
                                    >
                                      <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                                        ⚠ Teksten inneholder plassholdere du må fylle inn før du pusher:{' '}
                                        {placeholders.join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={regenerateContentFixAi}
                                  onMouseDown={pressDown}
                                  onMouseUp={pressReset}
                                  onMouseLeave={pressReset}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                >
                                  <RefreshCw size={14} /> Generer på nytt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editedSuggestion.trim()) {
                                      navigator.clipboard?.writeText(editedSuggestion);
                                      toastSuccess('Kopiert til utklippstavle');
                                    }
                                  }}
                                  onMouseDown={pressDown}
                                  onMouseUp={pressReset}
                                  onMouseLeave={pressReset}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                >
                                  <Copy size={14} /> Kopier forslag
                                </button>
                                {showPushPlaceholder && (
                                  <button
                                    type="button"
                                    disabled={pushBlockedByPlaceholders}
                                    title={pushBlockedByPlaceholders ? 'Fyll inn plassholderne først' : undefined}
                                    onClick={() => {
                                      if (pushBlockedByPlaceholders) return;
                                      setPushError(null);
                                      if (contentFixEntry.fieldType === 'content') {
                                        setPushState('content-warning');
                                      } else {
                                        setPushState('confirming');
                                      }
                                    }}
                                    onMouseDown={pushBlockedByPlaceholders ? undefined : pressDown}
                                    onMouseUp={pushBlockedByPlaceholders ? undefined : pressReset}
                                    onMouseLeave={pushBlockedByPlaceholders ? undefined : pressReset}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 7,
                                      border: `1px solid ${W.border}`,
                                      background: W.card,
                                      color: W.ink,
                                      borderRadius: 11,
                                      padding: '11px 16px',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      cursor: pushBlockedByPlaceholders ? 'not-allowed' : 'pointer',
                                      opacity: pushBlockedByPlaceholders ? 0.5 : 1,
                                      transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}`,
                                    }}
                                  >
                                    Push til WordPress
                                  </button>
                                )}
                              </div>
                              {showWixAdvisoryActions && contentFixLoading === 'idle' && contentFixEntry?.aiSuggestion && (() => {
                                const wixEditedSuggestion =
                                  editedSuggestions[selectedProblem.id] ?? contentFixEntry.aiSuggestion ?? '';
                                const wixPlaceholders = findPlaceholders(wixEditedSuggestion);
                                const wixCopyBlocked = wixPlaceholders.length > 0;
                                return (
                                  <div
                                    style={{
                                      marginTop: 4,
                                      background: 'rgba(245,158,11,0.06)',
                                      border: `1px solid ${W.border}`,
                                      borderRadius: 14,
                                      padding: '16px 18px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 12,
                                    }}
                                  >
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.ink }}>
                                      Lim inn i Wix selv
                                    </p>
                                    <p style={{ margin: 0, fontSize: 13, color: W.muted, lineHeight: 1.55 }}>
                                      {getWixFieldInstruction(contentFixEntry.fieldType)}
                                    </p>
                                    <button
                                      type="button"
                                      disabled={wixCopyBlocked || !wixEditedSuggestion.trim()}
                                      title={wixCopyBlocked ? 'Fyll inn plassholderne først' : undefined}
                                      onClick={() => {
                                        if (wixCopyBlocked || !wixEditedSuggestion.trim()) return;
                                        navigator.clipboard?.writeText(wixEditedSuggestion);
                                        toastSuccess('Kopiert til utklippstavle');
                                      }}
                                      onMouseDown={wixCopyBlocked ? undefined : pressDown}
                                      onMouseUp={wixCopyBlocked ? undefined : pressReset}
                                      onMouseLeave={wixCopyBlocked ? undefined : pressReset}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 7,
                                        alignSelf: 'flex-start',
                                        background: W.ink,
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 11,
                                        padding: '11px 16px',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        cursor: wixCopyBlocked ? 'not-allowed' : 'pointer',
                                        opacity: wixCopyBlocked ? 0.5 : 1,
                                        transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}`,
                                      }}
                                    >
                                      <Copy size={14} /> Kopier
                                    </button>
                                  </div>
                                );
                              })()}
                            </>
                          );
                        })()}

                        {pushState !== 'idle' && showPushPlaceholder && contentFixEntry?.fieldType && contentFixEntry.pageData && (() => {
                          const cur = getContentFixCurrentValue(contentFixEntry.fieldType, contentFixEntry.pageData);
                          const pushEditedSuggestion =
                            editedSuggestions[selectedProblem.id] ?? contentFixEntry.aiSuggestion ?? '';
                          const pushPlaceholders = findPlaceholders(pushEditedSuggestion);
                          const pushBlockedByPlaceholders = pushPlaceholders.length > 0;
                          const pushTitle =
                            contentFixEntry.fieldType === 'seo-title'
                              ? 'Push SEO-tittel til WordPress?'
                              : contentFixEntry.fieldType === 'h1'
                                ? 'Push H1 til WordPress?'
                                : contentFixEntry.fieldType === 'content'
                                  ? 'Push innhold til WordPress?'
                                  : 'Push meta-beskrivelse til WordPress?';
                          const isContentField = contentFixEntry.fieldType === 'content';
                          const scrollableValueStyle: React.CSSProperties = isContentField
                            ? { maxHeight: 200, overflowY: 'auto' }
                            : {};
                          const rollbackBusy = rollbackState === 'rolling_back';
                          const pushBusy = pushState === 'pushing';
                          const overlayBusy = pushBusy || rollbackBusy;
                          const oldValueLabel =
                            lastOldValue && lastOldValue.trim()
                              ? `'${lastOldValue}'`
                              : '(tom)';
                          const popupTitle =
                            rollbackState === 'success'
                              ? 'Rullet tilbake ✓'
                              : rollbackState === 'confirming'
                                ? 'Rull tilbake endringen?'
                                : pushState === 'content-warning'
                                  ? 'Erstatt sideinnhold?'
                                  : pushState === 'success'
                                    ? 'Pushet til WordPress ✓'
                                    : pushTitle;
                          return (
                            <div
                              style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 50,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 16,
                              }}
                            >
                              <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => {
                                  if (overlayBusy) return;
                                  resetContentFixPushUi();
                                }}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(26,26,26,0.45)',
                                  border: 'none',
                                  cursor: overlayBusy ? 'default' : 'pointer',
                                }}
                              />
                              <div
                                style={{
                                  position: 'relative',
                                  width: '100%',
                                  maxWidth: 480,
                                  background: W.card,
                                  border: `1px solid ${W.border}`,
                                  borderRadius: 16,
                                  padding: '24px 22px',
                                  boxShadow: '0 16px 48px rgba(26,26,26,0.12)',
                                }}
                              >
                                <h3 style={{ margin: '0 0 10px', color: W.ink, fontSize: 18, fontWeight: 700 }}>
                                  {popupTitle}
                                </h3>

                                {rollbackState === 'success' ? (
                                  <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                    Feltet er satt tilbake til den gamle verdien på WordPress.
                                  </p>
                                ) : rollbackState === 'confirming' ? (
                                  <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                    Vi setter feltet tilbake til den gamle verdien: {oldValueLabel}
                                  </p>
                                ) : pushState === 'content-warning' ? (
                                  <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                    Dette erstatter HELE tekstinnholdet på siden med den nye teksten. Bilder og spesial-formatering på siden kan gå tapt. Du kan angre når som helst i Løste-fanen.
                                  </p>
                                ) : pushState === 'success' ? (
                                  <>
                                    <p style={{ margin: '0 0 6px', color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                      Endringen er lagret på siden din.
                                    </p>
                                    {contentFixEntry.fieldType === 'h1' && lastH1Rendered === false && (
                                      <p style={{ margin: '0 0 6px', color: W.muted, fontSize: 13, lineHeight: 1.55 }}>
                                        Vi oppdaterte sidetittelen, men temaet ditt viser den kanskje ikke som H1 på siden. Dette kan kreve en tema-endring.
                                      </p>
                                    )}
                                    <p style={{ margin: 0, color: W.muted, fontSize: 13, lineHeight: 1.55 }}>
                                      Den gamle verdien er lagret. Du kan rulle tilbake hvis du ombestemmer deg.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                      Den nye verdien skrives direkte til siden din. Den gamle verdien lagres, så du kan rulle tilbake etterpå om du ombestemmer deg.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                                      <div style={{ background: W.bg, border: `1px solid ${W.border}`, borderRadius: 10, padding: '12px 14px' }}>
                                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: W.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nåværende</p>
                                        <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...scrollableValueStyle }}>{cur.value}</p>
                                      </div>
                                      <div style={{ background: 'rgba(21,121,90,0.06)', border: `1px solid ${W.border}`, borderRadius: 10, padding: '12px 14px' }}>
                                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: W.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ny</p>
                                        <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...scrollableValueStyle }}>{pushEditedSuggestion}</p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {pushState === 'error' && pushError && (
                                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                                    <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13, lineHeight: 1.5 }}>{pushError}</p>
                                  </div>
                                )}

                                {rollbackState === 'error' && rollbackError && (
                                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                                    <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13, lineHeight: 1.5 }}>{rollbackError}</p>
                                  </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: rollbackState === 'confirming' || pushState === 'success' || rollbackState === 'success' || pushState === 'content-warning' ? 18 : 0 }}>
                                  {rollbackState === 'success' ? (
                                    <button
                                      type="button"
                                      onClick={resetContentFixPushUi}
                                      onMouseDown={pressDown}
                                      onMouseUp={pressReset}
                                      onMouseLeave={pressReset}
                                      style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                    >
                                      Lukk
                                    </button>
                                  ) : rollbackState === 'confirming' ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={rollbackBusy}
                                        onClick={() => {
                                          setRollbackState('idle');
                                          setRollbackError(null);
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rollbackBusy}
                                        onClick={() => executeContentFixRollback()}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        Rull tilbake nå
                                      </button>
                                    </>
                                  ) : rollbackState === 'rolling_back' ? (
                                    <button
                                      type="button"
                                      disabled
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', opacity: 0.7 }}
                                    >
                                      <Loader2 size={14} className="ws-content-spin" style={{ animation: 'ws-spin 1s linear infinite' }} />
                                      Ruller tilbake …
                                    </button>
                                  ) : rollbackState === 'error' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRollbackState('idle');
                                          setRollbackError(null);
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => executeContentFixRollback()}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Rull tilbake nå
                                      </button>
                                    </>
                                  ) : pushState === 'content-warning' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={resetContentFixPushUi}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          pushBlockedByPlaceholders ||
                                          !pushEditedSuggestion.trim() ||
                                          !selectedProblem.pageUrl
                                        }
                                        title={pushBlockedByPlaceholders ? 'Fyll inn plassholderne først' : undefined}
                                        onClick={() => {
                                          if (
                                            pushBlockedByPlaceholders ||
                                            !pushEditedSuggestion.trim() ||
                                            !selectedProblem.pageUrl
                                          ) return;
                                          executeContentFixPush(
                                            selectedProblem.pageUrl,
                                            'content',
                                            pushEditedSuggestion,
                                          );
                                        }}
                                        onMouseDown={pushBlockedByPlaceholders ? undefined : pressDown}
                                        onMouseUp={pushBlockedByPlaceholders ? undefined : pressReset}
                                        onMouseLeave={pushBlockedByPlaceholders ? undefined : pressReset}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 7,
                                          background: W.ink,
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: 10,
                                          padding: '10px 16px',
                                          fontSize: 13,
                                          fontWeight: 700,
                                          cursor: pushBlockedByPlaceholders ? 'not-allowed' : 'pointer',
                                          opacity: pushBlockedByPlaceholders ? 0.5 : 1,
                                          transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}`,
                                        }}
                                      >
                                        Ja, erstatt innholdet
                                      </button>
                                    </>
                                  ) : pushState === 'success' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={resetContentFixPushUi}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Lukk
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRollbackError(null);
                                          setRollbackState('confirming');
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Angre push
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        disabled={pushBusy}
                                        onClick={resetContentFixPushUi}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: pushBusy ? 'not-allowed' : 'pointer', opacity: pushBusy ? 0.5 : 1, transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          pushBusy ||
                                          pushBlockedByPlaceholders ||
                                          !pushEditedSuggestion.trim() ||
                                          !selectedProblem.pageUrl
                                        }
                                        title={pushBlockedByPlaceholders ? 'Fyll inn plassholderne først' : undefined}
                                        onClick={() => {
                                          if (
                                            pushBlockedByPlaceholders ||
                                            !pushEditedSuggestion.trim() ||
                                            !selectedProblem.pageUrl ||
                                            (contentFixEntry.fieldType !== 'meta-description' &&
                                              contentFixEntry.fieldType !== 'seo-title' &&
                                              contentFixEntry.fieldType !== 'h1' &&
                                              contentFixEntry.fieldType !== 'content')
                                          ) return;
                                          executeContentFixPush(
                                            selectedProblem.pageUrl,
                                            contentFixEntry.fieldType,
                                            pushEditedSuggestion,
                                          );
                                        }}
                                        onMouseDown={pushBlockedByPlaceholders || pushBusy ? undefined : pressDown}
                                        onMouseUp={pushBlockedByPlaceholders || pushBusy ? undefined : pressReset}
                                        onMouseLeave={pushBlockedByPlaceholders || pushBusy ? undefined : pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: pushBusy || pushBlockedByPlaceholders ? 'not-allowed' : 'pointer', opacity: pushBusy ? 0.7 : pushBlockedByPlaceholders ? 0.5 : 1, transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        {pushBusy ? (
                                          <>
                                            <Loader2 size={14} className="ws-content-spin" style={{ animation: 'ws-spin 1s linear infinite' }} />
                                            Pusher …
                                          </>
                                        ) : (
                                          'Push nå'
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                  ) : selectedProblem ? (
                    /* ═══════════════════════════════════
                       SCREEN B — DETALJ (PageSpeed)
                       ═══════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column' }}>

                      {/* Breadcrumb */}
                      <div style={{ padding: isMobile ? '14px 16px' : '16px 48px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${W.border}` }}>
                        <button
                          type="button"
                          onClick={() => setExpandedWorkshopProblem(null)}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <ChevronLeft size={12} /> Verksted
                        </button>
                        <span style={{ color: W.border, fontSize: 14 }}>/</span>
                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted }}>
                          Funn {String(selectedIndex + 1).padStart(2, '0')} av {String(problems.length).padStart(2, '0')}
                          {selectedProblem.raw?.id ? ` · ${selectedProblem.raw.id}` : ''}
                        </span>
                      </div>

                      {/* Two-column main */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.3fr) minmax(0,0.7fr)', gap: isMobile ? 20 : 32, padding: isMobile ? '20px 16px' : '32px 48px', alignItems: 'start' }}>

                        {/* Left: title + meta */}
                        <div>
                          {/* Tag pills */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                            <span style={{ background: W.ink, color: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>PageSpeed</span>
                            <span style={{ border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: W.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: W.green, flexShrink: 0 }} /> Åpen
                            </span>
                            <span style={{ border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: W.muted, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Google Lighthouse · mobil</span>
                          </div>

                          {/* Title */}
                          <h2 style={{ margin: '0 0 16px', color: W.ink, fontSize: isMobile ? 'clamp(24px,7vw,30px)' : 'clamp(30px,4vw,50px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
                            {selectedProblem.title}
                          </h2>

                          {/* Description */}
                          <p style={{ margin: '0 0 28px', color: W.muted, fontSize: 16, lineHeight: 1.65, maxWidth: '52ch' }}>
                            {selectedProblem.raw?.description || 'Lighthouse foreslår en forbedring for mobilversjonen av nettsiden.'}
                          </p>

                          {/* Savings */}
                          <div>
                            <p style={{ margin: '0 0 4px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Lighthouse anslår</p>
                            <p style={{ margin: 0, fontSize: 36, fontWeight: 600, color: selectedProblem.raw?.savings ? W.green : W.muted, fontFamily: selectedProblem.raw?.savings ? "ui-monospace,'SF Mono',Menlo,monospace" : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                              {selectedProblem.raw?.savings ? `Sparer ${selectedProblem.raw.savings}` : 'Forbedring foreslått'}
                            </p>
                          </div>
                        </div>

                        {/* Right: 2×2 meta cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {[
                            { label: 'KATEGORI',   value: 'Performance',                                                                  color: W.ink,                                                dot: false, mono: false },
                            { label: 'STATUS',     value: 'Åpen',                                                                         color: W.green,                                              dot: true,  mono: false },
                            { label: 'KILDE',      value: 'Lighthouse · mobil',                                                           color: W.ink,                                                dot: false, mono: true  },
                            { label: 'BESPARELSE', value: selectedProblem.raw?.savings || 'Ikke oppgitt', color: selectedProblem.raw?.savings ? W.green : W.muted, dot: false, mono: !!selectedProblem.raw?.savings },
                          ].map((card) => (
                            <div key={card.label} style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 16, padding: '18px 16px' }}>
                              <p style={{ margin: '0 0 8px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{card.label}</p>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: card.color as string, fontFamily: card.mono ? "ui-monospace,'SF Mono',Menlo,monospace" : 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {card.dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: W.green, flexShrink: 0 }} />}
                                {card.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ height: 1, background: W.border, margin: isMobile ? '0 16px' : '0 48px' }} />

                      {/* AI solution section */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) minmax(0,1fr)', gap: isMobile ? 20 : 32, padding: isMobile ? '20px 16px' : '32px 48px', alignItems: 'start' }}>

                        {/* Left: explanation + steps */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: W.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Sparkles size={13} style={{ color: W.green }} />
                              </div>
                              <div>
                                <p style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11, fontWeight: 700, color: W.ink, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sikt-AI · Løsning</p>
                                <p style={{ margin: '2px 0 0', color: W.muted, fontSize: 11 }}>Forklaring og nummererte steg</p>
                              </div>
                            </div>
                            <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, background: W.bg, border: `1px solid ${W.border}`, borderRadius: 6, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {aiIsThinking ? 'Jobber' : aiSolution ? 'Svar' : 'Klar'}
                            </span>
                          </div>

                          {aiIsThinking ? (
                            <div style={{ padding: '32px 0', textAlign: 'center' }}>
                              <Loader2 size={22} style={{ color: W.green, margin: '0 auto 12px', animation: 'spin 1s linear infinite', display: 'block' }} />
                              <p style={{ margin: '0 0 4px', color: W.ink, fontSize: 14, fontWeight: 700 }}>Sikt-AI jobber</p>
                              <p style={{ margin: 0, color: W.muted, fontSize: 12 }}>Normalt tar AI-svar 5–15 sekunder.</p>
                            </div>
                          ) : aiSolution ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                              {aiSolution.usedHtmlContext && (
                                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, background: 'rgba(21,121,90,0.08)', border: `1px solid ${W.green}`, color: W.green, borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
                                  <Check size={12} /> Hentet fra din faktiske side
                                </span>
                              )}
                              {aiSolution.qualityNote && (
                                <div style={{ display: 'flex', gap: 8, background: 'rgba(186,117,23,0.07)', border: '1px solid rgba(186,117,23,0.35)', borderRadius: 10, padding: '10px 12px' }}>
                                  <AlertTriangle size={14} style={{ color: '#BA7517', flexShrink: 0, marginTop: 1 }} />
                                  <p style={{ margin: 0, fontSize: 12, color: '#854F0B', lineHeight: 1.5 }}>{aiSolution.qualityNote}</p>
                                </div>
                              )}
                              {aiSolution.replacementExplanation && (
                                <div>
                                  <p style={{ margin: '0 0 6px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Forklaring</p>
                                  <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.6 }}>{aiSolution.replacementExplanation}</p>
                                </div>
                              )}
                              {aiSolution.fileHint && (
                                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: W.muted, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                                  HVOR {aiSolution.fileHint}
                                </span>
                              )}
                              {Array.isArray(aiSolution.steps) && aiSolution.steps.length > 0 && (
                                <div>
                                  <p style={{ margin: '0 0 12px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Steg</p>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {aiSolution.steps.map((step: any, i: number) => (
                                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, padding: '14px 0', borderTop: `1px solid ${W.border}` }}>
                                        <span style={{ width: 24, height: 24, borderRadius: 7, background: W.bg, border: `1px solid ${W.border}`, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11, fontWeight: 700, color: W.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <div>
                                          <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: W.ink }}>{step.title || `Steg ${i + 1}`}</p>
                                          {step.description && <p style={{ margin: 0, fontSize: 12, color: W.muted, lineHeight: 1.55 }}>{step.description}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ border: `1.5px dashed ${W.border}`, borderRadius: 14, padding: '24px 20px', textAlign: 'center' }}>
                              <p style={{ margin: '0 0 6px', color: W.ink, fontSize: 14, fontWeight: 700 }}>Ingen løsning generert enda</p>
                              <p style={{ margin: '0 0 16px', color: W.muted, fontSize: 13, lineHeight: 1.6 }}>Be AI om en forklaring og nummererte steg for dette funnet.</p>
                              <button
                                type="button"
                                onClick={() => selectProblem(selectedProblem)}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                <Sparkles size={13} /> Be AI om løsning
                              </button>
                              <p style={{ margin: '12px 0 0', color: W.muted, fontSize: 11 }}>Normalt tar AI-svar 5–15 sekunder.</p>
                            </div>
                          )}
                        </div>

                        {/* Right: code panels */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {(() => {
                            const serp = extractSerpPreview(aiSolution, formData.websiteUrl || clientData?.websiteUrl || '');
                            if (!serp) return null;
                            return (
                              <div style={{ background: 'var(--surface)', border: `1px solid ${W.border}`, borderRadius: 14, overflow: 'hidden' }}>
                                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <SearchIcon size={12} style={{ color: W.muted }} />
                                  <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Slik ser du ut på Google</span>
                                </div>
                                <div style={{ padding: '14px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: W.muted }}>
                                      {(serp.host || 's')[0].toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: 12, color: '#202124' }}>{serp.host || 'dinside.no'}</span>
                                  </div>
                                  <p style={{ margin: '0 0 3px', color: '#1a0dab', fontSize: 17, lineHeight: 1.3, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {serp.title || 'Sidetittelen din'}
                                  </p>
                                  <p style={{ margin: 0, color: '#4d5156', fontSize: 13, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {serp.description || 'Beskrivelsen din vises her under den blå lenken.'}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                          {/* AI-bygde sider (Standard+): ferdig lim-inn-prompt — hovedleveransen */}
                          {aiSolution?.aiPrompt && (
                            <div style={{ background: W.card, border: `1px solid ${W.green}`, borderRadius: 14, overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <Sparkles size={12} style={{ color: W.green }} />
                                <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.green, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ferdig prompt for AI-verktøyet ditt</span>
                              </div>
                              <div style={{ padding: '12px 16px 6px' }}>
                                <p style={{ margin: '0 0 10px', fontSize: 12, color: W.muted, lineHeight: 1.55 }}>Lim denne inn i Claude, Cursor, v0 e.l. — den fikser dette i din egen kodebase.</p>
                                <div style={{ background: W.ink, borderRadius: 10, padding: '14px 16px', overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                                  <pre style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, lineHeight: 1.6, color: 'rgba(245,245,240,0.9)', whiteSpace: 'pre-wrap' }}><code>{String(aiSolution.aiPrompt)}</code></pre>
                                </div>
                              </div>
                              <div style={{ padding: '8px 14px 12px' }}>
                                <button type="button" onClick={() => { navigator.clipboard?.writeText(String(aiSolution.aiPrompt)); toastSuccess('Prompt kopiert.'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: W.green, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                  <Copy size={12} /> Kopier prompt
                                </button>
                              </div>
                            </div>
                          )}
                          {/* AI-bygd side + Basic → oppsalg til Standard */}
                          {aiSolution?.aiPromptLocked && (
                            <div style={{ background: W.card, border: `1px dashed ${W.border}`, borderRadius: 14, padding: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                                <Lock size={13} style={{ color: W.muted }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: W.ink }}>Ferdig AI-prompt — lås opp i Standard</span>
                              </div>
                              <p style={{ margin: '0 0 12px', fontSize: 12, color: W.muted, lineHeight: 1.55 }}>Få en ferdig prompt du limer rett inn i Claude/Cursor, så fikser den dette i kodebasen din. Inkludert fra Standard og oppover.</p>
                              <button type="button" onClick={() => handleUpgrade('Standard')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: W.ink, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                <Sparkles size={12} /> Oppgrader til Standard
                              </button>
                            </div>
                          )}
                          {aiSolution?.originalCode && (
                            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: aiSolution.originalCodeVerified ? W.green : W.muted }} />
                                  <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                    {aiSolution.originalCodeVerified ? 'Gammel kode · funnet på siden din' : 'Gammel kode'}
                                  </span>
                                </div>
                                {aiSolution.fileHint && <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: W.muted }}>{aiSolution.fileHint}</span>}
                              </div>
                              <div style={{ background: W.ink, padding: '14px 16px', overflowX: 'auto' }}>
                                <pre style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, lineHeight: 1.6, color: 'rgba(245,245,240,0.65)', whiteSpace: 'pre-wrap' }}><code>{String(aiSolution.originalCode)}</code></pre>
                              </div>
                              <div style={{ padding: '8px 14px' }}>
                                <button type="button" onClick={() => { navigator.clipboard?.writeText(String(aiSolution.originalCode)); toastSuccess('Kopiert.'); }} style={{ background: 'none', border: 'none', color: W.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Copy size={12} /> Kopier
                                </button>
                              </div>
                            </div>
                          )}
                          {aiSolution?.codePatch && (
                            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: W.green }} />
                                <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Foreslått patch</span>
                              </div>
                              <div style={{ background: 'rgba(21,121,90,0.06)', padding: '14px 16px', overflowX: 'auto' }}>
                                <pre style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, lineHeight: 1.6, color: W.green, whiteSpace: 'pre-wrap' }}><code>{typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch, null, 2)}</code></pre>
                              </div>
                              <div style={{ padding: '8px 14px' }}>
                                <button type="button" onClick={() => { navigator.clipboard?.writeText(typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch)); toastSuccess('Kopiert.'); }} style={{ background: 'none', border: 'none', color: W.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Copy size={12} /> Kopier
                                </button>
                              </div>
                            </div>
                          )}
                          {!aiSolution && !aiIsThinking && (
                            <div style={{ background: W.bg, border: `1px solid ${W.border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
                              <p style={{ margin: 0, color: W.muted, fontSize: 13, lineHeight: 1.5 }}>Kodepaneler vises her etter at AI har svart.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ height: 1, background: W.border, margin: isMobile ? '0 16px' : '0 48px' }} />

                      {/* Action row */}
                      <div style={{ padding: isMobile ? '18px 16px' : '22px 48px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => toastSuccess('Markert som løst (lagres ikke i denne versjonen).')}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Marker som løst
                        </button>
                        <button
                          type="button"
                          onClick={copyTicket}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <Copy size={13} /> Kopier som ticket
                        </button>
                        <button
                          type="button"
                          onClick={() => selectProblem(selectedProblem)}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', color: W.muted, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          Be om annen vinkling
                        </button>
                        <p style={{ margin: '0 0 0 auto', color: W.muted, fontSize: 12 }}>Normalt tar AI-svar 5–15 sekunder</p>
                      </div>

                      {/* Tier teaser */}
                      {!hasStandardOrHigher && (
                        <div style={{ margin: isMobile ? '0 16px 24px' : '0 48px 32px', background: W.ink, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(21,121,90,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Sparkles size={16} style={{ color: W.green }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ margin: '0 0 3px', color: '#fff', fontSize: 14, fontWeight: 700 }}>Få AI-løsninger for alle funnene</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Inkluderer automatisk re-analyse hver natt, søkeordsposisjon og konkurrent-sporing.</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600 }}>1 690 kr <span style={{ fontWeight: 400, fontSize: 11 }}>/mnd</span></p>
                            <button
                              type="button"
                              onClick={() => handleUpgrade('Standard')}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: 'var(--surface)', color: W.ink, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Oppgrader <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : (
                    <div style={{ padding: isMobile ? '48px 20px' : '64px 48px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', color: W.ink, fontSize: 18, fontWeight: 700 }}>Funn ikke funnet</p>
                      <button type="button" onClick={() => setExpandedWorkshopProblem(null)} style={{ marginTop: 12, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>← Tilbake</button>
                    </div>
                  )}

                </div>
              </div>
              </div>
            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* SIKT-LOGGEN — én tidslinje, filter-pills, ekspanderbare rader.  */}
        {/* =============================================================== */}
        {activeTab === 'log' && (() => {
          const now = new Date();
          const weekStart = new Date(now);
          const day = weekStart.getDay() || 7;
          weekStart.setDate(weekStart.getDate() - (day - 1));
          weekStart.setHours(0, 0, 0, 0);
          const viewedStart = new Date(weekStart);
          viewedStart.setDate(viewedStart.getDate() + weekOffset * 7);
          const viewedEnd = new Date(viewedStart);
          viewedEnd.setDate(viewedEnd.getDate() + 7);

          const getWeekNumber = (d: Date) => {
            const date = new Date(d.getTime());
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
            const week1 = new Date(date.getFullYear(), 0, 4);
            return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
          };

          const inWeek = siktActions.filter((a) => {
            const ts = new Date(a.created_at).getTime();
            return ts >= viewedStart.getTime() && ts < viewedEnd.getTime();
          });
          const filtered = receiptCategoryFilter === 'all' ? inWeek : inWeek.filter((a) => a.category === receiptCategoryFilter);
          const counts = {
            all: inWeek.length,
            finding: inWeek.filter((a) => a.category === 'finding').length,
            suggestion: inWeek.filter((a) => a.category === 'suggestion').length,
            fix: inWeek.filter((a) => a.category === 'fix').length,
            alert: inWeek.filter((a) => a.category === 'alert').length,
          };

          const filterPills: { key: typeof receiptCategoryFilter; label: string }[] = [
            { key: 'all', label: `Alle ${counts.all}` },
            { key: 'fix', label: `Fikser ${counts.fix}` },
            { key: 'suggestion', label: `Forslag ${counts.suggestion}` },
            { key: 'finding', label: `Funn ${counts.finding}` },
            { key: 'alert', label: `Varsler ${counts.alert}` },
          ];

          // Forén til PORTAL (var avvikende: #52A447/#808080/#EBEBE6 → handbook-farger).
          const L = {
            bg: PORTAL.bg, card: PORTAL.card, ink: PORTAL.ink, green: PORTAL.success,
            muted: PORTAL.muted, border: PORTAL.border,
          } as const;
          const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
          const catColor = (c: string) =>
            c === 'fix' ? L.green : c === 'alert' ? L.muted : L.ink;
          const pressD = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.97)'; };
          const pressU = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; };
          const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

          // ── AVLEDNINGER ──────────────────────────────────────────────────
          const siteLabel = websiteUrl
            ? websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
            : '';
          const companyLabel = (clientData as any)?.companyName || siteLabel || 'Din bedrift';
          const initials = (() => {
            const parts = companyLabel.trim().split(/\s+/).filter(Boolean);
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return companyLabel.slice(0, 2).toUpperCase() || '??';
          })();
          const currentPkgName = (clientData as any)?.package_name || 'Basic';

          // perDay: group filtered by calendar day, sorted ascending
          const perDay: { dateKey: string; label: string; weekdayLong: string; actions: typeof filtered }[] = [];
          filtered.forEach((a) => {
            const d = new Date(a.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            let group = perDay.find(g => g.dateKey === key);
            if (!group) {
              group = {
                dateKey: key,
                label: d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }),
                weekdayLong: d.toLocaleDateString('nb-NO', { weekday: 'long' }),
                actions: [],
              };
              perDay.push(group);
            }
            group.actions.push(a);
          });
          perDay.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
          perDay.forEach(g => g.actions.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ));

          // weekdayCounts: mon(0)…sun(6) counts from inWeek
          const weekdayCounts: number[] = Array(7).fill(0);
          inWeek.forEach((a) => {
            const d = new Date(a.created_at).getDay(); // 0=sun
            const idx = d === 0 ? 6 : d - 1; // mon=0…sun=6
            weekdayCounts[idx]++;
          });
          const maxWDCount = Math.max(...weekdayCounts, 1);
          const todayWDIdx = (() => {
            if (weekOffset !== 0) return -1;
            const d = new Date().getDay();
            return d === 0 ? 6 : d - 1;
          })();

          // periodEndLabel: viewedEnd minus 1 min
          const periodEndDate = new Date(viewedEnd.getTime() - 60000);
          const periodEndLabel = periodEndDate.toLocaleDateString('nb-NO', {
            weekday: 'short', day: 'numeric', month: 'short',
          }).replace('.', '') + ' · ' + periodEndDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={activeTab} className="space-y-6">
              <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: 'var(--ink)', fontFamily: SERIF }}>Sikt-loggen</h1>
                  <p className={`text-base mt-3 ${textDim}`}>Historikk over funn, forslag, fikser og varsler.</p>
                </div>
              </header>
              <div className={`${tabFadeInClass} space-y-6`}>
              <style>{`
                @keyframes log-card-in {
                  from { opacity: 0; transform: translateY(6px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                  @keyframes log-card-in {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                  }
                }
              `}</style>

              {/* ── TWO-COLUMN WRAPPER ── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,300px) 1fr',
                gap: 0,
                alignItems: 'start',
                background: 'transparent',
              }}>

                {/* ══════════════════════════════════
                    LEFT SIDEBAR
                    ══════════════════════════════════ */}
                <aside style={{
                  borderRight: isMobile ? 'none' : `1px solid ${L.border}`,
                  borderBottom: isMobile ? `1px solid ${L.border}` : 'none',
                  padding: isMobile ? '18px 16px' : '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  position: isMobile ? 'static' : 'sticky',
                  top: 24,
                  alignSelf: 'start',
                }}>

                  {/* Firmakort */}
                  <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: L.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: L.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{companyLabel}</p>
                      {siteLabel && (
                        <p style={{ margin: '2px 0 0', fontFamily: MONO, fontSize: 11, color: L.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{siteLabel}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      onMouseDown={pressD}
                      onMouseUp={pressU}
                      onMouseLeave={pressU}
                      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: L.muted, display: 'flex', alignItems: 'center', transition: `transform 160ms ${EASE}`, flexShrink: 0 }}
                      aria-label="Innstillinger"
                    >
                      <Settings size={14} />
                    </button>
                  </div>

                  {/* Ukekalender-kort */}
                  <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 16, padding: '14px 14px 12px' }}>
                    {/* Nav row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <button
                        type="button"
                        onClick={() => setWeekOffset((o) => o - 1)}
                        onMouseDown={pressD}
                        onMouseUp={pressU}
                        onMouseLeave={pressU}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: L.ink, display: 'flex', alignItems: 'center', transition: `transform 160ms ${EASE}` }}
                        aria-label="Forrige uke"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: L.ink }}>Uke {getWeekNumber(viewedStart)}</p>
                        <p style={{ margin: '1px 0 0', fontFamily: MONO, fontSize: 10, color: L.muted }}>
                          {viewedStart.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}–{new Date(viewedEnd.getTime() - 86400000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} · {viewedStart.getFullYear()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
                        disabled={weekOffset >= 0}
                        onMouseDown={pressD}
                        onMouseUp={pressU}
                        onMouseLeave={pressU}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer', color: weekOffset >= 0 ? L.border : L.ink, opacity: weekOffset >= 0 ? 0.35 : 1, display: 'flex', alignItems: 'center', transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                        aria-label="Neste uke"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    {/* Mini søylerad: M T O T F L S */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                      {(['M','T','O','T','F','L','S'] as const).map((letter, i) => {
                        const count = weekdayCounts[i];
                        const isToday = i === todayWDIdx;
                        const barPct = count > 0 ? Math.max(0.15, count / maxWDCount) : 0;
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: '100%', height: 36, borderRadius: 5, background: isToday ? L.ink : L.bg, position: 'relative', overflow: 'hidden' }}>
                              {count > 0 && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: `${barPct * 100}%`,
                                  background: isToday ? 'rgba(255,255,255,0.55)' : L.green,
                                  borderRadius: 4,
                                }} />
                              )}
                            </div>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: L.muted, letterSpacing: '0.04em' }}>{letter}</span>
                            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: count === 0 ? L.muted : L.ink }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bunnlinje */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                      {weekOffset === 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(82,164,71,0.10)', borderRadius: 99, padding: '3px 9px', fontSize: 11, fontWeight: 600, color: L.green }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: L.green }} />
                          denne uken
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setWeekOffset(0)}
                          onMouseDown={pressD}
                          onMouseUp={pressU}
                          onMouseLeave={pressU}
                          style={{ background: 'none', border: 'none', fontFamily: MONO, fontSize: 10, color: L.muted, cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationColor: L.border, transition: `transform 160ms ${EASE}` }}
                        >
                          → denne uken
                        </button>
                      )}
                      <span style={{ fontFamily: MONO, fontSize: 10, color: L.muted }}>{periodEndLabel}</span>
                    </div>
                  </div>

                  {/* Filter-kort */}
                  <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 16, padding: '14px 14px 10px' }}>
                    <p style={{ margin: '0 0 10px', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Filtre</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filterPills.map((p) => {
                        const active = receiptCategoryFilter === p.key;
                        const dot = p.key === 'all' ? L.muted : catColor(p.key);
                        // split label into text + count for alignment
                        const labelMatch = p.label.match(/^(.*?)(\d+)$/);
                        const labelText = labelMatch ? labelMatch[1].trim() : p.label;
                        const labelNum  = labelMatch ? labelMatch[2] : '';
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setReceiptCategoryFilter(p.key)}
                            onMouseDown={pressD}
                            onMouseUp={pressU}
                            onMouseLeave={(e) => { pressU(e); (e.currentTarget as HTMLButtonElement).style.background = active ? L.ink : 'transparent'; }}
                            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,26,26,0.04)'; }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                              background: active ? L.ink : 'transparent',
                              border: 'none',
                              borderRadius: 10,
                              padding: '8px 10px',
                              cursor: 'pointer',
                              transition: `transform 160ms ${EASE}, background 160ms ${EASE}`,
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : dot, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: active ? '#fff' : L.ink }}>{labelText}</span>
                            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: active ? 'rgba(255,255,255,0.6)' : L.muted }}>{labelNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Abonnementskort */}
                  <div style={{ background: L.bg, border: `1px solid ${L.border}`, borderRadius: 14, padding: 14 }}>
                    <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Abonnement</p>
                    <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: L.ink }}>{currentPkgName}</p>
                    <p style={{ margin: 0, fontSize: 12, color: L.muted, lineHeight: 1.5 }}>
                      {hasStandardOrHigher
                        ? 'Du ser før/etter-verdier og full historikk.'
                        : 'Oppgrader for å se før/etter-verdier og full historikk.'}
                    </p>
                  </div>
                </aside>

                {/* ══════════════════════════════════
                    RIGHT FEED
                    ══════════════════════════════════ */}
                <main style={{ padding: isMobile ? '20px 16px' : '28px 40px', minWidth: 0 }}>

                  {/* Feed header */}
                  <div style={{ marginBottom: 16 }}>
                    <h1 style={{ margin: 0, fontSize: 'clamp(28px,3.5vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: L.ink }}>
                      {counts.all} hendelser{' '}
                      <span style={{ color: L.muted, fontWeight: 400 }}>
                        {weekOffset === 0 ? 'denne uken' : 'denne perioden'}
                      </span>
                    </h1>
                  </div>
                  <div style={{ height: 1, background: L.border, marginBottom: 24 }} />

                  {/* States */}
                  {loadingReceipt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: L.muted, fontSize: 14 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="6" fill="none" stroke={L.border} strokeWidth="2" />
                        <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke={L.ink} strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Laster aktivitetsloggen…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 18, padding: '48px 32px', textAlign: 'center', maxWidth: 420 }}>
                      <ClipboardCheck size={28} style={{ color: L.muted, margin: '0 auto 14px', display: 'block' }} />
                      <p style={{ margin: '0 0 8px', color: L.ink, fontSize: 16, fontWeight: 600 }}>
                        {`Ingen handlinger ${weekOffset === 0 ? 'denne uken enda' : 'i denne uken'}`}
                      </p>
                      <p style={{ margin: '0 0 20px', color: L.muted, fontSize: 14, lineHeight: 1.6 }}>
                        {weekOffset === 0
                          ? 'Sikt jobber i bakgrunnen — første funn dukker opp her i løpet av kort tid etter at nettsiden er koblet til.'
                          : 'Sikt logget ingenting i denne perioden.'}
                      </p>
                      {weekOffset === 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('home')}
                          onMouseDown={pressD}
                          onMouseUp={pressU}
                          onMouseLeave={pressU}
                          style={{ background: L.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          Gå til Hjem
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Day groups */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                      {perDay.map((group) => (
                        <div key={group.dateKey}>
                          {/* Day header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: L.ink, textTransform: 'capitalize', flexShrink: 0 }}>
                              {group.weekdayLong.charAt(0).toUpperCase() + group.weekdayLong.slice(1)}
                            </h2>
                            <span style={{ fontFamily: MONO, fontSize: 12, color: L.muted, flexShrink: 0 }}>{group.label}</span>
                            <div style={{ flex: 1, height: 1, background: L.border }} />
                            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
                              {group.actions.length} hendelse{group.actions.length !== 1 ? 'r' : ''}
                            </span>
                          </div>

                          {/* Timeline */}
                          <div style={{ position: 'relative', paddingLeft: 48 }}>
                            {/* Vertical line */}
                            <div style={{ position: 'absolute', left: 14, top: 15, bottom: 15, width: 1, background: L.border }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {group.actions.map((a, idx) => {
                                const meta = categoryMeta(a.category);
                                const nodeColor = catColor(a.category);
                                const catBg = a.category === 'fix'
                                  ? 'rgba(82,164,71,0.12)'
                                  : a.category === 'alert'
                                  ? 'rgba(128,128,128,0.14)'
                                  : 'rgba(26,26,26,0.07)';
                                const globalIdx = filtered.indexOf(a);
                                return (
                                  <div
                                    key={a.id}
                                    style={{
                                      position: 'relative',
                                      animation: `log-card-in 220ms ${EASE} both`,
                                      animationDelay: `${globalIdx * 35}ms`,
                                    }}
                                  >
                                    {/* Node */}
                                    <div style={{
                                      position: 'absolute',
                                      left: -48,
                                      top: 14,
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: nodeColor,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: `0 0 0 3px ${L.bg}`,
                                    }}>
                                      {a.category === 'fix' ? (
                                        <CheckCircle2 size={13} style={{ color: '#fff' }} />
                                      ) : a.category === 'alert' ? (
                                        <Bell size={12} style={{ color: '#fff' }} />
                                      ) : a.category === 'suggestion' ? (
                                        <ArrowRight size={12} style={{ color: '#fff', transform: 'rotate(-45deg)' }} />
                                      ) : (
                                        <Search size={12} style={{ color: '#fff' }} />
                                      )}
                                    </div>

                                    {/* Card */}
                                    <div
                                      style={{
                                        background: L.card,
                                        border: `1px solid ${L.border}`,
                                        borderRadius: 14,
                                        padding: '16px 18px',
                                        boxShadow: '0 1px 2px rgba(26,26,26,0.02), 0 14px 34px -24px rgba(26,26,26,0.10)',
                                        transition: `transform 160ms ${EASE}, box-shadow 160ms ${EASE}, opacity 160ms ${EASE}`,
                                        opacity: a.status === 'done' ? 0.55 : 1,
                                      }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(26,26,26,0.03), 0 18px 40px -20px rgba(26,26,26,0.13)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(26,26,26,0.02), 0 14px 34px -24px rgba(26,26,26,0.10)'; }}
                                    >
                                      {/* Card top row: category pill + URL + time */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                        <span style={{
                                          background: catBg,
                                          color: nodeColor,
                                          borderRadius: 6,
                                          padding: '3px 8px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          letterSpacing: '0.04em',
                                          fontFamily: MONO,
                                        }}>
                                          {meta.label}
                                        </span>
                                        {a.page_url && (
                                          <span style={{ fontFamily: MONO, fontSize: 11, color: L.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {(() => {
                                              try {
                                                const u = new URL(a.page_url.startsWith('http') ? a.page_url : `https://${a.page_url}`);
                                                return u.hostname + u.pathname;
                                              } catch { return a.page_url; }
                                            })()}
                                          </span>
                                        )}
                                        <span style={{ fontFamily: MONO, fontSize: 11, color: L.muted, marginLeft: 'auto', flexShrink: 0 }}>
                                          {new Date(a.created_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>

                                      {/* Title */}
                                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: L.ink, lineHeight: 1.35, textDecoration: a.status === 'done' ? 'line-through' : 'none' }}>{a.title}</p>

                                      {/* Forklaring (fra motoren) */}
                                      {a.details?.explanation && (
                                        <p style={{ margin: '8px 0 0', fontSize: 13, color: L.muted, lineHeight: 1.55 }}>{a.details.explanation}</p>
                                      )}

                                      {/* Oppskrift: konkret «slik gjør du det» */}
                                      {a.details?.recipe && (
                                        <div style={{ background: L.bg, border: `1px solid ${L.border}`, borderRadius: 12, marginTop: 12, padding: '10px 12px' }}>
                                          <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Slik gjør du det</p>
                                          <p style={{ margin: 0, fontSize: 13, color: L.ink, lineHeight: 1.55 }}>{a.details.recipe}</p>
                                        </div>
                                      )}

                                      {/* Svarutkast (GBP-anmeldelser): klart til å lime inn */}
                                      {a.details?.reply && (
                                        <div style={{ background: L.bg, border: `1px solid ${L.border}`, borderRadius: 12, marginTop: 12, padding: '10px 12px' }}>
                                          <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Klart til å lime inn</p>
                                          <p style={{ margin: 0, fontSize: 13, color: L.ink, lineHeight: 1.55, fontStyle: 'italic' }}>«{a.details.reply}»</p>
                                        </div>
                                      )}

                                      {/* Before / After */}
                                      {(a.before_value || a.after_value) && (
                                        <div style={{
                                          background: L.bg,
                                          border: `1px solid ${L.border}`,
                                          borderRadius: 12,
                                          marginTop: 14,
                                          display: 'grid',
                                          gridTemplateColumns: a.before_value && a.after_value ? '1fr 28px 1fr' : '1fr',
                                          alignItems: 'start',
                                          overflow: 'hidden',
                                        }}>
                                          {a.before_value && (
                                            <div style={{ padding: '10px 12px' }}>
                                              <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Før</p>
                                              <p style={{ margin: 0, fontFamily: MONO, fontSize: 12, color: L.muted, textDecoration: 'line-through', lineHeight: 1.45 }}>{a.before_value}</p>
                                            </div>
                                          )}
                                          {a.before_value && a.after_value && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 22 }}>
                                              <ArrowRight size={12} style={{ color: L.green }} />
                                            </div>
                                          )}
                                          {a.after_value && (
                                            <div style={{ padding: '10px 12px' }}>
                                              <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Etter</p>
                                              <p style={{ margin: 0, fontFamily: MONO, fontSize: 12, color: L.green, fontWeight: 600, lineHeight: 1.45 }}>{a.after_value}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Handlingsrad: kopier + merk som gjort */}
                                      {(() => {
                                        const copyText = a.details?.reply || (a.category === 'suggestion' ? a.after_value : null);
                                        const canMarkDone = a.category === 'suggestion' || a.category === 'alert';
                                        if (!copyText && !canMarkDone) return null;
                                        return (
                                          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                            {copyText && (
                                              <button
                                                type="button"
                                                onClick={() => { navigator.clipboard?.writeText(copyText); toastSuccess('Kopiert til utklipp.'); }}
                                                onMouseDown={pressD}
                                                onMouseUp={pressU}
                                                onMouseLeave={pressU}
                                                style={{ background: 'none', border: 'none', color: L.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, transition: `transform 160ms ${EASE}` }}
                                              >
                                                <Copy size={12} /> Kopier til utklipp
                                              </button>
                                            )}
                                            {canMarkDone && (
                                              <button
                                                type="button"
                                                onClick={() => markActionDone(a.id, a.status !== 'done')}
                                                onMouseDown={pressD}
                                                onMouseUp={pressU}
                                                onMouseLeave={pressU}
                                                style={{ background: 'none', border: 'none', color: a.status === 'done' ? L.muted : L.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, transition: `transform 160ms ${EASE}` }}
                                              >
                                                <CheckCircle2 size={12} /> {a.status === 'done' ? 'Angre «gjort»' : 'Merk som gjort'}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </main>
              </div>
              </div>
            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* INNSTILLINGER — KONFIGURASJON                                  */}
        {/* =============================================================== */}
        {activeTab === 'settings' && (() => {
          const settingsSans = PORTAL.sans;
          const settingsMono = settingsSans;
          // Redaksjonell serif-display (samme uttrykk som e-postene — docs/design-principles.md)
          const settingsSerif = PORTAL.serif;
          // Handbook-uttrykk — alle verdier hentes fra PORTAL (src/portalTheme.ts), ett kildested.
          // Tema-bevisst via CSS-variabler (lys=dagens verdier, mørk=override på .sikt-portal).
          const C = {
            ink: 'var(--ink)', muted: 'var(--muted)', faint: 'var(--faint)', hair: 'var(--hair)',
            green: 'var(--green)', insetBg: 'var(--inset)', insetBorder: 'var(--insetbd)',
            danger: 'var(--danger)', dangerBg: 'var(--dangerbg)', dangerBorder: 'var(--insetbd)',
          };
          const settingsDomain = domainLabel || 'ingen-nettside';
          const profileDisplayFields = [
            { label: 'Bedrift', value: clientData?.companyName || 'Ikke oppgitt' },
            { label: 'Kontaktperson', value: clientData?.contactPerson || 'Ikke oppgitt' },
            { label: 'E-post', value: clientData?.email || user?.email || 'Ikke oppgitt' },
            { label: 'Telefon', value: clientData?.phone || 'Ikke oppgitt' },
            { label: 'Nettside', value: websiteUrl || 'Legg inn under rediger profil' },
            { label: 'Bransje', value: clientData?.industry || 'Ikke oppgitt' },
            { label: 'Målgruppe', value: clientData?.targetAudience || 'Ikke oppgitt' },
          ];
          const profileEditFields = [
            { key: 'companyName', label: 'Bedrift', placeholder: 'Min Bedrift AS' },
            { key: 'contactPerson', label: 'Kontaktperson', placeholder: 'Ola Nordmann' },
            { key: 'email', label: 'E-post', placeholder: 'ola@bedrift.no' },
            { key: 'phone', label: 'Telefon', placeholder: '+47 ...' },
            { key: 'industry', label: 'Bransje', placeholder: 'F.eks. rørlegger' },
          ] as const;
          // «Ukentlig/Månedlig rapport» er flyttet til den nye Rapport-e-post-blokken
          // (frekvens + klokkeslett + innhold). Her igjen kun de rene av/på-varslene.
          const notifRows = [
            { id: 'criticalAlerts' as const, label: 'Kritiske varsler', desc: 'Når nettsiden går ned eller får alvorlige feil.' },
            { id: 'rankChanges' as const, label: 'Rangeringsendringer', desc: 'Når du går opp eller ned på topp 10.' },
          ];
          const sectionCountProfile = editingSection === 'profile' ? profileEditFields.length + 2 : profileDisplayFields.length;
          const sectionCountCms = (/basic/i.test(planBundle) && !hasStandardOrHigher) ? 0 : 3;
          const sectionCountNotif = notifRows.length;
          const sectionCountTheme = 2;
          const planCost = planPrices[activePlanKey];

          const sectionShell = "rounded-[14px] border border-[color:var(--hair)] bg-[color:var(--surface)] overflow-hidden";
          const sectionSummary = "list-none px-5 sm:px-6 py-4 cursor-pointer";
          const rowShell = "flex items-start justify-between gap-4 py-3.5 border-t border-[color:var(--hair)]";
          // Tonet inset = «aksent-lampen»: gir dybde til en nøkkel-merknad uten å rope (lag-på-lag-lys).
          const Note = ({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'danger'; children: React.ReactNode }) => {
            const s = tone === 'green'
              ? { background: C.insetBg, border: `1px solid ${C.insetBorder}`, color: '#2F5C45' }
              : tone === 'danger'
                ? { background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, color: C.danger }
                : { background: 'var(--subtle)', border: `1px solid ${C.hair}`, color: C.muted };
            return <div className="rounded-[11px] px-4 py-3 text-sm" style={{ ...s, lineHeight: 1.6 }}>{children}</div>;
          };
          // Seksjons-tittel med liten aksent-strek (gjentar e-postenes sectionHead-motiv).
          const SectionTitle = ({ children, truncate = false }: { children: React.ReactNode; truncate?: boolean }) => (
            <span className="inline-flex items-center gap-2.5 min-w-0">
              <span aria-hidden style={{ width: 18, height: 2, background: C.green, borderRadius: 2, flexShrink: 0 }} />
              <span className={`text-base sm:text-lg font-semibold ${truncate ? 'truncate' : ''}`} style={{ color: C.ink, fontFamily: settingsSans }}>{children}</span>
            </span>
          );

          return (
            <div key={activeTab} className="space-y-6 font-['Geist','DM_Sans',sans-serif]">
              <header>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em]" style={{ color: C.ink, fontFamily: settingsSerif }}>Innstillinger</h1>
                <p className="text-base mt-3 max-w-[58ch]" style={{ color: C.muted, lineHeight: 1.6 }}>Bedrift, tilkobling, abonnement og varsler — samlet på ett sted.</p>
                <div aria-hidden className="mt-7" style={{ borderTop: `1px solid ${C.hair}` }} />
              </header>
              <div className={`${tabFadeInClass} space-y-8`}>
              {/* +S statement-rad: ett kort, tre celler delt av hårstrek (speiler e-postens statRow). */}
              <div className="rounded-[14px] border border-[color:var(--hair)] bg-[color:var(--surface)] px-5 py-6 sm:px-8 sm:py-7">
                <div className="grid grid-cols-1 sm:grid-cols-3">
                  {[
                    { label: 'Plan', value: planNames[activePlanKey], color: C.ink, focal: false },
                    { label: 'Pris per måned', value: planCost, color: C.ink, focal: true },
                    { label: 'Nettside-kobling', value: hostIsAdvisory ? platformLabel(hostConnection?.platform) : hostIsFullyConnected ? 'WordPress' : hostWasLightOnly ? 'Koble på nytt' : 'Ikke koblet', color: (hostIsFullyConnected || hostIsAdvisory) ? C.green : C.ink, focal: false },
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      className="py-4 first:pt-0 last:pb-0 border-t border-[color:var(--hair)] first:border-t-0 sm:py-0 sm:border-t-0 sm:px-6 first:sm:pl-0 last:sm:pr-0 sm:border-l sm:border-[color:var(--hair)] first:sm:border-l-0"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.faint }}>{cell.label}</p>
                      <p className="mt-2.5 tabular-nums" style={{ color: cell.color, fontFamily: settingsSerif, fontWeight: 700, letterSpacing: '-0.6px', fontSize: cell.focal ? '34px' : '24px', lineHeight: 1.05 }}>{cell.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <SectionTitle truncate>Bedrift og nettside</SectionTitle>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setEditingSection(editingSection === 'profile' ? null : 'profile'); }}
                      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      className="text-[13px] font-medium px-3 py-1.5 rounded-full"
                      style={{ color: 'var(--ink)', border: '1px solid var(--hair)', background: 'var(--surface)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                    >
                      {editingSection === 'profile' ? 'Ferdig' : 'Rediger'}
                    </button>
                  </div>
                </summary>
                <div className="px-4 sm:px-6 pb-5">
                  {editingSection !== 'profile' ? (
                    <dl>
                      {profileDisplayFields.map((row) => (
                        <div key={row.label} className={rowShell}>
                          <dt className="text-sm" style={{ color: C.muted }}>{row.label}</dt>
                          <dd className="text-sm text-right max-w-[70%] break-words" style={{ color: C.ink, fontFamily: settingsMono }}>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="space-y-4 pt-1">
                      {profileEditFields.map((f) => (
                        <div key={f.key}>
                          <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>{f.label}</label>
                          <input
                            type="text"
                            value={formData[f.key] ?? ''}
                            onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                            placeholder={f.placeholder}
                            className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                            style={{ color: 'var(--ink)' }}
                          />
                        </div>
                      ))}
                      <div>
                        <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>
                          Nettside
                          {urlLocked && (
                            <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full border border-[color:var(--hair)]" style={{ color: 'var(--muted)' }}>
                              låst i {urlDaysLeft} dager
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={formData.websiteUrl ?? ''}
                          onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                          placeholder="https://minbedrift.no"
                          disabled={urlLocked}
                          className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ color: 'var(--ink)' }}
                        />
                        <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                          Du kan endre nettadressen én gang per uke. Etter lagring er den låst i 7 dager.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>Målgruppe</label>
                        <textarea
                          value={formData.targetAudience ?? ''}
                          onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                          placeholder="Hvem vil du nå?"
                          rows={3}
                          className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none resize-none"
                          style={{ color: 'var(--ink)' }}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingSection(null)}
                          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)]"
                          style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                        >
                          Avbryt
                        </button>
                        <button
                          type="button"
                          onClick={async () => { await handleSaveSettings(formData); setEditingSection(null); }}
                          disabled={saving}
                          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white inline-flex items-center gap-2 disabled:opacity-70"
                          style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Lagre
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </details>

              {!(/basic/i.test(planBundle) && !hasStandardOrHigher) && (
                <details className={sectionShell} open>
                  <summary className={sectionSummary}>
                    <div className="flex items-center gap-3 min-w-0">
                      <SectionTitle truncate>Nettside-kobling</SectionTitle>
                    </div>
                  </summary>
                  <div className="px-4 sm:px-6 pb-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-[color:var(--hair)] bg-[color:var(--surface)] p-4 flex flex-col min-h-[140px]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>WordPress</p>
                          {hostIsFullyConnected && (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full shrink-0" style={{ color: 'var(--green)', background: 'var(--inset)' }}>
                              tilkoblet
                            </span>
                          )}
                        </div>
                        {hostIsFullyConnected ? (
                          <>
                            <p className="text-sm mt-3 flex-1 break-words" style={{ color: 'var(--muted)' }}>
                              Tilkoblet: {hostConnection?.adminUrl || '—'} som {hostConnection?.notes || '—'}
                            </p>
                            <button
                              type="button"
                              onClick={() => { setDisconnectError(null); setShowDisconnectConfirm(true); }}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 text-sm text-left"
                              style={{ color: 'var(--muted)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              Koble fra
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm mt-3 flex-1" style={{ color: 'var(--muted)' }}>
                              {hostWasLightOnly
                                ? 'Tidligere registrert uten skrivetilgang. Koble til på nytt med Application Password.'
                                : 'Koble til for at Sikt kan gjøre endringer direkte på siden din.'}
                            </p>
                            <button
                              type="button"
                              onClick={() => openHostConnectWizard('wordpress')}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white"
                              style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              {hostWasLightOnly ? 'Koble til WordPress (på nytt)' : 'Koble til'}
                            </button>
                          </>
                        )}
                      </div>
                      <div className="rounded-xl border border-[color:var(--hair)] bg-[color:var(--surface)] p-4 flex flex-col min-h-[140px]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Andre plattformer</p>
                          {hostIsAdvisory && (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full shrink-0" style={{ color: 'var(--green)', background: 'var(--inset)' }}>
                              tilkoblet
                            </span>
                          )}
                        </div>
                        {hostIsAdvisory ? (
                          <>
                            <p className="text-sm mt-3 flex-1 break-words" style={{ color: 'var(--muted)' }}>
                              Rådgiver-modus ({platformLabel(hostConnection?.platform)}): {hostConnection?.adminUrl || '—'}. Du kopierer Sikt-forslag inn selv.
                            </p>
                            <button
                              type="button"
                              onClick={() => { setDisconnectError(null); setShowDisconnectConfirm(true); }}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 text-sm text-left"
                              style={{ color: 'var(--muted)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              Koble fra
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm mt-3 flex-1" style={{ color: 'var(--muted)' }}>
                              Shopify, Wix, Squarespace, Webflow, Ghost m.fl. Sikt lager ferdige forslag du limer inn selv.
                            </p>
                            <button
                              type="button"
                              onClick={() => openHostConnectWizard()}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white"
                              style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              Velg plattform
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <Note tone="green">
                      WordPress får ekte auto-fiks. Shopify er på vei. Andre plattformer får ferdige forslag du limer inn — uansett hva du bruker.
                    </Note>
                    {!hostIsFullyConnected && !hostIsAdvisory && (
                      <Note tone="neutral">
                        Ikke koblet til. Sikt viser fortsatt funn og forslag, men du må kopiere fiksene inn selv.
                      </Note>
                    )}
                  </div>
                </details>
              )}

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center gap-3">
                    <SectionTitle>Abonnement</SectionTitle>
                  </div>
                </summary>
                <div className="px-4 sm:px-6 pb-5">
                  <div className="grid sm:grid-cols-3 gap-3">
                    {(['BASIC', 'STANDARD', 'PREMIUM'] as const).map((key) => {
                      const isCurrent = activePlanKey === key;
                      const order: Record<string, number> = { BASIC: 1, STANDARD: 2, PREMIUM: 3 };
                      const type: 'upgrade' | 'downgrade' = order[key] > order[activePlanKey] ? 'upgrade' : 'downgrade';
                      return (
                        <div key={key} className="rounded-xl border border-[color:var(--hair)] bg-[color:var(--surface)] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted)' }}>{planNames[key]}</p>
                          <p className="text-xl font-semibold mt-2 tabular-nums" style={{ color: 'var(--ink)' }}>{planPrices[key]}<span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>/mnd</span></p>
                          {isCurrent ? (
                            <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--green)' }}>Aktiv</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPlanChangeTarget({ key, name: planNames[key], price: planPrices[key], type })}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-3 text-sm"
                              style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              {type === 'upgrade' ? 'Oppgrader' : 'Nedgrader'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[color:var(--hair)]">
                    <button
                      type="button"
                      onClick={openCancelModal}
                      className="text-sm font-medium"
                      style={{ color: 'var(--muted)', transition: 'color 160ms cubic-bezier(0.23,1,0.32,1)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#B4231F'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#8A8578'; }}
                    >
                      Avslutt abonnement
                    </button>
                  </div>
                </div>
              </details>

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center gap-3">
                    <SectionTitle>Varsler</SectionTitle>
                  </div>
                </summary>
                <div className="px-5 sm:px-6 pb-6">
                  <p className="text-sm" style={{ color: C.muted, lineHeight: 1.6 }}>Vi sender bare det du velger — og du kan endre det når som helst.</p>

                  {/* Kunde-styrt rapport-e-post: frekvens, dag, klokkeslett, innhold. */}
                  <div className="mt-4 rounded-[12px] border border-[color:var(--hair)] p-4 sm:p-5">
                    <p className="text-sm font-semibold" style={{ color: C.ink }}>Rapport-e-post</p>
                    <p className="text-xs mt-1" style={{ color: C.muted, lineHeight: 1.6 }}>Hvor ofte, når og hva e-posten skal inneholde. Tidspunkt er norsk tid.</p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <label className="block">
                        <span className="block text-xs mb-1.5" style={{ color: C.muted }}>Hvor ofte</span>
                        <select
                          value={notifPrefs.reportFrequency}
                          onChange={(e) => { const f = e.target.value; patchNotifPrefs({ reportFrequency: f, weeklyReport: f !== 'off' }); }}
                          className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                          style={{ color: C.ink }}
                        >
                          <option value="off">Av</option>
                          <option value="thrice_week">3 ganger i uken</option>
                          <option value="twice_week">2 ganger i uken</option>
                          <option value="weekly">Ukentlig</option>
                          <option value="biweekly">Annenhver uke</option>
                          <option value="monthly">Månedlig</option>
                        </select>
                      </label>

                      {notifPrefs.reportFrequency !== 'off' && (
                        <label className="block">
                          <span className="block text-xs mb-1.5" style={{ color: C.muted }}>Dag</span>
                          <select
                            value={notifPrefs.reportAnchorDay}
                            onChange={(e) => patchNotifPrefs({ reportAnchorDay: Number(e.target.value) })}
                            className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                            style={{ color: C.ink }}
                          >
                            {[[1,'Mandag'],[2,'Tirsdag'],[3,'Onsdag'],[4,'Torsdag'],[5,'Fredag'],[6,'Lørdag'],[7,'Søndag']].map(([v,l]) => (
                              <option key={v as number} value={v as number}>{l}</option>
                            ))}
                          </select>
                        </label>
                      )}

                      {notifPrefs.reportFrequency !== 'off' && (
                        <label className="block">
                          <span className="block text-xs mb-1.5" style={{ color: C.muted }}>Klokkeslett</span>
                          <select
                            value={notifPrefs.reportHour}
                            onChange={(e) => patchNotifPrefs({ reportHour: Number(e.target.value) })}
                            className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                            style={{ color: C.ink }}
                          >
                            {Array.from({ length: 17 }, (_, i) => 6 + i).map((h) => (
                              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>

                    {notifPrefs.reportFrequency !== 'off' && (() => {
                      const names = ['', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
                      const wrap = (d: number) => ((d - 1) % 7 + 7) % 7 + 1;
                      const a = notifPrefs.reportAnchorDay;
                      const f = notifPrefs.reportFrequency;
                      const hint = f === 'twice_week' ? `Sendes ${names[a]} og ${names[wrap(a + 3)]}.`
                        : f === 'thrice_week' ? `Sendes ${names[a]}, ${names[wrap(a + 2)]} og ${names[wrap(a + 4)]}.`
                        : f === 'monthly' ? `Sendes første ${names[a]} i måneden.`
                        : f === 'biweekly' ? `Sendes annenhver ${names[a]}.`
                        : `Sendes hver ${names[a]}.`;
                      return <p className="text-xs mt-2" style={{ color: C.faint }}>{hint}</p>;
                    })()}

                    {notifPrefs.reportFrequency !== 'off' && (
                      <div className="mt-4 pt-4 border-t border-[color:var(--hair)]">
                        <p className="text-sm font-semibold" style={{ color: C.ink }}>Hva rapporten inneholder</p>
                        <ul className="mt-1">
                          {([
                            ['results', 'Resultater', 'Seire og hva trafikken er verdt.', true],
                            ['opportunity', 'Ukens mulighet', 'Neste søkeord å ta.', true],
                            ['work', 'Arbeid', 'Fikser, funn og AI-forslag.', true],
                            ['competitors', 'Konkurrenter', 'Hva konkurrentene gjør.', hasStandardOrHigher],
                            ['aiVisibility', 'AI-synlighet', 'Nevner ChatGPT deg?', currentLevel >= 3],
                            ['lifetime', 'Livstidstall', 'Totalt siden du startet.', true],
                          ] as const).filter(([, , , show]) => show).map(([id, label, desc]) => {
                            const on = notifPrefs.reportSections[id as keyof typeof notifPrefs.reportSections];
                            return (
                              <li key={id} className={rowShell}>
                                <div className="min-w-0 pr-2">
                                  <p className="text-sm font-medium" style={{ color: C.ink }}>{label}</p>
                                  <p className="text-xs mt-1" style={{ color: C.muted, lineHeight: 1.6 }}>{desc}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleSection(id as keyof typeof notifPrefs.reportSections)}
                                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full"
                                    style={{ background: on ? C.green : C.hair, transition: 'background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                                  >
                                    <span className="inline-block h-4 w-4 rounded-full bg-white" style={{ transform: on ? 'translateX(24px)' : 'translateX(4px)', transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)' }} />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>

                  <ul className="mt-1">
                    {notifRows.map((item) => (
                      <li key={item.id} className={rowShell}>
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-medium" style={{ color: C.ink }}>{item.label}</p>
                          <p className="text-xs mt-1" style={{ color: C.muted, lineHeight: 1.6 }}>{item.desc}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleNotif(item.id)}
                            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full"
                            style={{ background: notifPrefs[item.id] ? C.green : C.hair, transition: 'background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                          >
                            <span
                              className="inline-block h-4 w-4 rounded-full bg-white"
                              style={{ transform: notifPrefs[item.id] ? 'translateX(24px)' : 'translateX(4px)', transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center gap-3">
                    <SectionTitle>Utseende</SectionTitle>
                  </div>
                </summary>
                <div className="px-4 sm:px-6 pb-5">
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      ['light', 'Lys', Sun],
                      ['dark', 'Mørk', Moon],
                      ['system', 'System', Monitor],
                    ] as const).map(([val, label, Icon]) => {
                      const active = (themePref ?? 'system') === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTheme(val)}
                          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          className="px-3 py-4 rounded-[12px] border text-sm font-medium inline-flex items-center justify-center gap-2"
                          style={{
                            borderColor: active ? 'var(--ink)' : 'var(--hair)',
                            background: active ? 'var(--ink)' : 'var(--surface)',
                            color: active ? 'var(--surface)' : 'var(--ink)',
                            transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)',
                          }}
                        >
                          <Icon size={16} /> {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>«System» følger enhetens lyse/mørke innstilling automatisk.</p>
                </div>
              </details>

              <div className="rounded-[14px] border border-[color:var(--hair)] bg-[color:var(--surface)] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <SectionTitle>Vanlige spørsmål</SectionTitle>
                  <button
                    type="button"
                    onClick={() => setShowFaqModal(true)}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="text-[13px] font-medium px-3 py-1.5 rounded-full"
                    style={{ color: 'var(--ink)', border: '1px solid var(--hair)', background: 'var(--surface)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Åpne
                  </button>
                </div>
                <p className="text-sm" style={{ color: C.muted, lineHeight: 1.6 }}>
                  Felles svar om analyseintervall, GSC-forsinkelse, GEO-status og Technical Score.
                </p>
              </div>

              <div
                className="rounded-[14px] border p-5 sm:p-6"
                style={{ borderColor: C.dangerBorder, background: C.dangerBg }}
              >
                <h3 className="text-lg font-semibold" style={{ color: C.danger }}>Slett konto</h3>
                <p className="text-sm mt-2 mb-4" style={{ color: C.muted, lineHeight: 1.6 }}>
                  Dette sletter kontoen din og alle data permanent. Handlingen kan ikke angres.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    resetDeleteAccountModal();
                    setShowDeleteAccountModal(true);
                  }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: C.danger, transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                >
                  Slett konto
                </button>
              </div>
              </div>
            </div>
          );
        })()}

        <footer className="mt-12 pt-6 border-t border-[color:var(--hair)] text-center text-sm font-['Geist','DM_Sans',sans-serif]" style={{ color: 'var(--muted)' }}>
          <p className="inline-flex items-center justify-center gap-2 flex-wrap">
            <span>support@siktseo.com</span>
            <span>·</span>
            <span>Svar innen 1 virkedag</span>
          </p>
        </footer>

        {showFaqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Lukk FAQ"
              onClick={() => setShowFaqModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-2xl rounded-2xl border border-[color:var(--hair)] bg-[color:var(--surface)] p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Vanlige spørsmål</h3>
                <button type="button" onClick={() => setShowFaqModal(false)} className="p-1.5 rounded-md" style={{ color: 'var(--muted)' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                {[
                  {
                    q: 'Hvor raskt ser jeg resultater i Sikt?',
                    a: 'Teknisk analyse vises vanligvis innen 30-60 sekunder, mens søkeordsdata fra GSC kan ta 7-14 dager.',
                  },
                  {
                    q: 'Hvorfor vises ingen søkeord ennå?',
                    a: 'Google Search Console trenger historikk før data vises. Sørg for at siden er verifisert og indeksert.',
                  },
                  {
                    q: 'Hvordan oppgraderer jeg abonnementet?',
                    a: 'Trykk på «Oppgrader» i portalen. Du sendes direkte til Stripe checkout for valgt plan.',
                  },
                  {
                    q: 'Kan jeg koble flere nettsider?',
                    a: 'Per nå støtter portalen én hovedside per bruker. Kontakt support for fler-domene oppsett.',
                  },
                  {
                    q: 'Hva betyr Technical Score?',
                    a: 'Scoren vurderer lastetid, mobilvennlighet, sikkerhet og SEO-tekniske signaler på en skala fra 0 til 100.',
                  },
                  {
                    q: 'Hvordan fungerer GEO-fanen?',
                    a: 'Du kan teste synlighet manuelt i AI-søk nå. Automatisk GEO-sporing lanseres i Q3 2026.',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-[color:var(--hair)] p-4">
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{item.q}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </main>

      {/* =============================================================== */}
      {/* WORDPRESS CONNECT WIZARD                                        */}
      {/* =============================================================== */}
      {showWpWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <style>{`
            @keyframes wp-wizard-in {
              from { opacity: 0; transform: translateY(8px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @media (prefers-reduced-motion: reduce) {
              @keyframes wp-wizard-in {
                from { opacity: 0; }
                to   { opacity: 1; }
              }
            }
          `}</style>
          <button
            type="button"
            aria-label="Lukk"
            onClick={closeWpWizard}
            disabled={wpConnecting || wixConnecting}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait"
            style={{ transition: 'opacity 200ms ease-out' }}
          />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-[color:var(--hair)] bg-[color:var(--surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ animation: 'wp-wizard-in 220ms cubic-bezier(0.23,1,0.32,1) forwards' }}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-[0.12em]" style={{ color: 'var(--muted)', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                {connectWizardPlatform === null
                  ? 'Velg plattform'
                  : connectWizardPlatform === 'shopify'
                    ? 'Shopify'
                    : advisoryPlatform
                      ? platformLabel(advisoryPlatform)
                      : wpWizardStep === 3
                        ? 'Resultat'
                        : `Trinn ${wpWizardStep} av 3`}
              </p>
              <button
                type="button"
                onClick={closeWpWizard}
                disabled={wpConnecting || wixConnecting}
                className="p-1.5 rounded-md disabled:opacity-40"
                style={{ color: 'var(--muted)', transition: 'opacity 160ms ease-out' }}
              >
                <X size={16} />
              </button>
            </header>

            {connectWizardPlatform === null && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Hvilken plattform bruker du?</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  WordPress kobles med skrivetilgang så Sikt fikser automatisk. På andre plattformer lager Sikt ferdige forslag du limer inn selv.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectWizardPlatform('wordpress');
                      setWpWizardStep(1);
                    }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="text-left p-4 rounded-xl border border-violet-300 bg-violet-50/40 [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-500"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), border-color 160ms ease' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>WordPress <span className="text-violet-600">· auto-fiks</span></p>
                    <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Sikt pusher endringer direkte til siden</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectWizardPlatform('shopify')}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="text-left p-4 rounded-xl border border-violet-300 bg-violet-50/40 [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-500"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), border-color 160ms ease' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Shopify <span className="text-violet-600">· auto-fiks</span></p>
                    <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Sikt oppdaterer SEO via Admin API</p>
                  </button>
                  {ADVISORY_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setConnectWizardPlatform(p.id)}
                      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      className="text-left p-4 rounded-xl border border-[color:var(--hair)] bg-[color:var(--surface)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[color:var(--ink)]"
                      style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), border-color 160ms ease' }}
                    >
                      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{p.label}</p>
                      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{p.hint}</p>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeWpWizard}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)]"
                    style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}

            {advisoryPlatform && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Koble til {platformLabel(advisoryPlatform)}</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Lim inn nettadressen din (https). Sikt lager ferdige forslag — meta-titler, beskrivelser, FAQ og mer — som du kopierer inn i {platformLabel(advisoryPlatform)}.
                </p>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>Nettside-URL</label>
                  <input
                    type="url"
                    value={wixSiteUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWixSiteUrl(v);
                      if (!v.trim()) setWixSiteUrlError(null);
                      else if (!v.trim().startsWith('https://')) setWixSiteUrlError('Må starte med https://');
                      else setWixSiteUrlError(null);
                    }}
                    placeholder="https://dinside.no"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                  {wixSiteUrlError ? (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{wixSiteUrlError}</p>
                  ) : (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Må starte med https://</p>
                  )}
                </div>
                {wixConnectError && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--navbg)', color: 'var(--danger)', border: '1px solid var(--hair)' }}>
                    {wixConnectError}
                  </div>
                )}
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConnectWizardPlatform(null)}
                    disabled={wixConnecting}
                    onMouseDown={(e) => { if (wixConnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] disabled:opacity-50"
                    style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={connectAdvisory}
                    disabled={!wixStepValid || wixConnecting}
                    onMouseDown={(e) => { if (!wixStepValid || wixConnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    {wixConnecting ? <Loader2 size={14} className="animate-spin" /> : null}
                    Koble til
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'shopify' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Koble til Shopify</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Sikt oppdaterer SEO-titler og beskrivelser automatisk via Shopify Admin API. Lag en «custom app» i Shopify og lim inn tokenet — det tar ett minutt.
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: 'var(--ink)' }}>
                  <li>I Shopify-admin: Innstillinger → Apper og salgskanaler → <em>Utvikle apper</em>.</li>
                  <li>Klikk «Opprett app», gi den navnet «Sikt».</li>
                  <li>Under «Konfigurasjon» → Admin API: gi tilgangene <code style={{ background: 'var(--navbg)', padding: '1px 5px', borderRadius: 4 }}>write_products</code> og <code style={{ background: 'var(--navbg)', padding: '1px 5px', borderRadius: 4 }}>write_content</code>.</li>
                  <li>Installer appen, og under «API-legitimasjon» kopier <em>Admin API-tilgangstoken</em> (starter med <code style={{ background: 'var(--navbg)', padding: '1px 5px', borderRadius: 4 }}>shpat_</code>) — vises kun én gang.</li>
                </ol>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>Shopify-adresse (.myshopify.com)</label>
                  <input
                    type="text"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="minbutikk.myshopify.com"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                  <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Finner du i Shopify under Innstillinger → Domener</p>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>Admin API-tilgangstoken</label>
                  <input
                    type="password"
                    value={shopToken}
                    onChange={(e) => setShopToken(e.target.value)}
                    placeholder="shpat_..."
                    autoComplete="new-password"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                </div>
                {shopConnectError && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--navbg)', color: 'var(--danger)', border: '1px solid var(--hair)' }}>
                    {shopConnectError}
                  </div>
                )}
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConnectWizardPlatform(null)}
                    disabled={shopConnecting}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] disabled:opacity-50"
                    style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={connectShopify}
                    disabled={!shopStepValid || shopConnecting}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    {shopConnecting ? <Loader2 size={14} className="animate-spin" /> : null}
                    Koble til
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'wordpress' && wpWizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Installer Sikt-tillegget</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Sikt fikser siden din via et lite, trygt WordPress-tillegg. Last det ned og installer det først — det tar ett minutt.
                </p>
                <a
                  href="/sikt-connector.zip"
                  download
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white"
                  style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}
                >
                  <Download size={15} /> Last ned Sikt Connector
                </a>
                <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: 'var(--ink)' }}>
                  <li>I WordPress-admin: gå til Tillegg → Legg til nytt → Last opp tillegg.</li>
                  <li>Velg filen <code style={{ background: 'var(--navbg)', padding: '1px 5px', borderRadius: 4 }}>sikt-connector.zip</code> du nettopp lastet ned.</li>
                  <li>Klikk &quot;Installer nå&quot;, deretter &quot;Aktiver&quot;.</li>
                </ol>
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--navbg)', color: 'var(--muted)' }}>
                  Allerede installert tidligere? Last ned på nytt og velg «Erstatt» for å få siste versjon — nye funksjoner som schema, alt-tekst og llms.txt krever det.
                </div>

                <div className="pt-1 border-t" style={{ borderColor: 'var(--hair)' }} />
                <h3 className="text-lg font-semibold pt-1" style={{ color: 'var(--ink)' }}>Lag et Application Password</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Sikt trenger et eget passord for å gjøre endringer på siden din. Det er trygt, du kan trekke det tilbake når som helst, og det erstatter ikke vanlig innlogging.
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: 'var(--ink)' }}>
                  <li>Gå til Brukere → Profil i WordPress-admin.</li>
                  <li>Bla ned til &quot;Application Passwords&quot;.</li>
                  <li>Skriv &quot;Sikt&quot; som navn, klikk &quot;Add New&quot;.</li>
                  <li>Kopier den 24-tegns koden som vises — den vises kun én gang.</li>
                </ol>
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--navbg)', color: 'var(--ink)' }}>
                  Hvis du ikke ser Application Passwords-seksjonen, kan WordPress-versjonen din være for gammel. Du må ha WordPress 5.6 eller nyere.
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeWpWizard}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)]"
                    style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={() => setWpWizardStep(2)}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Jeg har koden, fortsett →
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'wordpress' && wpWizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Koble til WordPress</h3>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>WordPress-adresse</label>
                  <input
                    type="url"
                    value={wpSiteUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWpSiteUrl(v);
                      if (!v.trim()) setWpSiteUrlError(null);
                      else if (!v.trim().startsWith('https://')) setWpSiteUrlError('Må starte med https://');
                      else setWpSiteUrlError(null);
                    }}
                    placeholder="https://dinside.no"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                  {wpSiteUrlError ? (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{wpSiteUrlError}</p>
                  ) : (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Må starte med https://</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>Brukernavn</label>
                  <input
                    type="text"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="ditt-wp-brukernavn"
                    autoComplete="username"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>Application Password</label>
                  <input
                    type="password"
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    autoComplete="new-password"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                  <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                    Lim inn akkurat slik WordPress viste den, med mellomrom
                  </p>
                </div>
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWpWizardStep(1)}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)]"
                    style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={connectWordPress}
                    disabled={!wpStep2Valid}
                    onMouseDown={(e) => { if (!wpStep2Valid) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Koble til
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'wordpress' && wpWizardStep === 3 && (
              <div className="space-y-4">
                {wpConnecting && (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <Loader2 size={28} className="animate-spin" style={{ color: '#52A447' }} />
                    <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
                      Verifiserer mot WordPress-siden din — dette tar opp til 10 sekunder.
                    </p>
                  </div>
                )}
                {!wpConnecting && wpConnectResult && (
                  <div className="space-y-4">
                    <div className="rounded-xl px-4 py-4" style={{ background: 'var(--navbg)' }}>
                      <p className="text-lg font-semibold" style={{ color: '#52A447' }}>Tilkoblet ✓</p>
                      <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                        {wpConnectResult.site} · {wpConnectResult.wpUser}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={closeWpWizard}
                        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white"
                        style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                      >
                        Ferdig
                      </button>
                    </div>
                  </div>
                )}
                {!wpConnecting && wpConnectError && (
                  <div className="space-y-4">
                    <div className="rounded-xl px-4 py-4 text-sm" style={{ background: 'var(--navbg)', color: 'var(--danger)', border: '1px solid var(--hair)' }}>
                      {wpConnectError}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setWpConnectError(null); setWpWizardStep(2); }}
                        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white"
                        style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                      >
                        Prøv igjen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={closeDeleteAccountModal}
            disabled={deletingAccount}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[color:var(--hair)] bg-[color:var(--surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--danger)' }}>Slett konto permanent?</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>
              Dette sletter følgende permanent og kan ikke angres:
            </p>
            <ul className="text-sm mb-3 space-y-1.5 list-disc pl-5" style={{ color: 'var(--ink)', lineHeight: 1.5 }}>
              <li>WordPress-tilkoblinger</li>
              <li>Skann og analyser</li>
              <li>Konkurrentdata</li>
              <li>Søkeord og rangeringer</li>
              <li>Selve kontoen din</li>
            </ul>
            <p className="text-sm mb-4 font-semibold" style={{ color: 'var(--danger)', lineHeight: 1.55 }}>
              Sletting kansellerer IKKE abonnementet ditt. Si opp abonnementet separat for å unngå videre trekk.
            </p>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>
              Skriv SLETT for å bekrefte
            </label>
            <input
              type="text"
              value={deleteAccountConfirmText}
              onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
              autoComplete="off"
              disabled={deletingAccount}
              placeholder="SLETT"
              className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none disabled:opacity-60"
              style={{ color: 'var(--ink)', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}
            />
            {deleteAccountError && (
              <div className="rounded-xl px-4 py-3 text-sm mt-4" style={{ background: 'var(--navbg)', color: 'var(--danger)', border: '1px solid rgba(192,57,43,0.25)' }}>
                {deleteAccountError}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={closeDeleteAccountModal}
                disabled={deletingAccount}
                onMouseDown={(e) => { if (deletingAccount) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] disabled:opacity-50"
                style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={deletingAccount || deleteAccountConfirmText !== 'SLETT'}
                onMouseDown={(e) => { if (deletingAccount || deleteAccountConfirmText !== 'SLETT') return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className={`rounded-full px-4 py-2 text-sm text-white inline-flex items-center gap-2${deletingAccount || deleteAccountConfirmText !== 'SLETT' ? ' opacity-50 cursor-not-allowed' : ''}`}
                style={{ background: '#C0392B', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                {deletingAccount ? <Loader2 size={14} className="animate-spin" /> : null}
                Slett konto permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={closeCancelModal}
            disabled={cancelSubmitting}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[color:var(--hair)] bg-[color:var(--surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto font-['Geist','DM_Sans',sans-serif]">
            {!cancelDone ? (
              <>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>Avslutt abonnement</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--ink)', lineHeight: 1.55 }}>
                  Ingen bindingstid — du beholder tilgang ut perioden du har betalt for. Før du går: hva er hovedgrunnen? Det hjelper oss å bli bedre.
                </p>
                <div className="space-y-1.5 mb-4">
                  {CANCEL_REASONS.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer border"
                      style={{
                        borderColor: cancelReason === r.id ? '#1A1A1A' : '#E9E4DA',
                        background: cancelReason === r.id ? '#FAF8F3' : '#FFFFFF',
                        transition: 'border-color 140ms, background 140ms',
                      }}
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={r.id}
                        checked={cancelReason === r.id}
                        onChange={() => { setCancelReason(r.id); setCancelError(null); }}
                        className="accent-[#1A1A1A]"
                      />
                      <span className="text-sm" style={{ color: 'var(--ink)' }}>{r.label}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={cancelComment}
                  onChange={(e) => setCancelComment(e.target.value)}
                  placeholder="Vil du si mer? (valgfritt)"
                  rows={3}
                  className="w-full rounded-lg px-3 py-2.5 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] focus:outline-none resize-none"
                  style={{ color: 'var(--ink)' }}
                />
                {cancelError && (
                  <div className="rounded-xl px-4 py-3 text-sm mt-4" style={{ background: 'var(--dangerbg)', color: 'var(--danger)', border: '1px solid rgba(180,35,31,0.25)' }}>
                    {cancelError}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-5">
                  <button
                    type="button"
                    onClick={closeCancelModal}
                    disabled={cancelSubmitting}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] disabled:opacity-50"
                    style={{ color: 'var(--ink)' }}
                  >
                    Behold abonnementet
                  </button>
                  <button
                    type="button"
                    onClick={submitCancellation}
                    disabled={cancelSubmitting || !cancelReason}
                    className={`rounded-full px-4 py-2 text-sm text-white inline-flex items-center gap-2${cancelSubmitting || !cancelReason ? ' opacity-50 cursor-not-allowed' : ''}`}
                    style={{ background: '#B4231F' }}
                  >
                    {cancelSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    Avslutt abonnement
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>Takk — vi har registrert det</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--ink)', lineHeight: 1.55 }}>
                  Vi har lagret tilbakemeldingen din. For å stoppe videre trekk fullfører vi oppsigelsen i betalingsløsningen — skriv til
                  {' '}<a href="mailto:support@siktseo.com?subject=Avslutt%20abonnement" className="underline" style={{ color: 'var(--ink)' }}>support@siktseo.com</a>{' '}
                  så bekrefter vi med en gang. Du beholder tilgang ut perioden du har betalt for.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white"
                  >
                    Lukk
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={() => { if (!isDisconnecting) { setShowDisconnectConfirm(false); setDisconnectError(null); } }}
            disabled={isDisconnecting}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[color:var(--hair)] bg-[color:var(--surface)] shadow-2xl p-6">
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              {hostIsAdvisory ? `Koble fra ${platformLabel(hostConnection?.platform)}?` : 'Koble fra WordPress?'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {hostIsAdvisory
                ? 'Sikt husker ikke lenger plattformen din. Du kan koble til på nytt når som helst.'
                : 'Sikt kan ikke lenger gjøre endringer på siden din. Du kan koble til på nytt når som helst.'}
            </p>
            {!hostIsAdvisory && (
              <p className="text-sm mt-3 mb-4" style={{ color: 'var(--muted)' }}>
                Tips: Application Password-et i WordPress er fortsatt aktivt etter at du kobler fra her. Hvis du vil fjerne det helt, gå til Brukere → Profil → Application Passwords i WordPress og klikk Revoke.
              </p>
            )}
            {hostIsAdvisory && <div className="mb-4" />}
            {disconnectError && (
              <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: 'var(--navbg)', color: 'var(--danger)', border: '1px solid var(--hair)' }}>
                {disconnectError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowDisconnectConfirm(false); setDisconnectError(null); }}
                disabled={isDisconnecting}
                onMouseDown={(e) => { if (isDisconnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className="rounded-full px-4 py-2 text-sm border border-[color:var(--hair)] bg-[color:var(--surface)] disabled:opacity-50"
                style={{ color: 'var(--ink)', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={hostIsAdvisory ? disconnectAdvisory : disconnectWordPress}
                disabled={isDisconnecting}
                onMouseDown={(e) => { if (isDisconnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className={`rounded-full px-4 py-2 text-sm border border-[color:var(--ink)] bg-[color:var(--btn-bg)] text-white inline-flex items-center gap-2${isDisconnecting ? ' opacity-50 cursor-not-allowed' : ''}`}
                style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                {isDisconnecting ? <Loader2 size={14} className="animate-spin" /> : null}
                Koble fra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* PLAN CHANGE MODAL                                               */}
      {/* =============================================================== */}
      {planChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={() => !switchingPlan && setPlanChangeTarget(null)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <div className={`relative w-full max-w-md rounded-2xl ${isLight ? 'bg-[color:var(--surface)]' : 'bg-slate-900'} border ${divider} shadow-2xl p-6`}>
            <h3 className={`text-base font-semibold ${textMain} mb-2`}>
              {planChangeTarget.type === 'upgrade' ? 'Oppgrader' : 'Nedgrader'} til {planChangeTarget.name}?
            </h3>
            <p className={`text-sm ${textDim} mb-5`}>
              {planChangeTarget.type === 'upgrade'
                ? `Du får tilgang til alt i ${planChangeTarget.name} umiddelbart. Nytt beløp ${planChangeTarget.price}/mnd belastes ved neste faktura.`
                : `Du beholder nåværende funksjoner ut faktureringsperioden, deretter byttes du til ${planChangeTarget.name} (${planChangeTarget.price}/mnd).`}
            </p>

            {isDevMode && (
              <div className={`rounded-lg px-3 py-2 mb-4 text-xs ${isLight ? 'bg-amber-50 text-amber-800' : 'bg-amber-500/10 text-amber-300'}`}>
                Dev-modus: kan bytte direkte uten Stripe.
              </div>
            )}

            <div className="flex gap-2">
              <SecondaryButton theme={themed} onClick={() => setPlanChangeTarget(null)} className="flex-1" disabled={switchingPlan}>
                Avbryt
              </SecondaryButton>
              {isDevMode ? (
                <PrimaryButton onClick={performPlanChange} disabled={switchingPlan} className="flex-1">
                  {switchingPlan ? <Loader2 size={14} className="animate-spin" /> : null}
                  Bytt direkte
                </PrimaryButton>
              ) : (
                <PrimaryButton onClick={() => onSelectPlan(planChangeTarget.name)} disabled={switchingPlan} className="flex-1">
                  Fortsett til Stripe <ArrowRight size={14} />
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Flyttet hit fra App.tsx (portal-only typer + hjelpere) ---
interface ContentPage {
  id: string;
  url: string;
  fullUrl?: string;
  title: string;
  wordCount: number;
  status: 'Bra' | 'Advarsel' | 'Kritisk';
  lastUpdated: string;
  // Standard (AI Analyse)
  score: number; // 0-100
  readability: 'Lett' | 'Middels' | 'Tung';
  issues: string[]; // F.eks "Mangler H1", "Tynt innhold"
  // Premium (Strategi)
  topicCluster: string;
  action: string; // "Oppdater", "Slett", "Behold"
}

interface LinkPage {
  id: string;
  url: string;
  title: string;
  inlinks: number;
  outlinks: number;
  status: 'Bra' | 'Isolert' | 'Blindvei' | 'Kritisk';
  brokenLinks: number;
  linkScore: number;
  anchorIssues: string[];
  hubType: 'Pillar' | 'Cluster' | 'None';
  suggestedInlinks: { fromUrl: string; anchor: string; reason: string }[];
}

interface KeywordData {
  keyword: string;
  location: string;
  position: number;
  url: string;
  change: number;
  volume: string;
  competition: number;
  kd: number;
  intent: 'Kjøp' | 'Info' | 'Lokal';
  history: { date: string; rank: number }[];
  // NYTT: Vi lagrer konkurrentene direkte fra API-et
  competitors: { position: number; title: string; url: string; snippet: string }[];
}

export interface AnalysisResult {
  // De 4 store
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;

  // Detaljer
  seoDetails: {
    metaDescription: any;
    documentTitle: any;
    linkText: any;
    viewport: any;
  };

  // Core Web Vitals
  fcp?: { value: string; score: number };
  lcp?: { value: string; score: number };
  cls?: { value: string; score: number };
  tbt?: { value: string; score: number };

  // Standard Pakke (Tiltak)
  opportunities?: {
    title: string;
    description: string;
    savings: string
  }[];

  // Premium Pakke (Sjekkliste)
  diagnostics?: {
    title: string;
    passed: boolean
  }[];

  // NYTT: Ekstra info (Skjermbilde, server-tid osv)
  extras?: {
    screenshot: string;
    serverTime: string;
    totalWeight: string
  };
}

function useIsMobile() {
  const query = '(max-width: 640px)';
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

const GscPreCheck = ({ onConfirm, onCancel, theme }: {
  onConfirm: () => void;
  onCancel: () => void;
  theme?: any;
}) => {
  const [verified, setVerified] = useState(false);
  const [sameAccount, setSameAccount] = useState(false);
  const canProceed = verified && sameAccount;

  return (
    <div className="w-full max-w-lg bg-[color:var(--surface)] rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-2">
        Før du kobler til Google
      </h2>
      <p className="text-[color:var(--muted)] mb-6">
        For at Sikt skal kunne hente søkeorddata for nettsiden din, må disse to tingene være på plass:
      </p>

      {/* Sjekkliste */}
      <div className="space-y-4 mb-6">
        {/* Punkt 1 */}
        <div
          onClick={() => setVerified(!verified)}
          className="flex items-start gap-3 p-4 rounded-lg border-2 border-[color:var(--hair)] hover:border-[color:var(--muted)] cursor-pointer transition-colors"
        >
          <div className="pt-0.5">
            {verified ? (
              <CheckCircle2 className="w-5 h-5 text-[color:var(--ink)]" />
            ) : (
              <Circle className="w-5 h-5 text-[color:var(--muted)]" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-[color:var(--ink)] mb-1">
              Jeg har verifisert nettsiden min i Google Search Console
            </p>
            <a
              href="https://support.google.com/webmasters/answer/9008080"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[color:var(--ink)] hover:text-[color:var(--ink)] inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Har du ikke gjort det ennå? Slik gjør du det
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Punkt 2 */}
        <div
          onClick={() => setSameAccount(!sameAccount)}
          className="flex items-start gap-3 p-4 rounded-lg border-2 border-[color:var(--hair)] hover:border-[color:var(--muted)] cursor-pointer transition-colors"
        >
          <div className="pt-0.5">
            {sameAccount ? (
              <CheckCircle2 className="w-5 h-5 text-[color:var(--ink)]" />
            ) : (
              <Circle className="w-5 h-5 text-[color:var(--muted)]" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-[color:var(--ink)] mb-1">
              Jeg vil koble til med samme Google-konto som eier nettsiden
            </p>
            <p className="text-sm text-[color:var(--muted)]">
              Hvis nettsiden er verifisert med jobbkonto, logg inn med jobbkonto.
            </p>
          </div>
        </div>
      </div>

      {/* Knapper */}
      <div className="space-y-3">
        <button
          onClick={onConfirm}
          disabled={!canProceed}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] disabled:active:scale-100 ${
            canProceed
              ? 'bg-[#52A447] hover:bg-violet-600 text-white'
              : 'bg-[color:var(--subtle)] text-[color:var(--muted)] cursor-not-allowed'
          }`}
        >
          {canProceed
            ? 'Koble til Google Search Console'
            : 'Bekreft begge punkter for å fortsette'
          }
        </button>

        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-[color:var(--muted)] transition-[color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[color:var(--ink)] active:scale-[0.98]"
        >
          Hopp over for nå — jeg gjør dette senere
        </button>
      </div>
    </div>
  );
};

export default ClientPortal;

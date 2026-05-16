/**
 * CompetitorMonitor.tsx
 * 
 * Konkurrent-overvåking widgets for Sikt.
 * 
 * Eksporterer:
 *  - CompetitorChangeFeed  → Varsel-feed (dashboard + konkurrenter)
 *  - CompetitorCardEnhanced → Utvidet konkurrent-kort med sitemap + varsler
 *  - DashboardCompetitorWidget → Minimal widget for dashboardet
 *  - useCompetitorChanges → Hook for å hente varsler
 *  - useCompetitorPages → Hook for å hente sideantall
 *
 * Design: Matcher den eksisterende ultra-minimale, typografi-drevne
 * dashboard-estetikken. Emil Kowalski-prinsipper: stagger-animasjon,
 * custom easing, responsive hover, aktiv-tilbakemelding, redusert bevegelse.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  Trophy, Globe2, FileText, TrendingUp, TrendingDown, Search,
  Trash2, ChevronRight, Eye, RefreshCw, Loader2, Bell, Check,
  Settings, ChevronDown
} from 'lucide-react';

/* ─── Custom easing (Emil: never use default CSS easings) ─── */
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

/* ─── Stagger utility ─── */
const staggerDelay = (index: number, base = 50) => ({
  animationDelay: `${index * base}ms`,
});

/* ─── CSS-in-JS for keyframes (injected once) ─── */
const injectStyles = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes sikt-fade-up {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .sikt-stagger-item {
        opacity: 0;
        animation: sikt-fade-up 350ms ${EASE_OUT} forwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .sikt-stagger-item {
          opacity: 1;
          animation: none;
        }
      }
    `;
    document.head.appendChild(style);
  };
})();

/* ─── Change type config ─── */
const CHANGE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  new_page:      { icon: FileText,    color: 'text-emerald-500', bg: 'bg-emerald-500' },
  removed_page:  { icon: Trash2,      color: 'text-rose-500',    bg: 'bg-rose-500' },
  new_keyword:   { icon: Search,      color: 'text-violet-500',  bg: 'bg-violet-500' },
  rank_improved: { icon: TrendingUp,  color: 'text-emerald-500', bg: 'bg-emerald-500' },
  rank_dropped:  { icon: TrendingDown, color: 'text-amber-500',  bg: 'bg-amber-500' },
};

/* ─── Relative time (norsk) ─── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Nå';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t siden`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'I går';
  if (d < 7) return `${d} dager siden`;
  return new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
}


/* ═══════════════════════════════════════════════════════════
   HOOK: useCompetitorChanges
   ═══════════════════════════════════════════════════════════ */
export function useCompetitorChanges(userId: string | undefined, limit = 20) {
  const [changes, setChanges] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('competitor_changes')
        .select('*, competitors(domain, avatar_color)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      const rows = data || [];
      setChanges(rows);
      setUnreadCount(rows.filter((c: any) => !c.is_read).length);
    } catch (e) {
      console.warn('[useCompetitorChanges]', e);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  const markAsRead = async (changeId: string) => {
    await supabase.from('competitor_changes').update({ is_read: true }).eq('id', changeId);
    setChanges(prev => prev.map(c => c.id === changeId ? { ...c, is_read: true } : c));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from('competitor_changes').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setChanges(prev => prev.map(c => ({ ...c, is_read: true })));
    setUnreadCount(0);
  };

  return { changes, unreadCount, loading, markAsRead, markAllRead, refetch: fetch };
}


/* ═══════════════════════════════════════════════════════════
   HOOK: useCompetitorPages (page count per competitor)
   ═══════════════════════════════════════════════════════════ */
export function useCompetitorPages(competitorIds: string[]) {
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (competitorIds.length === 0) return;

    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      for (const id of competitorIds) {
        const { count } = await supabase
          .from('competitor_pages')
          .select('*', { count: 'exact', head: true })
          .eq('competitor_id', id)
          .eq('is_active', true);
        counts[id] = count || 0;
      }
      setPageCounts(counts);
    };

    fetchCounts();
  }, [competitorIds.join(',')]);

  return pageCounts;
}


/* ═══════════════════════════════════════════════════════════
   COMPONENT: DashboardCompetitorWidget
   Matches the ultra-minimal, typographic dashboard style.
   ═══════════════════════════════════════════════════════════ */
interface DashboardWidgetProps {
  userId: string;
  theme: string;
  onNavigate: () => void; // Navigate to competitors tab
}

export const DashboardCompetitorWidget: React.FC<DashboardWidgetProps> = ({ userId, theme, onNavigate }) => {
  const { changes, unreadCount, loading, markAllRead } = useCompetitorChanges(userId, 5);

  useEffect(() => { injectStyles(); }, []);

  const isDark = theme !== 'light';
  const textPrimary = isDark ? 'text-slate-200' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-600';
  const textLabel = isDark ? 'text-slate-500' : 'text-slate-400';
  const border = isDark ? 'border-white/5' : 'border-slate-100';
  const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50';

  if (loading) return null; // Ikke vis noe mens vi laster (Emil: unngå layout shift)

  return (
    <div>
      <div className={`flex items-center justify-between mb-4 pb-4 border-b ${border}`}>
        <div className="flex items-center gap-2">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${textLabel}`}>
            Konkurrentovervåking
          </p>
          {unreadCount > 0 && (
            <span
              className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-violet-500 rounded-full"
              style={{ 
                animation: 'sikt-fade-up 300ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={onNavigate}
          className={`text-xs font-medium text-violet-500 hover:text-violet-600 transition-colors duration-150`}
          style={{ transitionTimingFunction: EASE_OUT }}
        >
          Vis alle &rarr;
        </button>
      </div>

      {changes.length === 0 ? (
        <p className={`text-sm ${textMuted}`}>
          Ingen endringer enda. Varsler dukker opp her etter neste skann.
        </p>
      ) : (
        <div className="space-y-1">
          {changes.slice(0, 4).map((change, i) => {
            const config = CHANGE_CONFIG[change.change_type] || CHANGE_CONFIG.new_page;
            return (
              <div
                key={change.id}
                onClick={onNavigate}
                className={`sikt-stagger-item group flex items-center justify-between py-3 hover:px-4 -mx-4 rounded-lg ${hoverBg} transition-all duration-200 cursor-pointer`}
                style={{
                  ...staggerDelay(i),
                  transitionTimingFunction: EASE_OUT,
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Minimalistisk dot-indikator (matcher dashboard-stilen) */}
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.bg} ${change.is_read ? 'opacity-20' : 'opacity-100'}`} />
                  <p className={`text-sm ${change.is_read ? textMuted : textPrimary}`}>
                    {change.title}
                  </p>
                </div>
                <span className={`text-[10px] uppercase tracking-widest ${textLabel} opacity-0 group-hover:opacity-100 transition-opacity duration-150`}>
                  {timeAgo(change.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Mark all read — bare vis hvis uleste finnes */}
      {unreadCount > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); markAllRead(); }}
          className={`mt-4 text-xs ${textLabel} hover:text-violet-500 transition-colors duration-150 flex items-center gap-1.5`}
          style={{ transitionTimingFunction: EASE_OUT }}
        >
          <Check size={12} /> Marker alt som lest
        </button>
      )}
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════
   COMPONENT: CompetitorChangeFeed
   Full feed for the competitors tab. Richer than dashboard.
   ═══════════════════════════════════════════════════════════ */
interface ChangeFeedProps {
  userId: string;
  theme: string;
}

export const CompetitorChangeFeed: React.FC<ChangeFeedProps> = ({ userId, theme }) => {
  const { changes, unreadCount, loading, markAsRead, markAllRead } = useCompetitorChanges(userId, 30);

  useEffect(() => { injectStyles(); }, []);

  const isDark = theme !== 'light';
  const cardBg = isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-600';
  const textLabel = isDark ? 'text-slate-500' : 'text-slate-400';

  if (loading) {
    return (
      <div className={`p-6 rounded-2xl border ${cardBg}`}>
        <Loader2 size={20} className="animate-spin text-violet-500 mx-auto" />
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-2xl border ${cardBg}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className={`text-lg font-bold ${textPrimary}`}>Endringer</h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold text-white bg-violet-500 rounded-full">
              {unreadCount} ulest{unreadCount > 1 ? 'e' : ''}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className={`text-xs ${textLabel} hover:text-violet-500 flex items-center gap-1.5`}
            style={{ transition: `color 150ms ${EASE_OUT}` }}
          >
            <Check size={12} /> Marker alle lest
          </button>
        )}
      </div>

      {changes.length === 0 ? (
        <div className="text-center py-10">
          <Bell size={32} className={`mx-auto mb-3 opacity-20 ${textMuted}`} />
          <p className={`text-sm ${textMuted}`}>
            Ingen endringer enda
          </p>
          <p className={`text-xs mt-1 ${textLabel}`}>
            Varsler dukker opp her etter neste skann
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {changes.map((change, i) => {
            const config = CHANGE_CONFIG[change.change_type] || CHANGE_CONFIG.new_page;
            const Icon = config.icon;
            const domain = change.competitors?.domain || '';

            return (
              <div
                key={change.id}
                className={`sikt-stagger-item group relative flex items-start gap-3 py-3 px-3 -mx-3 rounded-xl transition-all duration-200 ${
                  isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                } ${!change.is_read ? '' : 'opacity-60'}`}
                style={{
                  ...staggerDelay(i, 40),
                  transitionTimingFunction: EASE_OUT,
                }}
              >
                {/* Ikon */}
                <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-white/5' : 'bg-slate-100'
                }`}>
                  <Icon size={14} className={config.color} />
                </div>

                {/* Innhold */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${textPrimary}`}>{change.title}</p>
                  {change.detail && (
                    <p className={`text-xs mt-0.5 ${textMuted} truncate`}>{change.detail}</p>
                  )}
                  <span className={`text-[10px] font-mono ${textLabel} mt-1 block`}>
                    {timeAgo(change.created_at)}
                  </span>
                </div>

                {/* Ulest-dot */}
                {!change.is_read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markAsRead(change.id); }}
                    className="mt-2 flex-shrink-0"
                    title="Marker som lest"
                  >
                    <div className="w-2 h-2 rounded-full bg-violet-500 hover:bg-violet-400 transition-colors duration-150" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════
   COMPONENT: ScanFrequencySelect
   Dropdown for scan frequency per competitor.
   ═══════════════════════════════════════════════════════════ */
interface FrequencySelectProps {
  competitorId: string;
  currentFrequency: string;
  theme: string;
}

export const ScanFrequencySelect: React.FC<FrequencySelectProps> = ({
  competitorId, currentFrequency, theme
}) => {
  const [freq, setFreq] = useState(currentFrequency || 'weekly');
  const [saving, setSaving] = useState(false);

  const isDark = theme !== 'light';

  const handleChange = async (newFreq: string) => {
    setFreq(newFreq);
    setSaving(true);
    try {
      await supabase
        .from('competitors')
        .update({ scan_frequency: newFreq })
        .eq('id', competitorId);
    } catch (e) {
      console.warn('[ScanFrequencySelect]', e);
    } finally {
      setTimeout(() => setSaving(false), 400); // Kort visuell bekreftelse
    }
  };

  const labels: Record<string, string> = {
    weekly: 'Ukentlig',
    every_3_days: 'Hver 3. dag',
    daily: 'Daglig',
  };

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <select
        value={freq}
        onChange={(e) => handleChange(e.target.value)}
        className={`text-xs font-medium appearance-none cursor-pointer pr-5 py-1 pl-2 rounded-md border transition-all duration-150 ${
          isDark
            ? 'bg-slate-800 border-white/10 text-slate-300 hover:border-white/20'
            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
        style={{ transitionTimingFunction: EASE_OUT }}
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <ChevronDown
        size={10}
        className={`absolute right-1.5 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
      />
      {saving && (
        <Check size={12} className="text-emerald-500 animate-in fade-in duration-200" />
      )}
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════
   COMPONENT: CompetitorCardEnhanced
   Full card for one competitor with all new data.
   ═══════════════════════════════════════════════════════════ */
interface CompetitorCardProps {
  competitor: any;
  pageCount: number;
  unreadChanges: number;
  theme: string;
  index: number;
  onScan: (id: string) => void;
  onDelete: (id: string) => void;
  scanning: boolean;
}

export const CompetitorCardEnhanced: React.FC<CompetitorCardProps> = ({
  competitor, pageCount, unreadChanges, theme, index, onScan, onDelete, scanning
}) => {
  useEffect(() => { injectStyles(); }, []);

  const isDark = theme !== 'light';
  const c = competitor;
  const avatarColor = c.avatar_color || '#8b5cf6';

  return (
    <div
      className={`sikt-stagger-item group p-5 rounded-2xl border transition-all duration-200 ${
        isDark
          ? 'bg-slate-800/50 border-white/5 hover:border-white/10'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
      style={{
        ...staggerDelay(index, 60),
        transitionTimingFunction: EASE_OUT,
      }}
    >
      {/* Top row: Avatar + Domain + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Avatar med domene-initial */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {(c.domain || '?')[0].toUpperCase()}
          </div>
          <div>
            <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {c.domain}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {c.competitor_type === 'main' ? 'Hovedkonkurrent' : 'Konkurrent'}
              </span>
              {unreadChanges > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-500 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                  <Bell size={8} /> {unreadChanges}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onScan(c.id)}
            disabled={scanning}
            className={`p-2 rounded-lg transition-all duration-150 ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            } disabled:opacity-40`}
            style={{ transitionTimingFunction: EASE_OUT }}
            title="Skann nå"
          >
            {scanning ? (
              <Loader2 size={14} className="animate-spin text-violet-500" />
            ) : (
              <RefreshCw size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
            )}
          </button>
          <button
            onClick={() => onDelete(c.id)}
            className={`p-2 rounded-lg transition-all duration-150 text-rose-500/50 hover:text-rose-500 ${
              isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'
            }`}
            style={{ transitionTimingFunction: EASE_OUT }}
            title="Fjern"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className={`grid grid-cols-4 gap-4 mt-5 pt-4 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
        <div>
          <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} mb-1`}>
            Søkeord
          </p>
          <span className={`text-lg font-light ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {c.keyword_count || '—'}
          </span>
        </div>
        <div>
          <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} mb-1`}>
            Snitt pos.
          </p>
          <span className={`text-lg font-light ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {c.avg_position ? `#${c.avg_position}` : '—'}
          </span>
        </div>
        <div>
          <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} mb-1`}>
            Sider
          </p>
          <span className={`text-lg font-light ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {pageCount || '—'}
          </span>
        </div>
        <div>
          <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'} mb-1`}>
            Frekvens
          </p>
          <ScanFrequencySelect
            competitorId={c.id}
            currentFrequency={c.scan_frequency || 'weekly'}
            theme={theme}
          />
        </div>
      </div>

      {/* Footer: Last scanned */}
      <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
        <span className={`text-[10px] font-mono ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {c.last_scanned_at
            ? `Sist skannet ${timeAgo(c.last_scanned_at)}`
            : 'Aldri skannet'
          }
        </span>
        {pageCount > 0 && (
          <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {pageCount} sider i sitemap
          </span>
        )}
      </div>
    </div>
  );
};
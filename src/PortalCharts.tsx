// PortalCharts — all recharts-bruk samlet i én modul som lazy-lastes fra App.tsx.
// Slik havner ikke recharts + d3 (~110 KB gzip) i hovedbundlen og lastes kun
// når brukeren faktisk åpner portalen. Markedssidene slipper hele charts-chunken.
import React from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar,
  RadialBarChart, RadialBar, Cell,
} from 'recharts';

export type PortalTheme = 'light' | 'dark';

export const scoreStatus = (score: number | null) => {
  if (score == null) return { label: 'Ikke målt', shortLabel: 'Mangler data', color: '#64748b', textClass: 'text-slate-500' };
  if (score >= 80) return { label: 'Sterk score', shortLabel: 'Bra', color: '#10b981', textClass: 'text-emerald-600' };
  if (score >= 60) return { label: 'God, men kan løftes', shortLabel: 'OK', color: '#f59e0b', textClass: 'text-amber-600' };
  return { label: 'Trenger forbedring', shortLabel: 'Svak', color: '#f43f5e', textClass: 'text-rose-600' };
};

// Sparkline — bittesmå linjer for trend-data (score-historikk, klikk-trend osv.).
export const Sparkline: React.FC<{
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}> = ({ data, color = '#7c3aed', height = 32, fill = true }) => {
  if (!data || data.length < 2) {
    return <div className="text-[10px] leading-snug text-slate-400">For få målinger til trend</div>;
  }
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={fill ? `url(#spark-${color.replace('#', '')})` : 'none'}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// RadialScore — donut-stil måler 0-100 med farge basert på score.
export const RadialScore: React.FC<{
  value: number | null;
  size?: number;
  theme: PortalTheme;
}> = ({ value, size = 96, theme }) => {
  const hasValue = value != null;
  const v = hasValue ? Math.max(0, Math.min(100, value)) : 0;
  const meta = scoreStatus(hasValue ? v : null);
  const color = meta.color;
  const trackColor = theme === 'light' ? '#f1f5f9' : '#1e293b';
  const data = [{ name: 'score', value: v, fill: color }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            background={{ fill: trackColor }}
            dataKey="value"
            cornerRadius={6}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-sm font-semibold text-center px-1 leading-tight ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
          {hasValue ? Math.round(v) : 'Ikke målt'}
        </span>
        <span className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>/ 100</span>
        <span className={`text-[10px] font-medium mt-0.5 ${meta.textClass}`}>{meta.shortLabel}</span>
      </div>
    </div>
  );
};

// ScoreHistoryChart — mobil ytelse + SEO over tid (Hjem).
export const ScoreHistoryChart: React.FC<{
  scoreHistory: { at: string; mobilePerf: number; mobileSeo: number }[];
  palette: { border: string; muted: string; success: string; ink: string };
}> = ({ scoreHistory, palette }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart
      data={scoreHistory.map((h, i) => ({ idx: i, perf: h.mobilePerf, seo: h.mobileSeo }))}
      margin={{ top: 6, right: 6, bottom: 0, left: -20 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.border} />
      <XAxis dataKey="idx" tick={false} axisLine={false} tickLine={false} />
      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: palette.muted }} axisLine={false} tickLine={false} />
      <RechartsTooltip
        contentStyle={{ background: '#fff', border: `1px solid ${palette.border}`, borderRadius: 10, fontSize: 12 }}
        labelFormatter={(idx: number) => scoreHistory[idx] ? new Date(scoreHistory[idx].at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : ''}
      />
      <Line type="monotone" dataKey="perf" stroke={palette.success} strokeWidth={2.5} dot={false} />
      <Line type="monotone" dataKey="seo" stroke={palette.ink} strokeWidth={2.5} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

// KeywordRankChart — posisjonshistorikk for ett søkeord (reversert akse).
export const KeywordRankChart: React.FC<{ data: any[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBEBE6" />
      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
      <YAxis
        reversed
        allowDecimals={false}
        tick={{ fontSize: 10, fill: '#808080' }}
        axisLine={false}
        tickLine={false}
        domain={['dataMin - 1', 'dataMax + 1']}
      />
      <RechartsTooltip
        contentStyle={{ background: '#fff', border: '1px solid #EBEBE6', borderRadius: 8, fontSize: 12 }}
        formatter={(val: any) => [`#${val}`, 'Posisjon']}
      />
      <Line
        type="monotone"
        dataKey="rank"
        stroke="#1A1A1A"
        strokeWidth={2}
        dot={{ fill: '#52A447', r: 3, strokeWidth: 0 }}
        activeDot={{ fill: '#52A447', r: 5, strokeWidth: 0 }}
        isAnimationActive={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

// PositionBucketsChart — fordeling av søkeord per posisjonsbøtte.
export const PositionBucketsChart: React.FC<{ data: { name: string; value: number; fill: string }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBEBE6" />
      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#808080' }} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
      <RechartsTooltip
        contentStyle={{ backgroundColor: '#fff', border: '1px solid #EBEBE6', borderRadius: 8, fontSize: 12 }}
        cursor={{ fill: '#F5F5F0' }}
      />
      <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
        {data.map((b, i) => <Cell key={i} fill={b.fill} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// PortalCharts — all recharts-bruk samlet i én modul som lazy-lastes fra App.tsx.
// Slik havner ikke recharts + d3 (~110 KB gzip) i hovedbundlen og lastes kun
// når brukeren faktisk åpner portalen. Markedssidene slipper hele charts-chunken.
//
// Alle farger kommer fra src/portalTheme.ts slik at grafene matcher resten av
// portalen («warm-neutral Linear») i stedet for recharts/Tailwind-standardene.
import React from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar,
  RadialBarChart, RadialBar, Cell, ReferenceDot,
} from 'recharts';
import { PORTAL, chartPalette, chartTooltipStyle, scoreColor, formatChartDate } from './portalTheme';

export type PortalTheme = 'light' | 'dark';

// Bakoverkompatibel: returnerer fortsatt {label, shortLabel, color}, nå i paletten.
export const scoreStatus = scoreColor;

// Felles akse-stil — rolig, brand-muted, ingen aksiale linjer/ticks.
const axisTick = { fontSize: 11, fill: chartPalette.axis } as const;
const axisProps = { axisLine: false, tickLine: false, tick: axisTick } as const;

// Sparkline — bittesmå linjer for trend-data (score-historikk, klikk-trend osv.).
export const Sparkline: React.FC<{
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}> = ({ data, color = PORTAL.success, height = 32, fill = true }) => {
  if (!data || data.length < 2) {
    return <div className="text-[10px] leading-snug" style={{ color: PORTAL.faint }}>For få målinger til trend</div>;
  }
  const gid = `spark-${color.replace('#', '')}`;
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={fill ? `url(#${gid})` : 'none'}
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
  const meta = scoreColor(hasValue ? v : null);
  const color = meta.color;
  const trackColor = theme === 'light' ? chartPalette.track : '#2A2A28';
  const data = [{ name: 'score', value: v, fill: color }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="74%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            background={{ fill: trackColor }}
            dataKey="value"
            cornerRadius={8}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-semibold leading-none tabular-nums" style={{ color: hasValue ? PORTAL.ink : PORTAL.muted }}>
          {hasValue ? Math.round(v) : '–'}
        </span>
        <span className="text-[10px] mt-0.5" style={{ color: PORTAL.muted }}>/ 100</span>
        <span className="text-[10px] font-medium mt-0.5" style={{ color: meta.color }}>{meta.shortLabel}</span>
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
      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={palette.border} />
      <XAxis
        dataKey="idx"
        tickFormatter={(idx: number) => formatChartDate(scoreHistory[idx]?.at)}
        tick={{ fontSize: 10, fill: palette.muted }}
        axisLine={false}
        tickLine={false}
        interval="preserveStartEnd"
        minTickGap={28}
        height={18}
      />
      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: palette.muted }} axisLine={false} tickLine={false} width={28} />
      <RechartsTooltip
        contentStyle={chartTooltipStyle}
        cursor={{ stroke: palette.muted, strokeWidth: 1, strokeDasharray: '3 3' }}
        labelFormatter={(idx: number) => formatChartDate(scoreHistory[idx]?.at)}
        formatter={(val: any, name: any) => [val, name === 'perf' ? 'Fart' : 'SEO']}
      />
      <Line type="monotone" dataKey="perf" stroke={palette.success} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      <Line type="monotone" dataKey="seo" stroke={palette.ink} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
    </LineChart>
  </ResponsiveContainer>
);

// KeywordRankChart — posisjonshistorikk for ett søkeord (reversert akse:
// lavere = bedre). Myk gradient under linja for en mer «designet» følelse.
export const KeywordRankChart: React.FC<{ data: any[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
      <defs>
        <linearGradient id="kw-rank-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chartPalette.accent} stopOpacity={0.18} />
          <stop offset="100%" stopColor={chartPalette.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={chartPalette.grid} />
      <XAxis dataKey="date" {...axisProps} tick={{ fontSize: 10, fill: chartPalette.axis }} />
      <YAxis
        reversed
        allowDecimals={false}
        {...axisProps}
        tick={{ fontSize: 10, fill: chartPalette.axis }}
        width={28}
        domain={['dataMin - 1', 'dataMax + 1']}
      />
      <RechartsTooltip
        contentStyle={chartTooltipStyle}
        cursor={{ stroke: chartPalette.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
        labelFormatter={(label: any) => label}
        formatter={(val: any) => [`#${val}`, 'Posisjon']}
      />
      <Area
        type="monotone"
        dataKey="rank"
        stroke={chartPalette.ink}
        strokeWidth={2.25}
        fill="url(#kw-rank-fill)"
        dot={{ fill: chartPalette.accent, r: 3, strokeWidth: 2, stroke: PORTAL.card }}
        activeDot={{ fill: chartPalette.accent, r: 5, strokeWidth: 2, stroke: PORTAL.card }}
        isAnimationActive={false}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// SiktEffectChart — «Sikt-effekten» (Hjem): antall søkeord i topp 10 på Google
// per ukentlige måling, med markør-prikker i uker der Sikt publiserte artikler
// eller gjorde fikser. Korrelasjon vises, aldri påstått årsak (ærlig copy i
// kortet rundt). Palette sendes theme-resolvert inn — recharts kan ikke lese
// CSS-variabler i SVG-attributter.
export const SiktEffectChart: React.FC<{
  data: { date: string; top10: number; events: string[] }[];
  palette: { border: string; muted: string; success: string; ink: string; accent: string; card: string };
}> = ({ data, palette }) => {
  const EffectTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { date: string; top10: number; events: string[] };
    return (
      <div style={{ ...chartTooltipStyle, background: palette.card, border: `1px solid ${palette.border}`, color: palette.ink }}>
        <div style={{ fontWeight: 600 }}>{formatChartDate(p.date)}</div>
        <div>{p.top10} søkeord i topp 10</div>
        {p.events.slice(0, 4).map((e, i) => (
          <div key={i} style={{ color: palette.muted, marginTop: 2 }}>· {e}</div>
        ))}
        {p.events.length > 4 && <div style={{ color: palette.muted, marginTop: 2 }}>+{p.events.length - 4} til</div>}
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="sikt-effect-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.success} stopOpacity={0.16} />
            <stop offset="100%" stopColor={palette.success} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={palette.border} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatChartDate(d)}
          tick={{ fontSize: 10, fill: palette.muted }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
          height={18}
        />
        <YAxis
          allowDecimals={false}
          domain={[0, 'dataMax + 1']}
          tick={{ fontSize: 11, fill: palette.muted }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <RechartsTooltip
          content={<EffectTooltip />}
          cursor={{ stroke: palette.muted, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="top10"
          stroke={palette.success}
          strokeWidth={2}
          fill="url(#sikt-effect-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
        {data.filter((d) => d.events.length > 0).map((d) => (
          <ReferenceDot
            key={d.date}
            x={d.date}
            y={d.top10}
            r={4.5}
            fill={palette.accent}
            stroke={palette.card}
            strokeWidth={2}
            isFront
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

// PositionBucketsChart — fordeling av søkeord per posisjonsbøtte.
export const PositionBucketsChart: React.FC<{ data: { name: string; value: number; fill: string }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={chartPalette.grid} />
      <XAxis dataKey="name" {...axisProps} />
      <YAxis allowDecimals={false} {...axisProps} tick={{ fontSize: 10, fill: chartPalette.axis }} width={28} />
      <RechartsTooltip
        contentStyle={chartTooltipStyle}
        cursor={{ fill: PORTAL.subtle }}
      />
      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
        {data.map((b, i) => <Cell key={i} fill={b.fill} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

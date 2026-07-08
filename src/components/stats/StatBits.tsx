/**
 * Small shared building blocks for the statistics screen: stat tiles,
 * labeled bar charts and stacked progress bars. Pure presentation.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Body, Muted, TABULAR } from '@/components/ui/Text';
import type { ChartType } from '@/domain/statsMode';

/** Compact value+label tile (matches the training dashboard style). */
export function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <View className="min-w-[30%] flex-1 items-center rounded-xl bg-surface dark:bg-surface-dark px-2 py-2.5">
      <Body style={TABULAR} className="text-2xl font-bold text-accent dark:text-accent-dark">
        {value}
      </Body>
      <Muted className="text-center text-xs">{label}</Muted>
      {sub ? (
        <Muted style={TABULAR} className="text-center text-[10px]">
          {sub}
        </Muted>
      ) : null}
    </View>
  );
}

export interface ChartBar {
  key: string;
  label: string;
  value: number;
  color: string;
  /** value text above the bar (defaults to the rounded value when > 0) */
  valueLabel?: string;
  highlighted?: boolean;
  onPress?: () => void;
}

/** Vertical bar chart with per-bar labels — used for all week trends. */
export function BarChart({ bars, height = 72, emptyColor }: { bars: ChartBar[]; height?: number; emptyColor: string }) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <View className="flex-row items-end gap-1.5">
      {bars.map((bar) => {
        const barHeight = bar.value > 0 ? Math.max(4, (bar.value / max) * height) : 3;
        const content = (
          <>
            <Muted style={TABULAR} className="text-[10px]">
              {bar.valueLabel ?? (bar.value > 0 ? String(Math.round(bar.value)) : '')}
            </Muted>
            <View
              className="w-full rounded-t-md"
              style={{
                height: barHeight,
                backgroundColor: bar.value > 0 ? bar.color : emptyColor,
              }}
            />
            <Muted
              style={TABULAR}
              className={`text-[10px] ${bar.highlighted ? 'font-bold text-accent dark:text-accent-dark' : ''}`}
              numberOfLines={1}
            >
              {bar.label}
            </Muted>
          </>
        );
        if (bar.onPress) {
          return (
            <Pressable
              key={bar.key}
              className="flex-1 items-center gap-1 active:opacity-60"
              onPress={bar.onPress}
            >
              {content}
            </Pressable>
          );
        }
        return (
          <View key={bar.key} className="flex-1 items-center gap-1">
            {content}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Min–max-zoomed line chart for slow-moving series (weight, muscle, …) where a
 * max-normalized bar chart would hide the variation. Stretches to the container
 * width via a viewBox; the stroke stays uniform via non-scaling-stroke.
 */
export function Sparkline({
  values,
  color,
  height = 44,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 100;
  const H = 40;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = pad + (1 - (v - min) / span) * (H - 2 * pad);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path d={area} fill={color} opacity={0.12} />
      <Path
        d={line}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
  );
}

/**
 * Line variant of the trend chart: min–max-zoomed (so slow-moving series like
 * weight stay legible) with first/last labels beneath. Consumes the same
 * ChartBar[] as BarChart; the line colour comes from the last bar.
 */
export function LineChart({
  bars,
  height = 96,
  color,
}: {
  bars: ChartBar[];
  height?: number;
  color: string;
}) {
  if (bars.length < 2) {
    return <Muted className="py-4 text-center text-xs">—</Muted>;
  }
  const values = bars.map((b) => b.value);
  const lineColor = bars[bars.length - 1]?.color ?? color;
  return (
    <View>
      <Sparkline values={values} color={lineColor} height={height} />
      <View className="mt-1 flex-row justify-between">
        <Muted style={TABULAR} className="text-[10px]">
          {bars[0].label}
        </Muted>
        <Muted style={TABULAR} className="text-[10px] font-bold text-accent dark:text-accent-dark">
          {bars[bars.length - 1].valueLabel ?? bars[bars.length - 1].label}
        </Muted>
      </View>
    </View>
  );
}

/** Bar or line trend chart, chosen by `type`. Both take the same ChartBar[]. */
export function TrendChart({
  bars,
  type,
  emptyColor,
  color,
}: {
  bars: ChartBar[];
  type: ChartType;
  emptyColor: string;
  color: string;
}) {
  // A line needs ≥2 points; with a single aggregated point (e.g. all data in one
  // week/month) fall back to a bar so something is always shown.
  if (type === 'line' && bars.length >= 2) return <LineChart bars={bars} color={color} />;
  return <BarChart bars={bars} emptyColor={emptyColor} />;
}

export interface StackedSegment {
  value: number;
  color: string;
}

/** Horizontal stacked bar (e.g. done/skipped/open). */
export function StackedBar({ segments }: { segments: StackedSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <View className="h-2 rounded-full bg-track dark:bg-track-dark" />;
  }
  return (
    <View className="h-2 flex-row overflow-hidden rounded-full bg-track dark:bg-track-dark">
      {segments.map((segment, index) => (
        <View
          key={index}
          style={{ flex: segment.value, backgroundColor: segment.color }}
        />
      ))}
    </View>
  );
}

/** Label row + horizontal percent bar — used for rates and shares. */
export function PercentRow({
  label,
  valueLabel,
  percent,
  color,
  trackColor,
}: {
  label: ReactNode;
  valueLabel: string;
  percent: number;
  color: string;
  trackColor?: string;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between gap-2">
        {typeof label === 'string' ? <Muted numberOfLines={1}>{label}</Muted> : label}
        <Muted style={TABULAR}>{valueLabel}</Muted>
      </View>
      <View
        className="h-1.5 overflow-hidden rounded-full bg-track dark:bg-track-dark"
        style={trackColor ? { backgroundColor: trackColor } : undefined}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

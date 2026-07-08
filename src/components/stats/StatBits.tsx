/**
 * Small shared building blocks for the statistics screen: stat tiles,
 * labeled bar charts and stacked progress bars. Pure presentation.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
 * Min–max-zoomed line chart with a visible dot per data point. Hovering (web) or
 * tapping (mobile) a point shows a tooltip with its value + period label.
 * Consumes the same ChartBar[] as BarChart; the line colour comes from the last
 * bar. Uses measured pixel width (onLayout) so dots + hit areas line up exactly.
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
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  if (bars.length < 2) {
    return <Muted className="py-4 text-center text-xs">—</Muted>;
  }

  const values = bars.map((b) => b.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lineColor = bars[bars.length - 1]?.color ?? color;

  const padX = 8;
  const padY = 12;
  const px = (i: number) => padX + (i / (bars.length - 1)) * Math.max(0, width - 2 * padX);
  const py = (v: number) => padY + (1 - (v - min) / span) * (height - 2 * padY);

  const path = bars
    .map((b, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(b.value).toFixed(1)}`)
    .join(' ');
  const area = `${path} L${px(bars.length - 1).toFixed(1)},${height} L${px(0).toFixed(1)},${height} Z`;

  const tipW = 92;
  const tipLeft = active === null ? 0 : Math.min(Math.max(px(active) - tipW / 2, 0), Math.max(0, width - tipW));

  return (
    <View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            <Svg width={width} height={height}>
              <Path d={area} fill={lineColor} opacity={0.12} />
              <Path d={path} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              {bars.map((b, i) => (
                <Circle
                  key={b.key}
                  cx={px(i)}
                  cy={py(b.value)}
                  r={active === i ? 4.5 : 2.5}
                  fill={lineColor}
                />
              ))}
            </Svg>
            {/* transparent hit areas: hover (web) / tap (mobile) selects a point */}
            {bars.map((b, i) => {
              const half = Math.max(12, width / bars.length / 2);
              return (
                <Pressable
                  key={b.key}
                  onHoverIn={() => setActive(i)}
                  onHoverOut={() => setActive(null)}
                  onPressIn={() => setActive(i)}
                  onPressOut={() => setActive(null)}
                  style={{ position: 'absolute', top: 0, bottom: 0, left: px(i) - half, width: half * 2 }}
                />
              );
            })}
            {active !== null && (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: tipLeft, top: Math.max(0, py(bars[active].value) - 40), width: tipW }}
                className="items-center rounded-lg border-2 border-border dark:border-border-dark bg-card dark:bg-card-dark px-2 py-1"
              >
                <Body style={TABULAR} className="text-xs font-bold">
                  {bars[active].valueLabel || String(Math.round(bars[active].value))}
                </Body>
                <Muted style={TABULAR} className="text-[10px]">
                  {bars[active].label}
                </Muted>
              </View>
            )}
          </>
        )}
      </View>
      <View className="mt-1 flex-row justify-between">
        <Muted style={TABULAR} className="text-[10px]">
          {bars[0].label}
        </Muted>
        <Muted style={TABULAR} className="text-[10px]">
          {bars[bars.length - 1].label}
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

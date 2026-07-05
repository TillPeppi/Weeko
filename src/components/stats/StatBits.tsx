/**
 * Small shared building blocks for the statistics screen: stat tiles,
 * labeled bar charts and stacked progress bars. Pure presentation.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Muted, TABULAR } from '@/components/ui/Text';

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

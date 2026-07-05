/**
 * Vertical day timeline 05:00–24:00 with proportionally positioned blocks.
 * Used by the week view (phone: single day, desktop: 7 columns side by side)
 * and the import preview.
 */
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DAY_END_MIN, DAY_START_MIN, toMinutes } from '@/domain/time';
import type { BlockStatus, BlockType } from '@/domain/types';
import { BLOCK_COLORS } from '@/constants/blockColors';
import { TABULAR } from '@/components/ui/Text';

export interface TimelineBlockData {
  key: string;
  type: BlockType;
  start: string;
  end: string;
  title: string;
  status?: BlockStatus;
}

interface Props {
  blocks: TimelineBlockData[];
  onBlockPress?: (block: TimelineBlockData) => void;
  /** current time as HH:mm to draw the "now" line (only pass for today) */
  nowTime?: string;
  pxPerMinute?: number;
  /** hide the hour labels (for dense multi-column grids all but first column) */
  hideHourLabels?: boolean;
}

const HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, i) => 5 + i);

function statusStyle(status?: BlockStatus): string {
  switch (status) {
    case 'done':
      return 'opacity-45';
    case 'skipped':
      return 'opacity-30';
    default:
      return '';
  }
}

export const DayTimeline = memo(function DayTimeline({
  blocks,
  onBlockPress,
  nowTime,
  pxPerMinute = 1.1,
  hideHourLabels = false,
}: Props) {
  const totalHeight = (DAY_END_MIN - DAY_START_MIN) * pxPerMinute;
  const yOf = (time: string) => (toMinutes(time) - DAY_START_MIN) * pxPerMinute;

  return (
    <View style={{ height: totalHeight }} className="relative flex-1">
      {HOURS.map((hour) => (
        <View
          key={hour}
          style={{ top: (hour * 60 - DAY_START_MIN) * pxPerMinute }}
          className="absolute left-0 right-0 flex-row items-center"
        >
          {!hideHourLabels && (
            <Text
              style={TABULAR}
              className="w-10 pr-1 text-right text-[10px] text-ink-muted dark:text-ink-muted-dark"
            >
              {String(hour).padStart(2, '0')}
            </Text>
          )}
          <View className="h-px flex-1 bg-track dark:bg-track-dark" />
        </View>
      ))}

      {blocks.map((block) => {
        const palette = BLOCK_COLORS[block.type];
        const top = yOf(block.start);
        const height = Math.max(yOf(block.end) - top, 18);
        const compact = height < 34;
        return (
          <Pressable
            key={block.key}
            onPress={onBlockPress ? () => onBlockPress(block) : undefined}
            style={{ top, height }}
            className={`absolute right-0 ${hideHourLabels ? 'left-0.5' : 'left-11'} rounded-lg border-2 px-2 py-0.5 ${palette.bgClass} ${palette.borderClass} ${statusStyle(block.status)} ${onBlockPress ? 'active:opacity-70' : ''}`}
          >
            <Text
              numberOfLines={compact ? 1 : 2}
              className={`text-xs font-bold ${palette.textClass} ${block.status === 'done' || block.status === 'skipped' ? 'line-through' : ''}`}
            >
              {block.title}
            </Text>
            {!compact && (
              <Text style={TABULAR} className={`text-[10px] ${palette.textClass} opacity-80`}>
                {block.start}–{block.end}
              </Text>
            )}
          </Pressable>
        );
      })}

      {nowTime && toMinutes(nowTime) >= DAY_START_MIN && toMinutes(nowTime) < DAY_END_MIN && (
        <View
          style={{ top: yOf(nowTime) }}
          className="absolute left-0 right-0 flex-row items-center"
          pointerEvents="none"
        >
          <View className="h-2 w-2 rounded-full bg-danger dark:bg-danger-dark" />
          <View className="h-0.5 flex-1 bg-danger dark:bg-danger-dark" />
        </View>
      )}
    </View>
  );
});

/**
 * Compact list representation of a block (Today view, previews).
 * Tap cycles the status (planned → done), long-press skips.
 */
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Check, SkipForward } from 'lucide-react-native';
import type { BlockStatus, BlockType } from '@/domain/types';
import { BLOCK_COLORS } from '@/constants/blockColors';
import { neoShadow, UI_COLORS } from '@/constants/uiColors';
import { TABULAR } from '@/components/ui/Text';

export interface BlockRowData {
  key: string;
  type: BlockType;
  start: string;
  end: string;
  title: string;
  status?: BlockStatus;
}

interface Props {
  block: BlockRowData;
  onPress?: () => void;
  onLongPress?: () => void;
  highlight?: boolean;
}

export function BlockRow({ block, onPress, onLongPress, highlight = false }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const palette = BLOCK_COLORS[block.type];
  const finished = block.status === 'done' || block.status === 'skipped';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={neoShadow(dark, 2)}
      className={`flex-row items-center gap-3 rounded-xl border-2 p-3 ${palette.bgClass} ${highlight ? 'border-accent dark:border-accent-dark' : palette.borderClass} ${finished ? 'opacity-50' : ''} ${onPress ? 'active:opacity-70' : ''}`}
    >
      <View className="w-16">
        <Text style={TABULAR} className={`text-xs font-bold ${palette.textClass}`}>
          {block.start}
        </Text>
        <Text style={TABULAR} className={`text-[10px] ${palette.textClass} opacity-70`}>
          {block.end}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={`text-base font-bold ${palette.textClass} ${finished ? 'line-through' : ''}`}
        >
          {block.title}
        </Text>
        <Text className={`text-xs font-semibold uppercase tracking-wider ${palette.textClass} opacity-70`}>
          {t(`blockTypes.${block.type}`)}
        </Text>
      </View>
      {block.status === 'done' && <Check size={18} color={UI_COLORS.ink.light} />}
      {block.status === 'skipped' && <SkipForward size={18} color={UI_COLORS.ink.light} />}
    </Pressable>
  );
}

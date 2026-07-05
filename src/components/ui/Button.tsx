import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { neoShadow, UI_COLORS } from '@/constants/uiColors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}

const inkBorder = 'border-2 border-border dark:border-border-dark';

const containerByVariant: Record<Variant, string> = {
  primary: `bg-highlight dark:bg-highlight-dark ${inkBorder} active:opacity-80`,
  secondary: `bg-card dark:bg-card-dark ${inkBorder} active:opacity-80`,
  ghost: 'bg-transparent active:opacity-60',
  danger: `bg-danger dark:bg-danger-dark ${inkBorder} active:opacity-80`,
};

const textByVariant: Record<Variant, string> = {
  // ink-on-color: yellow/coral surfaces keep dark text in both modes
  primary: 'text-ink font-bold uppercase tracking-wide',
  secondary: 'text-ink dark:text-ink-dark font-bold uppercase tracking-wide',
  ghost: 'text-accent dark:text-accent-dark font-semibold',
  danger: 'text-ink font-bold uppercase tracking-wide',
};

const containerBySize: Record<Size, string> = {
  sm: 'px-3 py-1.5 rounded-lg',
  md: 'px-4 py-2.5 rounded-xl',
  lg: 'px-5 py-3.5 rounded-2xl',
};

const textBySize: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const shadowBySize: Record<Size, 2 | 3 | 4> = { sm: 2, md: 3, lg: 4 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
}: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const shadow = variant === 'ghost' ? undefined : neoShadow(dark, shadowBySize[size]);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={shadow}
      className={`flex-row items-center justify-center gap-2 ${containerByVariant[variant]} ${containerBySize[size]} ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      {loading ? <ActivityIndicator size="small" color={UI_COLORS.ink.light} /> : icon}
      <Text className={`${textByVariant[variant]} ${textBySize[size]}`}>{title}</Text>
    </Pressable>
  );
}

import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { neoShadow } from '@/constants/uiColors';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** raised white pop surface for highlighted cards (now block, active session) */
  elevated?: boolean;
  className?: string;
}

export function Card({ children, onPress, elevated = false, className = '' }: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const surface = elevated
    ? 'bg-elevated dark:bg-elevated-dark'
    : 'bg-card dark:bg-card-dark';
  const base = `rounded-2xl ${surface} border-2 border-border dark:border-border-dark p-4 ${className}`;
  const shadow = neoShadow(dark, elevated ? 4 : 3);
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={shadow} className={`${base} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={shadow} className={base}>
      {children}
    </View>
  );
}

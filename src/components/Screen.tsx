import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
  /** wrap content in a ScrollView (default true) */
  scroll?: boolean;
  /** max content width on large screens; keeps web layouts centered */
  wide?: boolean;
  className?: string;
}

/**
 * Base screen wrapper: safe area, background, centered max-width container so
 * the web version reads as a designed page instead of a stretched phone app.
 */
export function Screen({ children, scroll = true, wide = false, className = '' }: Props) {
  const container = (
    <View className={`w-full flex-1 self-center ${wide ? 'max-w-6xl' : 'max-w-3xl'} px-4 pt-4 pb-8 ${className}`}>
      {children}
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {container}
        </ScrollView>
      ) : (
        container
      )}
    </SafeAreaView>
  );
}

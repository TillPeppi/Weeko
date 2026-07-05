import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Subtitle, Title } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, subtitle, action, icon }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8">
      {icon}
      <Title className="text-center text-xl">{title}</Title>
      {subtitle ? <Subtitle className="text-center">{subtitle}</Subtitle> : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}

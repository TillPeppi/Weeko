import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

/** All numbers (times, reps, weights, counts) render tabular. */
export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

interface Props extends TextProps {
  children: ReactNode;
  className?: string;
}

export function Title({ children, className = '', ...rest }: Props) {
  return (
    <Text
      className={`text-2xl font-extrabold uppercase tracking-wide text-ink dark:text-ink-dark ${className}`}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function Subtitle({ children, className = '', ...rest }: Props) {
  return (
    <Text className={`text-base text-ink-muted dark:text-ink-muted-dark ${className}`} {...rest}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, className = '', ...rest }: Props) {
  return (
    <Text
      className={`text-base font-extrabold uppercase tracking-wider text-ink dark:text-ink-dark ${className}`}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function Body({ children, className = '', ...rest }: Props) {
  return (
    <Text className={`text-base text-ink dark:text-ink-dark ${className}`} {...rest}>
      {children}
    </Text>
  );
}

export function Muted({ children, className = '', ...rest }: Props) {
  return (
    <Text className={`text-sm text-ink-muted dark:text-ink-muted-dark ${className}`} {...rest}>
      {children}
    </Text>
  );
}

export function Label({ children, className = '', ...rest }: Props) {
  return (
    <Text
      className={`mb-1 text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark ${className}`}
      {...rest}
    >
      {children}
    </Text>
  );
}

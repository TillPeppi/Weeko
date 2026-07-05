import { Pressable, Text, View } from 'react-native';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: Props<T>) {
  return (
    <View
      className={`flex-row rounded-xl bg-card dark:bg-card-dark border-2 border-border dark:border-border-dark p-1 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center rounded-lg px-2 py-2 ${
              selected ? 'bg-highlight dark:bg-highlight-dark' : ''
            }`}
          >
            <Text
              numberOfLines={1}
              className={
                selected
                  ? 'text-sm font-bold text-ink'
                  : 'text-sm font-medium text-ink-muted dark:text-ink-muted-dark'
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

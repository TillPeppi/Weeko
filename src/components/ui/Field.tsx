import { TextInput, View, type TextInputProps } from 'react-native';
import { useState } from 'react';
import { isValidTime } from '@/domain/time';
import { Label, Muted } from './Text';

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

const inputClass =
  'rounded-xl border-2 border-border dark:border-border-dark bg-card dark:bg-card-dark px-3 py-2.5 text-base text-ink dark:text-ink-dark';

export function Field({ label, error, className = '', ...rest }: FieldProps) {
  return (
    <View className={className}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        className={`${inputClass} ${error ? 'border-danger dark:border-danger-dark' : ''}`}
        placeholderTextColor="#a49d8e"
        {...rest}
      />
      {error ? <Muted className="mt-1 text-danger dark:text-danger-dark">{error}</Muted> : null}
    </View>
  );
}

interface TimeFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** HH:mm text field with lightweight validation feedback. */
export function TimeField({ label, value, onChange, placeholder, className }: TimeFieldProps) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && value !== '' && !isValidTime(value);
  return (
    <View className={className}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        className={`${inputClass} ${invalid ? 'border-danger dark:border-danger-dark' : ''}`}
        value={value}
        onChangeText={onChange}
        onBlur={() => setTouched(true)}
        placeholder={placeholder ?? 'HH:mm'}
        placeholderTextColor="#a49d8e"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
    </View>
  );
}

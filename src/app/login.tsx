/**
 * Login / sign-up (email + password). Gate target when auth is configured and
 * no session exists (see root _layout). Data stays local until the sync step;
 * this only establishes identity.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Body, Muted, Subtitle, Title } from '@/components/ui/Text';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const { t } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = emailValid && password.length >= 6 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        // With email confirmation on, there's no session yet — tell the user.
        if (!useAuthStore.getState().session) setInfo(t('auth.confirmEmailSent'));
      }
      // On success the auth-state subscription updates the session and the
      // router gate navigates away automatically.
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center gap-6">
        <View className="gap-1">
          <Title>{t('auth.welcomeTitle')}</Title>
          <Subtitle>{t('auth.welcomeSubtitle')}</Subtitle>
        </View>

        <SegmentedControl
          options={[
            { value: 'signIn', label: t('auth.signIn') },
            { value: 'signUp', label: t('auth.signUp') },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v as Mode);
            setError(null);
            setInfo(null);
          }}
        />

        <View className="gap-3">
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          />
          <Muted>{t('auth.passwordHint')}</Muted>
        </View>

        {error ? <Body className="text-danger dark:text-danger-dark">{error}</Body> : null}
        {info ? <Body className="text-accent dark:text-accent-dark">{info}</Body> : null}

        <Button
          title={mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
          onPress={submit}
          size="lg"
          loading={busy}
          disabled={!canSubmit}
        />
      </View>
    </Screen>
  );
}

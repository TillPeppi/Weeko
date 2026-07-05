/**
 * i18n foundation. Default language German, second language English.
 * Initial language from device locale; user override persisted in profile
 * (applied in the root layout after the DB loads).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { de as dateFnsDe, enUS as dateFnsEnUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import de from './locales/de.json';
import en from './locales/en.json';

export type AppLanguage = 'de' | 'en';

export function deviceLanguage(): AppLanguage {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'de';
}

void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: deviceLanguage(),
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

export function setAppLanguage(language: AppLanguage): void {
  void i18n.changeLanguage(language);
}

/** date-fns locale matching the active UI language (for all date formatting). */
export function dateFnsLocale(): Locale {
  return i18n.language === 'en' ? dateFnsEnUS : dateFnsDe;
}

export default i18n;

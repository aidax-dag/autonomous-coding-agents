/**
 * Internationalization Interface Definitions
 * @module core/i18n
 */

export type Locale = 'en' | 'ko';

export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

export interface II18n {
  readonly locale: Locale;
  readonly supportedLocales: readonly Locale[];
  setLocale(locale: Locale): void;
  t(key: string, params?: Record<string, string | number>): string;
  hasKey(key: string): boolean;
  addTranslations(locale: Locale, translations: TranslationMap): void;
}

export interface I18nConfig {
  defaultLocale?: Locale;
  fallbackLocale?: Locale;
}

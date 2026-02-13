/**
 * Internationalization Module
 *
 * Provides translation support with parameterized messages,
 * nested key resolution, and runtime locale switching.
 *
 * @module core/i18n
 */

import type { II18n, Locale, TranslationMap, I18nConfig } from './interfaces/i18n.interface';
import { en } from './locales/en';
import { ko } from './locales/ko';

const builtInLocales: Record<Locale, TranslationMap> = { en, ko };

export class I18n implements II18n {
  private _locale: Locale;
  private readonly fallbackLocale: Locale;
  private readonly translations: Map<Locale, TranslationMap> = new Map();

  readonly supportedLocales: readonly Locale[];

  constructor(config?: I18nConfig) {
    this._locale = config?.defaultLocale ?? 'en';
    this.fallbackLocale = config?.fallbackLocale ?? 'en';

    for (const [locale, map] of Object.entries(builtInLocales)) {
      this.translations.set(locale as Locale, map);
    }

    this.supportedLocales = [...this.translations.keys()];
  }

  get locale(): Locale {
    return this._locale;
  }

  setLocale(locale: Locale): void {
    if (!this.translations.has(locale)) {
      throw new Error(`Unsupported locale: ${locale}`);
    }
    this._locale = locale;
  }

  t(key: string, params?: Record<string, string | number>): string {
    const value =
      this.resolve(key, this._locale) ??
      this.resolve(key, this.fallbackLocale) ??
      key;

    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (_, name: string) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`,
    );
  }

  hasKey(key: string): boolean {
    return this.resolve(key, this._locale) !== undefined;
  }

  addTranslations(locale: Locale, translations: TranslationMap): void {
    const existing = this.translations.get(locale) ?? {};
    this.translations.set(locale, this.deepMerge(existing, translations));

    if (!this.supportedLocales.includes(locale)) {
      (this.supportedLocales as Locale[]).push(locale);
    }
  }

  private resolve(key: string, locale: Locale): string | undefined {
    const map = this.translations.get(locale);
    if (!map) return undefined;

    const parts = key.split('.');
    let current: unknown = map;

    for (const part of parts) {
      if (current === null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return typeof current === 'string' ? current : undefined;
  }

  private deepMerge(target: TranslationMap, source: TranslationMap): TranslationMap {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && value !== null && typeof result[key] === 'object') {
        result[key] = this.deepMerge(
          result[key] as TranslationMap,
          value as TranslationMap,
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

let defaultInstance: I18n | null = null;

export function getI18n(config?: I18nConfig): I18n {
  if (!defaultInstance) {
    defaultInstance = new I18n(config);
  }
  return defaultInstance;
}

export function t(key: string, params?: Record<string, string | number>): string {
  return getI18n().t(key, params);
}

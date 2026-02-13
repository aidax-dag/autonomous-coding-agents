import { I18n } from '@/core/i18n';

describe('I18n', () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n();
  });

  it('should default to English locale', () => {
    expect(i18n.locale).toBe('en');
  });

  it('should support en and ko locales', () => {
    expect(i18n.supportedLocales).toContain('en');
    expect(i18n.supportedLocales).toContain('ko');
  });

  it('should translate flat keys', () => {
    expect(i18n.t('common.ok')).toBe('OK');
    expect(i18n.t('common.cancel')).toBe('Cancel');
  });

  it('should translate nested keys', () => {
    expect(i18n.t('dashboard.title')).toBe('Dashboard');
    expect(i18n.t('agent.idle')).toBe('Idle');
  });

  it('should switch locale to Korean', () => {
    i18n.setLocale('ko');
    expect(i18n.locale).toBe('ko');
    expect(i18n.t('common.ok')).toBe('확인');
    expect(i18n.t('dashboard.title')).toBe('대시보드');
  });

  it('should interpolate parameters', () => {
    const result = i18n.t('task.submitted', { taskId: 'task-123' });
    expect(result).toBe('Task submitted: task-123');
  });

  it('should interpolate Korean with parameters', () => {
    i18n.setLocale('ko');
    const result = i18n.t('task.completed', { taskId: 'task-456' });
    expect(result).toBe('작업 완료: task-456');
  });

  it('should return key for missing translations', () => {
    expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('should fallback to English for missing Korean keys', () => {
    i18n.setLocale('ko');
    i18n.addTranslations('ko', { test: { partial: 'partial' } });
    // Non-existent key in ko falls back to en, then key itself
    expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('should check if key exists', () => {
    expect(i18n.hasKey('common.ok')).toBe(true);
    expect(i18n.hasKey('missing.key')).toBe(false);
  });

  it('should add custom translations', () => {
    i18n.addTranslations('en', { custom: { greeting: 'Hello {name}' } });
    expect(i18n.t('custom.greeting', { name: 'World' })).toBe('Hello World');
  });

  it('should throw on unsupported locale', () => {
    expect(() => i18n.setLocale('fr' as 'en')).toThrow('Unsupported locale: fr');
  });

  it('should preserve unmatched params', () => {
    const result = i18n.t('task.submitted', {});
    expect(result).toBe('Task submitted: {taskId}');
  });

  it('should construct with custom default locale', () => {
    const koI18n = new I18n({ defaultLocale: 'ko' });
    expect(koI18n.locale).toBe('ko');
    expect(koI18n.t('common.ok')).toBe('확인');
  });
});

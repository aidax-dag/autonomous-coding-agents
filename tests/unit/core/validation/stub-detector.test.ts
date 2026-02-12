/**
 * Stub Detector Tests
 */

import { StubDetector, STUB_PATTERNS } from '@/core/validation/stub-detector';

describe('StubDetector', () => {
  let detector: StubDetector;

  beforeEach(() => {
    detector = new StubDetector();
  });

  it('should have 20+ patterns', () => {
    expect(STUB_PATTERNS.length).toBeGreaterThanOrEqual(20);
    expect(detector.getPatternCount()).toBeGreaterThanOrEqual(20);
  });

  it('should detect TODO comments', () => {
    const results = detector.detect('test.ts', '// TODO: implement this');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('TODO comment');
  });

  it('should detect FIXME comments', () => {
    const results = detector.detect('test.ts', '// FIXME: broken logic');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('FIXME comment');
  });

  it('should detect not implemented errors', () => {
    const results = detector.detect('test.ts', "throw new Error('not implemented')");
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
  });

  it('should detect empty arrow functions', () => {
    const results = detector.detect('test.ts', 'const fn = () => {}');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should detect placeholder string literals', () => {
    const results = detector.detect('test.ts', "const x = 'placeholder'");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].severity).toBe('error');
  });

  it('should detect return null patterns', () => {
    const results = detector.detect('test.ts', 'return null; // temp');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle clean files with no stubs', () => {
    const clean = `
export function add(a: number, b: number): number {
  return a + b;
}
    `;
    const results = detector.detect('clean.ts', clean);
    expect(results).toHaveLength(0);
  });

  it('should classify errors vs warnings', () => {
    const content = [
      '// TODO: fix later',
      "throw new Error('not implemented')",
    ].join('\n');
    const results = detector.detect('test.ts', content);
    const warnings = results.filter((r) => r.severity === 'warning');
    const errors = results.filter((r) => r.severity === 'error');
    expect(warnings.length).toBeGreaterThan(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should return correct line numbers', () => {
    const content = 'line1\nline2\n// TODO fix\nline4';
    const results = detector.detect('test.ts', content);
    expect(results[0].line).toBe(3);
  });

  it('should support custom additional patterns', () => {
    const custom = new StubDetector([
      { pattern: /CUSTOM_MARKER/, description: 'Custom marker', severity: 'error' },
    ]);
    const results = custom.detect('test.ts', 'CUSTOM_MARKER here');
    expect(results.length).toBeGreaterThan(0);
    expect(custom.getPatternCount()).toBe(STUB_PATTERNS.length + 1);
  });

  it('should detect hasErrors correctly', () => {
    const withErrors = detector.detect('test.ts', "throw new Error('not implemented')");
    expect(detector.hasErrors(withErrors)).toBe(true);

    const withoutErrors = detector.detect('test.ts', '// TODO: fix');
    expect(detector.hasErrors(withoutErrors)).toBe(false);
  });
});

/**
 * Stub Detector Tests
 *
 * Tests for enhanced stub/placeholder detection including:
 * - 30+ pattern detection
 * - Severity classification (critical, error, warning, info)
 * - Agent/skill fallback patterns
 * - Heuristic empty-return-in-data-function detection
 * - CI-ready filesystem scanning via detectStubs()
 */

import { StubDetector, STUB_PATTERNS, detectStubs } from '@/core/validation/stub-detector';
import type { StubDetectionReport } from '@/core/validation/interfaces/verification-report.interface';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('StubDetector', () => {
  let detector: StubDetector;

  beforeEach(() => {
    detector = new StubDetector();
  });

  // ==========================================================================
  // Pattern count
  // ==========================================================================

  it('should have 30+ patterns', () => {
    expect(STUB_PATTERNS.length).toBeGreaterThanOrEqual(30);
    expect(detector.getPatternCount()).toBeGreaterThanOrEqual(30);
  });

  // ==========================================================================
  // Comment markers
  // ==========================================================================

  it('should detect TODO comments', () => {
    const results = detector.detect('test.ts', '// TODO: implement this');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('TODO comment');
    expect(results[0].severity).toBe('warning');
  });

  it('should detect FIXME comments', () => {
    const results = detector.detect('test.ts', '// FIXME: broken logic');
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('FIXME comment');
    expect(results[0].severity).toBe('warning');
  });

  it('should detect HACK comments', () => {
    const results = detector.detect('test.ts', '// HACK: workaround');
    expect(results.some((r) => r.pattern === 'HACK comment')).toBe(true);
  });

  it('should detect XXX comments', () => {
    const results = detector.detect('test.ts', '// XXX: review this');
    expect(results.some((r) => r.pattern === 'XXX comment')).toBe(true);
  });

  it('should detect TEMP comments', () => {
    const results = detector.detect('test.ts', '// TEMP: temporary code');
    expect(results.some((r) => r.pattern === 'TEMP comment')).toBe(true);
  });

  it('should detect PLACEHOLDER comments as critical', () => {
    const results = detector.detect('test.ts', '// PLACEHOLDER: will replace');
    expect(results.some((r) => r.pattern === 'PLACEHOLDER comment' && r.severity === 'critical')).toBe(true);
  });

  // ==========================================================================
  // Not implemented errors (critical)
  // ==========================================================================

  it('should detect "not implemented" errors as critical', () => {
    const results = detector.detect('test.ts', "throw new Error('not implemented')");
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('critical');
    expect(results[0].pattern).toBe('Not implemented error');
  });

  it('should detect "not yet implemented" errors as critical', () => {
    const results = detector.detect('test.ts', 'throw new Error("not yet implemented")');
    const matches = results.filter((r) => r.pattern === 'Not yet implemented error');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should detect "TODO" error throws as critical', () => {
    const results = detector.detect('test.ts', "throw new Error('TODO: implement')");
    const matches = results.filter((r) => r.pattern === 'TODO error throw');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should detect notImplemented() calls as critical', () => {
    const results = detector.detect('test.ts', 'notImplemented()');
    expect(results.some((r) => r.pattern === 'notImplemented() call' && r.severity === 'critical')).toBe(true);
  });

  // ==========================================================================
  // Placeholder / stub strings (critical)
  // ==========================================================================

  it('should detect placeholder string literals as critical', () => {
    const results = detector.detect('test.ts', "const x = 'placeholder'");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].severity).toBe('critical');
  });

  it('should detect "placeholder for LLM" string as critical', () => {
    const results = detector.detect('test.ts', 'return "placeholder for LLM"');
    const matches = results.filter((r) => r.pattern === 'placeholder for LLM string');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should detect "default stub" string as critical', () => {
    const results = detector.detect('test.ts', "const msg = 'default stub'");
    const matches = results.filter((r) => r.pattern === 'default stub string');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should detect "default stub output" string as critical', () => {
    const results = detector.detect('test.ts', 'return "default stub output"');
    const matches = results.filter((r) => r.pattern === 'default stub output string');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should detect "stub" string literal as critical', () => {
    const results = detector.detect('test.ts', "type: 'stub'");
    expect(results.some((r) => r.pattern === 'stub string literal' && r.severity === 'critical')).toBe(true);
  });

  // ==========================================================================
  // Empty / placeholder returns (warning)
  // ==========================================================================

  it('should detect return null patterns', () => {
    const results = detector.detect('test.ts', 'return null; // temp');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should detect bare return undefined', () => {
    const results = detector.detect('test.ts', '  return undefined');
    expect(results.some((r) => r.pattern === 'bare return undefined')).toBe(true);
  });

  it('should detect empty object return', () => {
    const results = detector.detect('test.ts', '  return {};');
    expect(results.some((r) => r.pattern === 'empty object return')).toBe(true);
  });

  it('should detect empty array return', () => {
    const results = detector.detect('test.ts', '  return [];');
    expect(results.some((r) => r.pattern === 'empty array return')).toBe(true);
  });

  // ==========================================================================
  // Empty function bodies (warning)
  // ==========================================================================

  it('should detect empty arrow functions', () => {
    const results = detector.detect('test.ts', 'const fn = () => {}');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should detect empty blocks', () => {
    const results = detector.detect('test.ts', 'function doSomething() {}');
    expect(results.some((r) => r.pattern === 'empty block' || r.pattern === 'empty arrow function')).toBe(true);
  });

  // ==========================================================================
  // Agent/skill fallback patterns (critical)
  // ==========================================================================

  it('should detect confidence: 0 in object literals as critical', () => {
    const results = detector.detect('test.ts', '  confidence: 0,');
    const matches = results.filter((r) => r.pattern === 'confidence: 0 fallback');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should detect confidence: 0.0 in object literals as critical', () => {
    const results = detector.detect('test.ts', '  confidence: 0.0,');
    const matches = results.filter((r) => r.pattern === 'confidence: 0 fallback');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should detect confidence = 0 assignment as critical', () => {
    const results = detector.detect('test.ts', 'let confidence = 0;');
    const matches = results.filter((r) => r.pattern === 'confidence = 0 assignment');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('should not detect confidence: 0.5 as a fallback', () => {
    const results = detector.detect('test.ts', '  confidence: 0.5,');
    const matches = results.filter((r) => r.pattern.includes('confidence'));
    expect(matches).toHaveLength(0);
  });

  // ==========================================================================
  // Hardcoded template / info severity
  // ==========================================================================

  it('should detect "Generated by template" as info severity', () => {
    const results = detector.detect('test.ts', 'return "Generated by template"');
    const matches = results.filter((r) => r.pattern === 'hardcoded template output');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('info');
  });

  it('should detect "Template output" as info severity', () => {
    const results = detector.detect('test.ts', "const msg = 'Template output'");
    const matches = results.filter((r) => r.pattern === 'template output string');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('info');
  });

  it('should detect auto-generated marker as info severity', () => {
    const results = detector.detect('test.ts', '// auto-generated');
    const matches = results.filter((r) => r.pattern === 'auto-generated marker');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('info');
  });

  it('should detect "sample output" as info severity', () => {
    const results = detector.detect('test.ts', 'return "sample output"');
    const matches = results.filter((r) => r.pattern === 'sample output string');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('info');
  });

  it('should detect "example output" as info severity', () => {
    const results = detector.detect('test.ts', "return 'example output'");
    const matches = results.filter((r) => r.pattern === 'example output string');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('info');
  });

  // ==========================================================================
  // Heuristic: empty return in data-producing functions
  // ==========================================================================

  it('should detect empty return [] inside analyzeXyz function', () => {
    const content = [
      'function analyzeCodeQuality(code: string) {',
      '  return [];',
      '}',
    ].join('\n');
    const results = detector.detect('test.ts', content);
    const matches = results.filter((r) => r.pattern === 'empty return in data function');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('warning');
  });

  it('should detect empty return {} inside generateReport function', () => {
    const content = [
      'function generateReport() {',
      '  return {};',
      '}',
    ].join('\n');
    const results = detector.detect('test.ts', content);
    const matches = results.filter((r) => r.pattern === 'empty return in data function');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should not flag empty return [] inside non-data functions', () => {
    const content = [
      'function resetState() {',
      '  return [];',
      '}',
    ].join('\n');
    const results = detector.detect('test.ts', content);
    const matches = results.filter((r) => r.pattern === 'empty return in data function');
    expect(matches).toHaveLength(0);
  });

  // ==========================================================================
  // Clean files
  // ==========================================================================

  it('should handle clean files with no stubs', () => {
    const clean = `
export function add(a: number, b: number): number {
  return a + b;
}
    `;
    const results = detector.detect('clean.ts', clean);
    expect(results).toHaveLength(0);
  });

  // ==========================================================================
  // Severity classification
  // ==========================================================================

  it('should classify critical vs warning vs info', () => {
    const content = [
      '// TODO: fix later',
      "throw new Error('not implemented')",
      '// auto-generated',
    ].join('\n');
    const results = detector.detect('test.ts', content);
    const warnings = results.filter((r) => r.severity === 'warning');
    const criticals = results.filter((r) => r.severity === 'critical');
    const infos = results.filter((r) => r.severity === 'info');
    expect(warnings.length).toBeGreaterThan(0);
    expect(criticals.length).toBeGreaterThan(0);
    expect(infos.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Line numbers
  // ==========================================================================

  it('should return correct line numbers', () => {
    const content = 'line1\nline2\n// TODO fix\nline4';
    const results = detector.detect('test.ts', content);
    expect(results[0].line).toBe(3);
  });

  // ==========================================================================
  // Custom patterns
  // ==========================================================================

  it('should support custom additional patterns', () => {
    const custom = new StubDetector([
      { pattern: /CUSTOM_MARKER/, description: 'Custom marker', severity: 'error' },
    ]);
    const results = custom.detect('test.ts', 'CUSTOM_MARKER here');
    expect(results.length).toBeGreaterThan(0);
    expect(custom.getPatternCount()).toBe(STUB_PATTERNS.length + 1);
  });

  // ==========================================================================
  // hasErrors and hasCritical
  // ==========================================================================

  it('should detect hasErrors correctly for critical severity', () => {
    const withCritical = detector.detect('test.ts', "throw new Error('not implemented')");
    expect(detector.hasErrors(withCritical)).toBe(true);
  });

  it('should detect hasErrors correctly for error severity', () => {
    const withErrors = detector.detect('test.ts', 'some code...');
    expect(detector.hasErrors(withErrors)).toBe(true);
  });

  it('should return false for hasErrors on warning-only detections', () => {
    const withoutErrors = detector.detect('test.ts', '// TODO: fix');
    expect(detector.hasErrors(withoutErrors)).toBe(false);
  });

  it('should return false for hasErrors on info-only detections', () => {
    const withInfo = detector.detect('test.ts', '// auto-generated');
    expect(detector.hasErrors(withInfo)).toBe(false);
  });

  it('should detect hasCritical correctly', () => {
    const withCritical = detector.detect('test.ts', "throw new Error('not implemented')");
    expect(detector.hasCritical(withCritical)).toBe(true);

    const withWarning = detector.detect('test.ts', '// TODO: fix');
    expect(detector.hasCritical(withWarning)).toBe(false);
  });
});

// ============================================================================
// detectStubs() filesystem scanning tests
// ============================================================================

describe('detectStubs', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `stub-detector-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should return passing report for clean project', async () => {
    await writeFile(
      join(testDir, 'src', 'clean.ts'),
      `export function add(a: number, b: number): number {\n  return a + b;\n}\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(true);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.infoCount).toBe(0);
    expect(report.results).toHaveLength(0);
  });

  it('should detect critical stubs and fail the report', async () => {
    await writeFile(
      join(testDir, 'src', 'broken.ts'),
      `export function doWork() {\n  throw new Error('not implemented');\n}\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(false);
    expect(report.criticalCount).toBeGreaterThan(0);
    expect(report.results.some((r) => r.severity === 'critical')).toBe(true);
  });

  it('should pass when only warnings are present', async () => {
    await writeFile(
      join(testDir, 'src', 'todo.ts'),
      `// TODO: improve this\nexport const x = 1;\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(true);
    expect(report.warningCount).toBeGreaterThan(0);
  });

  it('should pass when only info-level detections are present', async () => {
    await writeFile(
      join(testDir, 'src', 'template.ts'),
      `// auto-generated\nexport const x = 1;\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(true);
    expect(report.infoCount).toBeGreaterThan(0);
  });

  it('should skip test files by default', async () => {
    await mkdir(join(testDir, 'src', '__tests__'), { recursive: true });
    await writeFile(
      join(testDir, 'src', '__tests__', 'foo.test.ts'),
      `throw new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(true);
    expect(report.criticalCount).toBe(0);
  });

  it('should include test files when skipTests is false', async () => {
    await mkdir(join(testDir, 'tests'), { recursive: true });
    await writeFile(
      join(testDir, 'tests', 'foo.test.ts'),
      `throw new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir, { skipTests: false });
    expect(report.criticalCount).toBeGreaterThan(0);
    expect(report.passed).toBe(false);
  });

  it('should skip node_modules directory', async () => {
    await mkdir(join(testDir, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(
      join(testDir, 'node_modules', 'pkg', 'index.ts'),
      `throw new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(true);
    expect(report.criticalCount).toBe(0);
  });

  it('should skip dist directory', async () => {
    await mkdir(join(testDir, 'dist'), { recursive: true });
    await writeFile(
      join(testDir, 'dist', 'index.ts'),
      `throw new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(true);
  });

  it('should filter by severity option', async () => {
    await writeFile(
      join(testDir, 'src', 'mixed.ts'),
      [
        "throw new Error('not implemented');",
        '// TODO: fix this',
        '// auto-generated',
      ].join('\n'),
    );

    // Only critical
    const criticalOnly = await detectStubs(testDir, { severity: 'critical' });
    expect(criticalOnly.criticalCount).toBeGreaterThan(0);
    expect(criticalOnly.warningCount).toBe(0);
    expect(criticalOnly.infoCount).toBe(0);

    // Warning and above
    const warningUp = await detectStubs(testDir, { severity: 'warning' });
    expect(warningUp.criticalCount).toBeGreaterThan(0);
    expect(warningUp.warningCount).toBeGreaterThan(0);
    expect(warningUp.infoCount).toBe(0);

    // All severities (default)
    const all = await detectStubs(testDir);
    expect(all.criticalCount).toBeGreaterThan(0);
    expect(all.warningCount).toBeGreaterThan(0);
    expect(all.infoCount).toBeGreaterThan(0);
  });

  it('should include relative file paths in results', async () => {
    await writeFile(
      join(testDir, 'src', 'broken.ts'),
      `throw new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir);
    const fileResult = report.results.find((r) => r.severity === 'critical');
    expect(fileResult).toBeDefined();
    expect(fileResult!.file).toContain('src/broken.ts');
    expect(fileResult!.file).not.toContain(testDir);
  });

  it('should include line numbers in results', async () => {
    await writeFile(
      join(testDir, 'src', 'broken.ts'),
      `const x = 1;\nthrow new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir);
    const fileResult = report.results.find((r) => r.severity === 'critical');
    expect(fileResult).toBeDefined();
    expect(fileResult!.line).toBe(2);
  });

  it('should include message in results', async () => {
    await writeFile(
      join(testDir, 'src', 'broken.ts'),
      `throw new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir);
    const fileResult = report.results.find((r) => r.severity === 'critical');
    expect(fileResult).toBeDefined();
    expect(fileResult!.message).toContain('Not implemented error');
  });

  it('should return empty report for nonexistent path', async () => {
    const report = await detectStubs('/nonexistent/path/that/does/not/exist');
    expect(report.passed).toBe(true);
    expect(report.results).toHaveLength(0);
  });

  it('should detect agent fallback pattern (confidence: 0)', async () => {
    await writeFile(
      join(testDir, 'src', 'agent.ts'),
      `const result = { confidence: 0, output: '' };\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(false);
    expect(report.results.some((r) => r.pattern.includes('confidence'))).toBe(true);
  });

  it('should detect multiple stubs across multiple files', async () => {
    await writeFile(
      join(testDir, 'src', 'a.ts'),
      `throw new Error('not implemented');\n`,
    );
    await writeFile(
      join(testDir, 'src', 'b.ts'),
      `return "placeholder";\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(false);
    expect(report.criticalCount).toBeGreaterThanOrEqual(2);
    const uniqueFiles = new Set(report.results.map((r) => r.file));
    expect(uniqueFiles.size).toBeGreaterThanOrEqual(2);
  });

  it('should ignore non-source file extensions', async () => {
    await writeFile(
      join(testDir, 'src', 'readme.md'),
      `throw new Error('not implemented');\n`,
    );
    await writeFile(
      join(testDir, 'src', 'data.json'),
      `{ "placeholder": true }\n`,
    );
    const report = await detectStubs(testDir);
    expect(report.passed).toBe(true);
    expect(report.criticalCount).toBe(0);
  });

  it('should support custom additional patterns via options', async () => {
    await writeFile(
      join(testDir, 'src', 'custom.ts'),
      `CUSTOM_SENTINEL_VALUE\n`,
    );
    const report = await detectStubs(testDir, {
      additionalPatterns: [
        { pattern: /CUSTOM_SENTINEL_VALUE/, description: 'Custom sentinel', severity: 'critical' },
      ],
    });
    expect(report.passed).toBe(false);
    expect(report.results.some((r) => r.pattern === 'Custom sentinel')).toBe(true);
  });

  it('should correctly count all severity levels', async () => {
    await writeFile(
      join(testDir, 'src', 'all-levels.ts'),
      [
        "throw new Error('not implemented');",  // critical
        '// TODO: fix later',                    // warning
        '// auto-generated',                     // info
      ].join('\n'),
    );
    const report = await detectStubs(testDir);

    expect(report.criticalCount).toBeGreaterThan(0);
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.infoCount).toBeGreaterThan(0);
    expect(report.results.length).toBe(
      report.criticalCount + report.warningCount + report.infoCount,
    );
  });

  it('should report StubDetectionResult with correct shape', async () => {
    await writeFile(
      join(testDir, 'src', 'shape.ts'),
      `throw new Error('not implemented');\n`,
    );
    const report = await detectStubs(testDir);
    const result = report.results[0];
    expect(result).toBeDefined();
    expect(typeof result.file).toBe('string');
    expect(typeof result.line).toBe('number');
    expect(typeof result.pattern).toBe('string');
    expect(['critical', 'warning', 'info']).toContain(result.severity);
    expect(typeof result.message).toBe('string');
  });

  it('should report StubDetectionReport with correct shape', async () => {
    await writeFile(
      join(testDir, 'src', 'shape.ts'),
      `export const x = 1;\n`,
    );
    const report: StubDetectionReport = await detectStubs(testDir);
    expect(Array.isArray(report.results)).toBe(true);
    expect(typeof report.criticalCount).toBe('number');
    expect(typeof report.warningCount).toBe('number');
    expect(typeof report.infoCount).toBe('number');
    expect(typeof report.passed).toBe('boolean');
  });
});

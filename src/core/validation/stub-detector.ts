/**
 * Stub Detector
 *
 * Enhanced stub/placeholder detection with 30+ patterns including
 * agent/skill fallback detection and CI-ready project scanning.
 *
 * @module core/validation/stub-detector
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, extname } from 'path';
import type {
  StubDetection,
  StubSeverity,
  StubDetectionResult,
  StubDetectionReport,
} from './interfaces/verification-report.interface';

/**
 * Stub pattern definition
 */
export interface StubPattern {
  pattern: RegExp;
  description: string;
  severity: StubSeverity;
}

// ============================================================================
// Directories and extensions to skip during filesystem scanning
// ============================================================================

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  '.next',
  '.nuxt',
  'build',
  '__pycache__',
  '.tox',
  '.mypy_cache',
  'vendor',
]);

const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.rb',
  '.php',
  '.cs',
  '.swift',
]);

/**
 * Returns true if the given file path looks like a test file.
 */
function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('__tests__') ||
    lower.includes('/tests/') ||
    lower.includes('/test/') ||
    lower.includes('_test.') ||
    lower.endsWith('.test') ||
    lower.endsWith('.spec')
  );
}

// ============================================================================
// Detection patterns (30+)
// ============================================================================

/**
 * Names of functions that are expected to return substantive data.
 * Used for heuristic "return [] / return {}" detection.
 */
const DATA_FUNCTION_NAMES = [
  'analyze',
  'generate',
  'collect',
  'fetch',
  'compute',
  'calculate',
  'build',
  'create',
  'compile',
  'parse',
  'transform',
  'resolve',
  'evaluate',
  'produce',
  'extract',
  'aggregate',
  'process',
  'detect',
  'scan',
  'list',
  'get',
  'find',
  'search',
  'query',
  'load',
  'read',
];

/**
 * Extended stub patterns (30+ patterns)
 */
export const STUB_PATTERNS: StubPattern[] = [
  // ==========================================================================
  // Comment markers (warning)
  // ==========================================================================
  { pattern: /\/\/\s*TODO/i, description: 'TODO comment', severity: 'warning' },
  { pattern: /\/\/\s*FIXME/i, description: 'FIXME comment', severity: 'warning' },
  { pattern: /\/\/\s*HACK/i, description: 'HACK comment', severity: 'warning' },
  { pattern: /\/\/\s*XXX/i, description: 'XXX comment', severity: 'warning' },
  { pattern: /\/\/\s*TEMP/i, description: 'TEMP comment', severity: 'warning' },
  { pattern: /\/\/\s*PLACEHOLDER/i, description: 'PLACEHOLDER comment', severity: 'critical' },

  // ==========================================================================
  // Not implemented throws (critical)
  // ==========================================================================
  { pattern: /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented/i, description: 'Not implemented error', severity: 'critical' },
  { pattern: /throw\s+new\s+Error\s*\(\s*['"`]not\s+yet\s+implemented/i, description: 'Not yet implemented error', severity: 'critical' },
  { pattern: /throw\s+new\s+Error\s*\(\s*['"`]TODO/i, description: 'TODO error throw', severity: 'critical' },
  { pattern: /notImplemented\(\)/, description: 'notImplemented() call', severity: 'critical' },

  // ==========================================================================
  // Placeholder / stub string literals (critical)
  // ==========================================================================
  { pattern: /['"`]placeholder['"`]/i, description: 'placeholder string literal', severity: 'critical' },
  { pattern: /['"`]placeholder\s+for\s+LLM['"`]/i, description: 'placeholder for LLM string', severity: 'critical' },
  { pattern: /['"`]default\s+stub['"`]/i, description: 'default stub string', severity: 'critical' },
  { pattern: /['"`]default\s+stub\s+output['"`]/i, description: 'default stub output string', severity: 'critical' },
  { pattern: /['"`]stub['"`]/, description: 'stub string literal', severity: 'critical' },

  // ==========================================================================
  // Empty / placeholder returns (warning)
  // ==========================================================================
  { pattern: /return\s+null\s*;?\s*\/\//, description: 'return null with comment', severity: 'warning' },
  { pattern: /return\s+undefined\s*;?\s*$/, description: 'bare return undefined', severity: 'warning' },
  { pattern: /return\s*\{\s*\}\s*;?\s*$/, description: 'empty object return', severity: 'warning' },
  { pattern: /return\s*\[\s*\]\s*;?\s*$/, description: 'empty array return', severity: 'warning' },

  // ==========================================================================
  // Empty function bodies (warning)
  // ==========================================================================
  { pattern: /\{\s*\}\s*$/, description: 'empty block', severity: 'warning' },
  { pattern: /=>\s*\{\s*\}/, description: 'empty arrow function', severity: 'warning' },

  // ==========================================================================
  // Console-only implementations (warning)
  // ==========================================================================
  { pattern: /^\s*console\.(log|warn|error)\s*\(.*\)\s*;?\s*$/, description: 'console-only implementation', severity: 'warning' },

  // ==========================================================================
  // Mock / dummy values (warning)
  // ==========================================================================
  { pattern: /['"`]mock['"`]/, description: 'mock string literal', severity: 'warning' },

  // ==========================================================================
  // Ellipsis / pass patterns (error)
  // ==========================================================================
  { pattern: /\.\.\.\s*$/, description: 'ellipsis (incomplete code)', severity: 'error' },
  { pattern: /pass\s*$/, description: 'pass statement', severity: 'warning' },

  // ==========================================================================
  // Agent / skill fallback patterns (critical or info)
  // ==========================================================================
  { pattern: /confidence\s*:\s*0(?:\.0+)?\s*[,}\s]/, description: 'confidence: 0 fallback', severity: 'critical' },
  { pattern: /confidence\s*=\s*0(?:\.0+)?\s*[;,]/, description: 'confidence = 0 assignment', severity: 'critical' },

  // ==========================================================================
  // Hardcoded template detection (info)
  // ==========================================================================
  { pattern: /['"`]Generated\s+by\s+template['"`]/i, description: 'hardcoded template output', severity: 'info' },
  { pattern: /['"`]Template\s+output['"`]/i, description: 'template output string', severity: 'info' },
  { pattern: /\/\/\s*auto-?generated/i, description: 'auto-generated marker', severity: 'info' },
  { pattern: /['"`]sample\s+output['"`]/i, description: 'sample output string', severity: 'info' },
  { pattern: /['"`]example\s+output['"`]/i, description: 'example output string', severity: 'info' },
];

// ============================================================================
// Heuristic patterns (context-dependent, checked separately)
// ============================================================================

/**
 * Regex to detect "return []" or "return {}" within a function whose name
 * suggests it should return substantive data.
 */
const DATA_FUNCTION_PATTERN = new RegExp(
  `(?:function|const|let|var)\\s+(${DATA_FUNCTION_NAMES.join('|')})\\w*`,
  'i',
);

const EMPTY_RETURN_PATTERN = /^\s*return\s*(\[\s*\]|\{\s*\})\s*;?\s*$/;

// ============================================================================
// StubDetector class
// ============================================================================

/**
 * Stub Detector
 *
 * Scans file content for stub/placeholder patterns with severity classification.
 */
export class StubDetector {
  private patterns: StubPattern[];

  constructor(additionalPatterns?: StubPattern[]) {
    this.patterns = [...STUB_PATTERNS, ...(additionalPatterns ?? [])];
  }

  /**
   * Detect stub patterns in the given file content.
   *
   * Returns per-line detections with severity classification.
   */
  detect(filePath: string, content: string): StubDetection[] {
    const detections: StubDetection[] = [];
    const lines = content.split('\n');

    // Pre-scan: identify data-producing function scopes for heuristic matching
    const dataFunctionRanges = this.findDataFunctionRanges(lines);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Standard pattern matching
      for (const { pattern, description, severity } of this.patterns) {
        if (pattern.test(line)) {
          detections.push({
            filePath,
            line: i + 1,
            pattern: description,
            content: line.trim(),
            severity,
          });
        }
      }

      // Heuristic: "return []" or "return {}" inside a data-producing function
      if (EMPTY_RETURN_PATTERN.test(line)) {
        const inDataFunction = dataFunctionRanges.some(
          (range) => i >= range.start && i <= range.end,
        );
        if (inDataFunction) {
          detections.push({
            filePath,
            line: i + 1,
            pattern: 'empty return in data function',
            content: line.trim(),
            severity: 'warning',
          });
        }
      }
    }

    return detections;
  }

  /**
   * Returns true if any detections have 'critical' or 'error' severity.
   */
  hasErrors(detections: StubDetection[]): boolean {
    return detections.some((d) => d.severity === 'error' || d.severity === 'critical');
  }

  /**
   * Returns true if any detections have 'critical' severity.
   */
  hasCritical(detections: StubDetection[]): boolean {
    return detections.some((d) => d.severity === 'critical');
  }

  getPatternCount(): number {
    return this.patterns.length;
  }

  /**
   * Find approximate ranges of data-producing functions in the source lines.
   *
   * This is a simple brace-counting heuristic, not AST parsing.
   */
  private findDataFunctionRanges(lines: string[]): { start: number; end: number }[] {
    const ranges: { start: number; end: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (DATA_FUNCTION_PATTERN.test(lines[i])) {
        // Find the opening brace
        let braceDepth = 0;
        let started = false;
        let end = i;

        for (let j = i; j < lines.length; j++) {
          for (const ch of lines[j]) {
            if (ch === '{') {
              braceDepth++;
              started = true;
            } else if (ch === '}') {
              braceDepth--;
            }
          }
          if (started && braceDepth <= 0) {
            end = j;
            break;
          }
        }

        ranges.push({ start: i, end });
      }
    }

    return ranges;
  }
}

// ============================================================================
// CI-ready filesystem scanning
// ============================================================================

/**
 * Options for the detectStubs filesystem scanner.
 */
export interface DetectStubsOptions {
  /** Minimum severity to include in results. Defaults to all severities. */
  severity?: 'critical' | 'warning' | 'info';
  /** Additional patterns to scan for. */
  additionalPatterns?: StubPattern[];
  /** File extensions to scan. Defaults to common source extensions. */
  extensions?: Set<string>;
  /** Directory names to skip. Defaults to node_modules, dist, .git, etc. */
  skipDirs?: Set<string>;
  /** Whether to skip test files. Defaults to true. */
  skipTests?: boolean;
}

/**
 * Map internal StubSeverity to the three-tier CI severity.
 * 'error' is promoted to 'critical' since both indicate blocking issues.
 */
function toCISeverity(severity: StubSeverity): 'critical' | 'warning' | 'info' {
  if (severity === 'critical' || severity === 'error') {
    return 'critical';
  }
  return severity;
}

/**
 * Severity ordering for filtering (lower index = more severe).
 */
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  error: 0,
  warning: 1,
  info: 2,
};

/**
 * Recursively collect file paths under a directory, respecting skip rules.
 */
async function collectFiles(
  dir: string,
  extensions: Set<string>,
  skipDirs: Set<string>,
  skipTests: boolean,
): Promise<string[]> {
  const files: string[] = [];

  let entries: import('fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
        const subFiles = await collectFiles(fullPath, extensions, skipDirs, skipTests);
        files.push(...subFiles);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (!extensions.has(ext)) continue;
      if (skipTests && isTestFile(fullPath)) continue;
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Scan a project directory for stub patterns and produce a CI-ready report.
 *
 * @param projectPath - Root directory to scan
 * @param options - Scanning options
 * @returns A structured report with counts per severity and a pass/fail flag
 *
 * @example
 * ```typescript
 * const report = await detectStubs('/path/to/project');
 * if (!report.passed) {
 *   console.error(`Found ${report.criticalCount} critical stubs`);
 *   process.exit(1);
 * }
 * ```
 */
export async function detectStubs(
  projectPath: string,
  options: DetectStubsOptions = {},
): Promise<StubDetectionReport> {
  const {
    severity: minSeverity,
    additionalPatterns,
    extensions = SCAN_EXTENSIONS,
    skipDirs: customSkipDirs = SKIP_DIRS,
    skipTests = true,
  } = options;

  // Validate projectPath exists and is a directory
  const pathStat = await stat(projectPath).catch(() => null);
  if (!pathStat || !pathStat.isDirectory()) {
    return {
      results: [],
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      passed: true,
    };
  }

  const detector = new StubDetector(additionalPatterns);
  const files = await collectFiles(projectPath, extensions, customSkipDirs, skipTests);

  const results: StubDetectionResult[] = [];

  // Determine the numeric threshold for severity filtering
  const minSeverityOrder = minSeverity !== undefined ? SEVERITY_ORDER[minSeverity] : 2;

  for (const filePath of files) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const detections = detector.detect(filePath, content);

    for (const detection of detections) {
      const detectionOrder = SEVERITY_ORDER[detection.severity] ?? 1;
      if (detectionOrder > minSeverityOrder) continue;

      const ciSeverity = toCISeverity(detection.severity);
      results.push({
        file: relative(projectPath, detection.filePath),
        line: detection.line,
        pattern: detection.pattern,
        severity: ciSeverity,
        message: `${detection.pattern}: ${detection.content}`,
      });
    }
  }

  const criticalCount = results.filter((r) => r.severity === 'critical').length;
  const warningCount = results.filter((r) => r.severity === 'warning').length;
  const infoCount = results.filter((r) => r.severity === 'info').length;

  return {
    results,
    criticalCount,
    warningCount,
    infoCount,
    passed: criticalCount === 0,
  };
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create a stub detector
 */
export function createStubDetector(additionalPatterns?: StubPattern[]): StubDetector {
  return new StubDetector(additionalPatterns);
}

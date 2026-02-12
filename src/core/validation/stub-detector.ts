/**
 * Stub Detector
 *
 * Enhanced stub/placeholder detection with 20+ patterns.
 *
 * @module core/validation/stub-detector
 */

import type { StubDetection } from './interfaces/verification-report.interface';

/**
 * Stub pattern definition
 */
interface StubPattern {
  pattern: RegExp;
  description: string;
  severity: 'warning' | 'error';
}

/**
 * Extended stub patterns (20+ patterns)
 */
export const STUB_PATTERNS: StubPattern[] = [
  // Comment markers
  { pattern: /\/\/\s*TODO/i, description: 'TODO comment', severity: 'warning' },
  { pattern: /\/\/\s*FIXME/i, description: 'FIXME comment', severity: 'warning' },
  { pattern: /\/\/\s*HACK/i, description: 'HACK comment', severity: 'warning' },
  { pattern: /\/\/\s*XXX/i, description: 'XXX comment', severity: 'warning' },
  { pattern: /\/\/\s*TEMP/i, description: 'TEMP comment', severity: 'warning' },
  { pattern: /\/\/\s*PLACEHOLDER/i, description: 'PLACEHOLDER comment', severity: 'error' },

  // Not implemented
  { pattern: /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented/i, description: 'Not implemented error', severity: 'error' },
  { pattern: /throw\s+new\s+Error\s*\(\s*['"`]TODO/i, description: 'TODO error throw', severity: 'error' },
  { pattern: /notImplemented\(\)/, description: 'notImplemented() call', severity: 'error' },

  // Empty/placeholder returns
  { pattern: /return\s+null\s*;?\s*\/\//, description: 'return null with comment', severity: 'warning' },
  { pattern: /return\s+undefined\s*;?\s*$/, description: 'bare return undefined', severity: 'warning' },
  { pattern: /return\s*\{\s*\}\s*;?\s*$/, description: 'empty object return', severity: 'warning' },
  { pattern: /return\s*\[\s*\]\s*;?\s*$/, description: 'empty array return', severity: 'warning' },

  // Empty function bodies
  { pattern: /\{\s*\}\s*$/, description: 'empty block', severity: 'warning' },
  { pattern: /=>\s*\{\s*\}/, description: 'empty arrow function', severity: 'warning' },

  // Console-only implementations
  { pattern: /^\s*console\.(log|warn|error)\s*\(.*\)\s*;?\s*$/, description: 'console-only implementation', severity: 'warning' },

  // Placeholder values
  { pattern: /['"`]placeholder['"`]/, description: 'placeholder string literal', severity: 'error' },
  { pattern: /['"`]stub['"`]/, description: 'stub string literal', severity: 'error' },
  { pattern: /['"`]mock['"`]/, description: 'mock string literal', severity: 'warning' },

  // Ellipsis / pass patterns
  { pattern: /\.\.\.\s*$/, description: 'ellipsis (incomplete code)', severity: 'error' },
  { pattern: /pass\s*$/, description: 'pass statement', severity: 'warning' },
];

/**
 * Stub Detector
 *
 * Scans file content for stub/placeholder patterns.
 */
export class StubDetector {
  private patterns: StubPattern[];

  constructor(additionalPatterns?: StubPattern[]) {
    this.patterns = [...STUB_PATTERNS, ...(additionalPatterns ?? [])];
  }

  detect(filePath: string, content: string): StubDetection[] {
    const detections: StubDetection[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
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
    }

    return detections;
  }

  hasErrors(detections: StubDetection[]): boolean {
    return detections.some((d) => d.severity === 'error');
  }

  getPatternCount(): number {
    return this.patterns.length;
  }
}

/**
 * Create a stub detector
 */
export function createStubDetector(additionalPatterns?: StubPattern[]): StubDetector {
  return new StubDetector(additionalPatterns);
}

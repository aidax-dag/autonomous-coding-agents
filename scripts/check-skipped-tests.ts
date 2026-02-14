/**
 * Skipped Test Checker Script
 *
 * Scans test files for skipped/todo patterns and reports a summary.
 * Returns exit code 1 when the number of skipped tests exceeds a
 * configurable threshold (default: 50).
 *
 * Usage:
 *   npx tsx scripts/check-skipped-tests.ts [--max-skips N] [--json]
 */

import { readFileSync } from 'fs';
import { resolve, relative } from 'path';
import { globSync } from 'glob';

// ============================================================================
// Types
// ============================================================================

interface SkipMatch {
  file: string;
  line: number;
  pattern: string;
  text: string;
}

interface FileSummary {
  file: string;
  count: number;
  patterns: string[];
}

// ============================================================================
// Skip Patterns
// ============================================================================

const SKIP_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /it\.skip\s*\(/g, label: 'it.skip' },
  { regex: /xit\s*\(/g, label: 'xit' },
  { regex: /test\.skip\s*\(/g, label: 'test.skip' },
  { regex: /describe\.skip\s*\(/g, label: 'describe.skip' },
  { regex: /xdescribe\s*\(/g, label: 'xdescribe' },
  { regex: /it\.todo\s*\(/g, label: 'it.todo' },
];

// ============================================================================
// Scanning
// ============================================================================

function scanFile(filePath: string, rootDir: string): SkipMatch[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const matches: SkipMatch[] = [];
  const relPath = relative(rootDir, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SKIP_PATTERNS) {
      // Create a fresh regex per line since we use lastIndex-resetting
      const re = new RegExp(pattern.regex.source, 'g');
      if (re.test(line)) {
        matches.push({
          file: relPath,
          line: i + 1,
          pattern: pattern.label,
          text: line.trim(),
        });
      }
    }
  }

  return matches;
}

function scanAllTests(rootDir: string): SkipMatch[] {
  const testGlob = resolve(rootDir, 'tests/**/*.test.ts');
  const files = globSync(testGlob);
  const allMatches: SkipMatch[] = [];

  for (const file of files) {
    const matches = scanFile(file, rootDir);
    allMatches.push(...matches);
  }

  return allMatches;
}

// ============================================================================
// Reporting
// ============================================================================

function buildFileSummary(matches: SkipMatch[]): FileSummary[] {
  const grouped = new Map<string, SkipMatch[]>();

  for (const match of matches) {
    const existing = grouped.get(match.file) ?? [];
    existing.push(match);
    grouped.set(match.file, existing);
  }

  const summaries: FileSummary[] = [];
  for (const [file, fileMatches] of grouped) {
    const patterns = [...new Set(fileMatches.map((m) => m.pattern))];
    summaries.push({ file, count: fileMatches.length, patterns });
  }

  return summaries.sort((a, b) => b.count - a.count);
}

function printTable(summaries: FileSummary[], total: number, max: number): void {
  console.log('\n=== Skipped Test Report ===\n');

  if (summaries.length === 0) {
    console.log('  No skipped tests found.\n');
    return;
  }

  console.log(
    '  ' +
      'File'.padEnd(60) +
      'Count'.padEnd(8) +
      'Patterns',
  );
  console.log('  ' + '-'.repeat(90));

  for (const summary of summaries) {
    const file = summary.file.length > 58
      ? '...' + summary.file.slice(-55)
      : summary.file;
    console.log(
      '  ' +
        file.padEnd(60) +
        String(summary.count).padEnd(8) +
        summary.patterns.join(', '),
    );
  }

  console.log('  ' + '-'.repeat(90));
  console.log(`  Total: ${total} skipped tests (threshold: ${max})`);

  const status = total > max ? 'OVER THRESHOLD' : 'WITHIN THRESHOLD';
  console.log(`  Status: ${status}\n`);
}

function printJSON(matches: SkipMatch[], summaries: FileSummary[], total: number, max: number): void {
  const output = {
    total,
    threshold: max,
    exceeded: total > max,
    files: summaries,
    matches,
  };
  console.log(JSON.stringify(output, null, 2));
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(argv: string[]): { maxSkips: number; json: boolean } {
  let maxSkips = 50;
  let json = false;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--max-skips' && i + 1 < argv.length) {
      const parsed = parseInt(argv[i + 1], 10);
      if (!isNaN(parsed) && parsed >= 0) {
        maxSkips = parsed;
      }
      i++;
    } else if (argv[i] === '--json') {
      json = true;
    }
  }

  return { maxSkips, json };
}

// ============================================================================
// Main
// ============================================================================

export function run(rootDir: string, argv: string[]): boolean {
  const { maxSkips, json } = parseArgs(argv);
  const matches = scanAllTests(rootDir);
  const summaries = buildFileSummary(matches);
  const total = matches.length;

  if (json) {
    printJSON(matches, summaries, total, maxSkips);
  } else {
    printTable(summaries, total, maxSkips);
  }

  return total <= maxSkips;
}

// Main execution guard -- matches verify-package.ts pattern.
const scriptPath = process.argv[1];
if (scriptPath && resolve(scriptPath).includes('check-skipped-tests')) {
  const root = process.cwd();
  const passed = run(root, process.argv);
  process.exit(passed ? 0 : 1);
}

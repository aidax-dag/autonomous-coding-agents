import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Bundle Size Monitoring
 *
 * Analyzes dist/ directory after build to detect size regressions
 * and enforce configurable size limits per category.
 */

interface FileEntry {
  filePath: string;
  relativePath: string;
  size: number;
  category: string;
}

interface CategoryBreakdown {
  category: string;
  totalSize: number;
  fileCount: number;
}

interface BundleAnalysis {
  totalSize: number;
  fileCount: number;
  files: FileEntry[];
  categories: CategoryBreakdown[];
  largestFiles: FileEntry[];
}

interface BundleLimits {
  total: number;
  singleFile: number;
  categories: Record<string, number>;
}

interface LimitViolation {
  type: 'total' | 'singleFile' | 'category';
  label: string;
  actual: number;
  limit: number;
}

interface LimitCheckResult {
  passed: boolean;
  violations: LimitViolation[];
}

interface RegressionEntry {
  label: string;
  previous: number;
  current: number;
  delta: number;
  percentChange: number;
}

interface BaselineStats {
  totalSize: number;
  categories: Record<string, number>;
}

const CATEGORY_PATTERNS: Record<string, RegExp> = {
  core: /^core\//,
  api: /^api\//,
  cli: /^cli\//,
  shared: /^shared\//,
  platform: /^platform\//,
};

function categorizeFile(relativePath: string): string {
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(relativePath)) {
      return category;
    }
  }
  return 'other';
}

function collectFiles(dirPath: string, basePath: string): FileEntry[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries: FileEntry[] = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      entries.push(...collectFiles(fullPath, basePath));
    } else if (item.isFile()) {
      const relativePath = path.relative(basePath, fullPath);
      const stat = fs.statSync(fullPath);
      entries.push({
        filePath: fullPath,
        relativePath,
        size: stat.size,
        category: categorizeFile(relativePath),
      });
    }
  }

  return entries;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(2)} ${units[exponent]}`;
}

export function analyzeBundle(distPath: string): BundleAnalysis {
  const files = collectFiles(distPath, distPath);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const categoryMap = new Map<string, { totalSize: number; fileCount: number }>();
  for (const file of files) {
    const existing = categoryMap.get(file.category) ?? { totalSize: 0, fileCount: 0 };
    existing.totalSize += file.size;
    existing.fileCount += 1;
    categoryMap.set(file.category, existing);
  }

  const categories: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.totalSize - a.totalSize);

  const largestFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 10);

  return {
    totalSize,
    fileCount: files.length,
    files,
    categories,
    largestFiles,
  };
}

export function checkBundleLimits(analysis: BundleAnalysis, limits: BundleLimits): LimitCheckResult {
  const violations: LimitViolation[] = [];

  if (analysis.totalSize > limits.total) {
    violations.push({
      type: 'total',
      label: 'Total bundle size',
      actual: analysis.totalSize,
      limit: limits.total,
    });
  }

  for (const file of analysis.files) {
    if (file.size > limits.singleFile) {
      violations.push({
        type: 'singleFile',
        label: file.relativePath,
        actual: file.size,
        limit: limits.singleFile,
      });
    }
  }

  for (const cat of analysis.categories) {
    const catLimit = limits.categories[cat.category];
    if (catLimit !== undefined && cat.totalSize > catLimit) {
      violations.push({
        type: 'category',
        label: `Category: ${cat.category}`,
        actual: cat.totalSize,
        limit: catLimit,
      });
    }
  }

  return { passed: violations.length === 0, violations };
}

export function detectRegressions(
  analysis: BundleAnalysis,
  baselinePath: string,
  thresholdPercent = 10
): RegressionEntry[] {
  if (!fs.existsSync(baselinePath)) {
    return [];
  }

  const raw = fs.readFileSync(baselinePath, 'utf-8');
  const baseline: BaselineStats = JSON.parse(raw);
  const regressions: RegressionEntry[] = [];

  if (baseline.totalSize > 0) {
    const delta = analysis.totalSize - baseline.totalSize;
    const percentChange = (delta / baseline.totalSize) * 100;
    if (percentChange > thresholdPercent) {
      regressions.push({ label: 'Total size', previous: baseline.totalSize, current: analysis.totalSize, delta, percentChange });
    }
  }

  if (baseline.categories) {
    for (const cat of analysis.categories) {
      const prev = baseline.categories[cat.category];
      if (prev !== undefined && prev > 0) {
        const delta = cat.totalSize - prev;
        const percentChange = (delta / prev) * 100;
        if (percentChange > thresholdPercent) {
          regressions.push({ label: `Category: ${cat.category}`, previous: prev, current: cat.totalSize, delta, percentChange });
        }
      }
    }
  }

  return regressions;
}

export function generateBundleReport(
  analysis: BundleAnalysis,
  limitResult: LimitCheckResult,
  regressions: RegressionEntry[]
): string {
  const lines: string[] = [];

  lines.push('=== Bundle Size Analysis ===');
  lines.push('');
  lines.push(`Total size: ${formatBytes(analysis.totalSize)}`);
  lines.push(`File count: ${analysis.fileCount}`);
  lines.push('');

  if (analysis.largestFiles.length > 0) {
    lines.push('--- Top 10 Largest Files ---');
    for (const file of analysis.largestFiles) {
      lines.push(`  ${formatBytes(file.size).padStart(12)}  ${file.relativePath}`);
    }
    lines.push('');
  }

  if (analysis.categories.length > 0) {
    lines.push('--- Category Breakdown ---');
    for (const cat of analysis.categories) {
      lines.push(`  ${cat.category.padEnd(12)} ${formatBytes(cat.totalSize).padStart(12)}  (${cat.fileCount} files)`);
    }
    lines.push('');
  }

  if (!limitResult.passed) {
    lines.push('--- Limit Violations ---');
    for (const v of limitResult.violations) {
      lines.push(`  FAIL: ${v.label} - ${formatBytes(v.actual)} exceeds limit of ${formatBytes(v.limit)}`);
    }
    lines.push('');
  }

  if (regressions.length > 0) {
    lines.push('--- Size Regressions ---');
    for (const r of regressions) {
      lines.push(`  REGRESSION: ${r.label} grew ${r.percentChange.toFixed(1)}% (${formatBytes(r.previous)} -> ${formatBytes(r.current)})`);
    }
    lines.push('');
  }

  const status = limitResult.passed && regressions.length === 0 ? 'PASS' : 'FAIL';
  lines.push(`Result: ${status}`);

  return lines.join('\n');
}

// CLI entry point
export function runCli(projectRoot: string): void {
  const distPath = path.join(projectRoot, 'dist');
  const limitsPath = path.join(projectRoot, '.bundle-limits.json');
  const baselinePath = path.join(projectRoot, '.bundle-stats.json');

  if (!fs.existsSync(distPath)) {
    console.error('dist/ directory not found. Run build first.');
    process.exit(1);
  }

  const limitsRaw = fs.readFileSync(limitsPath, 'utf-8');
  const limits: BundleLimits = JSON.parse(limitsRaw);

  const analysis = analyzeBundle(distPath);
  const limitResult = checkBundleLimits(analysis, limits);
  const regressions = detectRegressions(analysis, baselinePath);
  const report = generateBundleReport(analysis, limitResult, regressions);

  console.log(report);

  // Write current stats as baseline for future comparisons
  const stats: BaselineStats = {
    totalSize: analysis.totalSize,
    categories: Object.fromEntries(analysis.categories.map((c) => [c.category, c.totalSize])),
  };
  fs.writeFileSync(baselinePath, JSON.stringify(stats, null, 2) + '\n');

  if (!limitResult.passed) {
    process.exit(1);
  }
}

// Auto-run when executed directly via tsx
const isDirectRun = process.argv[1]?.endsWith('bundle-analysis.ts') ?? false;
if (isDirectRun) {
  const scriptDir = path.dirname(process.argv[1]!);
  runCli(path.resolve(scriptDir, '..'));
}

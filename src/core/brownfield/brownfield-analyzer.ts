/**
 * Brownfield Analyzer
 *
 * Analyzes existing codebases to understand structure, patterns,
 * technical debt, and improvement opportunities.
 *
 * @module core/brownfield
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  IBrownfieldAnalyzer,
  BrownfieldAnalysis,
  BrownfieldOptions,
  CodebaseMetrics,
  TechDebtItem,
  CodePattern,
} from './interfaces/brownfield.interface';

/**
 * Analysis executor — pluggable function for actual codebase analysis
 */
export type AnalysisExecutor = (
  rootPath: string,
  options?: BrownfieldOptions,
) => Promise<BrownfieldAnalysis>;

/**
 * BrownfieldAnalyzer config
 */
export interface BrownfieldAnalyzerConfig {
  /** Custom analysis executor (for LLM-backed analysis) */
  executor?: AnalysisExecutor;
  /** Default options */
  defaults?: BrownfieldOptions;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum directory depth to prevent runaway recursion */
const MAX_SCAN_DEPTH = 10;

/** Directories to always skip during scanning */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  '.tox',
  '.cache',
  '.parcel-cache',
  '.turbo',
]);

/** File-extension to language mapping */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.go': 'Go',
  '.rs': 'Rust',
  '.c': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.h': 'C',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.swift': 'Swift',
  '.php': 'PHP',
  '.scala': 'Scala',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SASS',
  '.less': 'LESS',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.xml': 'XML',
  '.md': 'Markdown',
  '.r': 'R',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.clj': 'Clojure',
  '.hs': 'Haskell',
};

/** Extensions considered as source code (for LOC counting, debt/pattern scanning) */
const SOURCE_CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.java', '.kt', '.go', '.rs',
  '.c', '.cpp', '.cc', '.h', '.hpp', '.cs',
  '.swift', '.php', '.scala', '.dart', '.lua',
  '.sh', '.bash', '.zsh', '.sql',
  '.vue', '.svelte',
  '.ex', '.exs', '.erl', '.clj', '.hs', '.r',
]);

/** Tech-debt comment markers and their severities */
const DEBT_MARKERS: Array<{ pattern: RegExp; severity: 'high' | 'medium'; label: string }> = [
  { pattern: /\bHACK\b/i, severity: 'high', label: 'HACK' },
  { pattern: /\bXXX\b/i, severity: 'high', label: 'XXX' },
  { pattern: /\bTODO\b/i, severity: 'medium', label: 'TODO' },
  { pattern: /\bFIXME\b/i, severity: 'medium', label: 'FIXME' },
];

/** Design pattern detection rules */
const PATTERN_RULES: Array<{
  name: string;
  category: CodePattern['category'];
  /** Check a file's content + path and return matched locations */
  detect: (content: string, filePath: string) => boolean;
}> = [
  {
    name: 'Singleton',
    category: 'design',
    detect: (content) =>
      /class\s+\w*[Ss]ingleton/i.test(content) ||
      /getInstance\s*\(/i.test(content) ||
      /static\s+instance\b/i.test(content),
  },
  {
    name: 'Factory',
    category: 'design',
    detect: (content) =>
      /class\s+\w*[Ff]actory/i.test(content) ||
      /function\s+create\w+/i.test(content) ||
      /export\s+function\s+make\w+/i.test(content),
  },
  {
    name: 'Observer',
    category: 'design',
    detect: (content) =>
      /class\s+\w*[Oo]bserver/i.test(content) ||
      /\.on\(\s*['"`]\w+['"`]/i.test(content) ||
      /\.addEventListener\s*\(/i.test(content) ||
      /EventEmitter/i.test(content),
  },
  {
    name: 'Repository',
    category: 'architectural',
    detect: (content) =>
      /class\s+\w*[Rr]epository/i.test(content) ||
      /interface\s+\w*[Rr]epository/i.test(content),
  },
  {
    name: 'Test Suite',
    category: 'testing',
    detect: (content) =>
      /\bdescribe\s*\(/i.test(content) ||
      /\bit\s*\(/i.test(content) ||
      /\btest\s*\(/i.test(content),
  },
  {
    name: 'React Component',
    category: 'implementation',
    detect: (content) =>
      /from\s+['"]react['"]/i.test(content) ||
      /import\s+React/i.test(content) ||
      /React\.createElement/i.test(content),
  },
  {
    name: 'Express Middleware',
    category: 'architectural',
    detect: (content) =>
      /from\s+['"]express['"]/i.test(content) ||
      /require\s*\(\s*['"]express['"]\s*\)/i.test(content) ||
      /app\.(get|post|put|delete|use)\s*\(/i.test(content),
  },
];

// ---------------------------------------------------------------------------
// Internal file-info type used during scanning
// ---------------------------------------------------------------------------

interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  loc: number;
  content: string;
  depth: number;
}

// ---------------------------------------------------------------------------
// Filesystem scanning helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect files from `dir`, respecting skip-dirs and depth limit.
 * Returns an array of ScannedFile objects.
 */
function collectFiles(
  rootPath: string,
  dir: string,
  depth: number,
  maxFiles: number,
  results: ScannedFile[],
): void {
  if (depth > MAX_SCAN_DEPTH || results.length >= maxFiles) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Permission denied, broken symlink, etc. — skip silently.
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxFiles) {
      return;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      // Skip symlinks to avoid cycles and unexpected behaviour
      continue;
    }

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      collectFiles(rootPath, fullPath, depth + 1, maxFiles, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    const language = EXTENSION_LANGUAGE_MAP[ext];
    if (!language) {
      // Skip files with unrecognised extensions
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      // Unreadable file — skip
      continue;
    }

    const lines = content.split('\n');

    results.push({
      absolutePath: fullPath,
      relativePath: path.relative(rootPath, fullPath),
      extension: ext,
      loc: lines.length,
      content,
      depth,
    });
  }
}

// ---------------------------------------------------------------------------
// BrownfieldAnalyzer
// ---------------------------------------------------------------------------

/**
 * Brownfield Analyzer implementation
 */
export class BrownfieldAnalyzer implements IBrownfieldAnalyzer {
  private readonly executor?: AnalysisExecutor;
  private readonly defaults: BrownfieldOptions;

  constructor(config: BrownfieldAnalyzerConfig = {}) {
    this.executor = config.executor;
    this.defaults = config.defaults ?? {
      analyzeDeps: true,
      detectPatterns: true,
      scanTechDebt: true,
      maxFiles: 1000,
    };
  }

  async analyze(
    rootPath: string,
    options?: BrownfieldOptions,
  ): Promise<BrownfieldAnalysis> {
    const opts = { ...this.defaults, ...options };

    if (this.executor) {
      return this.executor(rootPath, opts);
    }

    // Real filesystem-based analysis
    const files = this.scanFiles(rootPath, opts);
    const metrics = this.computeMetrics(files);
    const techDebt = opts.scanTechDebt ? this.findTechDebt(files, rootPath) : [];
    const patterns = opts.detectPatterns ? this.findPatterns(files) : [];

    return {
      projectName: rootPath.split('/').pop() ?? 'unknown',
      analyzedAt: new Date().toISOString(),
      metrics,
      patterns,
      techDebt,
      dependencies: {
        directDeps: 0,
        devDeps: 0,
        outdated: [],
        unused: [],
        duplicates: [],
      },
      recommendations: this.generateRecommendations(metrics, techDebt, patterns),
      healthScore: this.calculateHealthScore(metrics, techDebt),
    };
  }

  async getMetrics(rootPath: string): Promise<CodebaseMetrics> {
    const files = this.scanFiles(rootPath, this.defaults);
    return this.computeMetrics(files);
  }

  async scanTechDebt(rootPath: string): Promise<TechDebtItem[]> {
    const files = this.scanFiles(rootPath, this.defaults);
    return this.findTechDebt(files, rootPath);
  }

  async detectPatterns(rootPath: string): Promise<CodePattern[]> {
    const files = this.scanFiles(rootPath, this.defaults);
    return this.findPatterns(files);
  }

  // -----------------------------------------------------------------------
  // Private — scanning
  // -----------------------------------------------------------------------

  private scanFiles(rootPath: string, opts: BrownfieldOptions): ScannedFile[] {
    const maxFiles = opts.maxFiles ?? 1000;
    const results: ScannedFile[] = [];

    try {
      const stat = fs.statSync(rootPath);
      if (!stat.isDirectory()) {
        return results;
      }
    } catch {
      return results;
    }

    collectFiles(rootPath, rootPath, 0, maxFiles, results);
    return results;
  }

  // -----------------------------------------------------------------------
  // Private — metrics
  // -----------------------------------------------------------------------

  private computeMetrics(files: ScannedFile[]): CodebaseMetrics {
    const languages: Record<string, number> = {};
    let totalLoc = 0;

    for (const file of files) {
      const lang = EXTENSION_LANGUAGE_MAP[file.extension];
      if (lang) {
        languages[lang] = (languages[lang] ?? 0) + file.loc;
      }
      totalLoc += file.loc;
    }

    const totalFiles = files.length;
    const avgFileSize = totalFiles > 0 ? Math.round(totalLoc / totalFiles) : 0;

    // Largest files (>500 lines), sorted descending
    const largestFiles = files
      .filter((f) => f.loc > 500)
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 20)
      .map((f) => ({ path: f.relativePath, loc: f.loc }));

    // Estimate test coverage by ratio of test files to source files
    const sourceCodeFiles = files.filter((f) => SOURCE_CODE_EXTENSIONS.has(f.extension));
    const testFiles = sourceCodeFiles.filter(
      (f) =>
        f.relativePath.includes('test') ||
        f.relativePath.includes('spec') ||
        f.relativePath.includes('__tests__'),
    );
    const nonTestSourceFiles = sourceCodeFiles.length - testFiles.length;
    const testCoverageEstimate =
      nonTestSourceFiles > 0
        ? Math.min(100, Math.round((testFiles.length / nonTestSourceFiles) * 100))
        : 0;

    return {
      totalLoc,
      totalFiles,
      languages,
      avgFileSize,
      largestFiles,
      testCoverageEstimate,
    };
  }

  // -----------------------------------------------------------------------
  // Private — tech debt
  // -----------------------------------------------------------------------

  private findTechDebt(files: ScannedFile[], rootPath: string): TechDebtItem[] {
    const items: TechDebtItem[] = [];

    // Only scan source-code files for comment markers
    const sourceFiles = files.filter((f) => SOURCE_CODE_EXTENSIONS.has(f.extension));

    for (const file of sourceFiles) {
      const lines = file.content.split('\n');

      // 1. Comment markers (TODO, FIXME, HACK, XXX)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const marker of DEBT_MARKERS) {
          if (marker.pattern.test(line)) {
            items.push({
              type: 'code-smell',
              severity: marker.severity,
              description: `${marker.label} comment at line ${i + 1}: ${line.trim().slice(0, 120)}`,
              files: [file.relativePath],
              effort: 'small',
            });
            // Only match first marker per line
            break;
          }
        }
      }

      // 2. Excessive file length (>300 lines)
      if (file.loc > 300) {
        items.push({
          type: 'complexity',
          severity: 'medium',
          description: `File has ${file.loc} lines (exceeds 300 line threshold)`,
          files: [file.relativePath],
          effort: 'medium',
        });
      }
    }

    // 3. Deeply nested directories (>5 levels from root)
    const deepFiles = files.filter((f) => f.depth > 5);
    if (deepFiles.length > 0) {
      // Group by the deepest directory segment to avoid duplicates
      const deepDirs = new Set(
        deepFiles.map((f) => path.dirname(path.relative(rootPath, f.absolutePath))),
      );
      for (const dir of deepDirs) {
        items.push({
          type: 'complexity',
          severity: 'low',
          description: `Deeply nested directory (>5 levels): ${dir}`,
          files: deepFiles
            .filter((f) => path.dirname(path.relative(rootPath, f.absolutePath)) === dir)
            .map((f) => f.relativePath),
          effort: 'medium',
        });
      }
    }

    return items;
  }

  // -----------------------------------------------------------------------
  // Private — patterns
  // -----------------------------------------------------------------------

  private findPatterns(files: ScannedFile[]): CodePattern[] {
    const sourceFiles = files.filter((f) => SOURCE_CODE_EXTENSIONS.has(f.extension));
    const patternMap = new Map<
      string,
      { rule: (typeof PATTERN_RULES)[number]; locations: string[] }
    >();

    for (const file of sourceFiles) {
      for (const rule of PATTERN_RULES) {
        if (rule.detect(file.content, file.relativePath)) {
          const existing = patternMap.get(rule.name);
          if (existing) {
            existing.locations.push(file.relativePath);
          } else {
            patternMap.set(rule.name, { rule, locations: [file.relativePath] });
          }
        }
      }
    }

    const patterns: CodePattern[] = [];
    for (const [, { rule, locations }] of patternMap) {
      // Compute confidence: more occurrences = higher confidence, capped at 0.95
      const confidence = Math.min(0.95, 0.4 + locations.length * 0.05);
      patterns.push({
        name: rule.name,
        category: rule.category,
        occurrences: locations.length,
        locations: locations.slice(0, 20), // Cap reported locations
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    // Sort by occurrences descending
    patterns.sort((a, b) => b.occurrences - a.occurrences);

    return patterns;
  }

  // -----------------------------------------------------------------------
  // Private — recommendations
  // -----------------------------------------------------------------------

  private generateRecommendations(
    metrics: CodebaseMetrics,
    techDebt: TechDebtItem[],
    patterns: CodePattern[],
  ): string[] {
    const recs: string[] = [];

    const highSeverityCount = techDebt.filter(
      (d) => d.severity === 'high' || d.severity === 'critical',
    ).length;
    if (highSeverityCount > 0) {
      recs.push(
        `Address ${highSeverityCount} high/critical severity tech debt item(s) (HACK/XXX comments)`,
      );
    }

    const longFiles = metrics.largestFiles.length;
    if (longFiles > 0) {
      recs.push(
        `Consider splitting ${longFiles} large file(s) exceeding 500 lines`,
      );
    }

    if (metrics.testCoverageEstimate < 50) {
      recs.push(
        `Increase test coverage (estimated at ${metrics.testCoverageEstimate}%)`,
      );
    }

    const hasTestPattern = patterns.some((p) => p.name === 'Test Suite');
    if (!hasTestPattern && metrics.totalFiles > 0) {
      recs.push('Add automated tests — no test patterns detected');
    }

    return recs;
  }

  // -----------------------------------------------------------------------
  // Private — health score
  // -----------------------------------------------------------------------

  private calculateHealthScore(
    metrics: CodebaseMetrics,
    techDebt: TechDebtItem[],
  ): number {
    let score = 100;

    // Deduct for tech debt
    const criticalCount = techDebt.filter((d) => d.severity === 'critical').length;
    const highCount = techDebt.filter((d) => d.severity === 'high').length;
    const mediumCount = techDebt.filter((d) => d.severity === 'medium').length;

    score -= criticalCount * 15;
    score -= highCount * 8;
    score -= mediumCount * 3;

    // Deduct for low test coverage
    if (metrics.testCoverageEstimate < 50) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Factory function
 */
export function createBrownfieldAnalyzer(
  config?: BrownfieldAnalyzerConfig,
): BrownfieldAnalyzer {
  return new BrownfieldAnalyzer(config);
}

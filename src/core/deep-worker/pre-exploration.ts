/**
 * Pre-Exploration
 *
 * Explores the task context before starting work. Identifies relevant files,
 * patterns, and dependencies to inform the planning phase.
 *
 * When no custom executor is provided, a non-LLM fallback performs
 * filesystem-based exploration using keyword matching, pattern detection,
 * and import/require analysis.
 *
 * @module core/deep-worker
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  IPreExploration,
  DeepWorkerContext,
  ExplorationResult,
} from './interfaces/deep-worker.interface';

/**
 * Exploration executor — pluggable function for actual exploration logic
 */
export type ExplorationExecutor = (
  context: DeepWorkerContext,
) => Promise<ExplorationResult>;

/**
 * PreExploration options
 */
export interface PreExplorationOptions {
  /** Custom executor (for LLM-backed exploration) */
  executor?: ExplorationExecutor;
  /** Maximum files to include in results */
  maxFiles?: number;
  /** Timeout in ms */
  timeout?: number;
}

// ── Directories to skip during filesystem walking ─────────────────────
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.cache',
  '.turbo',
]);

// ── Source file extensions considered relevant ────────────────────────
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.vue', '.svelte', '.astro',
  '.json', '.yaml', '.yml', '.toml',
  '.css', '.scss', '.less',
  '.html', '.md',
  '.sh', '.bash',
  '.sql',
]);

// ── Common stop-words to exclude from keyword extraction ──────────────
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'it', 'not', 'be', 'as', 'do', 'if', 'no',
  'so', 'up', 'my', 'we', 'he', 'me', 'this', 'that', 'from', 'all',
  'add', 'use', 'new', 'get', 'set', 'can', 'has', 'had', 'was', 'will',
  'should', 'would', 'could', 'need', 'make', 'like', 'also', 'into',
  'just', 'how', 'what', 'when', 'where', 'which', 'who', 'why',
  'implement', 'create', 'update', 'delete', 'remove', 'change', 'fix',
  'feature', 'bug', 'issue', 'task', 'work', 'file', 'code', 'function',
]);

// ── Import/require regex patterns ─────────────────────────────────────
const IMPORT_PATTERNS = [
  // ES import: import ... from 'path'  or  import ... from "path"
  /(?:import\s+(?:[\s\S]*?)\s+from\s+['"])([^'"]+)['"]/g,
  // Dynamic import: import('path')
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // CommonJS require: require('path')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/**
 * Extract keywords from a task description for file matching.
 * Splits on non-alphanumeric boundaries, removes stop-words, and
 * normalizes to lowercase.
 */
export function extractKeywords(taskDescription: string): string[] {
  const tokens = taskDescription
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((t) => t.length >= 2)
    .filter((t) => !STOP_WORDS.has(t));

  return [...new Set(tokens)];
}

/**
 * Walk a directory tree, collecting file paths while skipping
 * excluded directories. Non-recursive breadth-first traversal.
 */
export function collectFiles(rootDir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(rootDir)) {
    return files;
  }

  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      // Permission errors or broken symlinks — skip silently
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') {
        // Skip hidden files/dirs except the root might start with '.'
        if (SKIP_DIRS.has(entry.name)) continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          queue.push(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext) || entry.name === 'package.json') {
          files.push(fullPath);
        }
      }
    }
  }

  return files;
}

/**
 * Score a file against the extracted keywords.
 *
 * Scoring heuristic (per keyword, first match wins):
 * - Basename (without extension) exact match: +10
 * - Basename (without extension) contains keyword: +5
 * - Directory path segment contains keyword: +3
 * - File extension matches keyword: +1
 */
export function scoreFile(filePath: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const nameWithoutExt = path
    .basename(filePath, path.extname(filePath))
    .toLowerCase();
  const lowerPath = filePath.toLowerCase();
  const segments = lowerPath.split(path.sep);

  let score = 0;

  for (const keyword of keywords) {
    // Exact basename match (without extension)
    if (nameWithoutExt === keyword) {
      score += 10;
      continue;
    }

    // Basename (without extension) contains keyword
    if (nameWithoutExt.includes(keyword)) {
      score += 5;
      continue;
    }

    // Any path segment (excluding the filename) contains keyword
    const dirSegments = segments.slice(0, -1);
    if (dirSegments.some((seg) => seg.includes(keyword))) {
      score += 3;
      continue;
    }

    // Extension match (e.g., keyword "ts" matches .ts files)
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    if (ext === keyword) {
      score += 1;
    }
  }

  return score;
}

/**
 * Detect project patterns by reading package.json and scanning for
 * config files.
 */
export function detectPatterns(rootDir: string): string[] {
  const patterns: string[] = [];

  // Try to read package.json
  const pkgPath = path.join(rootDir, 'package.json');
  let pkg: Record<string, unknown> | null = null;

  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // No package.json or invalid JSON — not a Node.js project
  }

  if (pkg) {
    const allDeps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    };

    // Framework detection
    if (allDeps.react || allDeps['react-dom']) patterns.push('react');
    if (allDeps.next) patterns.push('next.js');
    if (allDeps.vue) patterns.push('vue');
    if (allDeps.nuxt) patterns.push('nuxt');
    if (allDeps.svelte) patterns.push('svelte');
    if (allDeps.express) patterns.push('express');
    if (allDeps.fastify) patterns.push('fastify');
    if (allDeps.nestjs || allDeps['@nestjs/core']) patterns.push('nestjs');
    if (allDeps.koa) patterns.push('koa');
    if (allDeps.hono) patterns.push('hono');
    if (allDeps.angular || allDeps['@angular/core']) patterns.push('angular');

    // Test framework detection
    if (allDeps.jest || allDeps['@jest/globals']) patterns.push('jest');
    if (allDeps.vitest) patterns.push('vitest');
    if (allDeps.mocha) patterns.push('mocha');
    if (allDeps.playwright || allDeps['@playwright/test']) patterns.push('playwright');
    if (allDeps.cypress) patterns.push('cypress');

    // Build tool detection
    if (allDeps.webpack) patterns.push('webpack');
    if (allDeps.vite) patterns.push('vite');
    if (allDeps.esbuild) patterns.push('esbuild');
    if (allDeps.rollup) patterns.push('rollup');
    if (allDeps.typescript || allDeps['ts-jest']) patterns.push('typescript');
    if (allDeps.tsup) patterns.push('tsup');
    if (allDeps.swc || allDeps['@swc/core']) patterns.push('swc');

    // ORM / Database
    if (allDeps.prisma || allDeps['@prisma/client']) patterns.push('prisma');
    if (allDeps.typeorm) patterns.push('typeorm');
    if (allDeps.drizzle || allDeps['drizzle-orm']) patterns.push('drizzle');
    if (allDeps.sequelize) patterns.push('sequelize');

    // Type of project
    if (typeof pkg.type === 'string') {
      patterns.push(`module:${pkg.type}`);
    }
  }

  // Config file-based detection
  const configIndicators: Array<[string, string]> = [
    ['tsconfig.json', 'typescript'],
    ['.eslintrc.json', 'eslint'],
    ['.eslintrc.js', 'eslint'],
    ['eslint.config.js', 'eslint'],
    ['.prettierrc', 'prettier'],
    ['prettier.config.js', 'prettier'],
    ['docker-compose.yml', 'docker'],
    ['Dockerfile', 'docker'],
    ['.github', 'github-actions'],
    ['tailwind.config.js', 'tailwind'],
    ['tailwind.config.ts', 'tailwind'],
  ];

  for (const [fileName, pattern] of configIndicators) {
    if (!patterns.includes(pattern)) {
      const configPath = path.join(rootDir, fileName);
      try {
        if (fs.existsSync(configPath)) {
          patterns.push(pattern);
        }
      } catch {
        // Access error — skip
      }
    }
  }

  return patterns;
}

/**
 * Extract import/require paths from a file's source content.
 * Returns resolved relative paths (for local imports) and
 * package names (for third-party imports).
 */
export function extractImports(filePath: string): string[] {
  let content: string;

  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const imports: Set<string> = new Set();
  const dirName = path.dirname(filePath);

  for (const pattern of IMPORT_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath) continue;

      if (importPath.startsWith('.')) {
        // Relative import — resolve to absolute path
        const resolved = path.resolve(dirName, importPath);
        imports.add(resolved);
      } else {
        // Package import — extract the package name
        const parts = importPath.split('/');
        const pkgName = importPath.startsWith('@')
          ? parts.slice(0, 2).join('/')
          : parts[0];
        imports.add(pkgName);
      }
    }
  }

  return [...imports];
}

/**
 * Default pre-exploration implementation
 */
export class PreExploration implements IPreExploration {
  private readonly executor?: ExplorationExecutor;
  private readonly maxFiles: number;
  private readonly timeout: number;

  constructor(options: PreExplorationOptions = {}) {
    this.executor = options.executor;
    this.maxFiles = options.maxFiles ?? 50;
    this.timeout = options.timeout ?? 30000;
  }

  async explore(context: DeepWorkerContext): Promise<ExplorationResult> {
    const start = Date.now();

    if (this.executor) {
      let timer: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Exploration timed out after ${this.timeout}ms`)),
          this.timeout,
        );
      });

      try {
        const result = await Promise.race([
          this.executor(context),
          timeoutPromise,
        ]);

        return {
          ...result,
          relevantFiles: result.relevantFiles.slice(0, this.maxFiles),
          duration: Date.now() - start,
        };
      } finally {
        clearTimeout(timer!);
      }
    }

    // Non-LLM fallback: filesystem-based exploration
    return this.defaultExplore(context, start);
  }

  /**
   * Non-LLM fallback exploration.
   * Extracts keywords from the task description, scans the workspace
   * for matching files, detects project patterns, and extracts
   * import/require dependencies from the top-scoring files.
   */
  private defaultExplore(
    context: DeepWorkerContext,
    start: number,
  ): ExplorationResult {
    const { workspaceDir, taskDescription } = context;

    // 1. Extract keywords from the task description
    const keywords = extractKeywords(taskDescription);

    // 2. Collect all source files in the workspace
    const allFiles = collectFiles(workspaceDir);

    // 3. Score and rank files by keyword relevance
    const scored = allFiles
      .map((filePath) => ({
        filePath,
        // Store relative path for cleaner output
        relativePath: path.relative(workspaceDir, filePath),
        score: scoreFile(filePath, keywords),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const relevantFiles = scored
      .slice(0, this.maxFiles)
      .map((entry) => entry.relativePath);

    // 4. Detect project patterns
    const patterns = detectPatterns(workspaceDir);

    // 5. Extract dependencies from top relevant files
    const depSet = new Set<string>();
    // Only parse imports from the top files (limit I/O)
    const filesToParse = scored.slice(0, Math.min(20, this.maxFiles));

    for (const entry of filesToParse) {
      const imports = extractImports(entry.filePath);
      for (const imp of imports) {
        depSet.add(imp);
      }
    }

    const dependencies = [...depSet];

    // 6. Build summary
    const summaryParts: string[] = [
      `Exploration of: ${taskDescription}`,
    ];
    if (relevantFiles.length > 0) {
      summaryParts.push(`Found ${relevantFiles.length} relevant file(s)`);
    }
    if (patterns.length > 0) {
      summaryParts.push(`Detected patterns: ${patterns.join(', ')}`);
    }
    if (dependencies.length > 0) {
      summaryParts.push(`${dependencies.length} dependency path(s) extracted`);
    }

    return {
      relevantFiles,
      patterns,
      dependencies,
      summary: summaryParts.join('. '),
      duration: Date.now() - start,
    };
  }
}

/**
 * Factory function
 */
export function createPreExploration(
  options?: PreExplorationOptions,
): PreExploration {
  return new PreExploration(options);
}

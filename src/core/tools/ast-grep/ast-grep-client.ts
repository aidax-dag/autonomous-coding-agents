/**
 * AST-Grep Client
 *
 * Wraps the `sg` (ast-grep) CLI tool for pattern-based code search and
 * transformation. Spawns the CLI process, parses JSON output, and provides
 * a typed API for search, rule-based search, and rewriting operations.
 *
 * @module core/tools/ast-grep
 */

import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createAgentLogger } from '../../../shared/logging/logger';

// ============================================================================
// Types
// ============================================================================

export interface ASTGrepClientConfig {
  /** Path to the sg binary (default: 'sg') */
  binaryPath?: string;
  /** Working directory for sg commands */
  cwd?: string;
  /** Timeout for CLI operations in milliseconds (default: 30000) */
  timeout?: number;
}

export interface SearchOptions {
  /** Language filter (e.g., 'typescript', 'python') */
  language?: string;
  /** Directories or files to search */
  paths?: string[];
  /** Ignore .gitignore rules */
  noIgnore?: boolean;
}

export interface SearchMatch {
  /** File path where the match was found */
  file: string;
  /** Start line number (1-indexed) */
  line: number;
  /** Start column number (0-indexed) */
  column: number;
  /** End line number (1-indexed) */
  endLine: number;
  /** End column number (0-indexed) */
  endColumn: number;
  /** The matched source text */
  matchedText: string;
  /** Surrounding context text */
  surroundingText?: string;
}

export interface SGRule {
  /** Unique rule identifier */
  id: string;
  /** Target language */
  language: string;
  /** AST pattern to match */
  pattern: string;
  /** Human-readable description */
  message?: string;
  /** Auto-fix replacement pattern */
  fix?: string;
  /** Severity level */
  severity?: 'error' | 'warning' | 'info' | 'hint';
}

export interface RewriteOptions extends SearchOptions {
  /** If true, show changes without applying them (default: true) */
  dryRun?: boolean;
}

export interface RewriteResult {
  /** Number of matches found */
  matchCount: number;
  /** Files that were (or would be) changed */
  filesChanged: string[];
  /** Whether this was a dry-run */
  dryRun: boolean;
}

// ============================================================================
// Internal Types
// ============================================================================

/** Shape of a single match from `sg run --json` output */
interface SGJsonMatch {
  file?: string;
  range?: {
    start?: { line?: number; column?: number };
    end?: { line?: number; column?: number };
  };
  lines?: string;
  text?: string;
  replacement?: string;
  charCount?: { matched?: number };
}

// ============================================================================
// Implementation
// ============================================================================

const logger = createAgentLogger('ast-grep-client');

export class ASTGrepClient {
  private readonly binaryPath: string;
  private readonly cwd: string;
  private readonly timeout: number;

  constructor(config?: ASTGrepClientConfig) {
    this.binaryPath = config?.binaryPath ?? 'sg';
    this.cwd = config?.cwd ?? process.cwd();
    this.timeout = config?.timeout ?? 30_000;
  }

  /**
   * Search for an AST pattern and return all matches.
   */
  async search(pattern: string, options?: SearchOptions): Promise<SearchMatch[]> {
    const args = this.buildSearchArgs(pattern, options);
    args.push('--json');

    const stdout = await this.exec(args);
    return this.parseSearchOutput(stdout);
  }

  /**
   * Search using a YAML rule definition.
   * Creates a temporary rule file and passes it to `sg scan --rule`.
   */
  async searchByRule(rule: SGRule, options?: SearchOptions): Promise<SearchMatch[]> {
    const ruleFile = join(tmpdir(), `sg-rule-${rule.id}-${Date.now()}.yml`);

    try {
      const ruleYaml = this.buildRuleYaml(rule);
      await writeFile(ruleFile, ruleYaml, 'utf-8');

      const args = ['scan', '--rule', ruleFile, '--json'];

      if (options?.paths && options.paths.length > 0) {
        args.push(...options.paths);
      }

      const stdout = await this.exec(args);
      return this.parseSearchOutput(stdout);
    } finally {
      try {
        await unlink(ruleFile);
      } catch {
        /* best-effort cleanup */
      }
    }
  }

  /**
   * Rewrite matches of a pattern with a replacement string.
   * Defaults to dry-run mode for safety.
   */
  async rewrite(
    pattern: string,
    replacement: string,
    options?: RewriteOptions,
  ): Promise<RewriteResult> {
    const dryRun = options?.dryRun ?? true;
    const args = this.buildSearchArgs(pattern, options);
    args.push('--rewrite', replacement);
    args.push('--json');

    if (!dryRun) {
      args.push('--update-all');
    }

    const stdout = await this.exec(args);
    const matches = this.parseSearchOutput(stdout);

    const filesChanged = [...new Set(matches.map((m) => m.file))];

    return {
      matchCount: matches.length,
      filesChanged,
      dryRun,
    };
  }

  /**
   * List all languages supported by ast-grep.
   */
  async listLanguages(): Promise<string[]> {
    const stdout = await this.exec(['list-languages']);
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Check whether the sg binary is available on the system.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.exec(['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the configured binary path.
   */
  getBinaryPath(): string {
    return this.binaryPath;
  }

  /**
   * Get the configured working directory.
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * Get the configured timeout.
   */
  getTimeout(): number {
    return this.timeout;
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private buildSearchArgs(pattern: string, options?: SearchOptions): string[] {
    const args = ['run', '-p', pattern];

    if (options?.language) {
      args.push('--lang', options.language);
    }

    if (options?.noIgnore) {
      args.push('--no-ignore');
    }

    if (options?.paths && options.paths.length > 0) {
      args.push(...options.paths);
    }

    return args;
  }

  private buildRuleYaml(rule: SGRule): string {
    const lines: string[] = [
      `id: ${rule.id}`,
      `language: ${rule.language}`,
      `rule:`,
      `  pattern: "${rule.pattern}"`,
    ];

    if (rule.message !== undefined) {
      lines.push(`message: "${rule.message}"`);
    }

    if (rule.fix !== undefined) {
      lines.push(`fix: "${rule.fix}"`);
    }

    if (rule.severity !== undefined) {
      lines.push(`severity: ${rule.severity}`);
    }

    return lines.join('\n') + '\n';
  }

  private parseSearchOutput(stdout: string): SearchMatch[] {
    const trimmed = stdout.trim();
    if (!trimmed) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      logger.debug('Failed to parse sg JSON output', { stdout: trimmed });
      return [];
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    const matches: SearchMatch[] = [];

    for (const item of items) {
      const match = this.parseMatchItem(item as SGJsonMatch);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  private parseMatchItem(item: SGJsonMatch): SearchMatch | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const file = item.file ?? '';
    const range = item.range ?? {};
    const start = range.start ?? {};
    const end = range.end ?? {};

    return {
      file,
      line: (start.line ?? 0) + 1,
      column: start.column ?? 0,
      endLine: (end.line ?? 0) + 1,
      endColumn: end.column ?? 0,
      matchedText: item.text ?? item.lines ?? '',
      surroundingText: item.lines,
    };
  }

  private exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.binaryPath,
        args,
        {
          cwd: this.cwd,
          timeout: this.timeout,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            // ast-grep returns exit code 1 when no matches found (not an error)
            if (error.code === 1 && !stderr) {
              resolve(stdout || '');
              return;
            }

            const message = stderr
              ? `sg command failed: ${stderr}`
              : `sg command failed: ${error.message}`;
            logger.debug('sg exec error', { args, error: message });
            reject(new Error(message));
            return;
          }

          resolve(stdout || '');
        },
      );
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createASTGrepClient(config?: ASTGrepClientConfig): ASTGrepClient {
  return new ASTGrepClient(config);
}

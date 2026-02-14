/**
 * Linting Plugin
 *
 * Code quality checks via ESLint and TypeScript compiler.
 * Provides lint, type-check, and auto-fix capabilities through safe
 * child_process.execFile invocations.
 *
 * @module core/plugins/examples
 */

import { execFile as cpExecFile } from 'node:child_process';

import type {
  PluginContext,
  PluginManifest,
  PluginStatus,
  IPlugin,
} from '../interfaces/plugin.interface';
import type { PluginManifestData } from '../marketplace/types';

// ============================================================================
// Result Types
// ============================================================================

export interface LintIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  ruleId: string | null;
}

export interface LintResult {
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
  fixableCount: number;
}

export interface TypeCheckResult {
  success: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    code: number;
  }>;
  errorCount: number;
}

// ============================================================================
// Manifest
// ============================================================================

export const LINTING_PLUGIN_MANIFEST: PluginManifest = {
  name: 'aca-plugin-linting',
  version: '1.0.0',
  description: 'Code quality checks - ESLint and TypeScript error checking',
  author: 'aca-team',
  main: 'linting-plugin.js',
};

export const LINTING_MARKETPLACE_MANIFEST: PluginManifestData = {
  name: 'aca-plugin-linting',
  version: '1.0.0',
  description: 'Code quality checks - ESLint and TypeScript error checking',
  author: 'aca-team',
  license: 'MIT',
  keywords: ['linting', 'eslint', 'typescript', 'code-quality'],
  main: 'linting-plugin.js',
  dependencies: {},
  acaVersion: '0.1.0',
};

// ============================================================================
// Exec Helper
// ============================================================================

function execCommand(
  cmd: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    cpExecFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        const enriched = Object.assign(error, {
          stdout: String(stdout),
          stderr: String(stderr),
        });
        reject(enriched);
      } else {
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      }
    });
  });
}

// ============================================================================
// Implementation
// ============================================================================

export class LintingPlugin implements IPlugin {
  readonly manifest: PluginManifest = LINTING_PLUGIN_MANIFEST;
  status: PluginStatus = 'loaded';
  private workspaceDir = '';

  async initialize(context: PluginContext): Promise<void> {
    if (this.status !== 'loaded') {
      throw new Error(`Cannot initialize in status '${this.status}'`);
    }
    if (!context.workspaceDir || !context.pluginDir) {
      throw new Error('PluginContext must have workspaceDir and pluginDir');
    }
    this.workspaceDir = context.workspaceDir;
    this.status = 'initialized';
  }

  async activate(): Promise<void> {
    if (this.status !== 'initialized') {
      throw new Error(`Cannot activate in status '${this.status}'`);
    }
    this.status = 'active';
  }

  async deactivate(): Promise<void> {
    if (this.status !== 'active') {
      throw new Error(`Cannot deactivate in status '${this.status}'`);
    }
    this.status = 'initialized';
  }

  async dispose(): Promise<void> {
    this.workspaceDir = '';
    this.status = 'disposed';
  }

  /**
   * Run ESLint on specified files and return structured issues.
   */
  async lint(files: string[]): Promise<LintResult> {
    this.assertActive();
    if (files.length === 0) {
      return { issues: [], errorCount: 0, warningCount: 0, fixableCount: 0 };
    }

    try {
      const { stdout } = await execCommand(
        'npx',
        ['eslint', '--format', 'json', ...files],
        { cwd: this.workspaceDir, timeout: 30_000 },
      );
      return this.parseEslintOutput(stdout);
    } catch (err: unknown) {
      // ESLint exits with code 1 when lint errors exist; parse stdout anyway
      if (isExecError(err) && err.stdout) {
        return this.parseEslintOutput(err.stdout);
      }
      throw new Error(`ESLint execution failed: ${String(err)}`);
    }
  }

  /**
   * Run TypeScript type checking via tsc --noEmit.
   */
  async typeCheck(tsConfigPath?: string): Promise<TypeCheckResult> {
    this.assertActive();
    const args = ['tsc', '--noEmit', '--pretty', 'false'];
    if (tsConfigPath) {
      args.push('--project', tsConfigPath);
    }

    try {
      await execCommand('npx', args, {
        cwd: this.workspaceDir,
        timeout: 60_000,
      });
      return { success: true, errors: [], errorCount: 0 };
    } catch (err: unknown) {
      if (isExecError(err) && err.stdout) {
        return this.parseTscOutput(err.stdout);
      }
      throw new Error(`TypeScript check failed: ${String(err)}`);
    }
  }

  /**
   * Auto-fix ESLint fixable issues in specified files.
   */
  async autoFix(files: string[]): Promise<LintResult> {
    this.assertActive();
    if (files.length === 0) {
      return { issues: [], errorCount: 0, warningCount: 0, fixableCount: 0 };
    }

    try {
      const { stdout } = await execCommand(
        'npx',
        ['eslint', '--fix', '--format', 'json', ...files],
        { cwd: this.workspaceDir, timeout: 30_000 },
      );
      return this.parseEslintOutput(stdout);
    } catch (err: unknown) {
      if (isExecError(err) && err.stdout) {
        return this.parseEslintOutput(err.stdout);
      }
      throw new Error(`ESLint auto-fix failed: ${String(err)}`);
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private assertActive(): void {
    if (this.status !== 'active') {
      throw new Error('Plugin must be active to perform operations');
    }
  }

  private parseEslintOutput(stdout: string): LintResult {
    const issues: LintIssue[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let fixableCount = 0;

    try {
      const results = JSON.parse(stdout) as Array<{
        filePath: string;
        messages: Array<{
          line: number;
          column: number;
          severity: number;
          message: string;
          ruleId: string | null;
          fix?: unknown;
        }>;
      }>;

      for (const result of results) {
        for (const msg of result.messages) {
          const severity = msg.severity === 2 ? 'error' : 'warning';
          if (severity === 'error') errorCount++;
          else warningCount++;
          if (msg.fix) fixableCount++;

          issues.push({
            file: result.filePath,
            line: msg.line,
            column: msg.column,
            severity,
            message: msg.message,
            ruleId: msg.ruleId,
          });
        }
      }
    } catch {
      // Non-JSON output; return empty result
    }

    return { issues, errorCount, warningCount, fixableCount };
  }

  private parseTscOutput(stdout: string): TypeCheckResult {
    const errors: TypeCheckResult['errors'] = [];
    const lines = stdout.split('\n').filter(Boolean);
    // tsc output format: file(line,col): error TSxxxx: message
    const pattern = /^(.+)\((\d+),(\d+)\):\s+error\s+TS(\d+):\s+(.+)$/;

    for (const line of lines) {
      const match = pattern.exec(line);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          code: parseInt(match[4], 10),
          message: match[5],
        });
      }
    }

    return { success: errors.length === 0, errors, errorCount: errors.length };
  }
}

// ============================================================================
// Utility
// ============================================================================

interface ExecError {
  stdout: string;
  stderr: string;
}

function isExecError(err: unknown): err is ExecError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'stdout' in err &&
    typeof (err as ExecError).stdout === 'string'
  );
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLintingPlugin(): LintingPlugin {
  return new LintingPlugin();
}

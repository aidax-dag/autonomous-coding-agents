/**
 * Static Analyzer
 *
 * Integrates ESLint and TypeScript compiler for code analysis.
 *
 * Feature: F4.5 - Auto Issue Detection and Fix
 */

import { ESLint } from 'eslint';
import * as ts from 'typescript';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AnalysisResult,
  AnalysisReport,
  AnalysisSeverity,
  AnalyzerConfig,
} from './types';
import { createAgentLogger } from '@/shared/logging/logger';

const logger = createAgentLogger('Analysis', 'static-analyzer');

/**
 * Static code analyzer
 */
export class StaticAnalyzer {
  private config: AnalyzerConfig;

  constructor(config: AnalyzerConfig = {}) {
    this.config = {
      excludePaths: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.ts', '**/*.spec.ts'],
      autoFix: false,
      maxIssues: 1000,
      ...config,
    };
  }

  /**
   * Analyze all files in directory
   */
  async analyzeAll(dirPath: string): Promise<AnalysisReport> {
    const startTime = Date.now();

    logger.info('Starting static analysis', { dirPath });

    try {
      // Find TypeScript files
      const files = await this.findTypeScriptFiles(dirPath);

      logger.info('Found TypeScript files', { count: files.length });

      // Run analyzers
      const [eslintResults, tsResults] = await Promise.all([
        this.analyzeESLint(files),
        this.analyzeTypeScript(files),
      ]);

      // Combine results
      const results = [...eslintResults, ...tsResults];

      // Create report
      const report: AnalysisReport = {
        totalFiles: files.length,
        totalIssues: results.length,
        errors: results.filter((r) => r.severity === AnalysisSeverity.ERROR).length,
        warnings: results.filter((r) => r.severity === AnalysisSeverity.WARNING).length,
        infos: results.filter((r) => r.severity === AnalysisSeverity.INFO).length,
        fixable: results.filter((r) => r.fixable).length,
        results: results.slice(0, this.config.maxIssues),
        analyzedAt: Date.now(),
        duration: Date.now() - startTime,
      };

      logger.info('Analysis complete', {
        totalIssues: report.totalIssues,
        errors: report.errors,
        warnings: report.warnings,
        fixable: report.fixable,
        duration: report.duration,
      });

      return report;
    } catch (error) {
      logger.error('Analysis failed', { error });
      throw error;
    }
  }

  /**
   * Analyze with ESLint
   */
  async analyzeESLint(files: string[]): Promise<AnalysisResult[]> {
    try {
      logger.debug('Running ESLint analysis', { fileCount: files.length });

      const eslint = new ESLint({
        fix: this.config.autoFix,
        overrideConfigFile: undefined, // Use project's ESLint config
      });

      const results = await eslint.lintFiles(files);

      // Apply fixes if autoFix is enabled
      if (this.config.autoFix) {
        await ESLint.outputFixes(results);
      }

      // Convert to AnalysisResult
      const analysisResults: AnalysisResult[] = results.flatMap((result) =>
        result.messages.map((msg) => ({
          file: result.filePath,
          line: msg.line,
          column: msg.column,
          severity:
            msg.severity === 2
              ? AnalysisSeverity.ERROR
              : msg.severity === 1
              ? AnalysisSeverity.WARNING
              : AnalysisSeverity.INFO,
          rule: msg.ruleId || 'unknown',
          message: msg.message,
          fixable: msg.fix !== undefined,
          fix: msg.fix
            ? {
                range: msg.fix.range as [number, number],
                text: msg.fix.text,
              }
            : undefined,
        }))
      );

      logger.debug('ESLint analysis complete', { issuesFound: analysisResults.length });

      return analysisResults;
    } catch (error) {
      logger.error('ESLint analysis failed', { error });
      return [];
    }
  }

  /**
   * Analyze with TypeScript compiler
   */
  async analyzeTypeScript(files: string[]): Promise<AnalysisResult[]> {
    try {
      logger.debug('Running TypeScript analysis', { fileCount: files.length });

      // Find tsconfig.json
      const configPath = ts.findConfigFile(
        process.cwd(),
        ts.sys.fileExists,
        'tsconfig.json'
      );

      if (!configPath) {
        logger.warn('No tsconfig.json found, skipping TypeScript analysis');
        return [];
      }

      // Read config
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const compilerOptions = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
      );

      // Create program
      const program = ts.createProgram(files, compilerOptions.options);

      // Get diagnostics
      const diagnostics = [
        ...program.getSyntacticDiagnostics(),
        ...program.getSemanticDiagnostics(),
      ];

      // Convert to AnalysisResult
      const analysisResults: AnalysisResult[] = diagnostics
        .map((diagnostic) => {
          if (!diagnostic.file) {
            return null;
          }

          const position = diagnostic.file.getLineAndCharacterOfPosition(
            diagnostic.start || 0
          );

          return {
            file: diagnostic.file.fileName,
            line: position.line + 1,
            column: position.character + 1,
            severity: AnalysisSeverity.ERROR,
            rule: `TS${diagnostic.code}`,
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            fixable: false, // TypeScript diagnostics are generally not auto-fixable
          };
        })
        .filter((r): r is AnalysisResult => r !== null);

      logger.debug('TypeScript analysis complete', { issuesFound: analysisResults.length });

      return analysisResults;
    } catch (error) {
      logger.error('TypeScript analysis failed', { error });
      return [];
    }
  }

  /**
   * Find all TypeScript files in directory
   */
  private async findTypeScriptFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Check exclusions
        const shouldExclude = [
          'node_modules',
          'dist',
          'build',
          '.git',
          'coverage',
        ].some((pattern) => fullPath.includes(pattern));

        if (shouldExclude) {
          continue;
        }

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    await scan(dirPath);

    return files;
  }

  /**
   * Format analysis report as markdown
   */
  formatReportMarkdown(report: AnalysisReport): string {
    const lines: string[] = [];

    lines.push('# Code Analysis Report\n');
    lines.push(`**Generated**: ${new Date(report.analyzedAt).toISOString()}\n`);
    lines.push(`**Duration**: ${report.duration}ms\n`);
    lines.push('## Summary\n');
    lines.push(`- **Total Files**: ${report.totalFiles}`);
    lines.push(`- **Total Issues**: ${report.totalIssues}`);
    lines.push(`- **Errors**: ${report.errors}`);
    lines.push(`- **Warnings**: ${report.warnings}`);
    lines.push(`- **Infos**: ${report.infos}`);
    lines.push(`- **Fixable**: ${report.fixable}\n`);

    if (report.results.length > 0) {
      lines.push('## Issues\n');

      // Group by file
      const byFile = new Map<string, AnalysisResult[]>();
      for (const result of report.results) {
        if (!byFile.has(result.file)) {
          byFile.set(result.file, []);
        }
        byFile.get(result.file)!.push(result);
      }

      // Format each file's issues
      for (const [file, issues] of byFile.entries()) {
        lines.push(`### ${file}\n`);

        for (const issue of issues) {
          const icon =
            issue.severity === AnalysisSeverity.ERROR
              ? '❌'
              : issue.severity === AnalysisSeverity.WARNING
              ? '⚠️'
              : 'ℹ️';
          const fixable = issue.fixable ? ' [auto-fixable]' : '';

          lines.push(
            `${icon} **${issue.rule}**${fixable}: ${issue.message} (line ${issue.line}:${issue.column})`
          );
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format analysis report as text
   */
  formatReportText(report: AnalysisReport): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('CODE ANALYSIS REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Generated: ${new Date(report.analyzedAt).toISOString()}`);
    lines.push(`Duration: ${report.duration}ms`);
    lines.push('');
    lines.push('SUMMARY:');
    lines.push(`  Total Files:   ${report.totalFiles}`);
    lines.push(`  Total Issues:  ${report.totalIssues}`);
    lines.push(`  Errors:        ${report.errors}`);
    lines.push(`  Warnings:      ${report.warnings}`);
    lines.push(`  Infos:         ${report.infos}`);
    lines.push(`  Fixable:       ${report.fixable}`);
    lines.push('');

    if (report.results.length > 0) {
      lines.push('ISSUES:');
      lines.push('');

      // Group by file
      const byFile = new Map<string, AnalysisResult[]>();
      for (const result of report.results) {
        if (!byFile.has(result.file)) {
          byFile.set(result.file, []);
        }
        byFile.get(result.file)!.push(result);
      }

      // Format each file's issues
      for (const [file, issues] of byFile.entries()) {
        lines.push(`  ${file}`);

        for (const issue of issues) {
          const severity = issue.severity.toUpperCase().padEnd(7);
          const fixable = issue.fixable ? '[FIX]' : '     ';
          const location = `${issue.line}:${issue.column}`.padEnd(10);

          lines.push(
            `    ${fixable} ${severity} ${location} ${issue.rule}: ${issue.message}`
          );
        }

        lines.push('');
      }
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}

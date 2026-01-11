/**
 * Code Quality Hook Implementation
 *
 * Provides code quality checking including linting, formatting, and type checking.
 *
 * @module core/hooks/code-quality
 */

import { spawn } from 'child_process';
import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult } from '../../interfaces/hook.interface.js';
import { IDisposable } from '../../di/interfaces/container.interface.js';
import {
  CodeQualityConfig,
  QualityCheckType,
  QualityTool,
  IssueSeverity,
  QualityIssue,
  ToolCheckResult,
  QualityCheckResult,
  CodeQualityMetrics,
  CodeQualityEventData,
  ToolConfig,
  IQualityChecker,
  CodeQualitySubscription,
  CheckStartedCallback,
  CheckCompletedCallback,
  IssueFoundCallback,
  FixAppliedCallback,
  DEFAULT_CODE_QUALITY_CONFIG,
  DEFAULT_TOOL_CONFIGS,
  CHECK_TYPE_TO_TOOLS,
} from './code-quality.interface.js';

/**
 * ESLint JSON output format
 */
interface ESLintResult {
  filePath: string;
  messages: Array<{
    ruleId: string | null;
    severity: 1 | 2;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    fix?: {
      range: [number, number];
      text: string;
    };
  }>;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

/**
 * Code Quality Hook
 *
 * Runs code quality checks on files and reports issues.
 */
export class CodeQualityHook
  extends BaseHook<unknown, CodeQualityEventData>
  implements IQualityChecker, IDisposable
{
  readonly name = 'code-quality';
  readonly description = 'Code quality checking (lint, format, type-check)';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly config: Required<
    Omit<CodeQualityConfig, 'tools' | 'filePatterns' | 'cacheDir' | 'name' | 'description' | 'event' | 'conditions'>
  >;
  private readonly toolConfigs: Map<QualityTool, ToolConfig>;
  private readonly cacheDir?: string;

  private metrics: CodeQualityMetrics;
  private disposed = false;

  // Event subscriptions
  private checkStartedCallbacks: Map<string, CheckStartedCallback> = new Map();
  private checkCompletedCallbacks: Map<string, CheckCompletedCallback> = new Map();
  private issueFoundCallbacks: Map<string, IssueFoundCallback> = new Map();
  private fixAppliedCallbacks: Map<string, FixAppliedCallback> = new Map();

  constructor(config?: CodeQualityConfig) {
    // Merge config with defaults before passing to super
    const mergedConfig = {
      ...DEFAULT_CODE_QUALITY_CONFIG,
      ...config,
    };
    super(mergedConfig);

    this.config = mergedConfig;

    this.cacheDir = config?.cacheDir;

    // Initialize tool configurations
    this.toolConfigs = new Map();
    this.initializeToolConfigs(config?.tools);

    // Initialize metrics
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Initialize tool configurations
   */
  private initializeToolConfigs(customConfigs?: ToolConfig[]): void {
    // Add default configs
    for (const [tool, config] of Object.entries(DEFAULT_TOOL_CONFIGS)) {
      this.toolConfigs.set(tool as QualityTool, config as ToolConfig);
    }

    // Override with custom configs
    if (customConfigs) {
      for (const config of customConfigs) {
        this.toolConfigs.set(config.tool, {
          ...this.toolConfigs.get(config.tool),
          ...config,
        });
      }
    }
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): CodeQualityMetrics {
    return {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      totalIssues: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalFixesApplied: 0,
      totalFilesChecked: 0,
      checksByType: {
        [QualityCheckType.LINT]: 0,
        [QualityCheckType.FORMAT]: 0,
        [QualityCheckType.TYPE_CHECK]: 0,
        [QualityCheckType.TEST]: 0,
        [QualityCheckType.ALL]: 0,
      },
      checksByTool: {
        [QualityTool.ESLINT]: 0,
        [QualityTool.PRETTIER]: 0,
        [QualityTool.TSC]: 0,
        [QualityTool.JEST]: 0,
        [QualityTool.VITEST]: 0,
        [QualityTool.BIOME]: 0,
        [QualityTool.CUSTOM]: 0,
      },
      issuesByRule: {},
      totalExecutionTimeMs: 0,
    };
  }

  /**
   * Execute hook on context overflow event
   */
  async execute(_context: HookContext<unknown>): Promise<HookResult<CodeQualityEventData>> {
    if (this.disposed) {
      return this.skip('Hook has been disposed');
    }

    // Get files from context or use default patterns
    const files = this.getFilesFromContext(_context);

    if (files.length === 0) {
      return this.continue(undefined, 'No files to check');
    }

    const result = await this.check(files, this.config.checkTypes);

    const eventData: CodeQualityEventData = {
      result,
      metrics: this.metrics,
      files,
    };

    if (!result.passed && this.config.failOnError) {
      return this.abort(`Quality check failed: ${result.totalErrors} errors found`);
    }

    return this.continue(eventData, `Quality check completed: ${result.issues.length} issues found`);
  }

  /**
   * Get files from context
   */
  private getFilesFromContext(context: HookContext<unknown>): string[] {
    const data = context.data as Record<string, unknown> | undefined;

    if (data?.files && Array.isArray(data.files)) {
      return data.files as string[];
    }

    if (data?.file && typeof data.file === 'string') {
      return [data.file];
    }

    return [];
  }

  /**
   * Run quality checks on files
   */
  async check(files: string[], checkTypes?: QualityCheckType[]): Promise<QualityCheckResult> {
    const startedAt = new Date();
    const typesToCheck = checkTypes || this.config.checkTypes;

    // Handle empty file list - return success immediately
    if (files.length === 0) {
      const completedAt = new Date();
      return {
        passed: true,
        toolResults: [],
        issues: [],
        totalErrors: 0,
        totalWarnings: 0,
        totalFilesChecked: 0,
        totalFixesApplied: 0,
        totalExecutionTimeMs: completedAt.getTime() - startedAt.getTime(),
        startedAt,
        completedAt,
      };
    }

    // Notify subscribers
    this.notifyCheckStarted(typesToCheck, files);

    const toolResults: ToolCheckResult[] = [];
    const allIssues: QualityIssue[] = [];

    // Determine which tools to run
    const toolsToRun = this.getToolsForCheckTypes(typesToCheck);

    // Run checks
    if (this.config.parallel) {
      const results = await Promise.all(
        toolsToRun.map((tool) => this.checkWithTool(files, tool))
      );
      toolResults.push(...results);
    } else {
      for (const tool of toolsToRun) {
        const result = await this.checkWithTool(files, tool);
        toolResults.push(result);
      }
    }

    // Aggregate issues
    for (const result of toolResults) {
      allIssues.push(...result.issues);
    }

    const completedAt = new Date();
    const totalExecutionTimeMs = completedAt.getTime() - startedAt.getTime();

    const totalErrors = toolResults.reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = toolResults.reduce((sum, r) => sum + r.warningCount, 0);
    const totalFilesChecked = new Set(allIssues.map((i) => i.location.file)).size || files.length;
    const totalFixesApplied = toolResults.reduce((sum, r) => sum + r.fixesApplied, 0);

    // Determine if passed
    let passed = toolResults.every((r) => r.passed);
    if (this.config.maxErrors > 0 && totalErrors > this.config.maxErrors) {
      passed = false;
    }
    if (this.config.failOnWarning && totalWarnings > 0) {
      passed = false;
    }
    if (this.config.maxWarnings > 0 && totalWarnings > this.config.maxWarnings) {
      passed = false;
    }

    const result: QualityCheckResult = {
      passed,
      toolResults,
      issues: allIssues,
      totalErrors,
      totalWarnings,
      totalFilesChecked,
      totalFixesApplied,
      totalExecutionTimeMs,
      startedAt,
      completedAt,
    };

    // Update metrics
    this.updateMetrics(result, typesToCheck);

    // Notify subscribers
    this.notifyCheckCompleted(result);

    return result;
  }

  /**
   * Run quality check with a specific tool
   */
  async checkWithTool(files: string[], tool: QualityTool): Promise<ToolCheckResult> {
    const startTime = Date.now();
    const config = this.toolConfigs.get(tool);

    if (!config) {
      return this.createErrorResult(tool, `Tool ${tool} not configured`);
    }

    const checkType = this.getCheckTypeForTool(tool);

    try {
      const isAvailable = await this.isToolAvailable(tool);
      if (!isAvailable) {
        return this.createErrorResult(tool, `Tool ${tool} is not available`);
      }

      let result: ToolCheckResult;

      switch (tool) {
        case QualityTool.ESLINT:
          result = await this.runESLint(files, config);
          break;
        case QualityTool.PRETTIER:
          result = await this.runPrettier(files, config);
          break;
        case QualityTool.TSC:
          result = await this.runTSC(config);
          break;
        case QualityTool.BIOME:
          result = await this.runBiome(files, config);
          break;
        default:
          result = await this.runCustomTool(files, config, tool);
      }

      result.executionTimeMs = Date.now() - startTime;
      result.checkType = checkType;

      // Notify for each issue found
      for (const issue of result.issues) {
        this.notifyIssueFound(issue);
      }

      return result;
    } catch (error) {
      return this.createErrorResult(
        tool,
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Fix issues automatically
   */
  async fix(files: string[], checkTypes?: QualityCheckType[]): Promise<QualityCheckResult> {
    // Save original autoFix setting
    const originalAutoFix = this.config.autoFix;
    this.config.autoFix = true;

    try {
      return await this.check(files, checkTypes);
    } finally {
      this.config.autoFix = originalAutoFix;
    }
  }

  /**
   * Get available tools
   */
  async getAvailableTools(): Promise<QualityTool[]> {
    const available: QualityTool[] = [];

    for (const tool of Object.values(QualityTool)) {
      if (tool === QualityTool.CUSTOM) continue;
      if (await this.isToolAvailable(tool)) {
        available.push(tool);
      }
    }

    return available;
  }

  /**
   * Check if a tool is available
   */
  async isToolAvailable(tool: QualityTool): Promise<boolean> {
    const config = this.toolConfigs.get(tool);
    if (!config) return false;

    const command = config.command || 'npx';

    try {
      const result = await this.execCommand('which', [command], { timeout: 5000 });
      return result.exitCode === 0;
    } catch {
      // Try running with --version as fallback
      try {
        const args = config.args?.[0] ? [config.args[0], '--version'] : ['--version'];
        const result = await this.execCommand(command, args, { timeout: 5000 });
        return result.exitCode === 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Run ESLint
   */
  private async runESLint(files: string[], config: ToolConfig): Promise<ToolCheckResult> {
    const args = [...(config.args || ['eslint', '--format', 'json'])];

    if (this.config.autoFix) {
      args.push('--fix');
    }

    args.push(...files);

    const result = await this.execCommand(config.command || 'npx', args, {
      timeout: config.timeout || this.config.checkTimeout,
      cwd: config.cwd,
      env: config.env,
    });

    const issues: QualityIssue[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let fixesApplied = 0;

    try {
      const eslintResults: ESLintResult[] = JSON.parse(result.stdout || '[]');

      for (const fileResult of eslintResults) {
        for (const msg of fileResult.messages) {
          const severity = msg.severity === 2 ? IssueSeverity.ERROR : IssueSeverity.WARNING;

          if (severity === IssueSeverity.ERROR) errorCount++;
          else warningCount++;

          const issue: QualityIssue = {
            id: `eslint-${fileResult.filePath}-${msg.line}-${msg.column}`,
            ruleId: msg.ruleId || 'unknown',
            severity,
            message: msg.message,
            location: {
              file: fileResult.filePath,
              line: msg.line,
              column: msg.column,
              endLine: msg.endLine,
              endColumn: msg.endColumn,
            },
            tool: QualityTool.ESLINT,
            checkType: QualityCheckType.LINT,
          };

          if (msg.fix) {
            issue.fix = {
              description: 'Auto-fix available',
              text: msg.fix.text,
              range: msg.fix.range,
            };
          }

          issues.push(issue);
        }

        if (this.config.autoFix) {
          fixesApplied += fileResult.fixableErrorCount + fileResult.fixableWarningCount;
        }
      }
    } catch {
      // Failed to parse JSON, treat as error
      if (result.stderr) {
        return this.createErrorResult(QualityTool.ESLINT, result.stderr);
      }
    }

    return {
      tool: QualityTool.ESLINT,
      checkType: QualityCheckType.LINT,
      passed: errorCount === 0,
      issues,
      errorCount,
      warningCount,
      infoCount: 0,
      filesChecked: files.length,
      filesWithIssues: new Set(issues.map((i) => i.location.file)).size,
      fixesApplied,
      executionTimeMs: 0,
      rawOutput: result.stdout,
    };
  }

  /**
   * Run Prettier
   */
  private async runPrettier(files: string[], config: ToolConfig): Promise<ToolCheckResult> {
    const args = [...(config.args || ['prettier'])];

    if (this.config.autoFix) {
      args.push('--write');
    } else {
      args.push('--check');
    }

    args.push(...files);

    const result = await this.execCommand(config.command || 'npx', args, {
      timeout: config.timeout || this.config.checkTimeout,
      cwd: config.cwd,
      env: config.env,
    });

    const issues: QualityIssue[] = [];
    let errorCount = 0;

    // Prettier outputs unformatted files to stderr when using --check
    if (result.exitCode !== 0 && result.stdout) {
      const unformattedFiles = result.stdout
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('Checking'));

      for (const file of unformattedFiles) {
        errorCount++;
        issues.push({
          id: `prettier-${file}`,
          ruleId: 'prettier/prettier',
          severity: IssueSeverity.ERROR,
          message: 'File is not formatted',
          location: {
            file: file.trim(),
            line: 1,
            column: 1,
          },
          tool: QualityTool.PRETTIER,
          checkType: QualityCheckType.FORMAT,
        });
      }
    }

    return {
      tool: QualityTool.PRETTIER,
      checkType: QualityCheckType.FORMAT,
      passed: result.exitCode === 0,
      issues,
      errorCount,
      warningCount: 0,
      infoCount: 0,
      filesChecked: files.length,
      filesWithIssues: issues.length,
      fixesApplied: this.config.autoFix && result.exitCode === 0 ? files.length : 0,
      executionTimeMs: 0,
      rawOutput: result.stdout + result.stderr,
    };
  }

  /**
   * Run TypeScript compiler
   */
  private async runTSC(config: ToolConfig): Promise<ToolCheckResult> {
    const args = [...(config.args || ['tsc', '--noEmit'])];

    const result = await this.execCommand(config.command || 'npx', args, {
      timeout: config.timeout || this.config.checkTimeout,
      cwd: config.cwd,
      env: config.env,
    });

    const issues: QualityIssue[] = [];
    let errorCount = 0;

    // Parse TSC output
    const lines = (result.stdout + result.stderr).split('\n');
    const errorRegex = /^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

    for (const line of lines) {
      const match = errorRegex.exec(line);
      if (match) {
        errorCount++;
        issues.push({
          id: `tsc-${match[1]}-${match[2]}-${match[3]}`,
          ruleId: match[4],
          severity: IssueSeverity.ERROR,
          message: match[5],
          location: {
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
          },
          tool: QualityTool.TSC,
          checkType: QualityCheckType.TYPE_CHECK,
          docsUrl: `https://typescript.tv/errors/#${match[4].toLowerCase()}`,
        });
      }
    }

    return {
      tool: QualityTool.TSC,
      checkType: QualityCheckType.TYPE_CHECK,
      passed: result.exitCode === 0,
      issues,
      errorCount,
      warningCount: 0,
      infoCount: 0,
      filesChecked: 0, // TSC checks all files in tsconfig
      filesWithIssues: new Set(issues.map((i) => i.location.file)).size,
      fixesApplied: 0,
      executionTimeMs: 0,
      rawOutput: result.stdout + result.stderr,
    };
  }

  /**
   * Run Biome
   */
  private async runBiome(files: string[], config: ToolConfig): Promise<ToolCheckResult> {
    const args = [...(config.args || ['biome', 'check'])];

    if (this.config.autoFix) {
      args.push('--apply');
    }

    args.push(...files);

    const result = await this.execCommand(config.command || 'npx', args, {
      timeout: config.timeout || this.config.checkTimeout,
      cwd: config.cwd,
      env: config.env,
    });

    // Biome combines lint and format
    const issues: QualityIssue[] = [];
    let errorCount = 0;
    let warningCount = 0;

    // Parse Biome output (simplified)
    const lines = (result.stdout + result.stderr).split('\n');

    for (const line of lines) {
      if (line.includes('error') || line.includes('warning')) {
        const isError = line.includes('error');
        if (isError) errorCount++;
        else warningCount++;

        issues.push({
          id: `biome-${issues.length}`,
          ruleId: 'biome',
          severity: isError ? IssueSeverity.ERROR : IssueSeverity.WARNING,
          message: line,
          location: {
            file: 'unknown',
            line: 1,
            column: 1,
          },
          tool: QualityTool.BIOME,
          checkType: QualityCheckType.LINT,
        });
      }
    }

    return {
      tool: QualityTool.BIOME,
      checkType: QualityCheckType.LINT,
      passed: result.exitCode === 0,
      issues,
      errorCount,
      warningCount,
      infoCount: 0,
      filesChecked: files.length,
      filesWithIssues: issues.length,
      fixesApplied: 0,
      executionTimeMs: 0,
      rawOutput: result.stdout + result.stderr,
    };
  }

  /**
   * Run custom tool
   */
  private async runCustomTool(
    files: string[],
    config: ToolConfig,
    tool: QualityTool
  ): Promise<ToolCheckResult> {
    if (!config.command) {
      return this.createErrorResult(tool, 'Custom tool command not specified');
    }

    const args = [...(config.args || []), ...files];

    const result = await this.execCommand(config.command, args, {
      timeout: config.timeout || this.config.checkTimeout,
      cwd: config.cwd,
      env: config.env,
    });

    return {
      tool,
      checkType: QualityCheckType.LINT,
      passed: result.exitCode === 0,
      issues: [],
      errorCount: result.exitCode === 0 ? 0 : 1,
      warningCount: 0,
      infoCount: 0,
      filesChecked: files.length,
      filesWithIssues: 0,
      fixesApplied: 0,
      executionTimeMs: 0,
      rawOutput: result.stdout + result.stderr,
      error: result.exitCode !== 0 ? result.stderr : undefined,
    };
  }

  /**
   * Execute a command
   */
  private execCommand(
    command: string,
    args: string[],
    options: { timeout?: number; cwd?: string; env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        shell: true,
        timeout: options.timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
        });
      });

      proc.on('error', (error) => {
        resolve({
          stdout,
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Create error result
   */
  private createErrorResult(
    tool: QualityTool,
    error: string,
    executionTimeMs = 0
  ): ToolCheckResult {
    return {
      tool,
      checkType: this.getCheckTypeForTool(tool),
      passed: false,
      issues: [],
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
      filesChecked: 0,
      filesWithIssues: 0,
      fixesApplied: 0,
      executionTimeMs,
      error,
    };
  }

  /**
   * Get tools for check types
   */
  private getToolsForCheckTypes(checkTypes: QualityCheckType[]): QualityTool[] {
    const tools = new Set<QualityTool>();

    for (const checkType of checkTypes) {
      const toolsForType = CHECK_TYPE_TO_TOOLS[checkType] || [];
      for (const tool of toolsForType) {
        tools.add(tool);
      }
    }

    return Array.from(tools);
  }

  /**
   * Get check type for tool
   */
  private getCheckTypeForTool(tool: QualityTool): QualityCheckType {
    switch (tool) {
      case QualityTool.ESLINT:
      case QualityTool.BIOME:
        return QualityCheckType.LINT;
      case QualityTool.PRETTIER:
        return QualityCheckType.FORMAT;
      case QualityTool.TSC:
        return QualityCheckType.TYPE_CHECK;
      case QualityTool.JEST:
      case QualityTool.VITEST:
        return QualityCheckType.TEST;
      default:
        return QualityCheckType.LINT;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(result: QualityCheckResult, checkTypes: QualityCheckType[]): void {
    this.metrics.totalChecks++;
    if (result.passed) {
      this.metrics.passedChecks++;
    } else {
      this.metrics.failedChecks++;
    }

    this.metrics.totalIssues += result.issues.length;
    this.metrics.totalErrors += result.totalErrors;
    this.metrics.totalWarnings += result.totalWarnings;
    this.metrics.totalFixesApplied += result.totalFixesApplied;
    this.metrics.totalFilesChecked += result.totalFilesChecked;
    this.metrics.totalExecutionTimeMs += result.totalExecutionTimeMs;
    this.metrics.lastCheckAt = result.completedAt;

    // Update by type
    for (const checkType of checkTypes) {
      this.metrics.checksByType[checkType]++;
    }

    // Update by tool
    for (const toolResult of result.toolResults) {
      this.metrics.checksByTool[toolResult.tool]++;
    }

    // Update issues by rule (top 10)
    for (const issue of result.issues) {
      this.metrics.issuesByRule[issue.ruleId] =
        (this.metrics.issuesByRule[issue.ruleId] || 0) + 1;
    }

    // Keep only top 10 rules
    const sortedRules = Object.entries(this.metrics.issuesByRule)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    this.metrics.issuesByRule = Object.fromEntries(sortedRules);
  }

  /**
   * Get metrics
   */
  getMetrics(): CodeQualityMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Get configuration
   */
  getQualityConfig(): CodeQualityConfig {
    return {
      ...this.config,
      tools: Array.from(this.toolConfigs.values()),
      cacheDir: this.cacheDir,
    };
  }

  // Event subscription methods

  /**
   * Subscribe to check started events
   */
  onCheckStarted(callback: CheckStartedCallback): CodeQualitySubscription {
    const id = this.generateSubscriptionId();
    this.checkStartedCallbacks.set(id, callback);
    return { id, unsubscribe: () => this.checkStartedCallbacks.delete(id) };
  }

  /**
   * Subscribe to check completed events
   */
  onCheckCompleted(callback: CheckCompletedCallback): CodeQualitySubscription {
    const id = this.generateSubscriptionId();
    this.checkCompletedCallbacks.set(id, callback);
    return { id, unsubscribe: () => this.checkCompletedCallbacks.delete(id) };
  }

  /**
   * Subscribe to issue found events
   */
  onIssueFound(callback: IssueFoundCallback): CodeQualitySubscription {
    const id = this.generateSubscriptionId();
    this.issueFoundCallbacks.set(id, callback);
    return { id, unsubscribe: () => this.issueFoundCallbacks.delete(id) };
  }

  /**
   * Subscribe to fix applied events
   */
  onFixApplied(callback: FixAppliedCallback): CodeQualitySubscription {
    const id = this.generateSubscriptionId();
    this.fixAppliedCallbacks.set(id, callback);
    return { id, unsubscribe: () => this.fixAppliedCallbacks.delete(id) };
  }

  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyCheckStarted(checkTypes: QualityCheckType[], files: string[]): void {
    for (const callback of this.checkStartedCallbacks.values()) {
      try {
        callback(checkTypes, files);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private notifyCheckCompleted(result: QualityCheckResult): void {
    for (const callback of this.checkCompletedCallbacks.values()) {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private notifyIssueFound(issue: QualityIssue): void {
    for (const callback of this.issueFoundCallbacks.values()) {
      try {
        callback(issue);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Dispose the hook
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.checkStartedCallbacks.clear();
    this.checkCompletedCallbacks.clear();
    this.issueFoundCallbacks.clear();
    this.fixAppliedCallbacks.clear();
  }
}

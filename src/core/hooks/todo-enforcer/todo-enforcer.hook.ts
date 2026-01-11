/**
 * Todo Enforcer Hook Implementation
 *
 * Detects, tracks, and enforces TODO completion in source code.
 *
 * Feature: F3.17 - Todo Enforcer
 * @module core/hooks/todo-enforcer
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult } from '../../interfaces/hook.interface.js';
import { IDisposable } from '../../di/interfaces/container.interface.js';
import {
  ITodoEnforcer,
  TodoEnforcerConfig,
  TodoEnforcerMetrics,
  TodoEnforcerEventData,
  TodoEnforcerSubscription,
  ParsedTodo,
  TodoFileAnalysis,
  TodoAnalysisResult,
  TodoStatistics,
  TodoEnforcementRule,
  EnforcementViolation,
  TodoType,
  TodoPriority,
  TodoStatus,
  EnforcementLevel,
  TodoSupportedLanguage,
  TodoLocation,
  TODO_TYPE_PATTERNS,
  PRIORITY_PATTERNS,
  ASSIGNEE_PATTERN,
  ISSUE_REF_PATTERNS,
  DUE_DATE_PATTERNS,
  TAG_PATTERNS,
  EXTENSION_TO_TODO_LANGUAGE,
  LANGUAGE_COMMENT_PATTERNS,
  DEFAULT_TODO_ENFORCER_CONFIG,
  DEFAULT_ENFORCEMENT_RULES,
  PRIORITY_ORDER,
} from './todo-enforcer.interface.js';


/**
 * Todo Enforcer Hook
 *
 * Analyzes source files for TODO comments and enforces completion rules.
 */
export class TodoEnforcerHook
  extends BaseHook<unknown, TodoEnforcerEventData>
  implements ITodoEnforcer, IDisposable
{
  readonly name = 'todo-enforcer';
  readonly description = 'Detects and enforces TODO completion in code';
  readonly event = HookEvent.GIT_COMMIT;

  private readonly config: Required<
    Omit<TodoEnforcerConfig, 'rules' | 'customPatterns' | 'reportOutputFile' | 'name' | 'description' | 'event' | 'conditions'>
  >;
  private readonly rules: TodoEnforcementRule[];
  private readonly customPatterns: RegExp[];

  private trackedTodos: ParsedTodo[] = [];
  private cache: Map<string, { todos: ParsedTodo[]; timestamp: number }> = new Map();
  private metrics: TodoEnforcerMetrics = {
    totalAnalyses: 0,
    passedAnalyses: 0,
    failedAnalyses: 0,
    totalTodosTracked: 0,
    totalViolations: 0,
    blockedCommits: 0,
    blockedDeployments: 0,
    averageTodosPerFile: 0,
    averageDurationMs: 0,
  };

  // Event subscriptions
  private analysisStartedCallbacks: Map<string, (files: string[]) => void> = new Map();
  private analysisCompletedCallbacks: Map<string, (result: TodoAnalysisResult) => void> = new Map();
  private todoFoundCallbacks: Map<string, (todo: ParsedTodo) => void> = new Map();
  private violationFoundCallbacks: Map<string, (violation: EnforcementViolation) => void> = new Map();
  private operationBlockedCallbacks: Map<string, (operation: 'commit' | 'deployment', violations: EnforcementViolation[]) => void> = new Map();

  constructor(config?: TodoEnforcerConfig) {
    super(config);

    this.config = {
      ...DEFAULT_TODO_ENFORCER_CONFIG,
      ...config,
    };

    this.rules = config?.rules ?? [...DEFAULT_ENFORCEMENT_RULES];
    this.customPatterns = (config?.customPatterns ?? []).map((p) => new RegExp(p, 'gi'));

    // Auto-include CUSTOM in todoTypes when customPatterns are provided
    if (this.customPatterns.length > 0 && !this.config.todoTypes.includes(TodoType.CUSTOM)) {
      this.config.todoTypes = [...this.config.todoTypes, TodoType.CUSTOM];
    }
  }

  /**
   * Execute the hook
   */
  async execute(context: HookContext<unknown>): Promise<HookResult<TodoEnforcerEventData>> {
    try {
      // Get files from context if available
      const files = this.extractFilesFromContext(context);
      if (files.length === 0) {
        return this.continue(
          { metrics: this.metrics },
          'No files to analyze'
        );
      }

      // Analyze files
      const result = await this.analyze(files);

      // Check if we should block the operation
      const shouldBlock = this.shouldBlockOperation(context.event, result.violations);

      if (shouldBlock) {
        const operation = context.event === HookEvent.GIT_COMMIT ? 'commit' : 'deployment';
        this.emitOperationBlocked(operation, result.violations);

        if (operation === 'commit') {
          this.metrics.blockedCommits++;
        } else {
          this.metrics.blockedDeployments++;
        }

        return this.abort(
          `Operation blocked: ${result.violations.length} TODO enforcement violations found`
        );
      }

      // Return result based on pass/fail
      if (!result.passed) {
        return this.continue(
          {
            result,
            metrics: this.metrics,
          },
          `TODO analysis completed with ${result.violations.length} violations (warnings)`
        );
      }

      return this.continue(
        {
          result,
          metrics: this.metrics,
        },
        `TODO analysis passed: ${result.todos.length} TODOs tracked`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.abort(`TODO enforcer error: ${message}`);
    }
  }

  /**
   * Analyze files for TODOs
   */
  async analyze(files: string[]): Promise<TodoAnalysisResult> {
    const startTime = Date.now();
    this.emitAnalysisStarted(files);

    const fileAnalyses: TodoFileAnalysis[] = [];
    const allTodos: ParsedTodo[] = [];

    for (const file of files) {
      const analysis = await this.analyzeFile(file);
      fileAnalyses.push(analysis);
      allTodos.push(...analysis.todos);
    }

    // Update tracked todos
    this.trackedTodos = allTodos;

    // Check enforcement rules
    const violations = this.checkEnforcement(allTodos);

    // Calculate statistics
    const statistics = this.calculateStatistics(allTodos);

    // Update metrics
    this.updateMetrics(fileAnalyses, violations, Date.now() - startTime);

    const result: TodoAnalysisResult = {
      files: fileAnalyses,
      todos: allTodos,
      violations,
      passed: violations.filter((v) => v.level === EnforcementLevel.ERROR || v.level === EnforcementLevel.STRICT).length === 0,
      statistics,
      analyzedAt: new Date(),
      durationMs: Date.now() - startTime,
    };

    this.emitAnalysisCompleted(result);

    return result;
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(file: string): Promise<TodoFileAnalysis> {
    const analysis: TodoFileAnalysis = {
      file,
      language: this.detectLanguage(file),
      todos: [],
      totalLines: 0,
      todoLines: 0,
      analyzedAt: new Date(),
    };

    try {
      // Check cache
      if (this.config.enableCache) {
        const cached = this.cache.get(file);
        if (cached && Date.now() - cached.timestamp < this.config.cacheTtlSeconds * 1000) {
          analysis.todos = cached.todos;
          analysis.todoLines = cached.todos.length;
          return analysis;
        }
      }

      // Read file content
      const content = await fs.promises.readFile(file, 'utf-8');
      const lines = content.split('\n');
      analysis.totalLines = lines.length;

      // Parse TODOs
      const todos = this.parseFileTodos(content, file, analysis.language);
      analysis.todos = todos;
      analysis.todoLines = new Set(todos.map((t) => t.location.line)).size;

      // Emit events for found TODOs
      for (const todo of todos) {
        this.emitTodoFound(todo);
      }

      // Update cache
      if (this.config.enableCache) {
        this.cache.set(file, { todos, timestamp: Date.now() });
      }
    } catch (error) {
      analysis.error = error instanceof Error ? error.message : String(error);
    }

    return analysis;
  }

  /**
   * Parse TODOs from file content
   */
  private parseFileTodos(content: string, file: string, language: TodoSupportedLanguage): ParsedTodo[] {
    const todos: ParsedTodo[] = [];
    const lines = content.split('\n');
    const patterns = LANGUAGE_COMMENT_PATTERNS[language] ?? LANGUAGE_COMMENT_PATTERNS[TodoSupportedLanguage.UNKNOWN];

    // Process single-line comments
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for single-line comments
      const singleMatch = this.findSingleLineComment(line, patterns.single);
      if (singleMatch) {
        const todo = this.parseTodoFromComment(singleMatch, file, lineNumber, line.indexOf(singleMatch) + 1, language);
        if (todo) {
          todos.push(todo);
        }
      }
    }

    // Process multi-line comments
    if (patterns.multiStart && patterns.multiEnd) {
      const multiTodos = this.parseMultiLineComments(content, file, language, patterns.multiStart, patterns.multiEnd);
      todos.push(...multiTodos);
    }

    return todos;
  }

  /**
   * Find single-line comment in a line
   */
  private findSingleLineComment(line: string, pattern: RegExp): string | null {
    const regex = new RegExp(pattern.source, 'g');
    const match = regex.exec(line);
    return match ? match[1]?.trim() ?? null : null;
  }

  /**
   * Parse multi-line comments
   */
  private parseMultiLineComments(
    content: string,
    file: string,
    language: TodoSupportedLanguage,
    startPattern: RegExp,
    endPattern: RegExp
  ): ParsedTodo[] {
    const todos: ParsedTodo[] = [];
    const lines = content.split('\n');
    let inMultiLine = false;
    let multiLineContent = '';
    let multiLineStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inMultiLine) {
        if (startPattern.test(line)) {
          inMultiLine = true;
          multiLineStart = i + 1;
          multiLineContent = line;
        }
      } else {
        multiLineContent += '\n' + line;
        if (endPattern.test(line)) {
          inMultiLine = false;
          // Check if multi-line comment contains TODO
          const todo = this.parseTodoFromComment(multiLineContent, file, multiLineStart, 1, language);
          if (todo) {
            todos.push(todo);
          }
          multiLineContent = '';
        }
      }
    }

    return todos;
  }

  /**
   * Parse a TODO from comment text
   */
  private parseTodoFromComment(
    comment: string,
    file: string,
    line: number,
    column: number,
    language: TodoSupportedLanguage
  ): ParsedTodo | null {
    // Check if this is a TODO-type comment
    let todoType: TodoType | null = null;

    for (const [type, pattern] of Object.entries(TODO_TYPE_PATTERNS)) {
      if (pattern.test(comment)) {
        todoType = type as TodoType;
        break;
      }
    }

    // Check custom patterns
    if (!todoType) {
      for (const pattern of this.customPatterns) {
        // Reset lastIndex for patterns with 'g' flag to ensure consistent matching
        pattern.lastIndex = 0;
        if (pattern.test(comment)) {
          todoType = TodoType.CUSTOM;
          break;
        }
      }
    }

    if (!todoType) {
      return null;
    }

    // Check if this type should be tracked
    if (!this.config.todoTypes.includes(todoType)) {
      return null;
    }

    // Extract priority
    let priority = TodoPriority.NONE;
    for (const [prio, pattern] of Object.entries(PRIORITY_PATTERNS)) {
      if (pattern.test(comment)) {
        priority = prio as TodoPriority;
        break;
      }
    }

    // Extract assignee
    const assigneeMatch = ASSIGNEE_PATTERN.exec(comment);
    const assignee = assigneeMatch ? (assigneeMatch[1] ?? assigneeMatch[2]) : undefined;

    // Extract issue reference
    let issueRef: string | undefined;
    for (const pattern of ISSUE_REF_PATTERNS) {
      const match = pattern.exec(comment);
      if (match) {
        issueRef = match[0];
        break;
      }
    }

    // Extract due date
    let dueDate: Date | undefined;
    for (const pattern of DUE_DATE_PATTERNS) {
      const match = pattern.exec(comment);
      if (match) {
        dueDate = new Date(match[1]);
        break;
      }
    }

    // Extract tags
    const tags: string[] = [];
    for (const pattern of TAG_PATTERNS) {
      const regex = new RegExp(pattern.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(comment)) !== null) {
        const matchedText = match[0];
        const capturedGroup = match[1];
        // Avoid adding issue refs as tags
        if (!ISSUE_REF_PATTERNS.some((p) => p.test(matchedText))) {
          tags.push(capturedGroup);
        }
      }
    }

    // Clean the message (remove the TODO keyword and metadata)
    const message = this.cleanMessage(comment, todoType);

    const location: TodoLocation = {
      file,
      line,
      column,
    };

    return {
      id: crypto.randomUUID(),
      type: todoType,
      priority,
      status: TodoStatus.OPEN,
      message,
      location,
      rawText: comment,
      assignee,
      dueDate,
      tags,
      issueRef,
      language,
    };
  }

  /**
   * Clean message by removing TODO keyword and metadata
   */
  private cleanMessage(comment: string, _type: TodoType): string {
    let message = comment;

    // Remove TODO-type keywords
    message = message.replace(/\b(?:TODO|FIXME|HACK|OPTIMIZE|OPTIM|PERF|REVIEW|SECURITY|SEC|DEPRECATED?|NOTE)\b:?\s*/gi, '');

    // Remove priority markers
    message = message.replace(/\b(?:CRITICAL|URGENT|ASAP|P0|HIGH|IMPORTANT|P1|MEDIUM|P2|LOW|MINOR|P3)\b:?\s*/gi, '');

    // Remove assignee
    message = message.replace(/@\w+\s*/g, '');
    message = message.replace(/\(\w+\)\s*/g, '');

    // Remove issue refs
    message = message.replace(/\b[A-Z]+-\d+\b/g, '');
    message = message.replace(/\b#\d+\b/g, '');

    // Remove due dates
    message = message.replace(/(?:due|by|deadline)[:\s]+\d{4}-\d{2}-\d{2}/gi, '');

    // Remove tags
    message = message.replace(/\[[^\]]+\]/g, '');

    // Clean up whitespace and colons
    message = message.replace(/^[\s:]+/, '').replace(/[\s:]+$/, '').trim();

    return message;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(file: string): TodoSupportedLanguage {
    const ext = path.extname(file).toLowerCase();
    return EXTENSION_TO_TODO_LANGUAGE[ext] ?? TodoSupportedLanguage.UNKNOWN;
  }

  /**
   * Check enforcement rules against TODOs
   */
  checkEnforcement(todos: ParsedTodo[]): EnforcementViolation[] {
    const violations: EnforcementViolation[] = [];

    for (const todo of todos) {
      for (const rule of this.rules) {
        const violation = this.checkRule(todo, rule);
        if (violation) {
          violations.push(violation);
          this.emitViolationFound(violation);
        }
      }

      // Check global rules
      if (this.config.requireAssignee && !todo.assignee) {
        violations.push(this.createViolation(
          todo,
          {
            id: 'global-require-assignee',
            name: 'Require Assignee',
            description: 'TODOs must have an assignee',
            level: this.config.defaultLevel,
          },
          'TODO is missing an assignee'
        ));
      }

      if (this.config.requireIssueRef && !todo.issueRef) {
        violations.push(this.createViolation(
          todo,
          {
            id: 'global-require-issue-ref',
            name: 'Require Issue Reference',
            description: 'TODOs must have an issue reference',
            level: this.config.defaultLevel,
          },
          'TODO is missing an issue reference'
        ));
      }

      if (this.config.maxAgeDays > 0 && todo.ageInDays && todo.ageInDays > this.config.maxAgeDays) {
        violations.push(this.createViolation(
          todo,
          {
            id: 'global-max-age',
            name: 'Maximum Age',
            description: `TODOs must not be older than ${this.config.maxAgeDays} days`,
            level: EnforcementLevel.ERROR,
          },
          `TODO is ${todo.ageInDays} days old (max: ${this.config.maxAgeDays})`
        ));
      }
    }

    // Check max TODOs
    if (this.config.maxTodos > 0 && todos.length > this.config.maxTodos) {
      violations.push({
        id: crypto.randomUUID(),
        todo: todos[0], // Reference first TODO
        rule: {
          id: 'global-max-todos',
          name: 'Maximum TODOs',
          description: `No more than ${this.config.maxTodos} TODOs allowed`,
          level: EnforcementLevel.ERROR,
        },
        message: `Too many TODOs: ${todos.length} (max: ${this.config.maxTodos})`,
        level: EnforcementLevel.ERROR,
      });
    }

    return violations;
  }

  /**
   * Check a single rule against a TODO
   */
  private checkRule(todo: ParsedTodo, rule: TodoEnforcementRule): EnforcementViolation | null {
    // Check if rule applies to this TODO type
    if (rule.types && !rule.types.includes(todo.type)) {
      return null;
    }

    // Check priority
    if (rule.minPriority) {
      const todoPriorityOrder = PRIORITY_ORDER[todo.priority];
      const minPriorityOrder = PRIORITY_ORDER[rule.minPriority];
      if (todoPriorityOrder > minPriorityOrder) {
        return null;
      }
    }

    // Check age
    if (rule.maxAgeDays && todo.ageInDays && todo.ageInDays > rule.maxAgeDays) {
      return this.createViolation(
        todo,
        rule,
        `TODO is ${todo.ageInDays} days old (max: ${rule.maxAgeDays})`
      );
    }

    // Check file patterns
    if (rule.filePatterns && rule.filePatterns.length > 0) {
      const matches = rule.filePatterns.some((pattern) => this.matchGlob(todo.location.file, pattern));
      if (!matches) {
        return null;
      }
    }

    // Check exclude patterns
    if (rule.excludePatterns && rule.excludePatterns.length > 0) {
      const excluded = rule.excludePatterns.some((pattern) => this.matchGlob(todo.location.file, pattern));
      if (excluded) {
        return null;
      }
    }

    // If we get here for type-based rules, it's a violation
    if (rule.types && rule.types.includes(todo.type)) {
      return this.createViolation(
        todo,
        rule,
        `${todo.type.toUpperCase()} found: ${todo.message.substring(0, 50)}...`
      );
    }

    return null;
  }

  /**
   * Create a violation object
   */
  private createViolation(
    todo: ParsedTodo,
    rule: TodoEnforcementRule,
    message: string
  ): EnforcementViolation {
    return {
      id: crypto.randomUUID(),
      todo,
      rule,
      message,
      level: rule.level,
      suggestion: this.getSuggestion(todo, rule),
    };
  }

  /**
   * Get suggestion for fixing a violation
   */
  private getSuggestion(todo: ParsedTodo, rule: TodoEnforcementRule): string {
    switch (rule.id) {
      case 'no-fixme-commit':
        return 'Fix the issue or convert FIXME to TODO with a tracking issue';
      case 'stale-todos':
        return 'Review and either complete the TODO or update with current status';
      case 'security-critical':
        return 'Address security concern before proceeding or document risk acceptance';
      case 'global-require-assignee':
        return `Add an assignee using @username: // TODO @${todo.assignee ?? 'developer'}: ${todo.message}`;
      case 'global-require-issue-ref':
        return `Add an issue reference: // TODO PROJ-123: ${todo.message}`;
      default:
        return 'Review and address the TODO according to team guidelines';
    }
  }

  /**
   * Simple glob matching
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(filePath);
  }

  /**
   * Calculate statistics from TODOs
   */
  private calculateStatistics(todos: ParsedTodo[]): TodoStatistics {
    const byType: Record<TodoType, number> = {} as Record<TodoType, number>;
    const byPriority: Record<TodoPriority, number> = {} as Record<TodoPriority, number>;
    const byStatus: Record<TodoStatus, number> = {} as Record<TodoStatus, number>;
    const byLanguage: Record<TodoSupportedLanguage, number> = {} as Record<TodoSupportedLanguage, number>;

    // Initialize counters
    Object.values(TodoType).forEach((t) => (byType[t] = 0));
    Object.values(TodoPriority).forEach((p) => (byPriority[p] = 0));
    Object.values(TodoStatus).forEach((s) => (byStatus[s] = 0));
    Object.values(TodoSupportedLanguage).forEach((l) => (byLanguage[l] = 0));

    let totalAge = 0;
    let oldestAge = 0;
    let stale30 = 0;
    let stale90 = 0;
    let withAssignee = 0;
    let withDueDate = 0;
    let withIssueRef = 0;
    let overdue = 0;
    const now = new Date();

    for (const todo of todos) {
      byType[todo.type]++;
      byPriority[todo.priority]++;
      byStatus[todo.status]++;
      byLanguage[todo.language]++;

      if (todo.ageInDays) {
        totalAge += todo.ageInDays;
        if (todo.ageInDays > oldestAge) {
          oldestAge = todo.ageInDays;
        }
        if (todo.ageInDays > 30) stale30++;
        if (todo.ageInDays > 90) stale90++;
      }

      if (todo.assignee) withAssignee++;
      if (todo.dueDate) {
        withDueDate++;
        if (todo.dueDate < now) overdue++;
      }
      if (todo.issueRef) withIssueRef++;
    }

    return {
      totalFiles: new Set(todos.map((t) => t.location.file)).size,
      totalTodos: todos.length,
      byType,
      byPriority,
      byStatus,
      byLanguage,
      averageAgeDays: todos.length > 0 ? totalAge / todos.length : 0,
      oldestAgeDays: oldestAge,
      stale30Days: stale30,
      stale90Days: stale90,
      withAssignee,
      withDueDate,
      withIssueRef,
      overdue,
    };
  }

  /**
   * Update metrics after analysis
   */
  private updateMetrics(
    fileAnalyses: TodoFileAnalysis[],
    violations: EnforcementViolation[],
    durationMs: number
  ): void {
    this.metrics.totalAnalyses++;

    const hasBlockingViolations = violations.some(
      (v) => v.level === EnforcementLevel.ERROR || v.level === EnforcementLevel.STRICT
    );

    if (hasBlockingViolations) {
      this.metrics.failedAnalyses++;
    } else {
      this.metrics.passedAnalyses++;
    }

    this.metrics.totalTodosTracked = this.trackedTodos.length;
    this.metrics.totalViolations += violations.length;

    const totalTodos = fileAnalyses.reduce((sum, f) => sum + f.todos.length, 0);
    this.metrics.averageTodosPerFile =
      fileAnalyses.length > 0 ? totalTodos / fileAnalyses.length : 0;

    // Update average duration
    this.metrics.averageDurationMs =
      (this.metrics.averageDurationMs * (this.metrics.totalAnalyses - 1) + durationMs) /
      this.metrics.totalAnalyses;

    this.metrics.lastAnalysisAt = new Date();
  }

  /**
   * Check if operation should be blocked
   */
  private shouldBlockOperation(event: HookEvent, violations: EnforcementViolation[]): boolean {
    const hasStrictViolations = violations.some((v) => v.level === EnforcementLevel.STRICT);
    const hasErrorViolations = violations.some((v) => v.level === EnforcementLevel.ERROR);

    if (hasStrictViolations) {
      return true;
    }

    if (event === HookEvent.GIT_COMMIT && this.config.blockCommits && hasErrorViolations) {
      return true;
    }

    if (
      (event === HookEvent.WORKFLOW_START || event === HookEvent.WORKFLOW_END) &&
      this.config.blockDeployments &&
      hasErrorViolations
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extract files from hook context
   */
  private extractFilesFromContext(context: HookContext<unknown>): string[] {
    const data = context.data as Record<string, unknown> | undefined;

    if (data?.files && Array.isArray(data.files)) {
      return data.files as string[];
    }

    if (data?.stagedFiles && Array.isArray(data.stagedFiles)) {
      return data.stagedFiles as string[];
    }

    return [];
  }

  /**
   * Get all tracked TODOs
   */
  getTodos(): ParsedTodo[] {
    return [...this.trackedTodos];
  }

  /**
   * Get statistics
   */
  getStatistics(): TodoStatistics {
    return this.calculateStatistics(this.trackedTodos);
  }

  /**
   * Get metrics
   */
  getMetrics(): TodoEnforcerMetrics {
    return { ...this.metrics };
  }

  /**
   * Generate report
   */
  generateReport(format: 'text' | 'json' | 'markdown' = this.config.reportFormat): string {
    const stats = this.getStatistics();
    const todos = this.getTodos();

    switch (format) {
      case 'json':
        return JSON.stringify({ statistics: stats, todos }, null, 2);

      case 'markdown':
        return this.generateMarkdownReport(stats, todos);

      case 'text':
      default:
        return this.generateTextReport(stats, todos);
    }
  }

  /**
   * Generate text report
   */
  private generateTextReport(stats: TodoStatistics, todos: ParsedTodo[]): string {
    const lines: string[] = [
      '='.repeat(60),
      'TODO ENFORCER REPORT',
      '='.repeat(60),
      '',
      `Total Files: ${stats.totalFiles}`,
      `Total TODOs: ${stats.totalTodos}`,
      '',
      'By Type:',
      ...Object.entries(stats.byType)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `  ${type}: ${count}`),
      '',
      'By Priority:',
      ...Object.entries(stats.byPriority)
        .filter(([, count]) => count > 0)
        .map(([priority, count]) => `  ${priority}: ${count}`),
      '',
      `Stale TODOs (>30 days): ${stats.stale30Days}`,
      `Stale TODOs (>90 days): ${stats.stale90Days}`,
      `Overdue TODOs: ${stats.overdue}`,
      '',
      '-'.repeat(60),
      'TODOs:',
      '-'.repeat(60),
    ];

    for (const todo of todos.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])) {
      lines.push(`[${todo.type.toUpperCase()}] ${todo.location.file}:${todo.location.line}`);
      lines.push(`  Priority: ${todo.priority} | ${todo.message.substring(0, 60)}${todo.message.length > 60 ? '...' : ''}`);
      if (todo.assignee) lines.push(`  Assignee: @${todo.assignee}`);
      if (todo.issueRef) lines.push(`  Issue: ${todo.issueRef}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(stats: TodoStatistics, todos: ParsedTodo[]): string {
    const lines: string[] = [
      '# TODO Enforcer Report',
      '',
      '## Summary',
      '',
      `- **Total Files**: ${stats.totalFiles}`,
      `- **Total TODOs**: ${stats.totalTodos}`,
      `- **Stale (>30 days)**: ${stats.stale30Days}`,
      `- **Stale (>90 days)**: ${stats.stale90Days}`,
      `- **Overdue**: ${stats.overdue}`,
      '',
      '## By Type',
      '',
      '| Type | Count |',
      '|------|-------|',
      ...Object.entries(stats.byType)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `| ${type} | ${count} |`),
      '',
      '## By Priority',
      '',
      '| Priority | Count |',
      '|----------|-------|',
      ...Object.entries(stats.byPriority)
        .filter(([, count]) => count > 0)
        .map(([priority, count]) => `| ${priority} | ${count} |`),
      '',
      '## TODOs',
      '',
    ];

    for (const todo of todos.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])) {
      lines.push(`### \`${todo.location.file}:${todo.location.line}\``);
      lines.push('');
      lines.push(`- **Type**: ${todo.type.toUpperCase()}`);
      lines.push(`- **Priority**: ${todo.priority}`);
      lines.push(`- **Message**: ${todo.message}`);
      if (todo.assignee) lines.push(`- **Assignee**: @${todo.assignee}`);
      if (todo.issueRef) lines.push(`- **Issue**: ${todo.issueRef}`);
      if (todo.tags.length > 0) lines.push(`- **Tags**: ${todo.tags.join(', ')}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Add enforcement rule
   */
  addRule(rule: TodoEnforcementRule): void {
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Remove enforcement rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get enforcement rules
   */
  getRules(): TodoEnforcementRule[] {
    return [...this.rules];
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // Event Subscriptions
  // ============================================================================

  onAnalysisStarted(callback: (files: string[]) => void): TodoEnforcerSubscription {
    const id = crypto.randomUUID();
    this.analysisStartedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.analysisStartedCallbacks.delete(id);
      },
    };
  }

  onAnalysisCompleted(callback: (result: TodoAnalysisResult) => void): TodoEnforcerSubscription {
    const id = crypto.randomUUID();
    this.analysisCompletedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.analysisCompletedCallbacks.delete(id);
      },
    };
  }

  onTodoFound(callback: (todo: ParsedTodo) => void): TodoEnforcerSubscription {
    const id = crypto.randomUUID();
    this.todoFoundCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.todoFoundCallbacks.delete(id);
      },
    };
  }

  onViolationFound(callback: (violation: EnforcementViolation) => void): TodoEnforcerSubscription {
    const id = crypto.randomUUID();
    this.violationFoundCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.violationFoundCallbacks.delete(id);
      },
    };
  }

  onOperationBlocked(
    callback: (operation: 'commit' | 'deployment', violations: EnforcementViolation[]) => void
  ): TodoEnforcerSubscription {
    const id = crypto.randomUUID();
    this.operationBlockedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.operationBlockedCallbacks.delete(id);
      },
    };
  }

  private emitAnalysisStarted(files: string[]): void {
    for (const callback of this.analysisStartedCallbacks.values()) {
      try {
        callback(files);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private emitAnalysisCompleted(result: TodoAnalysisResult): void {
    for (const callback of this.analysisCompletedCallbacks.values()) {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private emitTodoFound(todo: ParsedTodo): void {
    for (const callback of this.todoFoundCallbacks.values()) {
      try {
        callback(todo);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private emitViolationFound(violation: EnforcementViolation): void {
    for (const callback of this.violationFoundCallbacks.values()) {
      try {
        callback(violation);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private emitOperationBlocked(operation: 'commit' | 'deployment', violations: EnforcementViolation[]): void {
    for (const callback of this.operationBlockedCallbacks.values()) {
      try {
        callback(operation, violations);
      } catch {
        // Ignore callback errors
      }
    }
  }

  // ============================================================================
  // IDisposable
  // ============================================================================

  dispose(): void {
    this.analysisStartedCallbacks.clear();
    this.analysisCompletedCallbacks.clear();
    this.todoFoundCallbacks.clear();
    this.violationFoundCallbacks.clear();
    this.operationBlockedCallbacks.clear();
    this.cache.clear();
    this.trackedTodos = [];
  }
}

/**
 * Factory function to create a TodoEnforcerHook
 */
export function createTodoEnforcer(config?: TodoEnforcerConfig): TodoEnforcerHook {
  return new TodoEnforcerHook(config);
}

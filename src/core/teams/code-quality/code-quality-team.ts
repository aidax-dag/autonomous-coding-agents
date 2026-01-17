/**
 * Code Quality Team
 *
 * Specialized team for code quality, reviews, and technical debt management.
 * Handles code reviews, refactoring, security analysis, and maintainability.
 *
 * Feature: Team System
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TeamType,
  TeamCapability,
  TeamConfig,
  TaskDocument,
  TaskResult,
  TaskArtifact,
  AgentRole,
  TEAM_CAPABILITIES,
} from '../team-types';
import { BaseTeam, createRole } from '../base-team';

// ============================================================================
// Types
// ============================================================================

/**
 * Code Quality team configuration
 */
export interface CodeQualityTeamConfig extends Partial<TeamConfig> {
  /** Linting tools to use */
  linters?: string[];
  /** Security scanners to use */
  securityScanners?: string[];
  /** Enable auto-fix for issues */
  enableAutoFix?: boolean;
  /** Complexity threshold */
  complexityThreshold?: number;
  /** Technical debt threshold (hours) */
  techDebtThreshold?: number;
  /** Enable security scanning */
  enableSecurityScan?: boolean;
  /** Enable performance analysis */
  enablePerformanceAnalysis?: boolean;
  /** Code review strictness level */
  reviewStrictness?: 'lenient' | 'standard' | 'strict';
  /** Max issues before failing */
  maxIssuesThreshold?: number;
}

/**
 * Code review result
 */
export interface CodeReviewResult {
  /** Overall score (0-100) */
  score: number;
  /** Pass/fail status */
  passed: boolean;
  /** Issues found */
  issues: CodeIssue[];
  /** Suggestions for improvement */
  suggestions: CodeSuggestion[];
  /** Files reviewed */
  filesReviewed: string[];
  /** Review duration in ms */
  duration: number;
}

/**
 * Code issue
 */
export interface CodeIssue {
  /** Issue ID */
  id: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Issue type */
  type: 'bug' | 'security' | 'performance' | 'maintainability' | 'style' | 'complexity';
  /** Issue title */
  title: string;
  /** Issue description */
  description: string;
  /** File path */
  file: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Code snippet */
  snippet?: string;
  /** Suggested fix */
  fix?: string;
  /** Rule or check that triggered this */
  rule?: string;
}

/**
 * Code suggestion
 */
export interface CodeSuggestion {
  /** Suggestion ID */
  id: string;
  /** Priority */
  priority: 'high' | 'medium' | 'low';
  /** Suggestion type */
  type: 'refactor' | 'optimization' | 'pattern' | 'naming' | 'documentation';
  /** Suggestion title */
  title: string;
  /** Detailed description */
  description: string;
  /** Affected file */
  file?: string;
  /** Effort estimate (hours) */
  effort?: number;
  /** Example implementation */
  example?: string;
}

/**
 * Technical debt item
 */
export interface TechDebtItem {
  /** Item ID */
  id: string;
  /** Category */
  category: 'code' | 'architecture' | 'testing' | 'documentation' | 'dependency' | 'security';
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Affected areas */
  affectedAreas: string[];
  /** Estimated effort (hours) */
  estimatedEffort: number;
  /** Interest rate (how fast it grows) */
  interestRate: 'high' | 'medium' | 'low';
  /** Created date */
  createdAt: Date;
  /** Remediation plan */
  remediationPlan?: string;
}

/**
 * Refactoring result
 */
export interface RefactoringResult {
  /** Refactoring applied */
  refactorings: RefactoringAction[];
  /** Files modified */
  filesModified: string[];
  /** Lines changed */
  linesChanged: number;
  /** Improvement metrics */
  improvements: {
    complexityReduction: number;
    duplicationsRemoved: number;
    readabilityScore: number;
  };
}

/**
 * Refactoring action
 */
export interface RefactoringAction {
  /** Action ID */
  id: string;
  /** Type of refactoring */
  type: 'extract-method' | 'extract-variable' | 'rename' | 'inline' | 'move' | 'restructure';
  /** Description */
  description: string;
  /** Before code */
  before: string;
  /** After code */
  after: string;
  /** Target file */
  file: string;
  /** Lines affected */
  linesAffected: [number, number];
}

/**
 * Security scan result
 */
export interface SecurityScanResult {
  /** Overall risk level */
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  /** Vulnerabilities found */
  vulnerabilities: SecurityVulnerability[];
  /** Recommendations */
  recommendations: string[];
  /** Compliance status */
  compliance: {
    owasp: boolean;
    cwe: boolean;
  };
}

/**
 * Security vulnerability
 */
export interface SecurityVulnerability {
  /** Vulnerability ID */
  id: string;
  /** CVE ID if applicable */
  cve?: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Type */
  type: 'injection' | 'xss' | 'csrf' | 'auth' | 'exposure' | 'dependency' | 'config';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Affected file/component */
  affected: string;
  /** Remediation */
  remediation: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CODE_QUALITY_CONFIG: CodeQualityTeamConfig = {
  linters: ['eslint', 'typescript'],
  securityScanners: ['npm-audit', 'snyk'],
  enableAutoFix: false,
  complexityThreshold: 10,
  techDebtThreshold: 40,
  enableSecurityScan: true,
  enablePerformanceAnalysis: true,
  reviewStrictness: 'standard',
  maxIssuesThreshold: 50,
};

// ============================================================================
// Code Quality Team Implementation
// ============================================================================

/**
 * Code Quality Team for reviews, refactoring, and technical debt management
 */
export class CodeQualityTeam extends BaseTeam {
  protected cqConfig: CodeQualityTeamConfig & Required<Omit<CodeQualityTeamConfig, keyof TeamConfig>>;

  // Statistics
  protected cqStats = {
    reviewsCompleted: 0,
    issuesFound: 0,
    issuesFixed: 0,
    refactoringsApplied: 0,
    techDebtItems: 0,
    securityVulnerabilities: 0,
    totalFilesReviewed: 0,
    averageScore: 0,
  };

  constructor(config: CodeQualityTeamConfig = {}) {
    const teamConfig: TeamConfig = {
      id: config.id || `code-quality-team-${uuidv4().slice(0, 8)}`,
      name: config.name || 'Code Quality Team',
      type: TeamType.CODE_QUALITY,
      capabilities: TEAM_CAPABILITIES[TeamType.CODE_QUALITY],
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      taskTimeoutMs: config.taskTimeoutMs || 600000,
      autoRetry: config.autoRetry ?? true,
      maxRetries: config.maxRetries || 2,
      metadata: config.metadata || {},
    };

    super(teamConfig);

    this.cqConfig = {
      ...DEFAULT_CODE_QUALITY_CONFIG,
      ...config,
      id: teamConfig.id,
      name: teamConfig.name,
      type: teamConfig.type,
      capabilities: teamConfig.capabilities,
      maxConcurrentTasks: teamConfig.maxConcurrentTasks,
      taskTimeoutMs: teamConfig.taskTimeoutMs,
      autoRetry: teamConfig.autoRetry,
      maxRetries: teamConfig.maxRetries,
      metadata: teamConfig.metadata,
      linters: config.linters || DEFAULT_CODE_QUALITY_CONFIG.linters!,
      securityScanners: config.securityScanners || DEFAULT_CODE_QUALITY_CONFIG.securityScanners!,
      enableAutoFix: config.enableAutoFix ?? DEFAULT_CODE_QUALITY_CONFIG.enableAutoFix!,
      complexityThreshold: config.complexityThreshold || DEFAULT_CODE_QUALITY_CONFIG.complexityThreshold!,
      techDebtThreshold: config.techDebtThreshold || DEFAULT_CODE_QUALITY_CONFIG.techDebtThreshold!,
      enableSecurityScan: config.enableSecurityScan ?? DEFAULT_CODE_QUALITY_CONFIG.enableSecurityScan!,
      enablePerformanceAnalysis: config.enablePerformanceAnalysis ?? DEFAULT_CODE_QUALITY_CONFIG.enablePerformanceAnalysis!,
      reviewStrictness: config.reviewStrictness || DEFAULT_CODE_QUALITY_CONFIG.reviewStrictness!,
      maxIssuesThreshold: config.maxIssuesThreshold || DEFAULT_CODE_QUALITY_CONFIG.maxIssuesThreshold!,
    };
  }

  // ============================================================================
  // Agent Roles
  // ============================================================================

  protected getAgentRoles(): AgentRole[] {
    return [
      createRole(
        'Code Reviewer',
        'Reviews code for quality, patterns, and best practices',
        `You are a Code Reviewer responsible for:
- Analyzing code for bugs, issues, and anti-patterns
- Checking adherence to coding standards and best practices
- Evaluating code readability and maintainability
- Identifying performance bottlenecks
- Suggesting improvements and alternatives

Review with ${this.cqConfig.reviewStrictness} strictness level.
Focus on actionable feedback that improves code quality.
Consider both immediate fixes and long-term maintainability.`,
        { capabilities: [TeamCapability.CODE_REVIEW], tools: ['read', 'analyze', 'lint'] },
      ),

      createRole(
        'Refactorer',
        'Identifies and applies code refactoring opportunities',
        `You are a Refactorer responsible for:
- Identifying code duplication and opportunities for DRY
- Reducing cyclomatic complexity (threshold: ${this.cqConfig.complexityThreshold})
- Improving code structure and organization
- Applying design patterns appropriately
- Ensuring refactorings maintain behavior

Follow established refactoring patterns:
- Extract Method/Variable for clarity
- Rename for expressiveness
- Move for better cohesion
- Inline for simplicity`,
        { capabilities: [TeamCapability.REFACTORING, TeamCapability.CODE_GENERATION], tools: ['read', 'write', 'edit', 'analyze'] },
      ),

      createRole(
        'Tech Debt Tracker',
        'Tracks and prioritizes technical debt across the codebase',
        `You are a Tech Debt Tracker responsible for:
- Identifying and cataloging technical debt
- Estimating remediation effort (threshold: ${this.cqConfig.techDebtThreshold}h)
- Prioritizing debt based on interest rate and impact
- Creating remediation plans
- Tracking debt reduction over time

Categories to track:
- Code quality debt (complexity, duplication)
- Architecture debt (poor design decisions)
- Testing debt (insufficient coverage)
- Documentation debt (missing/outdated docs)
- Dependency debt (outdated/vulnerable packages)`,
        { capabilities: [TeamCapability.CODE_REVIEW, TeamCapability.DOCUMENTATION], tools: ['read', 'analyze', 'write'] },
      ),

      createRole(
        'Security Analyst',
        'Analyzes code for security vulnerabilities',
        `You are a Security Analyst responsible for:
- Scanning code for security vulnerabilities
- Identifying OWASP Top 10 issues
- Checking for hardcoded secrets and credentials
- Analyzing authentication and authorization patterns
- Reviewing input validation and sanitization

Use security scanners: ${this.cqConfig.securityScanners.join(', ')}.
Report findings with severity levels and remediation guidance.
Consider both application code and dependencies.`,
        { capabilities: [TeamCapability.SECURITY_ANALYSIS], tools: ['read', 'analyze', 'shell'] },
      ),

      createRole(
        'Performance Analyst',
        'Analyzes code for performance issues and optimizations',
        `You are a Performance Analyst responsible for:
- Identifying performance bottlenecks
- Analyzing algorithmic complexity
- Detecting memory leaks and inefficient patterns
- Profiling critical code paths
- Suggesting optimizations

Focus on:
- Time complexity improvements
- Memory usage optimization
- I/O efficiency
- Caching opportunities
- Lazy loading patterns`,
        { capabilities: [TeamCapability.CODE_REVIEW, TeamCapability.DEBUGGING], tools: ['read', 'analyze', 'shell'] },
      ),
    ];
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  protected async processTask(task: TaskDocument): Promise<TaskResult> {
    const startTime = Date.now();
    const taskType = this.determineTaskType(task);

    try {
      let result: CodeReviewResult | RefactoringResult | SecurityScanResult | TechDebtItem[];

      switch (taskType) {
        case 'code-review':
          result = await this.processCodeReviewTask(task);
          break;
        case 'refactoring':
          result = await this.processRefactoringTask(task);
          break;
        case 'tech-debt':
          result = await this.processTechDebtTask(task);
          break;
        case 'security-scan':
          result = await this.processSecurityScanTask(task);
          break;
        case 'complexity-analysis':
          result = await this.processComplexityAnalysisTask(task);
          break;
        case 'style-check':
          result = await this.processStyleCheckTask(task);
          break;
        case 'performance-analysis':
          result = await this.processPerformanceAnalysisTask(task);
          break;
        default:
          result = await this.processGenericQualityTask(task);
      }

      const duration = Date.now() - startTime;
      this.cqStats.reviewsCompleted++;

      return {
        taskId: task.id,
        success: true,
        outputs: {
          result,
          taskType,
          duration,
        },
        subtasks: [],
        artifacts: this.createReviewArtifacts(result, taskType),
        duration,
        tokensUsed: 0,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        outputs: {},
        subtasks: [],
        artifacts: [],
        duration: Date.now() - startTime,
        tokensUsed: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  protected determineTaskType(task: TaskDocument): string {
    const title = task.title.toLowerCase();
    const description = task.description.toLowerCase();
    const combined = `${title} ${description}`;

    // Check more specific patterns first before generic ones
    if (combined.includes('tech debt') || combined.includes('technical debt')) return 'tech-debt';
    if (combined.includes('security') || combined.includes('vulnerability')) return 'security-scan';
    if (combined.includes('complexity') || combined.includes('cyclomatic')) return 'complexity-analysis';
    if (combined.includes('performance') || combined.includes('optimize')) return 'performance-analysis';
    if (combined.includes('style') || combined.includes('lint') || combined.includes('format')) return 'style-check';
    if (combined.includes('refactor')) return 'refactoring';
    // Check code-review last as 'review' is a common word
    if (combined.includes('review') || combined.includes('pr ') || combined.includes('pull request')) return 'code-review';

    return 'generic';
  }

  // ============================================================================
  // Task Type Processors
  // ============================================================================

  protected async processCodeReviewTask(task: TaskDocument): Promise<CodeReviewResult> {
    const issues = this.analyzeCodeIssues(task);
    const suggestions = this.generateSuggestions(task);
    const filesReviewed = this.extractFilesFromTask(task);
    const score = this.calculateQualityScore(issues);

    this.cqStats.issuesFound += issues.length;
    this.cqStats.totalFilesReviewed += filesReviewed.length;
    this.updateAverageScore(score);

    return {
      score,
      passed: score >= this.getPassThreshold(),
      issues,
      suggestions,
      filesReviewed,
      duration: 0,
    };
  }

  protected async processRefactoringTask(task: TaskDocument): Promise<RefactoringResult> {
    const refactorings = this.identifyRefactorings(task);
    const filesModified = refactorings.map(r => r.file);
    const uniqueFiles = [...new Set(filesModified)];

    this.cqStats.refactoringsApplied += refactorings.length;

    return {
      refactorings,
      filesModified: uniqueFiles,
      linesChanged: refactorings.reduce((sum, r) => sum + (r.linesAffected[1] - r.linesAffected[0] + 1), 0),
      improvements: {
        complexityReduction: this.estimateComplexityReduction(refactorings),
        duplicationsRemoved: refactorings.filter(r => r.type === 'extract-method').length,
        readabilityScore: 85,
      },
    };
  }

  protected async processTechDebtTask(task: TaskDocument): Promise<TechDebtItem[]> {
    const items = this.identifyTechDebt(task);
    this.cqStats.techDebtItems += items.length;
    return items;
  }

  protected async processSecurityScanTask(task: TaskDocument): Promise<SecurityScanResult> {
    const vulnerabilities = this.identifyVulnerabilities(task);
    const riskLevel = this.calculateRiskLevel(vulnerabilities);

    this.cqStats.securityVulnerabilities += vulnerabilities.length;

    return {
      riskLevel,
      vulnerabilities,
      recommendations: this.generateSecurityRecommendations(vulnerabilities),
      compliance: {
        owasp: vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
        cwe: vulnerabilities.filter(v => v.severity === 'critical').length === 0,
      },
    };
  }

  protected async processComplexityAnalysisTask(task: TaskDocument): Promise<CodeReviewResult> {
    const issues = this.analyzeComplexity(task);
    const suggestions = this.generateComplexitySuggestions(issues);
    const filesReviewed = this.extractFilesFromTask(task);
    const score = this.calculateQualityScore(issues);

    return {
      score,
      passed: score >= this.getPassThreshold(),
      issues,
      suggestions,
      filesReviewed,
      duration: 0,
    };
  }

  protected async processStyleCheckTask(task: TaskDocument): Promise<CodeReviewResult> {
    const issues = this.analyzeStyle(task);
    const suggestions = this.generateStyleSuggestions(issues);
    const filesReviewed = this.extractFilesFromTask(task);
    const score = 100 - (issues.length * 2);

    return {
      score: Math.max(0, score),
      passed: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      issues,
      suggestions,
      filesReviewed,
      duration: 0,
    };
  }

  protected async processPerformanceAnalysisTask(task: TaskDocument): Promise<CodeReviewResult> {
    const issues = this.analyzePerformance(task);
    const suggestions = this.generatePerformanceSuggestions(issues);
    const filesReviewed = this.extractFilesFromTask(task);
    const score = this.calculateQualityScore(issues);

    return {
      score,
      passed: score >= this.getPassThreshold(),
      issues,
      suggestions,
      filesReviewed,
      duration: 0,
    };
  }

  protected async processGenericQualityTask(task: TaskDocument): Promise<CodeReviewResult> {
    // Combine all analysis types
    const codeIssues = this.analyzeCodeIssues(task);
    const styleIssues = this.analyzeStyle(task);
    const complexityIssues = this.analyzeComplexity(task);

    const allIssues = [...codeIssues, ...styleIssues, ...complexityIssues];
    const suggestions = this.generateSuggestions(task);
    const filesReviewed = this.extractFilesFromTask(task);
    const score = this.calculateQualityScore(allIssues);

    return {
      score,
      passed: score >= this.getPassThreshold(),
      issues: allIssues,
      suggestions,
      filesReviewed,
      duration: 0,
    };
  }

  // ============================================================================
  // Analysis Methods
  // ============================================================================

  protected analyzeCodeIssues(task: TaskDocument): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const description = task.description.toLowerCase();

    // Simulate code analysis based on task context
    if (description.includes('bug') || description.includes('error')) {
      issues.push({
        id: uuidv4(),
        severity: 'high',
        type: 'bug',
        title: 'Potential bug detected',
        description: 'Code analysis indicates potential bug patterns',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'no-unsafe-patterns',
      });
    }

    if (description.includes('null') || description.includes('undefined')) {
      issues.push({
        id: uuidv4(),
        severity: 'medium',
        type: 'bug',
        title: 'Null/undefined handling issue',
        description: 'Missing null checks or unsafe access patterns detected',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'strict-null-checks',
      });
    }

    // Default issues for review tasks
    if (issues.length === 0) {
      issues.push({
        id: uuidv4(),
        severity: 'info',
        type: 'maintainability',
        title: 'Code review completed',
        description: 'No critical issues found, minor improvements suggested',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
      });
    }

    return issues;
  }

  protected analyzeComplexity(task: TaskDocument): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const description = task.description.toLowerCase();

    if (description.includes('complex') || description.includes('nested')) {
      issues.push({
        id: uuidv4(),
        severity: 'medium',
        type: 'complexity',
        title: 'High cyclomatic complexity',
        description: `Function exceeds complexity threshold of ${this.cqConfig.complexityThreshold}`,
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'max-complexity',
        fix: 'Consider extracting logic into smaller functions',
      });
    }

    if (description.includes('long') || description.includes('large')) {
      issues.push({
        id: uuidv4(),
        severity: 'low',
        type: 'maintainability',
        title: 'Long function/file',
        description: 'Function or file exceeds recommended length',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'max-lines',
        fix: 'Consider splitting into smaller modules',
      });
    }

    return issues;
  }

  protected analyzeStyle(task: TaskDocument): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const description = task.description.toLowerCase();

    if (description.includes('format') || description.includes('style')) {
      issues.push({
        id: uuidv4(),
        severity: 'low',
        type: 'style',
        title: 'Code style inconsistency',
        description: 'Code formatting does not match project standards',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'prettier/prettier',
        fix: 'Run formatter to fix style issues',
      });
    }

    if (description.includes('naming') || description.includes('convention')) {
      issues.push({
        id: uuidv4(),
        severity: 'low',
        type: 'style',
        title: 'Naming convention violation',
        description: 'Variable/function names do not follow conventions',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'naming-convention',
      });
    }

    return issues;
  }

  protected analyzePerformance(task: TaskDocument): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const description = task.description.toLowerCase();

    if (description.includes('slow') || description.includes('performance')) {
      issues.push({
        id: uuidv4(),
        severity: 'medium',
        type: 'performance',
        title: 'Performance bottleneck detected',
        description: 'Inefficient algorithm or pattern identified',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'no-inefficient-patterns',
        fix: 'Consider algorithm optimization or caching',
      });
    }

    if (description.includes('loop') || description.includes('iteration')) {
      issues.push({
        id: uuidv4(),
        severity: 'low',
        type: 'performance',
        title: 'Loop optimization opportunity',
        description: 'Loop could be optimized for better performance',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'optimize-loops',
      });
    }

    if (description.includes('memory') || description.includes('leak')) {
      issues.push({
        id: uuidv4(),
        severity: 'high',
        type: 'performance',
        title: 'Potential memory leak',
        description: 'Resource not properly released or event listener not removed',
        file: this.extractFilesFromTask(task)[0] || 'unknown',
        rule: 'no-memory-leaks',
        fix: 'Ensure proper cleanup in useEffect/componentWillUnmount',
      });
    }

    return issues;
  }

  protected identifyRefactorings(task: TaskDocument): RefactoringAction[] {
    const refactorings: RefactoringAction[] = [];
    const description = task.description.toLowerCase();
    const file = this.extractFilesFromTask(task)[0] || 'unknown';

    if (description.includes('extract') || description.includes('duplicate')) {
      refactorings.push({
        id: uuidv4(),
        type: 'extract-method',
        description: 'Extract duplicated code into reusable method',
        before: '// Duplicated code block',
        after: '// Extracted method call',
        file,
        linesAffected: [10, 25],
      });
    }

    if (description.includes('rename') || description.includes('naming')) {
      refactorings.push({
        id: uuidv4(),
        type: 'rename',
        description: 'Rename for clarity and consistency',
        before: 'const x = ...',
        after: 'const descriptiveName = ...',
        file,
        linesAffected: [5, 5],
      });
    }

    if (description.includes('simplify') || description.includes('inline')) {
      refactorings.push({
        id: uuidv4(),
        type: 'inline',
        description: 'Inline unnecessary abstraction',
        before: 'function wrapper() { return innerFn(); }',
        after: 'innerFn()',
        file,
        linesAffected: [15, 20],
      });
    }

    // Default refactoring suggestion
    if (refactorings.length === 0) {
      refactorings.push({
        id: uuidv4(),
        type: 'extract-variable',
        description: 'Extract complex expression into named variable',
        before: 'if (a && b && c && d) { ... }',
        after: 'const isValid = a && b && c && d;\nif (isValid) { ... }',
        file,
        linesAffected: [1, 5],
      });
    }

    return refactorings;
  }

  protected identifyTechDebt(task: TaskDocument): TechDebtItem[] {
    const items: TechDebtItem[] = [];
    const description = task.description.toLowerCase();

    // Default tech debt items
    items.push({
      id: uuidv4(),
      category: 'code',
      severity: 'medium',
      title: 'Code complexity accumulation',
      description: 'Several areas have grown complex and need refactoring',
      affectedAreas: this.extractFilesFromTask(task),
      estimatedEffort: 8,
      interestRate: 'medium',
      createdAt: new Date(),
      remediationPlan: 'Schedule refactoring sprint to address complexity',
    });

    if (description.includes('test') || description.includes('coverage')) {
      items.push({
        id: uuidv4(),
        category: 'testing',
        severity: 'high',
        title: 'Insufficient test coverage',
        description: 'Critical paths lack adequate test coverage',
        affectedAreas: ['tests/'],
        estimatedEffort: 16,
        interestRate: 'high',
        createdAt: new Date(),
        remediationPlan: 'Add unit tests for critical business logic',
      });
    }

    if (description.includes('document') || description.includes('doc')) {
      items.push({
        id: uuidv4(),
        category: 'documentation',
        severity: 'low',
        title: 'Missing documentation',
        description: 'Public APIs lack proper documentation',
        affectedAreas: ['src/'],
        estimatedEffort: 4,
        interestRate: 'low',
        createdAt: new Date(),
        remediationPlan: 'Add JSDoc comments to public interfaces',
      });
    }

    if (description.includes('dependency') || description.includes('outdated')) {
      items.push({
        id: uuidv4(),
        category: 'dependency',
        severity: 'medium',
        title: 'Outdated dependencies',
        description: 'Several dependencies have major version updates available',
        affectedAreas: ['package.json'],
        estimatedEffort: 8,
        interestRate: 'medium',
        createdAt: new Date(),
        remediationPlan: 'Schedule dependency update sprint',
      });
    }

    return items;
  }

  protected identifyVulnerabilities(task: TaskDocument): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const description = task.description.toLowerCase();

    if (description.includes('sql') || description.includes('query')) {
      vulnerabilities.push({
        id: uuidv4(),
        severity: 'critical',
        type: 'injection',
        title: 'Potential SQL Injection',
        description: 'User input may be directly concatenated into SQL queries',
        affected: this.extractFilesFromTask(task)[0] || 'database queries',
        remediation: 'Use parameterized queries or ORM',
      });
    }

    if (description.includes('html') || description.includes('render')) {
      vulnerabilities.push({
        id: uuidv4(),
        severity: 'high',
        type: 'xss',
        title: 'Potential XSS Vulnerability',
        description: 'User input may be rendered without proper sanitization',
        affected: this.extractFilesFromTask(task)[0] || 'frontend components',
        remediation: 'Sanitize user input before rendering, use React/Vue auto-escaping',
      });
    }

    if (description.includes('auth') || description.includes('password')) {
      vulnerabilities.push({
        id: uuidv4(),
        severity: 'high',
        type: 'auth',
        title: 'Authentication concern',
        description: 'Authentication implementation should be reviewed',
        affected: this.extractFilesFromTask(task)[0] || 'auth module',
        remediation: 'Ensure secure password hashing, token management',
      });
    }

    if (description.includes('secret') || description.includes('key') || description.includes('token')) {
      vulnerabilities.push({
        id: uuidv4(),
        severity: 'critical',
        type: 'exposure',
        title: 'Potential secret exposure',
        description: 'Secrets may be hardcoded or improperly handled',
        affected: this.extractFilesFromTask(task)[0] || 'configuration',
        remediation: 'Use environment variables, secret management service',
      });
    }

    // Default security check result
    if (vulnerabilities.length === 0) {
      vulnerabilities.push({
        id: uuidv4(),
        severity: 'low',
        type: 'config',
        title: 'Security headers review',
        description: 'Review security headers configuration',
        affected: 'server configuration',
        remediation: 'Ensure CSP, HSTS, and other security headers are properly configured',
      });
    }

    return vulnerabilities;
  }

  // ============================================================================
  // Suggestion Generation
  // ============================================================================

  protected generateSuggestions(task: TaskDocument): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const description = task.description.toLowerCase();

    suggestions.push({
      id: uuidv4(),
      priority: 'medium',
      type: 'pattern',
      title: 'Consider design pattern',
      description: 'The current implementation could benefit from a well-known design pattern',
      file: this.extractFilesFromTask(task)[0],
      effort: 4,
    });

    if (description.includes('error') || description.includes('exception')) {
      suggestions.push({
        id: uuidv4(),
        priority: 'high',
        type: 'refactor',
        title: 'Improve error handling',
        description: 'Consider more granular error types and proper error propagation',
        effort: 2,
      });
    }

    if (description.includes('async') || description.includes('promise')) {
      suggestions.push({
        id: uuidv4(),
        priority: 'medium',
        type: 'optimization',
        title: 'Optimize async operations',
        description: 'Consider parallel execution with Promise.all where applicable',
        effort: 2,
      });
    }

    return suggestions;
  }

  protected generateComplexitySuggestions(issues: CodeIssue[]): CodeSuggestion[] {
    return issues
      .filter(i => i.type === 'complexity')
      .map(i => ({
        id: uuidv4(),
        priority: 'medium' as const,
        type: 'refactor' as const,
        title: `Reduce complexity in ${i.file}`,
        description: 'Extract methods to reduce cyclomatic complexity',
        file: i.file,
        effort: 4,
      }));
  }

  protected generateStyleSuggestions(issues: CodeIssue[]): CodeSuggestion[] {
    if (issues.length === 0) return [];

    return [{
      id: uuidv4(),
      priority: 'low',
      type: 'pattern',
      title: 'Apply consistent code style',
      description: 'Run automated formatter and fix linting issues',
      effort: 1,
      example: 'npx prettier --write . && npx eslint --fix .',
    }];
  }

  protected generatePerformanceSuggestions(issues: CodeIssue[]): CodeSuggestion[] {
    return issues
      .filter(i => i.type === 'performance')
      .map(i => ({
        id: uuidv4(),
        priority: i.severity === 'high' ? 'high' as const : 'medium' as const,
        type: 'optimization' as const,
        title: `Optimize ${i.title.toLowerCase()}`,
        description: i.fix || 'Consider performance optimization',
        file: i.file,
        effort: 4,
      }));
  }

  protected generateSecurityRecommendations(vulnerabilities: SecurityVulnerability[]): string[] {
    const recommendations: string[] = [];
    const seen = new Map<string, boolean>();

    for (const v of vulnerabilities) {
      if (!seen.get(v.remediation)) {
        recommendations.push(v.remediation);
        seen.set(v.remediation, true);
      }
    }

    // Add general recommendations
    const generalRecommendations = [
      'Keep dependencies up to date',
      'Implement security headers (CSP, HSTS, X-Frame-Options)',
      'Use HTTPS for all communications',
      'Implement rate limiting for APIs',
    ];

    for (const rec of generalRecommendations) {
      if (!seen.get(rec)) {
        recommendations.push(rec);
      }
    }

    return recommendations;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  protected extractFilesFromTask(task: TaskDocument): string[] {
    const files: string[] = [];
    const inputs = task.inputs as Record<string, unknown>;

    if (inputs.files && Array.isArray(inputs.files)) {
      files.push(...(inputs.files as string[]));
    }

    if (inputs.file && typeof inputs.file === 'string') {
      files.push(inputs.file);
    }

    // Extract from description
    const fileMatches = task.description.match(/[\w\-./]+\.(ts|js|tsx|jsx|py|java|go|rs|rb)/g);
    if (fileMatches) {
      files.push(...fileMatches);
    }

    return files.length > 0 ? files : ['src/'];
  }

  protected calculateQualityScore(issues: CodeIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  protected getPassThreshold(): number {
    switch (this.cqConfig.reviewStrictness) {
      case 'strict':
        return 90;
      case 'lenient':
        return 60;
      default:
        return 75;
    }
  }

  protected calculateRiskLevel(vulnerabilities: SecurityVulnerability[]): SecurityScanResult['riskLevel'] {
    const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
    const high = vulnerabilities.filter(v => v.severity === 'high').length;
    const medium = vulnerabilities.filter(v => v.severity === 'medium').length;

    if (critical > 0) return 'critical';
    if (high > 0) return 'high';
    if (medium > 0) return 'medium';
    if (vulnerabilities.length > 0) return 'low';
    return 'none';
  }

  protected estimateComplexityReduction(refactorings: RefactoringAction[]): number {
    return refactorings.reduce((reduction, r) => {
      switch (r.type) {
        case 'extract-method':
          return reduction + 3;
        case 'extract-variable':
          return reduction + 1;
        case 'inline':
          return reduction + 2;
        default:
          return reduction + 1;
      }
    }, 0);
  }

  protected updateAverageScore(score: number): void {
    const total = this.cqStats.reviewsCompleted;
    if (total === 0) {
      this.cqStats.averageScore = score;
    } else {
      this.cqStats.averageScore =
        (this.cqStats.averageScore * total + score) / (total + 1);
    }
  }

  protected createReviewArtifacts(
    result: CodeReviewResult | RefactoringResult | SecurityScanResult | TechDebtItem[],
    taskType: string
  ): TaskArtifact[] {
    const content = JSON.stringify(result, null, 2);

    return [{
      id: uuidv4(),
      type: 'report' as const,
      name: `${taskType}-report.json`,
      path: `reports/${taskType}-${Date.now()}.json`,
      content,
      mimeType: 'application/json',
      size: Buffer.byteLength(content, 'utf-8'),
      createdAt: new Date(),
    }];
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  getCodeQualityStats(): typeof this.cqStats {
    return { ...this.cqStats };
  }

  getLinters(): string[] {
    return [...this.cqConfig.linters];
  }

  getSecurityScanners(): string[] {
    return [...this.cqConfig.securityScanners];
  }

  getComplexityThreshold(): number {
    return this.cqConfig.complexityThreshold;
  }

  getReviewStrictness(): string {
    return this.cqConfig.reviewStrictness;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Code Quality team
 */
export function createCodeQualityTeam(config: CodeQualityTeamConfig = {}): CodeQualityTeam {
  return new CodeQualityTeam(config);
}

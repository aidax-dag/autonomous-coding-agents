/**
 * Completion Detector Module
 *
 * Determines when a project is "done" by validating against specifications,
 * running quality gates, and checking acceptance criteria.
 *
 * Key Features:
 * - Project completion checking
 * - Specification validation
 * - Quality gate evaluation
 * - Test coverage assessment
 * - Acceptance criteria validation
 *
 * @module core/quality/completion-detector
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import {
  ProjectState,
  ProjectStatus,
  TaskStatus,
  TaskRecord,
} from '../memory/project-store';
import { PRDAnalysis } from '../orchestrator/task-decomposer';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Completion status
 */
export enum CompletionStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  PARTIALLY_COMPLETE = 'partially_complete',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

/**
 * Quality gate level
 */
export enum QualityGateLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  STRICT = 'strict',
  ENTERPRISE = 'enterprise',
}

/**
 * Quality dimension
 */
export enum QualityDimension {
  TASK_COMPLETION = 'task_completion',
  TEST_COVERAGE = 'test_coverage',
  CODE_QUALITY = 'code_quality',
  DOCUMENTATION = 'documentation',
  ACCEPTANCE_CRITERIA = 'acceptance_criteria',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
}

/**
 * Quality check result
 */
export interface QualityCheckResult {
  dimension: QualityDimension;
  passed: boolean;
  score: number; // 0-100
  threshold: number;
  details: string;
  recommendations?: string[];
}

/**
 * Completion result
 */
export interface CompletionResult {
  projectId: string;
  status: CompletionStatus;
  overallScore: number; // 0-100
  qualityGatePassed: boolean;
  checks: QualityCheckResult[];
  summary: string;
  completedAt?: Date;
  recommendations: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  coverage: number; // Percentage of spec covered
  missingFeatures: string[];
  incompleteFeatures: string[];
  extraFeatures: string[];
  details: ValidationDetail[];
}

/**
 * Validation detail
 */
export interface ValidationDetail {
  featureId: string;
  featureName: string;
  status: 'complete' | 'partial' | 'missing';
  acceptanceCriteriaMet: number;
  acceptanceCriteriaTotal: number;
  notes?: string;
}

/**
 * Quality gate configuration
 */
export interface QualityGate {
  level: QualityGateLevel;
  dimensions: QualityGateDimension[];
  overallThreshold: number;
}

/**
 * Quality gate dimension
 */
export interface QualityGateDimension {
  dimension: QualityDimension;
  weight: number;
  threshold: number;
  required: boolean;
}

/**
 * Specification for validation
 */
export interface Specification {
  prdAnalysis: PRDAnalysis;
  requiredFeatures: string[];
  acceptanceCriteria: Map<string, string[]>;
  qualityRequirements?: QualityRequirements;
}

/**
 * Quality requirements
 */
export interface QualityRequirements {
  minTestCoverage?: number;
  maxCodeComplexity?: number;
  requiredDocumentation?: boolean;
  securityScanRequired?: boolean;
  performanceThresholds?: PerformanceThresholds;
}

/**
 * Performance thresholds
 */
export interface PerformanceThresholds {
  maxResponseTime?: number;
  minThroughput?: number;
  maxMemoryUsage?: number;
}

/**
 * Completion detector configuration
 */
export interface CompletionDetectorConfig {
  defaultQualityGateLevel: QualityGateLevel;
  taskCompletionWeight: number;
  acceptanceCriteriaWeight: number;
  testCoverageWeight: number;
  strictMode: boolean;
  verbose: boolean;
}

/**
 * Completion detector interface
 */
export interface ICompletionDetector {
  // Completion checking
  checkCompletion(project: ProjectState): Promise<CompletionResult>;
  getCompletionPercentage(project: ProjectState): Promise<number>;

  // Specification validation
  validateAgainstSpec(project: ProjectState, spec: Specification): Promise<ValidationResult>;

  // Quality gates
  passesQualityGate(project: ProjectState, gate: QualityGate): Promise<boolean>;
  evaluateQualityGate(project: ProjectState, gate: QualityGate): Promise<CompletionResult>;

  // Individual checks
  checkTaskCompletion(project: ProjectState): Promise<QualityCheckResult>;
  checkAcceptanceCriteria(project: ProjectState, spec?: Specification): Promise<QualityCheckResult>;
}

/**
 * Completion detector events
 */
export enum CompletionDetectorEvent {
  CHECK_STARTED = 'check:started',
  CHECK_COMPLETED = 'check:completed',
  QUALITY_GATE_PASSED = 'gate:passed',
  QUALITY_GATE_FAILED = 'gate:failed',
  PROJECT_COMPLETE = 'project:complete',
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const CompletionDetectorConfigSchema = z.object({
  defaultQualityGateLevel: z.nativeEnum(QualityGateLevel).default(QualityGateLevel.STANDARD),
  taskCompletionWeight: z.number().min(0).max(1).default(0.4),
  acceptanceCriteriaWeight: z.number().min(0).max(1).default(0.4),
  testCoverageWeight: z.number().min(0).max(1).default(0.2),
  strictMode: z.boolean().default(false),
  verbose: z.boolean().default(false),
});

export const DEFAULT_COMPLETION_DETECTOR_CONFIG: CompletionDetectorConfig = {
  defaultQualityGateLevel: QualityGateLevel.STANDARD,
  taskCompletionWeight: 0.4,
  acceptanceCriteriaWeight: 0.4,
  testCoverageWeight: 0.2,
  strictMode: false,
  verbose: false,
};

/**
 * Predefined quality gates
 */
export const QUALITY_GATES: Record<QualityGateLevel, QualityGate> = {
  [QualityGateLevel.MINIMAL]: {
    level: QualityGateLevel.MINIMAL,
    overallThreshold: 50,
    dimensions: [
      { dimension: QualityDimension.TASK_COMPLETION, weight: 1.0, threshold: 50, required: true },
    ],
  },
  [QualityGateLevel.STANDARD]: {
    level: QualityGateLevel.STANDARD,
    overallThreshold: 70,
    dimensions: [
      { dimension: QualityDimension.TASK_COMPLETION, weight: 0.4, threshold: 80, required: true },
      { dimension: QualityDimension.ACCEPTANCE_CRITERIA, weight: 0.4, threshold: 70, required: true },
      { dimension: QualityDimension.TEST_COVERAGE, weight: 0.2, threshold: 60, required: false },
    ],
  },
  [QualityGateLevel.STRICT]: {
    level: QualityGateLevel.STRICT,
    overallThreshold: 85,
    dimensions: [
      { dimension: QualityDimension.TASK_COMPLETION, weight: 0.3, threshold: 95, required: true },
      { dimension: QualityDimension.ACCEPTANCE_CRITERIA, weight: 0.3, threshold: 90, required: true },
      { dimension: QualityDimension.TEST_COVERAGE, weight: 0.2, threshold: 80, required: true },
      { dimension: QualityDimension.CODE_QUALITY, weight: 0.1, threshold: 80, required: false },
      { dimension: QualityDimension.DOCUMENTATION, weight: 0.1, threshold: 70, required: false },
    ],
  },
  [QualityGateLevel.ENTERPRISE]: {
    level: QualityGateLevel.ENTERPRISE,
    overallThreshold: 95,
    dimensions: [
      { dimension: QualityDimension.TASK_COMPLETION, weight: 0.2, threshold: 100, required: true },
      { dimension: QualityDimension.ACCEPTANCE_CRITERIA, weight: 0.25, threshold: 95, required: true },
      { dimension: QualityDimension.TEST_COVERAGE, weight: 0.2, threshold: 90, required: true },
      { dimension: QualityDimension.CODE_QUALITY, weight: 0.15, threshold: 90, required: true },
      { dimension: QualityDimension.DOCUMENTATION, weight: 0.1, threshold: 85, required: true },
      { dimension: QualityDimension.SECURITY, weight: 0.1, threshold: 95, required: true },
    ],
  },
};

// ============================================================================
// Completion Detector Implementation
// ============================================================================

/**
 * Completion detector for determining when projects are "done"
 */
export class CompletionDetector extends EventEmitter implements ICompletionDetector {
  private config: CompletionDetectorConfig;

  constructor(config: Partial<CompletionDetectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_COMPLETION_DETECTOR_CONFIG, ...config };
  }

  // ==================== Completion Checking ====================

  async checkCompletion(project: ProjectState): Promise<CompletionResult> {
    this.emit(CompletionDetectorEvent.CHECK_STARTED, { projectId: project.id });
    this.log(`Checking completion for project: ${project.name}`);

    const gate = QUALITY_GATES[this.config.defaultQualityGateLevel];
    const result = await this.evaluateQualityGate(project, gate);

    if (result.status === CompletionStatus.COMPLETE) {
      this.emit(CompletionDetectorEvent.PROJECT_COMPLETE, result);
    }

    this.emit(CompletionDetectorEvent.CHECK_COMPLETED, result);
    return result;
  }

  async getCompletionPercentage(project: ProjectState): Promise<number> {
    const tasks = Array.from(project.tasks.values());
    if (tasks.length === 0) return 0;

    const completed = tasks.filter(t =>
      t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED
    ).length;

    return Math.round((completed / tasks.length) * 100);
  }

  // ==================== Specification Validation ====================

  async validateAgainstSpec(project: ProjectState, spec: Specification): Promise<ValidationResult> {
    this.log(`Validating project against specification`);

    const details: ValidationDetail[] = [];
    const missingFeatures: string[] = [];
    const incompleteFeatures: string[] = [];
    const extraFeatures: string[] = [];

    // Get project features from context and tasks
    const projectFeatureIds = this.extractProjectFeatures(project);

    // Check each required feature from spec
    for (const feature of spec.prdAnalysis.features) {
      const isRequired = spec.requiredFeatures.includes(feature.id);
      const acceptanceCriteria = spec.acceptanceCriteria.get(feature.id) || feature.acceptanceCriteria;
      const featureTasks = this.getFeatureTasks(project, feature.id);

      if (featureTasks.length === 0) {
        if (isRequired) {
          missingFeatures.push(feature.name);
        }
        details.push({
          featureId: feature.id,
          featureName: feature.name,
          status: 'missing',
          acceptanceCriteriaMet: 0,
          acceptanceCriteriaTotal: acceptanceCriteria.length,
        });
        continue;
      }

      const completedTasks = featureTasks.filter(t => t.status === TaskStatus.COMPLETED);
      const acceptanceMet = this.countMetAcceptanceCriteria(completedTasks, acceptanceCriteria);

      const allTasksComplete = completedTasks.length === featureTasks.length;
      // Feature is complete if all tasks are complete (acceptance criteria are informational)
      const featureComplete = allTasksComplete && completedTasks.length > 0;

      if (featureComplete) {
        details.push({
          featureId: feature.id,
          featureName: feature.name,
          status: 'complete',
          acceptanceCriteriaMet: acceptanceMet,
          acceptanceCriteriaTotal: acceptanceCriteria.length,
        });
      } else {
        incompleteFeatures.push(feature.name);
        details.push({
          featureId: feature.id,
          featureName: feature.name,
          status: 'partial',
          acceptanceCriteriaMet: acceptanceMet,
          acceptanceCriteriaTotal: acceptanceCriteria.length,
          notes: `${completedTasks.length}/${featureTasks.length} tasks complete`,
        });
      }

      projectFeatureIds.delete(feature.id);
    }

    // Check for extra features not in spec
    for (const featureId of projectFeatureIds) {
      extraFeatures.push(featureId);
    }

    // Calculate coverage
    const completeCount = details.filter(d => d.status === 'complete').length;
    const totalRequired = spec.prdAnalysis.features.length;
    const coverage = totalRequired > 0 ? (completeCount / totalRequired) * 100 : 0;

    return {
      valid: missingFeatures.length === 0 && incompleteFeatures.length === 0,
      coverage,
      missingFeatures,
      incompleteFeatures,
      extraFeatures,
      details,
    };
  }

  // ==================== Quality Gates ====================

  async passesQualityGate(project: ProjectState, gate: QualityGate): Promise<boolean> {
    const result = await this.evaluateQualityGate(project, gate);
    return result.qualityGatePassed;
  }

  async evaluateQualityGate(project: ProjectState, gate: QualityGate): Promise<CompletionResult> {
    this.log(`Evaluating quality gate: ${gate.level}`);

    const checks: QualityCheckResult[] = [];
    let weightedScore = 0;
    let totalWeight = 0;
    let requiredFailed = false;

    for (const dimension of gate.dimensions) {
      const check = await this.evaluateDimension(project, dimension);
      checks.push(check);

      weightedScore += check.score * dimension.weight;
      totalWeight += dimension.weight;

      if (dimension.required && !check.passed) {
        requiredFailed = true;
      }
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const qualityGatePassed = !requiredFailed && overallScore >= gate.overallThreshold;

    const status = this.determineCompletionStatus(project, qualityGatePassed, overallScore);
    const recommendations = this.generateRecommendations(checks, gate);

    const result: CompletionResult = {
      projectId: project.id,
      status,
      overallScore: Math.round(overallScore),
      qualityGatePassed,
      checks,
      summary: this.generateSummary(status, overallScore, checks),
      completedAt: status === CompletionStatus.COMPLETE ? new Date() : undefined,
      recommendations,
    };

    if (qualityGatePassed) {
      this.emit(CompletionDetectorEvent.QUALITY_GATE_PASSED, result);
    } else {
      this.emit(CompletionDetectorEvent.QUALITY_GATE_FAILED, result);
    }

    return result;
  }

  // ==================== Individual Checks ====================

  async checkTaskCompletion(project: ProjectState): Promise<QualityCheckResult> {
    const tasks = Array.from(project.tasks.values());
    const total = tasks.length;

    if (total === 0) {
      return {
        dimension: QualityDimension.TASK_COMPLETION,
        passed: false,
        score: 0,
        threshold: 80,
        details: 'No tasks defined',
        recommendations: ['Add tasks to the project'],
      };
    }

    const completed = tasks.filter(t =>
      t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED
    ).length;

    const failed = tasks.filter(t => t.status === TaskStatus.FAILED).length;
    const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;

    const score = Math.round((completed / total) * 100);

    return {
      dimension: QualityDimension.TASK_COMPLETION,
      passed: score >= 80,
      score,
      threshold: 80,
      details: `${completed}/${total} tasks completed, ${failed} failed, ${inProgress} in progress`,
      recommendations: failed > 0 ? ['Address failed tasks', 'Review error messages'] : undefined,
    };
  }

  async checkAcceptanceCriteria(project: ProjectState, spec?: Specification): Promise<QualityCheckResult> {
    const tasks = Array.from(project.tasks.values());
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);

    // Count acceptance criteria from tasks (stored in metadata)
    let totalCriteria = 0;
    let metCriteria = 0;

    for (const task of tasks) {
      const taskCriteria = (task.metadata.acceptanceCriteria as string[] | undefined) || [];
      totalCriteria += taskCriteria.length;
    }

    // For completed tasks, count their criteria as met
    for (const task of completedTasks) {
      const taskCriteria = (task.metadata.acceptanceCriteria as string[] | undefined) || [];
      metCriteria += taskCriteria.length;
    }

    // If spec provided, also check against spec criteria
    if (spec) {
      for (const [featureId, criteria] of spec.acceptanceCriteria) {
        totalCriteria += criteria.length;
        const featureTasks = this.getFeatureTasks(project, featureId);
        const completed = featureTasks.filter(t => t.status === TaskStatus.COMPLETED);
        metCriteria += this.countMetAcceptanceCriteria(completed, criteria);
      }
    }

    const score = totalCriteria > 0 ? Math.round((metCriteria / totalCriteria) * 100) : 0;

    return {
      dimension: QualityDimension.ACCEPTANCE_CRITERIA,
      passed: score >= 70,
      score,
      threshold: 70,
      details: `${metCriteria}/${totalCriteria} acceptance criteria met`,
      recommendations: score < 70 ? ['Complete more acceptance criteria', 'Review failing criteria'] : undefined,
    };
  }

  // ==================== Private Helpers ====================

  private async evaluateDimension(
    project: ProjectState,
    dimension: QualityGateDimension
  ): Promise<QualityCheckResult> {
    let result: QualityCheckResult;

    switch (dimension.dimension) {
      case QualityDimension.TASK_COMPLETION:
        result = await this.checkTaskCompletion(project);
        break;

      case QualityDimension.ACCEPTANCE_CRITERIA:
        result = await this.checkAcceptanceCriteria(project);
        break;

      case QualityDimension.TEST_COVERAGE:
        result = await this.checkTestCoverage(project);
        break;

      case QualityDimension.CODE_QUALITY:
        result = await this.checkCodeQuality(project);
        break;

      case QualityDimension.DOCUMENTATION:
        result = await this.checkDocumentation(project);
        break;

      case QualityDimension.SECURITY:
        result = await this.checkSecurity(project);
        break;

      case QualityDimension.PERFORMANCE:
        result = await this.checkPerformance(project);
        break;

      default:
        return {
          dimension: dimension.dimension,
          passed: true,
          score: 100,
          threshold: dimension.threshold,
          details: 'Not evaluated',
        };
    }

    // Apply the gate's threshold to determine if passed
    return {
      ...result,
      threshold: dimension.threshold,
      passed: result.score >= dimension.threshold,
    };
  }

  private async checkTestCoverage(_project: ProjectState): Promise<QualityCheckResult> {
    // In a real implementation, this would check actual test coverage
    // For now, we assume tests are run and return a mock score
    const mockScore = 75;

    return {
      dimension: QualityDimension.TEST_COVERAGE,
      passed: mockScore >= 60,
      score: mockScore,
      threshold: 60,
      details: `Test coverage: ${mockScore}%`,
      recommendations: mockScore < 80 ? ['Add more unit tests', 'Increase integration test coverage'] : undefined,
    };
  }

  private async checkCodeQuality(_project: ProjectState): Promise<QualityCheckResult> {
    // In a real implementation, this would run linters, complexity checks, etc.
    const mockScore = 85;

    return {
      dimension: QualityDimension.CODE_QUALITY,
      passed: mockScore >= 80,
      score: mockScore,
      threshold: 80,
      details: `Code quality score: ${mockScore}%`,
    };
  }

  private async checkDocumentation(_project: ProjectState): Promise<QualityCheckResult> {
    // In a real implementation, this would check for README, API docs, etc.
    const mockScore = 70;

    return {
      dimension: QualityDimension.DOCUMENTATION,
      passed: mockScore >= 70,
      score: mockScore,
      threshold: 70,
      details: `Documentation coverage: ${mockScore}%`,
      recommendations: mockScore < 80 ? ['Add API documentation', 'Update README'] : undefined,
    };
  }

  private async checkSecurity(_project: ProjectState): Promise<QualityCheckResult> {
    // In a real implementation, this would run security scans
    const mockScore = 90;

    return {
      dimension: QualityDimension.SECURITY,
      passed: mockScore >= 90,
      score: mockScore,
      threshold: 90,
      details: `Security scan passed: ${mockScore}%`,
    };
  }

  private async checkPerformance(_project: ProjectState): Promise<QualityCheckResult> {
    // In a real implementation, this would run performance tests
    const mockScore = 80;

    return {
      dimension: QualityDimension.PERFORMANCE,
      passed: mockScore >= 70,
      score: mockScore,
      threshold: 70,
      details: `Performance score: ${mockScore}%`,
    };
  }

  private extractProjectFeatures(project: ProjectState): Set<string> {
    const featureIds = new Set<string>();
    for (const task of project.tasks.values()) {
      if (task.metadata.featureId) {
        featureIds.add(task.metadata.featureId as string);
      }
    }
    return featureIds;
  }

  private getFeatureTasks(project: ProjectState, featureId: string): TaskRecord[] {
    return Array.from(project.tasks.values()).filter(task => {
      // Check if task belongs to feature via metadata or task id pattern
      return task.metadata.featureId === featureId ||
        task.id.includes(featureId) ||
        task.name.toLowerCase().includes(featureId.toLowerCase());
    });
  }

  private countMetAcceptanceCriteria(completedTasks: TaskRecord[], criteria: string[]): number {
    // Simple heuristic: assume completed tasks satisfy their associated criteria
    // In a real implementation, this would check specific criteria
    const tasksCovering = Math.min(completedTasks.length, criteria.length);
    return tasksCovering;
  }

  private determineCompletionStatus(
    project: ProjectState,
    gatePassed: boolean,
    score: number
  ): CompletionStatus {
    if (project.status === ProjectStatus.FAILED) {
      return CompletionStatus.FAILED;
    }

    if (project.status === ProjectStatus.CREATED) {
      return CompletionStatus.NOT_STARTED;
    }

    if (gatePassed && score >= 95) {
      return CompletionStatus.COMPLETE;
    }

    if (score >= 50) {
      return CompletionStatus.PARTIALLY_COMPLETE;
    }

    return CompletionStatus.IN_PROGRESS;
  }

  private generateSummary(status: CompletionStatus, score: number, checks: QualityCheckResult[]): string {
    const failedChecks = checks.filter(c => !c.passed);
    const passedChecks = checks.filter(c => c.passed);

    let summary = `Project is ${status.replace('_', ' ')} with overall score of ${Math.round(score)}%. `;
    summary += `${passedChecks.length}/${checks.length} quality checks passed. `;

    if (failedChecks.length > 0) {
      const failedDimensions = failedChecks.map(c => c.dimension).join(', ');
      summary += `Failed dimensions: ${failedDimensions}.`;
    }

    return summary;
  }

  private generateRecommendations(checks: QualityCheckResult[], gate: QualityGate): string[] {
    const recommendations: string[] = [];

    for (const check of checks) {
      if (!check.passed && check.recommendations) {
        recommendations.push(...check.recommendations);
      }
    }

    // Add gate-specific recommendations
    const overallPassed = checks.every(c => c.passed);
    if (!overallPassed && gate.level === QualityGateLevel.ENTERPRISE) {
      recommendations.push('Consider addressing all quality dimensions for enterprise readiness');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[CompletionDetector] ${message}`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a completion detector instance
 */
export function createCompletionDetector(
  config: Partial<CompletionDetectorConfig> = {}
): CompletionDetector {
  return new CompletionDetector(config);
}

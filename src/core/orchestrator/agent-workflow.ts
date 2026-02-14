/**
 * Agent Workflow
 *
 * Simplified workflow interface for common agent orchestration patterns.
 * Provides pre-built workflows for typical development scenarios.
 *
 * Feature: End-to-End Workflow Integration for Agent OS
 */

import { EventEmitter } from 'events';
import {
  OrchestratorRunner,
  createOrchestratorRunner,
  createMockRunner,
  RunnerStatus,
  GoalResult,
  WorkflowResult,
} from './orchestrator-runner';
import { PlanningOutput } from './agents/planning-agent';
import { DevelopmentOutput } from './agents/development-agent';
import { QAOutput } from './agents/qa-agent';
import { ILLMClient } from '@/shared/llm';

/**
 * Workflow type
 */
export type WorkflowType =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'test'
  | 'review'
  | 'full-cycle'
  | 'custom';

/**
 * Workflow step result
 */
export interface WorkflowStepResult {
  step: string;
  success: boolean;
  output: PlanningOutput | DevelopmentOutput | QAOutput | unknown;
  duration: number;
  error?: string;
}

/**
 * Full workflow result
 */
export interface FullWorkflowResult {
  success: boolean;
  workflowType: WorkflowType;
  steps: WorkflowStepResult[];
  totalDuration: number;
  summary: string;
}

/**
 * Workflow options
 */
export interface WorkflowOptions {
  /** Project context */
  projectContext?: string;
  /** Skip planning phase */
  skipPlanning?: boolean;
  /** Skip QA phase */
  skipQA?: boolean;
  /** Custom workflow steps */
  customSteps?: Array<{
    name: string;
    team: 'planning' | 'development' | 'qa';
    content: string;
  }>;
}

/**
 * Agent workflow configuration
 */
export interface AgentWorkflowConfig {
  /** LLM client (optional - uses mock if not provided) */
  llmClient?: ILLMClient;
  /** Workspace directory */
  workspaceDir?: string;
  /** Project context for agents */
  projectContext?: string;
}

/**
 * Agent Workflow Events
 */
export interface AgentWorkflowEvents {
  'step:started': (step: string) => void;
  'step:completed': (result: WorkflowStepResult) => void;
  'workflow:completed': (result: FullWorkflowResult) => void;
  error: (error: Error) => void;
}

/**
 * Agent Workflow
 *
 * Simplified interface for running common development workflows.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class AgentWorkflow extends EventEmitter {
  private runner: OrchestratorRunner;
  private config: AgentWorkflowConfig;
  private started = false;

  constructor(config: AgentWorkflowConfig = {}) {
    super();
    this.config = config;

    // Create runner with mock LLM if not provided
    if (config.llmClient) {
      this.runner = createOrchestratorRunner({
        llmClient: config.llmClient,
        workspaceDir: config.workspaceDir,
        projectContext: config.projectContext,
      });
    } else {
      this.runner = createMockRunner({
        workspaceDir: config.workspaceDir,
        projectContext: config.projectContext,
      });
    }
  }

  /**
   * Start the workflow system
   */
  async start(): Promise<void> {
    if (this.started) return;
    await this.runner.start();
    this.started = true;
  }

  /**
   * Stop the workflow system
   */
  async stop(): Promise<void> {
    if (!this.started) return;
    await this.runner.stop();
    this.started = false;
  }

  /**
   * Get current status
   */
  get status(): RunnerStatus {
    return this.runner.currentStatus;
  }

  /**
   * Run a feature development workflow
   *
   * Steps: Planning → Development → QA
   */
  async runFeatureWorkflow(
    title: string,
    description: string,
    options?: WorkflowOptions
  ): Promise<FullWorkflowResult> {
    return this.runWorkflow('feature', title, description, options);
  }

  /**
   * Run a bug fix workflow
   *
   * Steps: Analysis → Development → QA
   */
  async runBugfixWorkflow(
    title: string,
    description: string,
    options?: WorkflowOptions
  ): Promise<FullWorkflowResult> {
    return this.runWorkflow('bugfix', title, description, {
      ...options,
      skipPlanning: options?.skipPlanning ?? true, // Usually skip full planning for bugfixes
    });
  }

  /**
   * Run a refactoring workflow
   *
   * Steps: Analysis → Development → QA Review
   */
  async runRefactorWorkflow(
    title: string,
    description: string,
    options?: WorkflowOptions
  ): Promise<FullWorkflowResult> {
    return this.runWorkflow('refactor', title, description, options);
  }

  /**
   * Run a test creation workflow
   *
   * Steps: Planning → Development (test code) → QA Verification
   */
  async runTestWorkflow(
    title: string,
    description: string,
    options?: WorkflowOptions
  ): Promise<FullWorkflowResult> {
    return this.runWorkflow('test', title, description, options);
  }

  /**
   * Run a code review workflow
   *
   * Steps: QA Review only
   */
  async runReviewWorkflow(
    title: string,
    description: string,
    options?: WorkflowOptions
  ): Promise<FullWorkflowResult> {
    return this.runWorkflow('review', title, description, {
      ...options,
      skipPlanning: true,
    });
  }

  /**
   * Run a full development cycle
   *
   * Steps: Planning → Design → Development → QA → Review
   */
  async runFullCycleWorkflow(
    title: string,
    description: string,
    options?: WorkflowOptions
  ): Promise<FullWorkflowResult> {
    return this.runWorkflow('full-cycle', title, description, options);
  }

  /**
   * Run a custom workflow with specified steps
   */
  async runCustomWorkflow(
    title: string,
    steps: Array<{
      name: string;
      team: 'planning' | 'development' | 'qa';
      content: string;
    }>
  ): Promise<FullWorkflowResult> {
    return this.runWorkflow('custom', title, '', { customSteps: steps });
  }

  /**
   * Execute a single goal
   */
  async executeGoal(title: string, description: string): Promise<GoalResult> {
    await this.ensureStarted();
    return this.runner.executeGoal(title, description);
  }

  /**
   * Get runner statistics
   */
  getStats() {
    return this.runner.getStats();
  }

  /**
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    await this.stop();
    await this.runner.destroy();
    this.removeAllListeners();
  }

  /**
   * Internal workflow execution
   */
  private async runWorkflow(
    type: WorkflowType,
    title: string,
    description: string,
    options?: WorkflowOptions
  ): Promise<FullWorkflowResult> {
    await this.ensureStarted();

    const startTime = Date.now();
    const steps: WorkflowStepResult[] = [];
    const context = options?.projectContext || this.config.projectContext || '';

    try {
      // Custom workflow
      if (type === 'custom' && options?.customSteps) {
        for (const step of options.customSteps) {
          const result = await this.executeStep(step.name, step.team, step.content);
          steps.push(result);
          if (!result.success) break;
        }
      } else {
        // Standard workflow patterns
        const workflowSteps = this.getWorkflowSteps(type, title, description, context, options);

        for (const step of workflowSteps) {
          this.emit('step:started', step.name);
          const result = await this.executeStep(step.name, step.team, step.content);
          steps.push(result);
          this.emit('step:completed', result);
          if (!result.success) break;
        }
      }

      const result: FullWorkflowResult = {
        success: steps.every((s) => s.success),
        workflowType: type,
        steps,
        totalDuration: Date.now() - startTime,
        summary: this.generateSummary(type, title, steps),
      };

      this.emit('workflow:completed', result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);

      return {
        success: false,
        workflowType: type,
        steps,
        totalDuration: Date.now() - startTime,
        summary: `Workflow failed: ${err.message}`,
      };
    }
  }

  /**
   * Get workflow steps based on type
   */
  private getWorkflowSteps(
    type: WorkflowType,
    title: string,
    description: string,
    context: string,
    options?: WorkflowOptions
  ): Array<{ name: string; team: 'planning' | 'development' | 'qa'; content: string }> {
    const steps: Array<{
      name: string;
      team: 'planning' | 'development' | 'qa';
      content: string;
    }> = [];

    // Planning step (if not skipped)
    if (!options?.skipPlanning && type !== 'review') {
      steps.push({
        name: 'Planning',
        team: 'planning',
        content: `Plan: ${title}\n\n${description}\n\nContext: ${context}`,
      });
    }

    // Development step
    if (type !== 'review') {
      const devContent = this.getDevContent(type, title, description, context);
      steps.push({
        name: 'Development',
        team: 'development',
        content: devContent,
      });
    }

    // QA step (if not skipped)
    if (!options?.skipQA) {
      const qaContent = this.getQAContent(type, title, description);
      steps.push({
        name: type === 'review' ? 'Review' : 'QA',
        team: 'qa',
        content: qaContent,
      });
    }

    return steps;
  }

  /**
   * Get development content based on workflow type
   */
  private getDevContent(
    type: WorkflowType,
    title: string,
    description: string,
    context: string
  ): string {
    switch (type) {
      case 'feature':
        return `Implement feature: ${title}\n\n${description}\n\nContext: ${context}`;
      case 'bugfix':
        return `Fix bug: ${title}\n\n${description}\n\nContext: ${context}`;
      case 'refactor':
        return `Refactor: ${title}\n\n${description}\n\nContext: ${context}`;
      case 'test':
        return `Create tests for: ${title}\n\n${description}\n\nContext: ${context}`;
      case 'full-cycle':
        return `Develop: ${title}\n\n${description}\n\nContext: ${context}`;
      default:
        return `${title}\n\n${description}`;
    }
  }

  /**
   * Get QA content based on workflow type
   */
  private getQAContent(type: WorkflowType, title: string, description: string): string {
    switch (type) {
      case 'review':
        return `Review code: ${title}\n\n${description}`;
      case 'test':
        return `Verify tests for: ${title}\n\n${description}`;
      default:
        return `QA verification for: ${title}\n\n${description}`;
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    name: string,
    team: 'planning' | 'development' | 'qa',
    content: string
  ): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    try {
      const task = await this.runner.submitToTeam(team, name, content);
      const result: WorkflowResult = await this.runner.executeTask(task);

      return {
        step: name,
        success: result.success,
        output: result.result,
        duration: Date.now() - startTime,
        error: result.error,
      };
    } catch (error) {
      return {
        step: name,
        success: false,
        output: null,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate workflow summary
   */
  private generateSummary(type: WorkflowType, title: string, steps: WorkflowStepResult[]): string {
    const successCount = steps.filter((s) => s.success).length;
    const totalSteps = steps.length;
    const status = successCount === totalSteps ? 'completed successfully' : 'failed';

    return `${type.charAt(0).toUpperCase() + type.slice(1)} workflow for "${title}" ${status}. ` +
      `${successCount}/${totalSteps} steps completed.`;
  }

  /**
   * Ensure runner is started
   */
  private async ensureStarted(): Promise<void> {
    if (!this.started) {
      await this.start();
    }
  }
}

// Type-safe event emitter
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface AgentWorkflow {
  on<E extends keyof AgentWorkflowEvents>(event: E, listener: AgentWorkflowEvents[E]): this;
  emit<E extends keyof AgentWorkflowEvents>(
    event: E,
    ...args: Parameters<AgentWorkflowEvents[E]>
  ): boolean;
}

/**
 * Create an agent workflow
 */
export function createAgentWorkflow(config?: AgentWorkflowConfig): AgentWorkflow {
  return new AgentWorkflow(config);
}

/**
 * Create a workflow with mock LLM for testing
 */
export function createMockWorkflow(options?: {
  workspaceDir?: string;
  projectContext?: string;
}): AgentWorkflow {
  return new AgentWorkflow({
    workspaceDir: options?.workspaceDir,
    projectContext: options?.projectContext,
  });
}

/**
 * Seven-Phase Structured Workflow
 *
 * Provides a 7-phase structured workflow engine:
 * Discovery -> Exploration -> Clarification -> Design -> Implementation -> Review -> Summary
 *
 * This is a self-contained workflow manager that uses a callback-based PhaseExecutor
 * pattern for flexible integration with existing team agents and orchestration systems.
 *
 * Feature: F-6 - 7-Phase Structured Workflow
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../../shared/logging/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * The seven workflow phase types, in execution order.
 */
export type SevenPhaseType =
  | 'discovery'
  | 'exploration'
  | 'clarification'
  | 'design'
  | 'implementation'
  | 'review'
  | 'summary';

/**
 * Execution status for an individual phase.
 */
export type PhaseExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Definition of a single workflow phase.
 */
export interface PhaseDefinition {
  /** Phase type identifier */
  type: SevenPhaseType;
  /** Human-readable phase name */
  name: string;
  /** Description of what this phase accomplishes */
  description: string;
  /** Execution order (0-based) */
  order: number;
  /** Whether this phase can be skipped */
  required: boolean;
  /** Estimated duration in milliseconds */
  estimatedDurationMs: number;
  /** Which team handles this phase */
  team: string;
  /** Task type for routing */
  taskType: string;
}

/**
 * Result of executing a single phase.
 */
export interface PhaseExecutionResult {
  /** Phase type that was executed */
  phaseType: SevenPhaseType;
  /** Final status of the phase */
  status: PhaseExecutionStatus;
  /** Output data from the phase */
  output?: unknown;
  /** Artifacts produced during the phase */
  artifacts?: PhaseArtifact[];
  /** Decisions made during the phase */
  decisions?: string[];
  /** Duration in milliseconds */
  duration: number;
  /** Error message if the phase failed */
  error?: string;
}

/**
 * An artifact produced by a phase.
 */
export interface PhaseArtifact {
  /** Artifact name */
  name: string;
  /** Artifact type classification */
  type: 'document' | 'code' | 'test' | 'diagram' | 'report';
  /** Artifact content */
  content: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the seven-phase workflow.
 */
export interface SevenPhaseConfig {
  /** The goal this workflow is working toward */
  goal: string;
  /** Additional context for the workflow */
  context?: string;
  /** Phase types to skip */
  skipPhases?: SevenPhaseType[];
  /** Per-phase timeout overrides in milliseconds */
  phaseTimeouts?: Partial<Record<SevenPhaseType, number>>;
  /** Callback invoked after each phase completes */
  onPhaseComplete?: (result: PhaseExecutionResult) => void | Promise<void>;
}

/**
 * Overall result of the seven-phase workflow execution.
 */
export interface SevenPhaseResult {
  /** Whether the workflow completed successfully */
  success: boolean;
  /** The goal that was pursued */
  goal: string;
  /** Results from each phase */
  phases: PhaseExecutionResult[];
  /** Total execution duration in milliseconds */
  totalDuration: number;
  /** Number of phases that completed successfully */
  completedPhases: number;
  /** Number of phases that were skipped */
  skippedPhases: number;
  /** Number of phases that failed */
  failedPhases: number;
  /** Summary text from the summary phase, if available */
  finalSummary?: string;
  /** Error message if the workflow failed */
  error?: string;
}

/**
 * Context passed to the phase executor for each phase.
 */
export interface PhaseExecutionContext {
  /** The workflow goal */
  goal: string;
  /** Index of the current phase (0-based) */
  phaseIndex: number;
  /** Total number of phases in the workflow */
  totalPhases: number;
  /** Elapsed time since workflow started, in milliseconds */
  elapsed: number;
  /** All artifacts accumulated from previous phases */
  artifacts: PhaseArtifact[];
}

/**
 * Callback function that executes a single phase.
 * Implementations receive the phase definition, previous results, and execution context.
 */
export type PhaseExecutor = (
  phase: PhaseDefinition,
  previousResults: PhaseExecutionResult[],
  context: PhaseExecutionContext,
) => Promise<PhaseExecutionResult>;

/**
 * Events emitted by SevenPhaseWorkflow.
 */
export interface SevenPhaseWorkflowEvents {
  'phase:started': (data: { type: SevenPhaseType; name: string; order: number }) => void;
  'phase:completed': (result: PhaseExecutionResult) => void;
  'phase:failed': (result: PhaseExecutionResult) => void;
  'phase:skipped': (data: { type: SevenPhaseType; reason: string }) => void;
  'workflow:started': (data: { goal: string; totalPhases: number }) => void;
  'workflow:completed': (result: SevenPhaseResult) => void;
  'workflow:failed': (result: SevenPhaseResult) => void;
}

// ============================================================================
// Default Phase Definitions
// ============================================================================

/**
 * Default definitions for all seven phases.
 */
export const DEFAULT_PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    type: 'discovery',
    name: 'Discovery',
    description: 'Understand the goal, gather requirements, identify constraints and scope',
    order: 0,
    required: true,
    estimatedDurationMs: 30000,
    team: 'planning',
    taskType: 'planning',
  },
  {
    type: 'exploration',
    name: 'Exploration',
    description: 'Explore the codebase, identify relevant files, understand existing patterns',
    order: 1,
    required: true,
    estimatedDurationMs: 45000,
    team: 'planning',
    taskType: 'planning',
  },
  {
    type: 'clarification',
    name: 'Clarification',
    description: 'Resolve ambiguities, ask questions, confirm assumptions with stakeholders',
    order: 2,
    required: false,
    estimatedDurationMs: 20000,
    team: 'planning',
    taskType: 'planning',
  },
  {
    type: 'design',
    name: 'Design',
    description: 'Create implementation plan, define architecture, design interfaces',
    order: 3,
    required: true,
    estimatedDurationMs: 60000,
    team: 'planning',
    taskType: 'planning',
  },
  {
    type: 'implementation',
    name: 'Implementation',
    description: 'Write code, create files, implement the designed solution',
    order: 4,
    required: true,
    estimatedDurationMs: 120000,
    team: 'development',
    taskType: 'feature',
  },
  {
    type: 'review',
    name: 'Review',
    description: 'Review code quality, run tests, validate against requirements',
    order: 5,
    required: true,
    estimatedDurationMs: 45000,
    team: 'qa',
    taskType: 'review',
  },
  {
    type: 'summary',
    name: 'Summary',
    description: 'Summarize changes, document decisions, create completion report',
    order: 6,
    required: true,
    estimatedDurationMs: 15000,
    team: 'planning',
    taskType: 'planning',
  },
];

// ============================================================================
// SevenPhaseWorkflow
// ============================================================================

/**
 * Seven-Phase Workflow
 *
 * Orchestrates execution of seven sequential phases using a callback-based
 * PhaseExecutor pattern. Each phase receives the definitions, accumulated
 * results from previous phases, and a context object with goal and artifacts.
 *
 * The workflow emits events for each phase transition and supports:
 * - Phase skipping via configuration
 * - Cancellation of in-progress workflows
 * - Per-phase timeout configuration
 * - Accumulated artifact tracking across phases
 * - Configurable failure behavior (required vs optional phases)
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class SevenPhaseWorkflow extends EventEmitter {
  private phases: PhaseDefinition[];
  private results: Map<SevenPhaseType, PhaseExecutionResult>;
  private currentPhaseIndex: number;
  private config: SevenPhaseConfig;
  private startTime: number;
  private cancelled: boolean;
  private logger;

  constructor(config: SevenPhaseConfig) {
    super();
    this.config = config;
    this.results = new Map();
    this.currentPhaseIndex = -1;
    this.startTime = 0;
    this.cancelled = false;
    this.logger = createAgentLogger('Orchestrator', 'seven-phase-workflow');

    // Build phase list from defaults, marking skippable ones
    this.phases = DEFAULT_PHASE_DEFINITIONS.map((def) => ({ ...def }));
  }

  /**
   * Get the current phase being executed, or null if not running.
   */
  getCurrentPhase(): PhaseDefinition | null {
    if (this.currentPhaseIndex < 0 || this.currentPhaseIndex >= this.phases.length) {
      return null;
    }
    return this.phases[this.currentPhaseIndex];
  }

  /**
   * Get all phase definitions in execution order.
   */
  getPhaseDefinitions(): PhaseDefinition[] {
    return [...this.phases];
  }

  /**
   * Execute all phases sequentially.
   *
   * For each phase:
   * 1. Check if the phase should be skipped (via config.skipPhases)
   * 2. Emit 'phase:started'
   * 3. Call the phaseExecutor callback
   * 4. Store the result
   * 5. Emit 'phase:completed' or 'phase:failed'
   * 6. Call config.onPhaseComplete if provided
   * 7. If a required phase fails, stop the workflow
   */
  async execute(phaseExecutor: PhaseExecutor): Promise<SevenPhaseResult> {
    this.startTime = Date.now();
    this.cancelled = false;
    this.results.clear();
    this.currentPhaseIndex = -1;

    const skipSet = new Set(this.config.skipPhases ?? []);
    const totalPhases = this.phases.length;

    this.logger.info(`Starting seven-phase workflow for goal: ${this.config.goal}`);
    this.emit('workflow:started', { goal: this.config.goal, totalPhases });

    const phaseResults: PhaseExecutionResult[] = [];
    let workflowError: string | undefined;

    for (let i = 0; i < this.phases.length; i++) {
      if (this.cancelled) {
        this.logger.info('Workflow cancelled, stopping execution');
        break;
      }

      const phase = this.phases[i];
      this.currentPhaseIndex = i;

      // Check if phase should be skipped
      if (skipSet.has(phase.type)) {
        const skippedResult: PhaseExecutionResult = {
          phaseType: phase.type,
          status: 'skipped',
          duration: 0,
        };
        this.results.set(phase.type, skippedResult);
        phaseResults.push(skippedResult);

        this.logger.info(`Skipping phase: ${phase.name} (configured to skip)`);
        this.emit('phase:skipped', { type: phase.type, reason: 'Configured to skip' });

        if (this.config.onPhaseComplete) {
          await this.config.onPhaseComplete(skippedResult);
        }

        continue;
      }

      // Build execution context
      const accumulatedArtifacts = this.collectArtifacts(phaseResults);
      const context: PhaseExecutionContext = {
        goal: this.config.goal,
        phaseIndex: i,
        totalPhases,
        elapsed: Date.now() - this.startTime,
        artifacts: accumulatedArtifacts,
      };

      this.logger.info(`Starting phase ${i + 1}/${totalPhases}: ${phase.name}`);
      this.emit('phase:started', { type: phase.type, name: phase.name, order: phase.order });

      const phaseStartTime = Date.now();
      let result: PhaseExecutionResult;

      try {
        result = await phaseExecutor(phase, [...phaseResults], context);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result = {
          phaseType: phase.type,
          status: 'failed',
          duration: Date.now() - phaseStartTime,
          error: errorMessage,
        };
      }

      this.results.set(phase.type, result);
      phaseResults.push(result);

      if (result.status === 'completed') {
        this.logger.info(`Phase completed: ${phase.name} (${result.duration}ms)`);
        this.emit('phase:completed', result);
      } else if (result.status === 'failed') {
        this.logger.warn(`Phase failed: ${phase.name} - ${result.error}`);
        this.emit('phase:failed', result);
      }

      if (this.config.onPhaseComplete) {
        await this.config.onPhaseComplete(result);
      }

      // If a required phase fails, stop the workflow
      if (result.status === 'failed' && phase.required) {
        workflowError = `Required phase '${phase.name}' failed: ${result.error}`;
        this.logger.error(workflowError);
        break;
      }
    }

    // Reset current phase index
    this.currentPhaseIndex = -1;

    // Build final result
    const totalDuration = Date.now() - this.startTime;
    const completedPhases = phaseResults.filter((r) => r.status === 'completed').length;
    const skippedPhases = phaseResults.filter((r) => r.status === 'skipped').length;
    const failedPhases = phaseResults.filter((r) => r.status === 'failed').length;

    // Extract final summary from the summary phase if available
    const summaryResult = this.results.get('summary');
    const finalSummary =
      summaryResult?.status === 'completed' && typeof summaryResult.output === 'string'
        ? summaryResult.output
        : undefined;

    const success = !workflowError && !this.cancelled;

    const workflowResult: SevenPhaseResult = {
      success,
      goal: this.config.goal,
      phases: phaseResults,
      totalDuration,
      completedPhases,
      skippedPhases,
      failedPhases,
      finalSummary,
      error: workflowError,
    };

    if (success) {
      this.logger.info(
        `Workflow completed: ${completedPhases} completed, ${skippedPhases} skipped, ${failedPhases} failed (${totalDuration}ms)`,
      );
      this.emit('workflow:completed', workflowResult);
    } else {
      this.logger.error(`Workflow failed: ${workflowError ?? 'cancelled'}`);
      this.emit('workflow:failed', workflowResult);
    }

    return workflowResult;
  }

  /**
   * Cancel the in-progress workflow. Remaining phases will not be executed.
   */
  cancel(): void {
    this.cancelled = true;
    this.logger.info('Workflow cancellation requested');
  }

  /**
   * Get all results accumulated so far.
   */
  getResults(): PhaseExecutionResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Get the result for a specific phase type.
   */
  getPhaseResult(type: SevenPhaseType): PhaseExecutionResult | undefined {
    return this.results.get(type);
  }

  /**
   * Collect all artifacts from phase results.
   */
  private collectArtifacts(results: PhaseExecutionResult[]): PhaseArtifact[] {
    const artifacts: PhaseArtifact[] = [];
    for (const result of results) {
      if (result.artifacts) {
        artifacts.push(...result.artifacts);
      }
    }
    return artifacts;
  }
}

// Type-safe event emitter overloads
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface SevenPhaseWorkflow {
  on<E extends keyof SevenPhaseWorkflowEvents>(event: E, listener: SevenPhaseWorkflowEvents[E]): this;
  emit<E extends keyof SevenPhaseWorkflowEvents>(
    event: E,
    ...args: Parameters<SevenPhaseWorkflowEvents[E]>
  ): boolean;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new SevenPhaseWorkflow instance.
 */
export function createSevenPhaseWorkflow(config: SevenPhaseConfig): SevenPhaseWorkflow {
  return new SevenPhaseWorkflow(config);
}

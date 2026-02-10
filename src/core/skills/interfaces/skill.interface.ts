/**
 * Skill Module Interfaces
 *
 * Defines the core abstractions for composable skills:
 * - ISkill: a single reusable capability
 * - ISkillRegistry: skill discovery and management
 * - ISkillPipeline: skill composition and chaining
 *
 * @module core/skills/interfaces
 */

/**
 * Context passed to every skill execution
 */
export interface SkillContext {
  /** Working directory */
  workspaceDir: string;
  /** Project description/context */
  projectContext?: string;
  /** Execution timeout in ms */
  timeout?: number;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from skill execution
 */
export interface SkillResult<T = unknown> {
  /** Whether the skill completed successfully */
  success: boolean;
  /** Output data */
  output?: T;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  duration: number;
  /** Arbitrary result metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Core skill interface — a single reusable capability
 */
export interface ISkill<TInput = unknown, TOutput = unknown> {
  /** Unique skill name */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** Tags for discovery/filtering */
  readonly tags: readonly string[];
  /** Semantic version */
  readonly version: string;

  /**
   * Execute the skill
   */
  execute(input: TInput, context: SkillContext): Promise<SkillResult<TOutput>>;

  /**
   * Validate input before execution (optional)
   */
  validate?(input: TInput): boolean;

  /**
   * Check if this skill can handle the given input (optional)
   */
  canHandle?(input: TInput, context: SkillContext): boolean;
}

/**
 * Summary info for a registered skill
 */
export interface SkillInfo {
  name: string;
  description: string;
  tags: readonly string[];
  version: string;
}

/**
 * Skill registry — discovery and management
 */
export interface ISkillRegistry {
  /** Register a skill */
  register(skill: ISkill): void;

  /** Unregister a skill by name */
  unregister(name: string): boolean;

  /** Get a skill by name */
  get(name: string): ISkill | undefined;

  /** Find skills matching a tag */
  findByTag(tag: string): ISkill[];

  /** Find skills that can handle the given input */
  findByCapability(input: unknown, context: SkillContext): ISkill[];

  /** List all registered skills */
  list(): SkillInfo[];

  /** Count of registered skills */
  count(): number;

  /** Clear all skills */
  clear(): void;
}

/**
 * Pipeline step configuration
 */
export interface PipelineStepOptions {
  /** Transform output before passing to next step */
  transform?: (output: unknown) => unknown;
  /** Skip this step if condition returns false */
  condition?: (previousOutput: unknown) => boolean;
  /** Fallback skill name if this step fails */
  fallback?: string;
  /** Step-level timeout in ms */
  timeout?: number;
}

/**
 * Result from a single pipeline step
 */
export interface PipelineStepResult {
  /** Skill name */
  skillName: string;
  /** Whether the step succeeded */
  success: boolean;
  /** Step output */
  output?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  duration: number;
  /** Whether the step was skipped */
  skipped?: boolean;
}

/**
 * Result from a full pipeline execution
 */
export interface PipelineResult {
  /** Whether the entire pipeline succeeded */
  success: boolean;
  /** Results from each step */
  steps: PipelineStepResult[];
  /** Output from the last successful step */
  finalOutput?: unknown;
  /** Total execution duration in ms */
  totalDuration: number;
}

/**
 * Pipeline validation result
 */
export interface PipelineValidation {
  /** Whether the pipeline configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
}

/**
 * Skill pipeline — chaining skills together
 */
export interface ISkillPipeline {
  /** Pipeline name */
  readonly name: string;

  /** Number of steps */
  readonly stepCount: number;

  /** Add a step to the pipeline */
  addStep(skillName: string, options?: PipelineStepOptions): ISkillPipeline;

  /** Execute the pipeline */
  execute(input: unknown, context: SkillContext): Promise<PipelineResult>;

  /** Validate the pipeline configuration */
  validate(): PipelineValidation;
}

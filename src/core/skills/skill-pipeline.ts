/**
 * Skill Pipeline
 *
 * Chains multiple skills together for sequential execution.
 * Supports conditional steps, output transformation, and fallbacks.
 *
 * @module core/skills
 */

import type {
  ISkillPipeline,
  ISkillRegistry,
  PipelineResult,
  PipelineStepOptions,
  PipelineStepResult,
  PipelineValidation,
  SkillContext,
} from './interfaces/skill.interface';

/**
 * Internal step definition
 */
interface PipelineStep {
  skillName: string;
  options: PipelineStepOptions;
}

/**
 * SkillPipeline options
 */
export interface SkillPipelineOptions {
  /** Pipeline name */
  name: string;
  /** Registry to resolve skill names */
  registry: ISkillRegistry;
  /** Stop on first failure (default: true) */
  stopOnFailure?: boolean;
}

/**
 * Sequential skill pipeline implementation
 */
export class SkillPipeline implements ISkillPipeline {
  readonly name: string;
  private readonly registry: ISkillRegistry;
  private readonly stopOnFailure: boolean;
  private readonly steps: PipelineStep[] = [];

  constructor(options: SkillPipelineOptions) {
    this.name = options.name;
    this.registry = options.registry;
    this.stopOnFailure = options.stopOnFailure ?? true;
  }

  get stepCount(): number {
    return this.steps.length;
  }

  addStep(
    skillName: string,
    options: PipelineStepOptions = {},
  ): ISkillPipeline {
    this.steps.push({ skillName, options });
    return this;
  }

  async execute(
    input: unknown,
    context: SkillContext,
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const stepResults: PipelineStepResult[] = [];
    let currentInput = input;
    let allSucceeded = true;

    for (const step of this.steps) {
      const stepStart = Date.now();

      // Check condition
      if (step.options.condition && !step.options.condition(currentInput)) {
        stepResults.push({
          skillName: step.skillName,
          success: true,
          duration: Date.now() - stepStart,
          skipped: true,
        });
        continue;
      }

      // Resolve skill
      const skill = this.registry.get(step.skillName);
      if (!skill) {
        const result: PipelineStepResult = {
          skillName: step.skillName,
          success: false,
          error: `Skill '${step.skillName}' not found in registry`,
          duration: Date.now() - stepStart,
        };
        stepResults.push(result);
        allSucceeded = false;
        if (this.stopOnFailure) break;
        continue;
      }

      // Execute with optional timeout
      try {
        const timeout = step.options.timeout ?? context.timeout;
        let execPromise = skill.execute(currentInput, context);

        if (timeout) {
          execPromise = Promise.race([
            execPromise,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Step '${step.skillName}' timed out after ${timeout}ms`)),
                timeout,
              ),
            ),
          ]) as typeof execPromise;
        }

        const skillResult = await execPromise;

        if (skillResult.success) {
          const output = step.options.transform
            ? step.options.transform(skillResult.output)
            : skillResult.output;

          stepResults.push({
            skillName: step.skillName,
            success: true,
            output,
            duration: Date.now() - stepStart,
          });
          currentInput = output;
        } else {
          // Try fallback
          if (step.options.fallback) {
            const fallbackResult = await this.tryFallback(
              step.options.fallback,
              currentInput,
              context,
            );
            if (fallbackResult.success) {
              const output = step.options.transform
                ? step.options.transform(fallbackResult.output)
                : fallbackResult.output;
              stepResults.push({
                skillName: `${step.skillName}→${step.options.fallback}`,
                success: true,
                output,
                duration: Date.now() - stepStart,
              });
              currentInput = output;
              continue;
            }
          }

          stepResults.push({
            skillName: step.skillName,
            success: false,
            error: skillResult.error ?? 'Skill execution failed',
            duration: Date.now() - stepStart,
          });
          allSucceeded = false;
          if (this.stopOnFailure) break;
        }
      } catch (err) {
        stepResults.push({
          skillName: step.skillName,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          duration: Date.now() - stepStart,
        });
        allSucceeded = false;
        if (this.stopOnFailure) break;
      }
    }

    return {
      success: allSucceeded,
      steps: stepResults,
      finalOutput: currentInput,
      totalDuration: Date.now() - startTime,
    };
  }

  validate(): PipelineValidation {
    const errors: string[] = [];

    if (this.steps.length === 0) {
      errors.push('Pipeline has no steps');
    }

    for (const step of this.steps) {
      if (!this.registry.get(step.skillName)) {
        errors.push(`Skill '${step.skillName}' not found in registry`);
      }
      if (step.options.fallback && !this.registry.get(step.options.fallback)) {
        errors.push(
          `Fallback skill '${step.options.fallback}' not found in registry`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private async tryFallback(
    fallbackName: string,
    input: unknown,
    context: SkillContext,
  ): Promise<{ success: boolean; output?: unknown }> {
    const fallback = this.registry.get(fallbackName);
    if (!fallback) return { success: false };

    try {
      const result = await fallback.execute(input, context);
      return { success: result.success, output: result.output };
    } catch {
      return { success: false };
    }
  }
}

/**
 * Factory function for creating a SkillPipeline
 */
export function createSkillPipeline(
  options: SkillPipelineOptions,
): SkillPipeline {
  return new SkillPipeline(options);
}

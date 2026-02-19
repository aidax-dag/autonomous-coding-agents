/**
 * Base Skill Abstract Class
 *
 * Extracts common boilerplate from all skill implementations:
 * constructor, canHandle, execute flow (timing, validation, executor, fallback, error).
 * Subclasses only define: metadata, validate logic, fallback output.
 *
 * @module core/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from './interfaces/skill.interface';
import { createSkillFallback } from './skill-fallback';

/**
 * Abstract base class for all skills.
 *
 * Subclass contract:
 * - Set readonly `name`, `description`, `tags`
 * - Implement `validate()` with domain-specific checks
 * - Set `validationError` message
 * - Implement `createFallbackOutput()` for no-executor stub
 * - Optionally override `createFallbackContext()` and `createExtraMetadata()`
 */
export abstract class BaseSkill<TInput, TOutput>
  implements ISkill<TInput, TOutput>
{
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly tags: readonly string[];
  readonly version = '1.0.0';

  /** Error message returned when validate() fails */
  protected abstract readonly validationError: string;

  protected readonly executor?: (
    input: TInput,
    context: SkillContext,
  ) => Promise<TOutput>;

  constructor(options?: {
    executor?: (input: TInput, context: SkillContext) => Promise<TOutput>;
  }) {
    this.executor = options?.executor;
  }

  /** Domain-specific input validation */
  abstract validate(input: TInput): boolean;

  /** Construct the stub output when no executor is configured */
  protected abstract createFallbackOutput(input: TInput): TOutput;

  /** Context data passed to createSkillFallback() — override to enrich */
  protected createFallbackContext(
    _input: TInput,
  ): Record<string, unknown> | undefined {
    return undefined;
  }

  /** Extra metadata merged into the result alongside fallback — override to enrich */
  protected createExtraMetadata(
    _input: TInput,
  ): Record<string, unknown> | undefined {
    return undefined;
  }

  canHandle(input: unknown): boolean {
    if (input === null || typeof input !== 'object') return false;
    return this.validate(input as TInput);
  }

  async execute(
    input: TInput,
    context: SkillContext,
  ): Promise<SkillResult<TOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: this.validationError,
        duration: Date.now() - start,
      };
    }

    try {
      if (this.executor) {
        const output = await this.executor(input, context);
        return { success: true, output, duration: Date.now() - start };
      }

      const fallback = createSkillFallback(
        this.name,
        'no_executor',
        this.createFallbackContext(input),
      );
      const output = this.createFallbackOutput(input);
      const extra = this.createExtraMetadata(input);

      return {
        success: true,
        output,
        duration: Date.now() - start,
        metadata: { ...extra, fallback },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }
}

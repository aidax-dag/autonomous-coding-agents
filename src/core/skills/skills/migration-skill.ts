/**
 * Migration Skill
 *
 * Handles framework and library migrations with compatibility analysis.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';

/**
 * A migration change entry
 */
export interface MigrationChange {
  file: string;
  description: string;
  before?: string;
  after?: string;
}

/**
 * Input for migration skill
 */
export interface MigrationSkillInput {
  /** Source framework/version */
  from: string;
  /** Target framework/version */
  to: string;
  /** File paths to migrate */
  files: string[];
  /** Whether to perform a dry run */
  dryRun?: boolean;
}

/**
 * Output from migration skill
 */
export interface MigrationSkillOutput {
  /** List of changes to apply */
  changes: MigrationChange[];
  /** Migration warnings */
  warnings: string[];
  /** Incompatible items that cannot be migrated */
  incompatible: string[];
}

/**
 * Migration skill — handles framework and library migrations
 */
export class MigrationSkill
  implements ISkill<MigrationSkillInput, MigrationSkillOutput>
{
  readonly name = 'migration';
  readonly description = 'Handles framework and library migrations with compatibility analysis';
  readonly tags = ['migration', 'upgrade', 'framework'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: MigrationSkillInput,
    context: SkillContext,
  ) => Promise<MigrationSkillOutput>;

  constructor(options?: {
    executor?: (
      input: MigrationSkillInput,
      context: SkillContext,
    ) => Promise<MigrationSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: MigrationSkillInput): boolean {
    return (
      typeof input.from === 'string' &&
      input.from.length > 0 &&
      typeof input.to === 'string' &&
      input.to.length > 0 &&
      Array.isArray(input.files) &&
      input.files.length > 0
    );
  }

  canHandle(input: unknown): boolean {
    const typed = input as MigrationSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      typeof typed.from === 'string' &&
      typed.from.length > 0 &&
      typeof typed.to === 'string' &&
      typed.to.length > 0 &&
      Array.isArray(typed.files) &&
      typed.files.length > 0
    );
  }

  async execute(
    input: MigrationSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<MigrationSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: from, to, and files are required',
        duration: Date.now() - start,
      };
    }

    try {
      if (this.executor) {
        const output = await this.executor(input, context);
        return {
          success: true,
          output,
          duration: Date.now() - start,
        };
      }

      // Default stub output
      const changes: MigrationChange[] = input.files.map((file) => ({
        file,
        description: `Pending migration from ${input.from} to ${input.to}`,
      }));

      const output: MigrationSkillOutput = {
        changes,
        warnings: [],
        incompatible: [],
      };

      return {
        success: true,
        output,
        duration: Date.now() - start,
        metadata: { dryRun: input.dryRun ?? false },
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

/**
 * Factory function
 */
export function createMigrationSkill(options?: {
  executor?: (
    input: MigrationSkillInput,
    context: SkillContext,
  ) => Promise<MigrationSkillOutput>;
}): MigrationSkill {
  return new MigrationSkill(options);
}

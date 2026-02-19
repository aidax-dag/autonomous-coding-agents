/**
 * Migration Skill
 *
 * Handles framework and library migrations with compatibility analysis.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

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
export class MigrationSkill extends BaseSkill<MigrationSkillInput, MigrationSkillOutput> {
  readonly name = 'migration';
  readonly description = 'Handles framework and library migrations with compatibility analysis';
  readonly tags = ['migration', 'upgrade', 'framework'] as const;
  protected readonly validationError = 'Invalid input: from, to, and files are required';

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

  protected createFallbackOutput(input: MigrationSkillInput): MigrationSkillOutput {
    const changes: MigrationChange[] = input.files.map((file) => ({
      file,
      description: `Pending migration from ${input.from} to ${input.to}`,
    }));

    return {
      changes,
      warnings: [],
      incompatible: [],
    };
  }

  protected createFallbackContext(input: MigrationSkillInput): Record<string, unknown> {
    return { from: input.from, to: input.to, fileCount: input.files.length };
  }

  protected createExtraMetadata(input: MigrationSkillInput): Record<string, unknown> {
    return { dryRun: input.dryRun ?? false };
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

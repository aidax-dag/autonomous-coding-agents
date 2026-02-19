/**
 * Database Skill
 *
 * Handles database schema design, query optimization, and migration generation.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

/**
 * Input for database skill
 */
export interface DatabaseSkillInput {
  /** Database operation type */
  operation: 'schema' | 'query' | 'migration' | 'optimize';
  /** Schema definition or description */
  schema?: string;
  /** SQL query to analyze or optimize */
  query?: string;
}

/**
 * Output from database skill
 */
export interface DatabaseSkillOutput {
  /** Operation result (generated SQL, schema, etc.) */
  result: string;
  /** Improvement suggestions */
  suggestions: string[];
  /** Potential issues or warnings */
  warnings: string[];
  /** Optimized version (for optimize operation) */
  optimized?: string;
}

/**
 * Database skill — handles schema design, query optimization, and migrations
 */
export class DatabaseSkill extends BaseSkill<DatabaseSkillInput, DatabaseSkillOutput> {
  readonly name = 'database';
  readonly description = 'Handles database schema design, query optimization, and migration generation';
  readonly tags = ['database', 'sql', 'schema', 'optimization'] as const;
  protected readonly validationError = 'Invalid input: operation must be schema, query, migration, or optimize';

  validate(input: DatabaseSkillInput): boolean {
    const validOps = ['schema', 'query', 'migration', 'optimize'];
    return typeof input.operation === 'string' && validOps.includes(input.operation);
  }

  protected createFallbackOutput(input: DatabaseSkillInput): DatabaseSkillOutput {
    const output: DatabaseSkillOutput = {
      result: `Database ${input.operation} operation stub`,
      suggestions: [],
      warnings: [],
    };

    if (input.operation === 'optimize' && input.query) {
      output.optimized = input.query;
    }

    return output;
  }
}

/**
 * Factory function
 */
export function createDatabaseSkill(options?: {
  executor?: (
    input: DatabaseSkillInput,
    context: SkillContext,
  ) => Promise<DatabaseSkillOutput>;
}): DatabaseSkill {
  return new DatabaseSkill(options);
}

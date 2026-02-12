/**
 * Database Skill
 *
 * Handles database schema design, query optimization, and migration generation.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';

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
export class DatabaseSkill
  implements ISkill<DatabaseSkillInput, DatabaseSkillOutput>
{
  readonly name = 'database';
  readonly description = 'Handles database schema design, query optimization, and migration generation';
  readonly tags = ['database', 'sql', 'schema', 'optimization'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: DatabaseSkillInput,
    context: SkillContext,
  ) => Promise<DatabaseSkillOutput>;

  constructor(options?: {
    executor?: (
      input: DatabaseSkillInput,
      context: SkillContext,
    ) => Promise<DatabaseSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: DatabaseSkillInput): boolean {
    const validOps = ['schema', 'query', 'migration', 'optimize'];
    return typeof input.operation === 'string' && validOps.includes(input.operation);
  }

  canHandle(input: unknown): boolean {
    const typed = input as DatabaseSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      typeof typed.operation === 'string' &&
      ['schema', 'query', 'migration', 'optimize'].includes(typed.operation)
    );
  }

  async execute(
    input: DatabaseSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<DatabaseSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: operation must be schema, query, migration, or optimize',
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
      const output: DatabaseSkillOutput = {
        result: `Database ${input.operation} operation stub`,
        suggestions: [],
        warnings: [],
      };

      if (input.operation === 'optimize' && input.query) {
        output.optimized = input.query;
      }

      return {
        success: true,
        output,
        duration: Date.now() - start,
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
export function createDatabaseSkill(options?: {
  executor?: (
    input: DatabaseSkillInput,
    context: SkillContext,
  ) => Promise<DatabaseSkillOutput>;
}): DatabaseSkill {
  return new DatabaseSkill(options);
}

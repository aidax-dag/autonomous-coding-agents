/**
 * API Design Skill
 *
 * Designs REST and GraphQL APIs with schema generation and endpoint documentation.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';
import { createSkillFallback } from '../skill-fallback';

/**
 * An API endpoint definition
 */
export interface ApiEndpoint {
  method: string;
  path: string;
  request?: string;
  response?: string;
  description: string;
}

/**
 * Input for API design skill
 */
export interface ApiDesignSkillInput {
  /** API name */
  name: string;
  /** API type */
  type?: 'rest' | 'graphql';
  /** Endpoint definitions */
  endpoints?: Array<{ method: string; path: string; description: string }>;
}

/**
 * Output from API design skill
 */
export interface ApiDesignSkillOutput {
  /** Generated schema (OpenAPI or GraphQL SDL) */
  schema: string;
  /** Fully specified endpoints */
  endpoints: ApiEndpoint[];
  /** Generated documentation */
  documentation: string;
}

/**
 * API design skill — designs REST and GraphQL APIs
 */
export class ApiDesignSkill
  implements ISkill<ApiDesignSkillInput, ApiDesignSkillOutput>
{
  readonly name = 'api-design';
  readonly description = 'Designs REST and GraphQL APIs with schema generation and endpoint documentation';
  readonly tags = ['api', 'design', 'rest', 'graphql'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: ApiDesignSkillInput,
    context: SkillContext,
  ) => Promise<ApiDesignSkillOutput>;

  constructor(options?: {
    executor?: (
      input: ApiDesignSkillInput,
      context: SkillContext,
    ) => Promise<ApiDesignSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: ApiDesignSkillInput): boolean {
    return typeof input.name === 'string' && input.name.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as ApiDesignSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      typeof typed.name === 'string' &&
      typed.name.length > 0
    );
  }

  async execute(
    input: ApiDesignSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<ApiDesignSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: name is required',
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
      const apiType = input.type ?? 'rest';
      const fallback = createSkillFallback('api-design', 'no_executor', {
        name: input.name,
        type: apiType,
      });

      const endpoints: ApiEndpoint[] = (input.endpoints ?? []).map((ep) => ({
        method: ep.method,
        path: ep.path,
        description: ep.description,
        request: '{}',
        response: '{}',
      }));

      const output: ApiDesignSkillOutput = {
        schema: apiType === 'rest'
          ? `openapi: "3.0.0"\ninfo:\n  title: "${input.name}"\n  version: "1.0.0"`
          : `type Query {\n  # ${input.name} schema stub\n  health: Boolean\n}`,
        endpoints,
        documentation: `# ${input.name} API\n\nType: ${apiType}\nEndpoints: ${endpoints.length}`,
      };

      return {
        success: true,
        output,
        duration: Date.now() - start,
        metadata: { fallback },
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
export function createApiDesignSkill(options?: {
  executor?: (
    input: ApiDesignSkillInput,
    context: SkillContext,
  ) => Promise<ApiDesignSkillOutput>;
}): ApiDesignSkill {
  return new ApiDesignSkill(options);
}

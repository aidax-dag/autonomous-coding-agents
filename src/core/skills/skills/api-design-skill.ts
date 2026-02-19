/**
 * API Design Skill
 *
 * Designs REST and GraphQL APIs with schema generation and endpoint documentation.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

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
export class ApiDesignSkill extends BaseSkill<ApiDesignSkillInput, ApiDesignSkillOutput> {
  readonly name = 'api-design';
  readonly description = 'Designs REST and GraphQL APIs with schema generation and endpoint documentation';
  readonly tags = ['api', 'design', 'rest', 'graphql'] as const;
  protected readonly validationError = 'Invalid input: name is required';

  validate(input: ApiDesignSkillInput): boolean {
    return typeof input.name === 'string' && input.name.length > 0;
  }

  protected createFallbackOutput(input: ApiDesignSkillInput): ApiDesignSkillOutput {
    const apiType = input.type ?? 'rest';

    const endpoints: ApiEndpoint[] = (input.endpoints ?? []).map((ep) => ({
      method: ep.method,
      path: ep.path,
      description: ep.description,
      request: '{}',
      response: '{}',
    }));

    return {
      schema: apiType === 'rest'
        ? `openapi: "3.0.0"\ninfo:\n  title: "${input.name}"\n  version: "1.0.0"`
        : `type Query {\n  # ${input.name} schema stub\n  health: Boolean\n}`,
      endpoints,
      documentation: `# ${input.name} API\n\nType: ${apiType}\nEndpoints: ${endpoints.length}`,
    };
  }

  protected createFallbackContext(input: ApiDesignSkillInput): Record<string, unknown> {
    const apiType = input.type ?? 'rest';
    return { name: input.name, type: apiType };
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

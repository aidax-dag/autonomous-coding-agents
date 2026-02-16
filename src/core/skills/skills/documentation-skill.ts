/**
 * Documentation Skill
 *
 * Generates documentation in various formats for code files.
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
 * A generated document entry
 */
export interface GeneratedDocument {
  path: string;
  content: string;
  format: string;
}

/**
 * Input for documentation skill
 */
export interface DocumentationSkillInput {
  /** File paths to document */
  files: string[];
  /** Output format */
  format?: 'markdown' | 'jsdoc' | 'readme';
  /** Documentation scope */
  scope?: 'api' | 'module' | 'function';
}

/**
 * Output from documentation skill
 */
export interface DocumentationSkillOutput {
  /** Generated documents */
  documents: GeneratedDocument[];
  /** Human-readable summary */
  summary: string;
}

/**
 * Documentation skill — generates documentation for code files
 */
export class DocumentationSkill
  implements ISkill<DocumentationSkillInput, DocumentationSkillOutput>
{
  readonly name = 'documentation';
  readonly description = 'Generates documentation in markdown, JSDoc, or README format for code files';
  readonly tags = ['docs', 'documentation', 'api'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: DocumentationSkillInput,
    context: SkillContext,
  ) => Promise<DocumentationSkillOutput>;

  constructor(options?: {
    executor?: (
      input: DocumentationSkillInput,
      context: SkillContext,
    ) => Promise<DocumentationSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: DocumentationSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  canHandle(input: unknown): boolean {
    const typed = input as DocumentationSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      Array.isArray(typed.files) &&
      typed.files.length > 0
    );
  }

  async execute(
    input: DocumentationSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<DocumentationSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: files array is required',
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
      const format = input.format ?? 'markdown';
      const fallback = createSkillFallback('documentation', 'no_executor', {
        files: input.files,
        format,
      });

      const documents: GeneratedDocument[] = input.files.map((file) => ({
        path: file,
        content: `# Documentation for ${file}\n\nGenerated documentation stub.`,
        format,
      }));

      const output: DocumentationSkillOutput = {
        documents,
        summary: `Generated ${format} documentation for ${input.files.length} file(s)`,
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
export function createDocumentationSkill(options?: {
  executor?: (
    input: DocumentationSkillInput,
    context: SkillContext,
  ) => Promise<DocumentationSkillOutput>;
}): DocumentationSkill {
  return new DocumentationSkill(options);
}

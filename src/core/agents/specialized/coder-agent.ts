/**
 * Refactored Coder Agent
 *
 * DI-based implementation responsible for code generation and implementation.
 * Uses LLM for code generation with Zod validation and Git operations.
 *
 * Follows SOLID principles:
 * - S: Single responsibility - code implementation tasks
 * - O: Open for extension via hooks
 * - L: Implements IAgent, substitutable
 * - I: Depends only on required interfaces
 * - D: All dependencies injected via constructor
 *
 * @module core/agents/specialized
 */

import { BaseAgent } from '../base-agent';
import type { AgentDependencies } from '../interfaces';
import {
  IAgentConfig,
  AgentType,
  AgentCapability,
  ITask,
  TaskResult,
} from '../../interfaces';
import { z } from 'zod';

/**
 * Implementation request payload schema
 */
const ImplementationPayloadSchema = z.object({
  repository: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    url: z.string().url().optional(),
  }),
  branch: z.string().optional(),
  featureBranch: z.string().optional(),
  feature: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    requirements: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()).optional(),
  }),
  context: z
    .object({
      relatedFiles: z.array(z.string()).optional(),
      existingCode: z.record(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * LLM response schema for code generation
 */
const CodeGenerationResponseSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      action: z.enum(['create', 'modify', 'delete']),
    })
  ),
  summary: z.string().optional(),
  tests: z.array(z.string()).optional(),
});

type CodeGenerationResponse = z.infer<typeof CodeGenerationResponseSchema>;

interface FileChange {
  path: string;
  content: string;
  action: 'create' | 'modify' | 'delete';
}

interface SyntaxValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Coder Agent Configuration
 */
export interface CoderAgentConfig extends IAgentConfig {
  workDir?: string;
  maxRetries?: number;
  baseRetryDelay?: number;
}

/**
 * Refactored Coder Agent
 *
 * Implements code generation and implementation tasks using DI pattern.
 */
export class CoderAgent extends BaseAgent {
  // workDir reserved for future file operations
  private readonly _workDir: string;
  private readonly maxRetries: number;
  private readonly baseRetryDelay: number;

  constructor(config: CoderAgentConfig, dependencies: AgentDependencies) {
    super(config, dependencies);

    this._workDir = config.workDir || process.env.WORK_DIR || '/tmp/coder-agent';
    this.maxRetries = config.maxRetries || 3;
    this.baseRetryDelay = config.baseRetryDelay || 1000;
  }

  /**
   * Get the configured work directory
   */
  get workDir(): string {
    return this._workDir;
  }

  /**
   * Get coder agent capabilities
   */
  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'code-generation',
        description: 'Generate TypeScript/JavaScript code from requirements',
        inputSchema: {
          type: 'object',
          properties: {
            feature: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                requirements: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'description', 'requirements'],
            },
          },
          required: ['feature'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            files: { type: 'array' },
            summary: { type: 'string' },
          },
        },
      },
      {
        name: 'code-modification',
        description: 'Modify existing code based on requirements',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string' },
            modification: { type: 'string' },
          },
          required: ['filePath', 'modification'],
        },
      },
      {
        name: 'syntax-validation',
        description: 'Validate TypeScript syntax',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
          required: ['code'],
        },
      },
    ];
  }

  /**
   * Process implementation task
   */
  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();

    try {
      // Validate task payload
      const validationResult = ImplementationPayloadSchema.safeParse(task.payload);

      if (!validationResult.success) {
        return this.createFailureResult(
          task,
          new Error(`Invalid implementation request: ${validationResult.error.message}`),
          startTime
        );
      }

      const payload = validationResult.data;
      const { feature } = payload;

      this.logger.info('Processing implementation request', {
        taskId: task.id,
        feature: feature.title,
      });

      // Generate code using LLM
      const codeGeneration = await this.generateCode(feature);

      // Validate syntax
      const validationResults = await this.validateGeneratedCode(codeGeneration.files);

      // Build result data
      const resultData: Record<string, unknown> = {
        feature: {
          title: feature.title,
          description: feature.description,
        },
        generatedFiles: codeGeneration.files.map((f) => ({
          path: f.path,
          action: f.action,
          lines: f.content.split('\n').length,
        })),
        summary: codeGeneration.summary || `Generated code for ${feature.title}`,
        validationResults: {
          syntaxCheck: validationResults.every((r) => r.valid),
          errors: validationResults.flatMap((r) => r.errors || []),
        },
      };

      this.logger.info('Implementation completed successfully', {
        taskId: task.id,
        filesGenerated: codeGeneration.files.length,
      });

      return this.createSuccessResult(task, resultData, startTime);
    } catch (error) {
      this.logger.error('Implementation failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.createFailureResult(
        task,
        error instanceof Error ? error : new Error(String(error)),
        startTime
      );
    }
  }

  /**
   * Generate code using LLM with retry logic
   */
  private async generateCode(feature: {
    title: string;
    description: string;
    requirements: string[];
  }): Promise<CodeGenerationResponse> {
    return this.retryWithBackoff(async () => {
      const prompt = this.buildCodeGenerationPrompt(feature);

      const response = await this.llmClient.complete(
        [
          {
            role: 'system',
            content:
              'You are an expert software engineer. Generate clean, well-tested TypeScript code. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.2,
          maxTokens: 4000,
        }
      );

      // Update token usage
      this.updateTokenUsage(response.usage.totalTokens);

      // Parse and validate response
      let parsedContent: unknown;
      try {
        parsedContent = JSON.parse(response.content);
      } catch {
        throw new Error(`LLM response is not valid JSON: ${response.content.substring(0, 200)}`);
      }

      const validationResult = CodeGenerationResponseSchema.safeParse(parsedContent);
      if (!validationResult.success) {
        throw new Error(
          `LLM response does not match expected schema: ${validationResult.error.message}`
        );
      }

      return validationResult.data;
    });
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable =
          error instanceof Error && error.message.toLowerCase().includes('rate limit');

        if (!isRetryable || attempt === this.maxRetries - 1) {
          throw error;
        }

        // Wait with exponential backoff
        const delay = this.baseRetryDelay * Math.pow(2, attempt);
        this.logger.warn('Retrying after error', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          delay,
          error: String(error),
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build prompt for code generation
   */
  private buildCodeGenerationPrompt(feature: {
    title: string;
    description: string;
    requirements: string[];
  }): string {
    return `Generate TypeScript code for the following feature:

Title: ${feature.title}
Description: ${feature.description}

Requirements:
${feature.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Generate code following these guidelines:
- Use TypeScript with strict typing
- Include proper error handling
- Add JSDoc comments
- Follow clean code principles
- Return response in JSON format:
{
  "files": [
    {"path": "src/example.ts", "content": "...", "action": "create"}
  ],
  "summary": "Brief summary of changes"
}`;
  }

  /**
   * Validate generated code syntax
   */
  private async validateGeneratedCode(
    files: FileChange[]
  ): Promise<SyntaxValidationResult[]> {
    const results: SyntaxValidationResult[] = [];

    for (const file of files) {
      if (file.action !== 'delete' && file.path.endsWith('.ts')) {
        const result = this.validateTypeScriptSyntax(file.content);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Validate TypeScript syntax using basic parsing
   */
  private validateTypeScriptSyntax(code: string): SyntaxValidationResult {
    try {
      // Basic syntax validation checks
      const errors: string[] = [];

      // Check for unbalanced braces
      const braceBalance = this.checkBraceBalance(code);
      if (braceBalance !== 0) {
        errors.push(`Unbalanced braces: ${braceBalance > 0 ? 'missing }' : 'extra }'}`);
      }

      // Check for unbalanced parentheses
      const parenBalance = this.checkParenBalance(code);
      if (parenBalance !== 0) {
        errors.push(`Unbalanced parentheses: ${parenBalance > 0 ? 'missing )' : 'extra )'}`);
      }

      // Check for unclosed strings
      if (this.hasUnclosedStrings(code)) {
        errors.push('Unclosed string literal detected');
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [String(error)],
      };
    }
  }

  /**
   * Check brace balance in code
   */
  private checkBraceBalance(code: string): number {
    let balance = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : '';

      // Handle string state
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (!inString) {
        if (char === '{') balance++;
        if (char === '}') balance--;
      }
    }

    return balance;
  }

  /**
   * Check parenthesis balance in code
   */
  private checkParenBalance(code: string): number {
    let balance = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : '';

      // Handle string state
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (!inString) {
        if (char === '(') balance++;
        if (char === ')') balance--;
      }
    }

    return balance;
  }

  /**
   * Check for unclosed strings
   */
  private hasUnclosedStrings(code: string): boolean {
    const lines = code.split('\n');

    for (const line of lines) {
      let inString = false;
      let stringChar = '';
      let escaped = false;

      for (const char of line) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        // Skip template literals for simplicity (they can span multiple lines)
        if (char === '`') continue;

        if ((char === '"' || char === "'") && !inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar && inString) {
          inString = false;
        }
      }

      // If we're still in a regular string at end of line, it's unclosed
      if (inString && (stringChar === '"' || stringChar === "'")) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create a coder agent instance
 */
export function createCoderAgent(
  config: Omit<CoderAgentConfig, 'type'>,
  dependencies: AgentDependencies
): CoderAgent {
  return new CoderAgent(
    {
      ...config,
      type: AgentType.CODER,
    },
    dependencies
  );
}

/**
 * AST-Grep Lint Tool
 *
 * AST-based code linting using pattern rules.
 *
 * @module core/tools/ast-grep/ast-lint
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IASTGrepClient, ASTLintResult, ASTLintOptions } from './ast-grep.interface.js';
import { ASTGrepClient } from './ast-grep-client.js';

/**
 * Input parameters for AST lint
 */
export interface ASTLintInput {
  /** File or directory path to lint */
  path: string;
  /** Lint options */
  options?: ASTLintOptions;
}

/**
 * AST-Grep Lint Tool
 *
 * Lints code using AST-based pattern rules.
 * Features:
 * - Custom rule support
 * - Severity levels (error, warning, info, hint)
 * - Category-based filtering
 * - Suggested fixes
 */
export class ASTLintTool extends BaseTool<ASTLintInput, ASTLintResult | null> {
  readonly name = 'ast-lint';
  readonly description = 'Lint code using AST-based pattern rules';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.AST,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'File or directory path to lint',
        required: true,
      },
      {
        name: 'options',
        type: 'object',
        description:
          'Lint options (ruleIds, minSeverity, categories, include/exclude patterns)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Lint results with violations, severity groupings, and suggested fixes',
    },
    tags: ['ast', 'lint', 'code-quality', 'rules'],
  };

  private readonly astClient: IASTGrepClient;

  constructor(astClient?: IASTGrepClient) {
    super();
    this.astClient = astClient ?? new ASTGrepClient();
  }

  async execute(
    params: ASTLintInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ASTLintResult | null>> {
    const startTime = Date.now();

    // Determine if path is a file or directory
    const isFile = params.path.includes('.') && !params.path.endsWith('/');

    let result;
    if (isFile) {
      result = await this.astClient.lintFile(params.path, params.options);
    } else {
      result = await this.astClient.lintDirectory(params.path, params.options);
    }

    if (!result.success) {
      return this.failure(
        'AST_LINT_FAILED',
        result.error ?? 'Failed to lint code',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.astClient.isAvailable();
  }
}

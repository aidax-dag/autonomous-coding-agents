/**
 * AST-Grep Rewrite Tool
 *
 * AST-based code transformation and refactoring.
 *
 * @module core/tools/ast-grep/ast-rewrite
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import {
  IASTGrepClient,
  ASTRewriteResult,
  ASTLanguage,
  ASTRewriteOptions,
} from './ast-grep.interface.js';
import { ASTGrepClient } from './ast-grep-client.js';

/**
 * Input parameters for AST rewrite
 */
export interface ASTRewriteInput {
  /** Pattern to match */
  pattern: string;
  /** Replacement template (can use captured metavariables) */
  replacement: string;
  /** Target file or directory path */
  path: string;
  /** Target language (auto-detected from file extension if not specified) */
  language?: ASTLanguage;
  /** Rewrite options */
  options?: ASTRewriteOptions;
}

/**
 * AST-Grep Rewrite Tool
 *
 * Transforms code using AST pattern matching and replacement.
 * Features:
 * - Pattern-based search and replace
 * - Metavariable capture and substitution
 * - Dry run mode for previewing changes
 * - Backup file creation
 * - Multi-file transformation
 */
export class ASTRewriteTool extends BaseTool<ASTRewriteInput, ASTRewriteResult | null> {
  readonly name = 'ast-rewrite';
  readonly description = 'Transform code using AST pattern matching and replacement';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.AST,
    version: '1.0.0',
    parameters: [
      {
        name: 'pattern',
        type: 'string',
        description:
          'AST pattern to match (e.g., "console.log($ARGS)", "var $NAME = $VALUE")',
        required: true,
      },
      {
        name: 'replacement',
        type: 'string',
        description:
          'Replacement template using captured metavariables (e.g., "logger.info($ARGS)", "const $NAME = $VALUE")',
        required: true,
      },
      {
        name: 'path',
        type: 'string',
        description: 'File or directory path to transform',
        required: true,
      },
      {
        name: 'language',
        type: 'string',
        description:
          'Target language (typescript, javascript, python, etc.). Auto-detected if not specified.',
        required: false,
      },
      {
        name: 'options',
        type: 'object',
        description:
          'Rewrite options (dryRun, backup, include/exclude patterns, maxFiles)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description:
        'Rewrite results with transformations applied, modified files, and replacement count',
    },
    tags: ['ast', 'rewrite', 'refactor', 'transform'],
  };

  private readonly astClient: IASTGrepClient;

  constructor(astClient?: IASTGrepClient) {
    super();
    this.astClient = astClient ?? new ASTGrepClient();
  }

  async execute(
    params: ASTRewriteInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ASTRewriteResult | null>> {
    const startTime = Date.now();

    // Determine if path is a file or directory
    const isFile = params.path.includes('.') && !params.path.endsWith('/');

    let result;
    if (isFile) {
      result = await this.astClient.rewriteFile(
        params.path,
        params.pattern,
        params.replacement,
        params.language,
        params.options
      );
    } else {
      result = await this.astClient.rewriteDirectory(
        params.path,
        params.pattern,
        params.replacement,
        params.options
      );
    }

    if (!result.success) {
      return this.failure(
        'AST_REWRITE_FAILED',
        result.error ?? 'Failed to rewrite code',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.astClient.isAvailable();
  }
}

/**
 * AST-Grep Search Tool
 *
 * Pattern-based code search using AST analysis.
 *
 * @module core/tools/ast-grep/ast-search
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
  ASTSearchResult,
  ASTLanguage,
  ASTSearchOptions,
} from './ast-grep.interface.js';
import { ASTGrepClient } from './ast-grep-client.js';

/**
 * Input parameters for AST search
 */
export interface ASTSearchInput {
  /** Pattern to search for (using AST-grep pattern syntax) */
  pattern: string;
  /** Target file or directory path */
  path: string;
  /** Target language (auto-detected from file extension if not specified) */
  language?: ASTLanguage;
  /** Search options */
  options?: ASTSearchOptions;
}

/**
 * AST-Grep Search Tool
 *
 * Searches for code patterns using Abstract Syntax Tree analysis.
 * Supports:
 * - Pattern matching with metavariables ($VAR, $EXPR)
 * - Multi-language support (TypeScript, JavaScript, Python, etc.)
 * - File and directory searches
 * - Contextual matching
 */
export class ASTSearchTool extends BaseTool<ASTSearchInput, ASTSearchResult | null> {
  readonly name = 'ast-search';
  readonly description = 'Search for code patterns using AST analysis';
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
          'AST pattern to search for (e.g., "console.log($ARGS)", "function $NAME($PARAMS) { $BODY }")',
        required: true,
      },
      {
        name: 'path',
        type: 'string',
        description: 'File or directory path to search in',
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
        description: 'Search options (maxMatches, contextLines, include/exclude patterns)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Search results with matches, locations, and captured metavariables',
    },
    tags: ['ast', 'search', 'pattern', 'code-analysis'],
  };

  private readonly astClient: IASTGrepClient;

  constructor(astClient?: IASTGrepClient) {
    super();
    this.astClient = astClient ?? new ASTGrepClient();
  }

  async execute(
    params: ASTSearchInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ASTSearchResult | null>> {
    const startTime = Date.now();

    // Determine if path is a file or directory based on pattern
    const isFile = params.path.includes('.') && !params.path.endsWith('/');

    let result;
    if (isFile) {
      result = await this.astClient.searchFile(
        params.path,
        params.pattern,
        params.language,
        params.options
      );
    } else {
      result = await this.astClient.searchDirectory(params.path, params.pattern, params.options);
    }

    if (!result.success) {
      return this.failure(
        'AST_SEARCH_FAILED',
        result.error ?? 'Failed to search for pattern',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.astClient.isAvailable();
  }
}

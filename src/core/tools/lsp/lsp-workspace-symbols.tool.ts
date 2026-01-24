/**
 * LSP Workspace Symbols Tool
 *
 * Searches for symbols across the entire workspace.
 *
 * @module core/tools/lsp/lsp-workspace-symbols
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { ILSPClient, WorkspaceSymbol } from './lsp.interface.js';
import { LSPClient } from './lsp-client.js';

/**
 * Input parameters for LSP workspace symbols
 */
export interface LSPWorkspaceSymbolsInput {
  /** Search query string */
  query: string;
}

/**
 * Output type for workspace symbols
 */
export type LSPWorkspaceSymbolsOutput = WorkspaceSymbol[] | null;

/**
 * LSP Workspace Symbols Tool
 *
 * Searches for symbols across the entire workspace that match the query.
 * This is useful for:
 * - Finding classes, functions, types by name
 * - Navigating to symbols in other files
 * - Discovering project structure
 */
export class LSPWorkspaceSymbolsTool extends BaseTool<LSPWorkspaceSymbolsInput, LSPWorkspaceSymbolsOutput> {
  readonly name = 'lsp-workspace-symbols';
  readonly description = 'Search for symbols across the entire workspace';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.LSP,
    version: '1.0.0',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query string to match against symbol names',
        required: true,
      },
    ],
    returns: {
      type: 'array',
      description: 'Array of matching symbols with name, kind, and location',
    },
    tags: ['lsp', 'symbols', 'workspace', 'search'],
  };

  private readonly lspClient: ILSPClient;

  constructor(lspClient?: ILSPClient) {
    super();
    this.lspClient = lspClient ?? new LSPClient();
  }

  async execute(
    params: LSPWorkspaceSymbolsInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<LSPWorkspaceSymbolsOutput>> {
    const startTime = Date.now();

    const result = await this.lspClient.searchWorkspaceSymbols(params.query);

    if (!result.success) {
      return this.failure(
        'LSP_WORKSPACE_SYMBOLS_FAILED',
        result.error ?? 'Failed to search workspace symbols',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.lspClient.isInitialized();
  }
}

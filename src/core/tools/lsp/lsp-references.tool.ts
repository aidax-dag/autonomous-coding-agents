/**
 * LSP Find References Tool
 *
 * Finds all references to a symbol at a given position.
 *
 * @module core/tools/lsp/lsp-references
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { ILSPClient, Location, Position } from './lsp.interface.js';
import { LSPClient } from './lsp-client.js';

/**
 * Input parameters for LSP find references
 */
export interface LSPReferencesInput {
  /** File URI (e.g., file:///path/to/file.ts) */
  uri: string;
  /** Line number (0-based) */
  line: number;
  /** Character position (0-based) */
  character: number;
  /** Whether to include the declaration in results (default: true) */
  includeDeclaration?: boolean;
}

/**
 * LSP Find References Tool
 *
 * Returns all locations where a symbol is referenced including:
 * - Usages in the same file
 * - Usages across the project
 * - Optionally the declaration itself
 */
export class LSPReferencesTool extends BaseTool<LSPReferencesInput, Location[] | null> {
  readonly name = 'lsp-references';
  readonly description = 'Find all references to a symbol at a position';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.LSP,
    version: '1.0.0',
    parameters: [
      {
        name: 'uri',
        type: 'string',
        description: 'File URI (e.g., file:///path/to/file.ts)',
        required: true,
      },
      {
        name: 'line',
        type: 'number',
        description: 'Line number (0-based)',
        required: true,
      },
      {
        name: 'character',
        type: 'number',
        description: 'Character position (0-based)',
        required: true,
      },
      {
        name: 'includeDeclaration',
        type: 'boolean',
        description: 'Whether to include the declaration in results (default: true)',
        required: false,
      },
    ],
    returns: {
      type: 'array',
      description: 'Array of locations where the symbol is referenced',
    },
    tags: ['lsp', 'references', 'find', 'usages'],
  };

  private readonly lspClient: ILSPClient;

  constructor(lspClient?: ILSPClient) {
    super();
    this.lspClient = lspClient ?? new LSPClient();
  }

  async execute(
    params: LSPReferencesInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<Location[] | null>> {
    const startTime = Date.now();

    const position: Position = {
      line: params.line,
      character: params.character,
    };

    const includeDeclaration = params.includeDeclaration ?? true;
    const result = await this.lspClient.findReferences(params.uri, position, includeDeclaration);

    if (!result.success) {
      return this.failure(
        'LSP_REFERENCES_FAILED',
        result.error ?? 'Failed to find references',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.lspClient.isInitialized();
  }
}

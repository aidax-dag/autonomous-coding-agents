/**
 * LSP Hover Tool
 *
 * Retrieves hover information (documentation, type info) for a symbol at a position.
 *
 * @module core/tools/lsp/lsp-hover
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { ILSPClient, HoverResult, Position } from './lsp.interface.js';
import { LSPClient } from './lsp-client.js';

/**
 * Input parameters for LSP hover
 */
export interface LSPHoverInput {
  /** File URI (e.g., file:///path/to/file.ts) */
  uri: string;
  /** Line number (0-based) */
  line: number;
  /** Character position (0-based) */
  character: number;
}

/**
 * LSP Hover Tool
 *
 * Returns hover information for a symbol at a given position including:
 * - Documentation
 * - Type information
 * - Signature details
 */
export class LSPHoverTool extends BaseTool<LSPHoverInput, HoverResult | null> {
  readonly name = 'lsp-hover';
  readonly description = 'Get hover information (docs, type) for a symbol at a position';
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
    ],
    returns: {
      type: 'object',
      description: 'Hover information including documentation and type',
    },
    tags: ['lsp', 'hover', 'documentation', 'type'],
  };

  private readonly lspClient: ILSPClient;

  constructor(lspClient?: ILSPClient) {
    super();
    this.lspClient = lspClient ?? new LSPClient();
  }

  async execute(
    params: LSPHoverInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<HoverResult | null>> {
    const startTime = Date.now();

    const position: Position = {
      line: params.line,
      character: params.character,
    };

    const result = await this.lspClient.hover(params.uri, position);

    if (!result.success) {
      return this.failure(
        'LSP_HOVER_FAILED',
        result.error ?? 'Failed to get hover information',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.lspClient.isInitialized();
  }
}

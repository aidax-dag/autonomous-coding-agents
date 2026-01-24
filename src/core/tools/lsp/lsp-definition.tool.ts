/**
 * LSP Go to Definition Tool
 *
 * Finds the definition location of a symbol at a given position.
 *
 * @module core/tools/lsp/lsp-definition
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { ILSPClient, Location, LocationLink, Position } from './lsp.interface.js';
import { LSPClient } from './lsp-client.js';

/**
 * Input parameters for LSP go to definition
 */
export interface LSPDefinitionInput {
  /** File URI (e.g., file:///path/to/file.ts) */
  uri: string;
  /** Line number (0-based) */
  line: number;
  /** Character position (0-based) */
  character: number;
}

/**
 * Output type for definition
 */
export type LSPDefinitionOutput = Location | Location[] | LocationLink[] | null;

/**
 * LSP Go to Definition Tool
 *
 * Returns the definition location(s) for a symbol at a given position.
 * This can return:
 * - A single location
 * - Multiple locations (for overloaded symbols)
 * - Location links (with additional context)
 */
export class LSPDefinitionTool extends BaseTool<LSPDefinitionInput, LSPDefinitionOutput> {
  readonly name = 'lsp-definition';
  readonly description = 'Find the definition location of a symbol at a position';
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
      description: 'Definition location(s) with file URI and range',
    },
    tags: ['lsp', 'definition', 'navigation', 'go-to'],
  };

  private readonly lspClient: ILSPClient;

  constructor(lspClient?: ILSPClient) {
    super();
    this.lspClient = lspClient ?? new LSPClient();
  }

  async execute(
    params: LSPDefinitionInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<LSPDefinitionOutput>> {
    const startTime = Date.now();

    const position: Position = {
      line: params.line,
      character: params.character,
    };

    const result = await this.lspClient.gotoDefinition(params.uri, position);

    if (!result.success) {
      return this.failure(
        'LSP_DEFINITION_FAILED',
        result.error ?? 'Failed to find definition',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.lspClient.isInitialized();
  }
}

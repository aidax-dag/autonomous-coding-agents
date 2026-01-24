/**
 * LSP Document Symbols Tool
 *
 * Retrieves all symbols defined in a document.
 *
 * @module core/tools/lsp/lsp-document-symbols
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { ILSPClient, DocumentSymbol } from './lsp.interface.js';
import { LSPClient } from './lsp-client.js';

/**
 * Input parameters for LSP document symbols
 */
export interface LSPDocumentSymbolsInput {
  /** File URI (e.g., file:///path/to/file.ts) */
  uri: string;
}

/**
 * Output type for document symbols
 */
export type LSPDocumentSymbolsOutput = DocumentSymbol[] | null;

/**
 * LSP Document Symbols Tool
 *
 * Returns all symbols defined in a document including:
 * - Classes, interfaces, types
 * - Functions, methods
 * - Variables, constants
 * - Properties, fields
 * - Modules, namespaces
 */
export class LSPDocumentSymbolsTool extends BaseTool<LSPDocumentSymbolsInput, LSPDocumentSymbolsOutput> {
  readonly name = 'lsp-document-symbols';
  readonly description = 'Get all symbols (functions, classes, etc.) defined in a document';
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
    ],
    returns: {
      type: 'array',
      description: 'Array of symbols with name, kind, location, and children',
    },
    tags: ['lsp', 'symbols', 'outline', 'structure'],
  };

  private readonly lspClient: ILSPClient;

  constructor(lspClient?: ILSPClient) {
    super();
    this.lspClient = lspClient ?? new LSPClient();
  }

  async execute(
    params: LSPDocumentSymbolsInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<LSPDocumentSymbolsOutput>> {
    const startTime = Date.now();

    const result = await this.lspClient.getDocumentSymbols(params.uri);

    if (!result.success) {
      return this.failure(
        'LSP_DOCUMENT_SYMBOLS_FAILED',
        result.error ?? 'Failed to get document symbols',
        Date.now() - startTime
      );
    }

    return this.success(result.data ?? null, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.lspClient.isInitialized();
  }
}

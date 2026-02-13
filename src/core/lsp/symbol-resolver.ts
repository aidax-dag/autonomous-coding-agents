/**
 * Symbol Resolver
 *
 * Provides symbol resolution capabilities (definitions, references,
 * document symbols, workspace symbols) by delegating to configurable
 * resolver functions or an LSP client.
 *
 * @module core/lsp
 */

import type {
  ILSPClient,
  ISymbolResolver,
  Location,
  Position,
  SymbolInfo,
} from './interfaces/lsp.interface';

// ============================================================================
// Types
// ============================================================================

export interface SymbolResolverOptions {
  /** Custom resolver for findDefinition */
  definitionResolver?: (uri: string, position: Position) => Promise<Location | null>;
  /** Custom resolver for findReferences */
  referencesResolver?: (uri: string, position: Position) => Promise<Location[]>;
  /** Custom resolver for getDocumentSymbols */
  documentSymbolsResolver?: (uri: string) => Promise<SymbolInfo[]>;
  /** Custom resolver for getWorkspaceSymbols */
  workspaceSymbolsResolver?: (query: string) => Promise<SymbolInfo[]>;
  /** LSP client for automatic delegation */
  client?: ILSPClient;
}

// ============================================================================
// Implementation
// ============================================================================

export class SymbolResolver implements ISymbolResolver {
  private readonly definitionResolver: ((uri: string, position: Position) => Promise<Location | null>) | null;
  private readonly referencesResolver: ((uri: string, position: Position) => Promise<Location[]>) | null;
  private readonly documentSymbolsResolver: ((uri: string) => Promise<SymbolInfo[]>) | null;
  private readonly workspaceSymbolsResolver: ((query: string) => Promise<SymbolInfo[]>) | null;
  private readonly client: ILSPClient | null;

  constructor(options?: SymbolResolverOptions) {
    this.definitionResolver = options?.definitionResolver ?? null;
    this.referencesResolver = options?.referencesResolver ?? null;
    this.documentSymbolsResolver = options?.documentSymbolsResolver ?? null;
    this.workspaceSymbolsResolver = options?.workspaceSymbolsResolver ?? null;
    this.client = options?.client ?? null;
  }

  async findDefinition(uri: string, position: Position): Promise<Location | null> {
    if (this.definitionResolver) {
      return this.definitionResolver(uri, position);
    }
    if (this.client) {
      return this.client.sendRequest<Location | null>('textDocument/definition', {
        textDocument: { uri },
        position,
      });
    }
    return null;
  }

  async findReferences(uri: string, position: Position): Promise<Location[]> {
    if (this.referencesResolver) {
      return this.referencesResolver(uri, position);
    }
    if (this.client) {
      const result = await this.client.sendRequest<Location[] | null>('textDocument/references', {
        textDocument: { uri },
        position,
        context: { includeDeclaration: true },
      });
      return result ?? [];
    }
    return [];
  }

  async getDocumentSymbols(uri: string): Promise<SymbolInfo[]> {
    if (this.documentSymbolsResolver) {
      return this.documentSymbolsResolver(uri);
    }
    if (this.client) {
      const result = await this.client.sendRequest<SymbolInfo[] | null>('textDocument/documentSymbol', {
        textDocument: { uri },
      });
      return result ?? [];
    }
    return [];
  }

  async getWorkspaceSymbols(query: string): Promise<SymbolInfo[]> {
    if (this.workspaceSymbolsResolver) {
      return this.workspaceSymbolsResolver(query);
    }
    if (this.client) {
      const result = await this.client.sendRequest<SymbolInfo[] | null>('workspace/symbol', {
        query,
      });
      return result ?? [];
    }
    return [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSymbolResolver(options?: SymbolResolverOptions): SymbolResolver {
  return new SymbolResolver(options);
}

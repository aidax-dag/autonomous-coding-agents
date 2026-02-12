/**
 * Symbol Resolver
 *
 * Provides symbol resolution capabilities (definitions, references,
 * document symbols, workspace symbols) by delegating to configurable
 * resolver functions.
 *
 * @module core/lsp
 */

import type {
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
}

// ============================================================================
// Implementation
// ============================================================================

export class SymbolResolver implements ISymbolResolver {
  private readonly definitionResolver: (uri: string, position: Position) => Promise<Location | null>;
  private readonly referencesResolver: (uri: string, position: Position) => Promise<Location[]>;
  private readonly documentSymbolsResolver: (uri: string) => Promise<SymbolInfo[]>;
  private readonly workspaceSymbolsResolver: (query: string) => Promise<SymbolInfo[]>;

  constructor(options?: SymbolResolverOptions) {
    this.definitionResolver = options?.definitionResolver ?? (() => Promise.resolve(null));
    this.referencesResolver = options?.referencesResolver ?? (() => Promise.resolve([]));
    this.documentSymbolsResolver = options?.documentSymbolsResolver ?? (() => Promise.resolve([]));
    this.workspaceSymbolsResolver = options?.workspaceSymbolsResolver ?? (() => Promise.resolve([]));
  }

  async findDefinition(uri: string, position: Position): Promise<Location | null> {
    return this.definitionResolver(uri, position);
  }

  async findReferences(uri: string, position: Position): Promise<Location[]> {
    return this.referencesResolver(uri, position);
  }

  async getDocumentSymbols(uri: string): Promise<SymbolInfo[]> {
    return this.documentSymbolsResolver(uri);
  }

  async getWorkspaceSymbols(query: string): Promise<SymbolInfo[]> {
    return this.workspaceSymbolsResolver(query);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSymbolResolver(options?: SymbolResolverOptions): SymbolResolver {
  return new SymbolResolver(options);
}

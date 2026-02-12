/**
 * LSP Integration Module
 *
 * @module core/lsp
 */

export type {
  ILSPClient,
  ISymbolResolver,
  IRefactorEngine,
  IDiagnosticsCollector,
  LSPServerConfig,
  SymbolInfo,
  SymbolKind,
  Location,
  Range,
  Position,
  Diagnostic,
  DiagnosticSeverity,
  RefactorResult,
} from './interfaces/lsp.interface';

export {
  LSPClient,
  createLSPClient,
  type LSPClientOptions,
} from './lsp-client';

export {
  SymbolResolver,
  createSymbolResolver,
  type SymbolResolverOptions,
} from './symbol-resolver';

export {
  RefactorEngine,
  createRefactorEngine,
  type RefactorEngineOptions,
} from './refactor-engine';

export {
  DiagnosticsCollector,
  createDiagnosticsCollector,
  type DiagnosticsCollectorOptions,
} from './diagnostics-collector';

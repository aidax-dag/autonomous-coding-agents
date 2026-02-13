/**
 * LSP Integration Module
 *
 * @module core/lsp
 */

export type {
  ILSPClient,
  ILSPTransport,
  ISymbolResolver,
  IRefactorEngine,
  IDiagnosticsCollector,
  LspJsonRpcMessage,
  LSPServerCapabilities,
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
  LspStdioTransport,
  createLspStdioTransport,
} from './lsp-transport';

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

export {
  DocumentSync,
  createDocumentSync,
  type DocumentSyncConfig,
  type IDocumentSync,
  type TextDocumentContentChangeEvent,
} from './document-sync';

export {
  SymbolCache,
  createSymbolCache,
  type SymbolCacheConfig,
  type CachedEntry,
} from './symbol-cache';

export {
  LSPConnectionManager,
  createLSPConnectionManager,
  type LSPServerEntry,
  type LSPConnectionManagerConfig,
  type LSPConnectionStatus,
} from './lsp-connection-manager';

export {
  LSP_PRESETS,
  getLSPPreset,
  listLSPPresets,
} from './presets/index';

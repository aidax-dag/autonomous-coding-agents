/**
 * LSP Module Interfaces
 * @module core/lsp/interfaces
 */

// ============================================================================
// JSON-RPC Types
// ============================================================================

/** JSON-RPC 2.0 message for LSP protocol */
export interface LspJsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ============================================================================
// Transport
// ============================================================================

/** LSP Transport interface (Content-Length framed stdio) */
export interface ILSPTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: LspJsonRpcMessage): Promise<void>;
  onMessage(handler: (message: LspJsonRpcMessage) => void): void;
  onNotification(handler: (method: string, params: unknown) => void): void;
  isConnected(): boolean;
}

// ============================================================================
// Server Capabilities
// ============================================================================

/** Server capabilities received from initialize response */
export interface LSPServerCapabilities {
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  documentSymbolProvider?: boolean;
  workspaceSymbolProvider?: boolean;
  renameProvider?: boolean | { prepareProvider?: boolean };
  textDocumentSync?: number;
  completionProvider?: { triggerCharacters?: string[] };
  hoverProvider?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Server Config
// ============================================================================

export interface LSPServerConfig {
  language: string;
  command: string;
  args?: string[];
  rootUri?: string;
}

// ============================================================================
// LSP Data Types
// ============================================================================

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
}

export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'interface'
  | 'enum'
  | 'module'
  | 'property';

export interface Location {
  uri: string;
  range: Range;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  character: number;
}

export interface Diagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  code?: string | number;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface RefactorResult {
  success: boolean;
  changes: Array<{
    uri: string;
    edits: Array<{ range: Range; newText: string }>;
  }>;
  error?: string;
}

// ============================================================================
// Module Interfaces
// ============================================================================

export interface ILSPClient {
  connect(config: LSPServerConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T>;
  sendNotification(method: string, params?: unknown): Promise<void>;
  onNotification(handler: (method: string, params: unknown) => void): void;
  getCapabilities(): LSPServerCapabilities | null;
}

export interface ISymbolResolver {
  findDefinition(uri: string, position: Position): Promise<Location | null>;
  findReferences(uri: string, position: Position): Promise<Location[]>;
  getDocumentSymbols(uri: string): Promise<SymbolInfo[]>;
  getWorkspaceSymbols(query: string): Promise<SymbolInfo[]>;
}

export interface IRefactorEngine {
  rename(
    uri: string,
    position: Position,
    newName: string,
  ): Promise<RefactorResult>;
  extractFunction(
    uri: string,
    range: Range,
    name: string,
  ): Promise<RefactorResult>;
}

export interface IDiagnosticsCollector {
  collectDiagnostics(uri: string): Promise<Diagnostic[]>;
  collectAll(): Promise<Map<string, Diagnostic[]>>;
  getErrorCount(): number;
  getWarningCount(): number;
}

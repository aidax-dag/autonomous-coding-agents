/**
 * LSP Module Interfaces
 * @module core/lsp/interfaces
 */

export interface LSPServerConfig {
  language: string;
  command: string;
  args?: string[];
  rootUri?: string;
}

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

export interface ILSPClient {
  connect(config: LSPServerConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
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

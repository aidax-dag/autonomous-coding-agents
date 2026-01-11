/**
 * LSP (Language Server Protocol) Tool Interfaces
 *
 * Defines types and interfaces for Language Server Protocol operations.
 * Provides code intelligence features like hover, go-to-definition, references, etc.
 *
 * @module core/tools/lsp/lsp.interface
 */

// ============================================================================
// Position & Range Types
// ============================================================================

/**
 * Position in a text document (0-based line and character)
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * Range in a text document
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Location in a document (file path + range)
 */
export interface Location {
  uri: string;
  range: Range;
}

/**
 * Location with additional context
 */
export interface LocationLink {
  originSelectionRange?: Range;
  targetUri: string;
  targetRange: Range;
  targetSelectionRange: Range;
}

// ============================================================================
// Diagnostic Types
// ============================================================================

/**
 * Diagnostic severity levels
 */
export enum DiagnosticSeverity {
  ERROR = 1,
  WARNING = 2,
  INFORMATION = 3,
  HINT = 4,
}

/**
 * Diagnostic tags for additional classification
 */
export enum DiagnosticTag {
  UNNECESSARY = 1,
  DEPRECATED = 2,
}

/**
 * Related information for a diagnostic
 */
export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

/**
 * Code information for diagnostics
 */
export interface DiagnosticCode {
  value: string | number;
  target?: string;
}

/**
 * Diagnostic information for code issues
 */
export interface Diagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  code?: string | number | DiagnosticCode;
  codeDescription?: { href: string };
  source?: string;
  message: string;
  tags?: DiagnosticTag[];
  relatedInformation?: DiagnosticRelatedInformation[];
  data?: unknown;
}

// ============================================================================
// Symbol Types
// ============================================================================

/**
 * Symbol kinds (matches LSP SymbolKind)
 */
export enum SymbolKind {
  FILE = 1,
  MODULE = 2,
  NAMESPACE = 3,
  PACKAGE = 4,
  CLASS = 5,
  METHOD = 6,
  PROPERTY = 7,
  FIELD = 8,
  CONSTRUCTOR = 9,
  ENUM = 10,
  INTERFACE = 11,
  FUNCTION = 12,
  VARIABLE = 13,
  CONSTANT = 14,
  STRING = 15,
  NUMBER = 16,
  BOOLEAN = 17,
  ARRAY = 18,
  OBJECT = 19,
  KEY = 20,
  NULL = 21,
  ENUM_MEMBER = 22,
  STRUCT = 23,
  EVENT = 24,
  OPERATOR = 25,
  TYPE_PARAMETER = 26,
}

/**
 * Symbol tags for additional classification
 */
export enum SymbolTag {
  DEPRECATED = 1,
}

/**
 * Document symbol information (hierarchical)
 */
export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  deprecated?: boolean;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

/**
 * Workspace symbol information (flat)
 */
export interface WorkspaceSymbol {
  name: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  containerName?: string;
  location: Location | { uri: string };
  data?: unknown;
}

// ============================================================================
// Hover Types
// ============================================================================

/**
 * Markup kind for content
 */
export enum MarkupKind {
  PLAIN_TEXT = 'plaintext',
  MARKDOWN = 'markdown',
}

/**
 * Markup content (text or markdown)
 */
export interface MarkupContent {
  kind: MarkupKind;
  value: string;
}

/**
 * Hover result
 */
export interface HoverResult {
  contents: MarkupContent | MarkupContent[] | string;
  range?: Range;
}

// ============================================================================
// Completion Types
// ============================================================================

/**
 * Completion item kinds
 */
export enum CompletionItemKind {
  TEXT = 1,
  METHOD = 2,
  FUNCTION = 3,
  CONSTRUCTOR = 4,
  FIELD = 5,
  VARIABLE = 6,
  CLASS = 7,
  INTERFACE = 8,
  MODULE = 9,
  PROPERTY = 10,
  UNIT = 11,
  VALUE = 12,
  ENUM = 13,
  KEYWORD = 14,
  SNIPPET = 15,
  COLOR = 16,
  FILE = 17,
  REFERENCE = 18,
  FOLDER = 19,
  ENUM_MEMBER = 20,
  CONSTANT = 21,
  STRUCT = 22,
  EVENT = 23,
  OPERATOR = 24,
  TYPE_PARAMETER = 25,
}

/**
 * Insert text format
 */
export enum InsertTextFormat {
  PLAIN_TEXT = 1,
  SNIPPET = 2,
}

/**
 * Text edit for completion
 */
export interface TextEdit {
  range: Range;
  newText: string;
}

/**
 * Completion item
 */
export interface CompletionItem {
  label: string;
  labelDetails?: {
    detail?: string;
    description?: string;
  };
  kind?: CompletionItemKind;
  tags?: SymbolTag[];
  detail?: string;
  documentation?: string | MarkupContent;
  deprecated?: boolean;
  preselect?: boolean;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: InsertTextFormat;
  textEdit?: TextEdit;
  additionalTextEdits?: TextEdit[];
  commitCharacters?: string[];
  command?: Command;
  data?: unknown;
}

/**
 * Completion list
 */
export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

// ============================================================================
// Code Action Types
// ============================================================================

/**
 * Code action kinds
 */
export enum CodeActionKind {
  EMPTY = '',
  QUICK_FIX = 'quickfix',
  REFACTOR = 'refactor',
  REFACTOR_EXTRACT = 'refactor.extract',
  REFACTOR_INLINE = 'refactor.inline',
  REFACTOR_REWRITE = 'refactor.rewrite',
  SOURCE = 'source',
  SOURCE_ORGANIZE_IMPORTS = 'source.organizeImports',
  SOURCE_FIX_ALL = 'source.fixAll',
}

/**
 * Command to execute
 */
export interface Command {
  title: string;
  command: string;
  arguments?: unknown[];
}

/**
 * Code action
 */
export interface CodeAction {
  title: string;
  kind?: CodeActionKind | string;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  disabled?: { reason: string };
  edit?: WorkspaceEdit;
  command?: Command;
  data?: unknown;
}

/**
 * Code action context
 */
export interface CodeActionContext {
  diagnostics: Diagnostic[];
  only?: (CodeActionKind | string)[];
  triggerKind?: CodeActionTriggerKind;
}

/**
 * Code action trigger kind
 */
export enum CodeActionTriggerKind {
  INVOKED = 1,
  AUTOMATIC = 2,
}

// ============================================================================
// Workspace Edit Types
// ============================================================================

/**
 * Text document edit
 */
export interface TextDocumentEdit {
  textDocument: VersionedTextDocumentIdentifier;
  edits: TextEdit[];
}

/**
 * Versioned text document identifier
 */
export interface VersionedTextDocumentIdentifier {
  uri: string;
  version: number | null;
}

/**
 * Create file operation
 */
export interface CreateFile {
  kind: 'create';
  uri: string;
  options?: {
    overwrite?: boolean;
    ignoreIfExists?: boolean;
  };
}

/**
 * Rename file operation
 */
export interface RenameFile {
  kind: 'rename';
  oldUri: string;
  newUri: string;
  options?: {
    overwrite?: boolean;
    ignoreIfExists?: boolean;
  };
}

/**
 * Delete file operation
 */
export interface DeleteFile {
  kind: 'delete';
  uri: string;
  options?: {
    recursive?: boolean;
    ignoreIfNotExists?: boolean;
  };
}

/**
 * Document change (text edit or file operation)
 */
export type DocumentChange = TextDocumentEdit | CreateFile | RenameFile | DeleteFile;

/**
 * Workspace edit
 */
export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
  documentChanges?: DocumentChange[];
  changeAnnotations?: Record<string, ChangeAnnotation>;
}

/**
 * Change annotation
 */
export interface ChangeAnnotation {
  label: string;
  needsConfirmation?: boolean;
  description?: string;
}

// ============================================================================
// Signature Help Types
// ============================================================================

/**
 * Parameter information
 */
export interface ParameterInformation {
  label: string | [number, number];
  documentation?: string | MarkupContent;
}

/**
 * Signature information
 */
export interface SignatureInformation {
  label: string;
  documentation?: string | MarkupContent;
  parameters?: ParameterInformation[];
  activeParameter?: number;
}

/**
 * Signature help result
 */
export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

// ============================================================================
// Call Hierarchy Types
// ============================================================================

/**
 * Call hierarchy item
 */
export interface CallHierarchyItem {
  name: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  detail?: string;
  uri: string;
  range: Range;
  selectionRange: Range;
  data?: unknown;
}

/**
 * Incoming call
 */
export interface CallHierarchyIncomingCall {
  from: CallHierarchyItem;
  fromRanges: Range[];
}

/**
 * Outgoing call
 */
export interface CallHierarchyOutgoingCall {
  to: CallHierarchyItem;
  fromRanges: Range[];
}

// ============================================================================
// Type Hierarchy Types
// ============================================================================

/**
 * Type hierarchy item
 */
export interface TypeHierarchyItem {
  name: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  detail?: string;
  uri: string;
  range: Range;
  selectionRange: Range;
  data?: unknown;
}

// ============================================================================
// Rename Types
// ============================================================================

/**
 * Prepare rename result
 */
export interface PrepareRenameResult {
  range: Range;
  placeholder?: string;
  defaultBehavior?: boolean;
}

// ============================================================================
// Formatting Types
// ============================================================================

/**
 * Formatting options
 */
export interface FormattingOptions {
  tabSize: number;
  insertSpaces: boolean;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
  trimFinalNewlines?: boolean;
  [key: string]: boolean | number | string | undefined;
}

// ============================================================================
// LSP Server Configuration
// ============================================================================

/**
 * Supported language IDs
 */
export enum LanguageId {
  TYPESCRIPT = 'typescript',
  TYPESCRIPT_REACT = 'typescriptreact',
  JAVASCRIPT = 'javascript',
  JAVASCRIPT_REACT = 'javascriptreact',
  PYTHON = 'python',
  RUST = 'rust',
  GO = 'go',
  JAVA = 'java',
  C = 'c',
  CPP = 'cpp',
  CSHARP = 'csharp',
  RUBY = 'ruby',
  PHP = 'php',
  HTML = 'html',
  CSS = 'css',
  JSON = 'json',
  YAML = 'yaml',
  MARKDOWN = 'markdown',
}

/**
 * LSP server configuration
 */
export interface LSPServerConfig {
  /**
   * Unique identifier for this server
   */
  id: string;

  /**
   * Display name
   */
  name: string;

  /**
   * Language(s) this server supports
   */
  languages: LanguageId[];

  /**
   * Command to start the server
   */
  command: string;

  /**
   * Command arguments
   */
  args?: string[];

  /**
   * Working directory
   */
  cwd?: string;

  /**
   * Environment variables
   */
  env?: Record<string, string>;

  /**
   * Initialization options
   */
  initializationOptions?: Record<string, unknown>;

  /**
   * Root path for the workspace
   */
  rootPath?: string;

  /**
   * Root URIs for the workspace
   */
  rootUris?: string[];

  /**
   * Connection timeout in milliseconds
   */
  timeout?: number;

  /**
   * Whether to use stdio for communication
   */
  stdio?: boolean;

  /**
   * TCP port for socket communication
   */
  port?: number;

  /**
   * TCP host for socket communication
   */
  host?: string;
}

/**
 * LSP server status
 */
export enum LSPServerStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  ERROR = 'error',
  STOPPING = 'stopping',
}

/**
 * LSP server state information
 */
export interface LSPServerState {
  id: string;
  name: string;
  status: LSPServerStatus;
  languages: LanguageId[];
  pid?: number;
  startedAt?: Date;
  error?: string;
  capabilities?: ServerCapabilities;
}

/**
 * Server capabilities (subset of LSP ServerCapabilities)
 */
export interface ServerCapabilities {
  hoverProvider?: boolean;
  completionProvider?: {
    triggerCharacters?: string[];
    resolveProvider?: boolean;
  };
  signatureHelpProvider?: {
    triggerCharacters?: string[];
    retriggerCharacters?: string[];
  };
  definitionProvider?: boolean;
  typeDefinitionProvider?: boolean;
  implementationProvider?: boolean;
  referencesProvider?: boolean;
  documentHighlightProvider?: boolean;
  documentSymbolProvider?: boolean;
  workspaceSymbolProvider?: boolean;
  codeActionProvider?: boolean | { codeActionKinds?: string[] };
  codeLensProvider?: { resolveProvider?: boolean };
  documentFormattingProvider?: boolean;
  documentRangeFormattingProvider?: boolean;
  documentOnTypeFormattingProvider?: {
    firstTriggerCharacter: string;
    moreTriggerCharacter?: string[];
  };
  renameProvider?: boolean | { prepareProvider?: boolean };
  foldingRangeProvider?: boolean;
  callHierarchyProvider?: boolean;
  typeHierarchyProvider?: boolean;
  semanticTokensProvider?: unknown;
  inlayHintProvider?: boolean;
}

// ============================================================================
// LSP Client Options
// ============================================================================

/**
 * LSP client options
 */
export interface LSPClientOptions {
  /**
   * Maximum time to wait for responses (ms)
   */
  timeout?: number;

  /**
   * Auto-start servers on first use
   */
  autoStart?: boolean;

  /**
   * Auto-restart failed servers
   */
  autoRestart?: boolean;

  /**
   * Maximum restart attempts
   */
  maxRestartAttempts?: number;

  /**
   * Restart delay in milliseconds
   */
  restartDelay?: number;

  /**
   * Enable logging
   */
  logging?: boolean;

  /**
   * Log level
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// Operation Results
// ============================================================================

/**
 * LSP operation result
 */
export interface LSPOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  serverId?: string;
  duration?: number;
}

// ============================================================================
// LSP Client Interface
// ============================================================================

/**
 * LSP Client Interface
 *
 * Provides code intelligence features through Language Server Protocol.
 */
export interface ILSPClient {
  // === Server Management ===

  /**
   * Start a language server
   */
  startServer(config: LSPServerConfig): Promise<LSPOperationResult>;

  /**
   * Stop a language server
   */
  stopServer(serverId: string): Promise<LSPOperationResult>;

  /**
   * Stop all language servers
   */
  stopAllServers(): Promise<LSPOperationResult>;

  /**
   * Get server state
   */
  getServerState(serverId: string): LSPServerState | undefined;

  /**
   * Get all server states
   */
  getAllServerStates(): LSPServerState[];

  /**
   * Check if server is running
   */
  isServerRunning(serverId: string): boolean;

  /**
   * Get server for a language
   */
  getServerForLanguage(language: LanguageId): LSPServerState | undefined;

  // === Document Synchronization ===

  /**
   * Open a document
   */
  openDocument(
    uri: string,
    languageId: LanguageId,
    version: number,
    text: string
  ): Promise<LSPOperationResult>;

  /**
   * Close a document
   */
  closeDocument(uri: string): Promise<LSPOperationResult>;

  /**
   * Update document content
   */
  updateDocument(
    uri: string,
    version: number,
    changes: TextEdit[]
  ): Promise<LSPOperationResult>;

  /**
   * Replace entire document content
   */
  replaceDocumentContent(
    uri: string,
    version: number,
    text: string
  ): Promise<LSPOperationResult>;

  // === Code Intelligence ===

  /**
   * Get hover information
   */
  hover(uri: string, position: Position): Promise<LSPOperationResult<HoverResult | null>>;

  /**
   * Go to definition
   */
  gotoDefinition(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<Location[] | LocationLink[] | null>>;

  /**
   * Go to type definition
   */
  gotoTypeDefinition(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<Location[] | LocationLink[] | null>>;

  /**
   * Go to implementation
   */
  gotoImplementation(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<Location[] | LocationLink[] | null>>;

  /**
   * Find references
   */
  findReferences(
    uri: string,
    position: Position,
    includeDeclaration?: boolean
  ): Promise<LSPOperationResult<Location[] | null>>;

  /**
   * Get document symbols
   */
  getDocumentSymbols(
    uri: string
  ): Promise<LSPOperationResult<DocumentSymbol[] | null>>;

  /**
   * Search workspace symbols
   */
  searchWorkspaceSymbols(
    query: string
  ): Promise<LSPOperationResult<WorkspaceSymbol[] | null>>;

  // === Diagnostics ===

  /**
   * Get diagnostics for a document
   */
  getDiagnostics(uri: string): Promise<LSPOperationResult<Diagnostic[] | null>>;

  /**
   * Subscribe to diagnostic updates
   */
  onDiagnostics(
    callback: (uri: string, diagnostics: Diagnostic[]) => void
  ): LSPSubscription;

  // === Completion ===

  /**
   * Get completions
   */
  getCompletions(
    uri: string,
    position: Position,
    context?: { triggerKind: number; triggerCharacter?: string }
  ): Promise<LSPOperationResult<CompletionList | CompletionItem[] | null>>;

  /**
   * Resolve completion item
   */
  resolveCompletion(
    item: CompletionItem
  ): Promise<LSPOperationResult<CompletionItem>>;

  // === Signature Help ===

  /**
   * Get signature help
   */
  getSignatureHelp(
    uri: string,
    position: Position,
    context?: { triggerKind: number; triggerCharacter?: string; isRetrigger: boolean }
  ): Promise<LSPOperationResult<SignatureHelp | null>>;

  // === Code Actions ===

  /**
   * Get code actions
   */
  getCodeActions(
    uri: string,
    range: Range,
    context: CodeActionContext
  ): Promise<LSPOperationResult<CodeAction[] | null>>;

  /**
   * Resolve code action
   */
  resolveCodeAction(
    action: CodeAction
  ): Promise<LSPOperationResult<CodeAction>>;

  /**
   * Execute command
   */
  executeCommand(
    command: string,
    args?: unknown[]
  ): Promise<LSPOperationResult<unknown>>;

  // === Refactoring ===

  /**
   * Prepare rename
   */
  prepareRename(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<PrepareRenameResult | null>>;

  /**
   * Rename symbol
   */
  rename(
    uri: string,
    position: Position,
    newName: string
  ): Promise<LSPOperationResult<WorkspaceEdit | null>>;

  // === Formatting ===

  /**
   * Format document
   */
  formatDocument(
    uri: string,
    options: FormattingOptions
  ): Promise<LSPOperationResult<TextEdit[] | null>>;

  /**
   * Format range
   */
  formatRange(
    uri: string,
    range: Range,
    options: FormattingOptions
  ): Promise<LSPOperationResult<TextEdit[] | null>>;

  /**
   * Format on type
   */
  formatOnType(
    uri: string,
    position: Position,
    character: string,
    options: FormattingOptions
  ): Promise<LSPOperationResult<TextEdit[] | null>>;

  // === Call Hierarchy ===

  /**
   * Prepare call hierarchy
   */
  prepareCallHierarchy(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<CallHierarchyItem[] | null>>;

  /**
   * Get incoming calls
   */
  getIncomingCalls(
    item: CallHierarchyItem
  ): Promise<LSPOperationResult<CallHierarchyIncomingCall[] | null>>;

  /**
   * Get outgoing calls
   */
  getOutgoingCalls(
    item: CallHierarchyItem
  ): Promise<LSPOperationResult<CallHierarchyOutgoingCall[] | null>>;

  // === Type Hierarchy ===

  /**
   * Prepare type hierarchy
   */
  prepareTypeHierarchy(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<TypeHierarchyItem[] | null>>;

  /**
   * Get supertypes
   */
  getSupertypes(
    item: TypeHierarchyItem
  ): Promise<LSPOperationResult<TypeHierarchyItem[] | null>>;

  /**
   * Get subtypes
   */
  getSubtypes(
    item: TypeHierarchyItem
  ): Promise<LSPOperationResult<TypeHierarchyItem[] | null>>;

  // === Lifecycle ===

  /**
   * Initialize client
   */
  initialize(options?: LSPClientOptions): Promise<LSPOperationResult>;

  /**
   * Dispose client and all servers
   */
  dispose(): Promise<void>;

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean;
}

/**
 * LSP subscription for event handlers
 */
export interface LSPSubscription {
  unsubscribe(): void;
}

/**
 * LSP service interface (higher-level abstraction)
 */
export interface ILSPService {
  // === Connection Management ===

  /**
   * Connect to a language server
   */
  connect(config: LSPServerConfig): Promise<void>;

  /**
   * Disconnect from a language server
   */
  disconnect(serverId: string): Promise<void>;

  /**
   * Get connected servers
   */
  getConnectedServers(): LSPServerState[];

  // === Code Intelligence (simplified) ===

  /**
   * Get hover information at position
   */
  hover(file: string, position: Position): Promise<HoverResult | null>;

  /**
   * Go to definition
   */
  gotoDefinition(file: string, position: Position): Promise<Location[]>;

  /**
   * Find all references
   */
  findReferences(file: string, position: Position): Promise<Location[]>;

  /**
   * Get document symbols
   */
  getDocumentSymbols(file: string): Promise<DocumentSymbol[]>;

  // === Refactoring ===

  /**
   * Rename symbol
   */
  rename(
    file: string,
    position: Position,
    newName: string
  ): Promise<WorkspaceEdit | null>;

  /**
   * Get code actions
   */
  getCodeActions(file: string, range: Range): Promise<CodeAction[]>;

  /**
   * Apply code action
   */
  applyCodeAction(action: CodeAction): Promise<void>;

  // === Diagnostics ===

  /**
   * Get diagnostics for a file
   */
  getDiagnostics(file: string): Promise<Diagnostic[]>;

  // === Formatting ===

  /**
   * Format a document
   */
  formatDocument(file: string, options?: FormattingOptions): Promise<TextEdit[]>;
}

/**
 * Default LSP client options
 */
export const DEFAULT_LSP_CLIENT_OPTIONS: Required<LSPClientOptions> = {
  timeout: 30000,
  autoStart: true,
  autoRestart: true,
  maxRestartAttempts: 3,
  restartDelay: 1000,
  logging: false,
  logLevel: 'info',
};

/**
 * Common language server commands
 */
export const COMMON_LSP_SERVERS: Record<LanguageId, Partial<LSPServerConfig>> = {
  [LanguageId.TYPESCRIPT]: {
    id: 'typescript-language-server',
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    languages: [
      LanguageId.TYPESCRIPT,
      LanguageId.TYPESCRIPT_REACT,
      LanguageId.JAVASCRIPT,
      LanguageId.JAVASCRIPT_REACT,
    ],
  },
  [LanguageId.TYPESCRIPT_REACT]: {
    id: 'typescript-language-server',
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    languages: [
      LanguageId.TYPESCRIPT,
      LanguageId.TYPESCRIPT_REACT,
      LanguageId.JAVASCRIPT,
      LanguageId.JAVASCRIPT_REACT,
    ],
  },
  [LanguageId.JAVASCRIPT]: {
    id: 'typescript-language-server',
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    languages: [
      LanguageId.TYPESCRIPT,
      LanguageId.TYPESCRIPT_REACT,
      LanguageId.JAVASCRIPT,
      LanguageId.JAVASCRIPT_REACT,
    ],
  },
  [LanguageId.JAVASCRIPT_REACT]: {
    id: 'typescript-language-server',
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    languages: [
      LanguageId.TYPESCRIPT,
      LanguageId.TYPESCRIPT_REACT,
      LanguageId.JAVASCRIPT,
      LanguageId.JAVASCRIPT_REACT,
    ],
  },
  [LanguageId.PYTHON]: {
    id: 'pyright-language-server',
    name: 'Pyright Language Server',
    command: 'pyright-langserver',
    args: ['--stdio'],
    languages: [LanguageId.PYTHON],
  },
  [LanguageId.RUST]: {
    id: 'rust-analyzer',
    name: 'Rust Analyzer',
    command: 'rust-analyzer',
    languages: [LanguageId.RUST],
  },
  [LanguageId.GO]: {
    id: 'gopls',
    name: 'Go Language Server',
    command: 'gopls',
    args: ['serve'],
    languages: [LanguageId.GO],
  },
  [LanguageId.JAVA]: {
    id: 'jdtls',
    name: 'Eclipse JDT Language Server',
    command: 'jdtls',
    languages: [LanguageId.JAVA],
  },
  [LanguageId.C]: {
    id: 'clangd',
    name: 'Clangd',
    command: 'clangd',
    languages: [LanguageId.C, LanguageId.CPP],
  },
  [LanguageId.CPP]: {
    id: 'clangd',
    name: 'Clangd',
    command: 'clangd',
    languages: [LanguageId.C, LanguageId.CPP],
  },
  [LanguageId.CSHARP]: {
    id: 'omnisharp',
    name: 'OmniSharp',
    command: 'omnisharp',
    args: ['--languageserver'],
    languages: [LanguageId.CSHARP],
  },
  [LanguageId.RUBY]: {
    id: 'solargraph',
    name: 'Solargraph',
    command: 'solargraph',
    args: ['stdio'],
    languages: [LanguageId.RUBY],
  },
  [LanguageId.PHP]: {
    id: 'intelephense',
    name: 'Intelephense',
    command: 'intelephense',
    args: ['--stdio'],
    languages: [LanguageId.PHP],
  },
  [LanguageId.HTML]: {
    id: 'html-language-server',
    name: 'HTML Language Server',
    command: 'vscode-html-language-server',
    args: ['--stdio'],
    languages: [LanguageId.HTML],
  },
  [LanguageId.CSS]: {
    id: 'css-language-server',
    name: 'CSS Language Server',
    command: 'vscode-css-language-server',
    args: ['--stdio'],
    languages: [LanguageId.CSS],
  },
  [LanguageId.JSON]: {
    id: 'json-language-server',
    name: 'JSON Language Server',
    command: 'vscode-json-language-server',
    args: ['--stdio'],
    languages: [LanguageId.JSON],
  },
  [LanguageId.YAML]: {
    id: 'yaml-language-server',
    name: 'YAML Language Server',
    command: 'yaml-language-server',
    args: ['--stdio'],
    languages: [LanguageId.YAML],
  },
  [LanguageId.MARKDOWN]: {
    id: 'markdown-language-server',
    name: 'Markdown Language Server',
    command: 'marksman',
    args: ['server'],
    languages: [LanguageId.MARKDOWN],
  },
};

/**
 * Helper to get file URI from path
 */
export function pathToUri(path: string): string {
  // Handle Windows paths
  if (path.startsWith('/')) {
    return `file://${path}`;
  } else if (/^[a-zA-Z]:/.test(path)) {
    // Windows drive letter
    return `file:///${path.replace(/\\/g, '/')}`;
  }
  return `file://${path}`;
}

/**
 * Helper to get path from file URI
 */
export function uriToPath(uri: string): string {
  if (uri.startsWith('file:///')) {
    // Windows path
    if (uri.charAt(9) === ':') {
      return uri.slice(8).replace(/\//g, '\\');
    }
    return uri.slice(7);
  } else if (uri.startsWith('file://')) {
    return uri.slice(7);
  }
  return uri;
}

/**
 * Helper to detect language from file extension
 */
export function detectLanguage(filePath: string): LanguageId | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const extensionMap: Record<string, LanguageId> = {
    ts: LanguageId.TYPESCRIPT,
    tsx: LanguageId.TYPESCRIPT_REACT,
    js: LanguageId.JAVASCRIPT,
    jsx: LanguageId.JAVASCRIPT_REACT,
    mjs: LanguageId.JAVASCRIPT,
    cjs: LanguageId.JAVASCRIPT,
    py: LanguageId.PYTHON,
    rs: LanguageId.RUST,
    go: LanguageId.GO,
    java: LanguageId.JAVA,
    c: LanguageId.C,
    h: LanguageId.C,
    cpp: LanguageId.CPP,
    cxx: LanguageId.CPP,
    cc: LanguageId.CPP,
    hpp: LanguageId.CPP,
    cs: LanguageId.CSHARP,
    rb: LanguageId.RUBY,
    php: LanguageId.PHP,
    html: LanguageId.HTML,
    htm: LanguageId.HTML,
    css: LanguageId.CSS,
    scss: LanguageId.CSS,
    less: LanguageId.CSS,
    json: LanguageId.JSON,
    jsonc: LanguageId.JSON,
    yaml: LanguageId.YAML,
    yml: LanguageId.YAML,
    md: LanguageId.MARKDOWN,
    markdown: LanguageId.MARKDOWN,
  };

  return ext ? extensionMap[ext] : undefined;
}

/**
 * LSP Client Implementation
 *
 * Provides Language Server Protocol client for code intelligence features.
 * Communicates with language servers via JSON-RPC over stdio.
 *
 * @module core/tools/lsp/lsp-client
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import {
  ILSPClient,
  LSPServerConfig,
  LSPServerState,
  LSPServerStatus,
  LSPClientOptions,
  LSPOperationResult,
  LSPSubscription,
  Position,
  Range,
  Location,
  LocationLink,
  HoverResult,
  Diagnostic,
  DocumentSymbol,
  WorkspaceSymbol,
  CompletionList,
  CompletionItem,
  SignatureHelp,
  CodeAction,
  CodeActionContext,
  WorkspaceEdit,
  PrepareRenameResult,
  FormattingOptions,
  TextEdit,
  CallHierarchyItem,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  TypeHierarchyItem,
  ServerCapabilities,
  LanguageId,
  DEFAULT_LSP_CLIENT_OPTIONS,
  pathToUri,
} from './lsp.interface.js';

/**
 * JSON-RPC message ID counter
 */
let messageIdCounter = 0;

/**
 * Generate unique message ID
 */
function generateId(): number {
  return ++messageIdCounter;
}

/**
 * JSON-RPC Request
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC Notification
 */
interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC Response
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Pending request info
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * LSP Server Connection
 */
class LSPServerConnection {
  private process: ChildProcess | null = null;
  private buffer = '';
  private pendingRequests = new Map<number, PendingRequest>();
  private eventEmitter = new EventEmitter();
  private capabilities: ServerCapabilities | undefined;
  private initialized = false;
  private restartAttempts = 0;

  readonly config: LSPServerConfig;
  readonly options: Required<LSPClientOptions>;
  status: LSPServerStatus = LSPServerStatus.STOPPED;
  startedAt?: Date;
  error?: string;

  constructor(config: LSPServerConfig, options: Required<LSPClientOptions>) {
    this.config = config;
    this.options = options;
  }

  /**
   * Start the language server process
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Server already running');
    }

    this.status = LSPServerStatus.STARTING;
    this.error = undefined;

    try {
      this.process = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        if (this.options.logging) {
          console.error(`[LSP ${this.config.id}] stderr:`, data.toString());
        }
      });

      this.process.on('error', (err) => {
        this.handleProcessError(err);
      });

      this.process.on('exit', (code, signal) => {
        this.handleProcessExit(code, signal);
      });

      // Initialize the server
      await this.initialize();

      this.status = LSPServerStatus.RUNNING;
      this.startedAt = new Date();
      this.restartAttempts = 0;

      if (this.options.logging) {
        console.log(`[LSP ${this.config.id}] Server started`);
      }
    } catch (err) {
      this.status = LSPServerStatus.ERROR;
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  /**
   * Stop the language server
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    this.status = LSPServerStatus.STOPPING;

    try {
      // Send shutdown request
      await this.sendRequest('shutdown', null);
      // Send exit notification
      this.sendNotification('exit', null);
    } catch {
      // Ignore errors during shutdown
    }

    // Force kill if still running after timeout
    const killTimeout = setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, 5000);

    return new Promise((resolve) => {
      if (!this.process) {
        clearTimeout(killTimeout);
        resolve();
        return;
      }

      this.process.once('exit', () => {
        clearTimeout(killTimeout);
        this.cleanup();
        resolve();
      });

      // Graceful shutdown
      this.process.kill('SIGTERM');
    });
  }

  /**
   * Send a request and wait for response
   */
  sendRequest<T>(method: string, params: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        reject(new Error('Server not running'));
        return;
      }

      const id = generateId();
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params: params ?? undefined,
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, this.options.timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.send(request);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  sendNotification(method: string, params: unknown): void {
    if (!this.process || !this.process.stdin) {
      return;
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params: params ?? undefined,
    };

    this.send(notification);
  }

  /**
   * Subscribe to server notifications
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Unsubscribe from server notifications
   */
  off(event: string, callback: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): ServerCapabilities | undefined {
    return this.capabilities;
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get process ID
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Initialize the language server
   */
  private async initialize(): Promise<void> {
    const rootUri = this.config.rootPath
      ? pathToUri(this.config.rootPath)
      : null;

    const initParams = {
      processId: process.pid,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          codeAction: {
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: [
                  'quickfix',
                  'refactor',
                  'refactor.extract',
                  'refactor.inline',
                  'refactor.rewrite',
                  'source',
                  'source.organizeImports',
                ],
              },
            },
          },
          rename: { prepareSupport: true },
          formatting: {},
          rangeFormatting: {},
          callHierarchy: {},
          typeHierarchy: {},
        },
        workspace: {
          applyEdit: true,
          workspaceEdit: { documentChanges: true },
          symbol: {},
          executeCommand: {},
        },
      },
      rootUri,
      rootPath: this.config.rootPath || null,
      workspaceFolders: this.config.rootUris
        ? this.config.rootUris.map((uri) => ({ uri: pathToUri(uri), name: uri }))
        : rootUri
          ? [{ uri: rootUri, name: this.config.rootPath || 'workspace' }]
          : null,
      initializationOptions: this.config.initializationOptions,
    };

    const response = await this.sendRequest<{
      capabilities: ServerCapabilities;
    }>('initialize', initParams);

    this.capabilities = response.capabilities;

    // Send initialized notification
    this.sendNotification('initialized', {});
    this.initialized = true;
  }

  /**
   * Send a message to the server
   */
  private send(message: JsonRpcRequest | JsonRpcNotification): void {
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;

    if (this.options.logging && this.options.logLevel === 'debug') {
      console.log(`[LSP ${this.config.id}] ->`, json);
    }

    this.process?.stdin?.write(header + json);
  }

  /**
   * Handle incoming data from the server
   */
  private handleData(data: string): void {
    this.buffer += data;

    while (true) {
      // Look for Content-Length header
      const headerMatch = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/);
      if (!headerMatch) {
        break;
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const headerEnd = headerMatch.index! + headerMatch[0].length;
      const messageEnd = headerEnd + contentLength;

      if (this.buffer.length < messageEnd) {
        // Not enough data yet
        break;
      }

      const messageContent = this.buffer.slice(headerEnd, messageEnd);
      this.buffer = this.buffer.slice(messageEnd);

      try {
        const message = JSON.parse(messageContent);

        if (this.options.logging && this.options.logLevel === 'debug') {
          console.log(`[LSP ${this.config.id}] <-`, messageContent);
        }

        this.handleMessage(message);
      } catch (err) {
        if (this.options.logging) {
          console.error(`[LSP ${this.config.id}] Parse error:`, err);
        }
      }
    }
  }

  /**
   * Handle a parsed message
   */
  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    if ('id' in message && message.id !== undefined) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        clearTimeout(pending.timeout);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if ('method' in message) {
      // Notification from server
      this.eventEmitter.emit(message.method, message.params);

      // Handle specific notifications
      if (message.method === 'textDocument/publishDiagnostics') {
        this.eventEmitter.emit('diagnostics', message.params);
      }
    }
  }

  /**
   * Handle process error
   */
  private handleProcessError(err: Error): void {
    this.status = LSPServerStatus.ERROR;
    this.error = err.message;

    if (this.options.logging) {
      console.error(`[LSP ${this.config.id}] Process error:`, err);
    }

    this.cleanup();
    this.maybeRestart();
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    if (this.options.logging) {
      console.log(`[LSP ${this.config.id}] Process exited:`, { code, signal });
    }

    if (this.status !== LSPServerStatus.STOPPING) {
      this.status = LSPServerStatus.ERROR;
      this.error = `Process exited with code ${code}`;
    } else {
      this.status = LSPServerStatus.STOPPED;
    }

    this.cleanup();

    if (
      this.status === LSPServerStatus.ERROR &&
      code !== 0
    ) {
      this.maybeRestart();
    }
  }

  /**
   * Maybe restart the server
   */
  private maybeRestart(): void {
    if (
      this.options.autoRestart &&
      this.restartAttempts < this.options.maxRestartAttempts
    ) {
      this.restartAttempts++;

      if (this.options.logging) {
        console.log(
          `[LSP ${this.config.id}] Restarting (attempt ${this.restartAttempts})`
        );
      }

      setTimeout(() => {
        this.start().catch((err) => {
          if (this.options.logging) {
            console.error(`[LSP ${this.config.id}] Restart failed:`, err);
          }
        });
      }, this.options.restartDelay);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Server stopped'));
      this.pendingRequests.delete(id);
    }

    this.process = null;
    this.buffer = '';
    this.initialized = false;
    this.capabilities = undefined;
  }
}

/**
 * LSP Client Implementation
 */
export class LSPClient implements ILSPClient {
  private servers = new Map<string, LSPServerConnection>();
  private documentServers = new Map<string, string>(); // uri -> serverId
  private diagnosticCallbacks: Array<(uri: string, diagnostics: Diagnostic[]) => void> = [];
  private options: Required<LSPClientOptions>;
  private _initialized = false;

  constructor(options?: LSPClientOptions) {
    this.options = { ...DEFAULT_LSP_CLIENT_OPTIONS, ...options };
  }

  // === Server Management ===

  async startServer(config: LSPServerConfig): Promise<LSPOperationResult> {
    try {
      if (this.servers.has(config.id)) {
        return { success: false, error: `Server ${config.id} already exists` };
      }

      const connection = new LSPServerConnection(config, this.options);
      this.servers.set(config.id, connection);

      // Subscribe to diagnostics
      connection.on('diagnostics', (params: unknown) => {
        const { uri, diagnostics } = params as {
          uri: string;
          diagnostics: Diagnostic[];
        };
        for (const callback of this.diagnosticCallbacks) {
          callback(uri, diagnostics);
        }
      });

      await connection.start();

      return { success: true, serverId: config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        serverId: config.id,
      };
    }
  }

  async stopServer(serverId: string): Promise<LSPOperationResult> {
    try {
      const connection = this.servers.get(serverId);
      if (!connection) {
        return { success: false, error: `Server ${serverId} not found` };
      }

      await connection.stop();
      this.servers.delete(serverId);

      // Remove document mappings for this server
      for (const [uri, sid] of this.documentServers) {
        if (sid === serverId) {
          this.documentServers.delete(uri);
        }
      }

      return { success: true, serverId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        serverId,
      };
    }
  }

  async stopAllServers(): Promise<LSPOperationResult> {
    try {
      const promises = Array.from(this.servers.keys()).map((id) =>
        this.stopServer(id)
      );
      await Promise.all(promises);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  getServerState(serverId: string): LSPServerState | undefined {
    const connection = this.servers.get(serverId);
    if (!connection) {
      return undefined;
    }

    return {
      id: connection.config.id,
      name: connection.config.name,
      status: connection.status,
      languages: connection.config.languages,
      pid: connection.getPid(),
      startedAt: connection.startedAt,
      error: connection.error,
      capabilities: connection.getCapabilities(),
    };
  }

  getAllServerStates(): LSPServerState[] {
    return Array.from(this.servers.keys())
      .map((id) => this.getServerState(id))
      .filter((state): state is LSPServerState => state !== undefined);
  }

  isServerRunning(serverId: string): boolean {
    const connection = this.servers.get(serverId);
    return connection?.status === LSPServerStatus.RUNNING;
  }

  getServerForLanguage(language: LanguageId): LSPServerState | undefined {
    for (const connection of this.servers.values()) {
      if (
        connection.config.languages.includes(language) &&
        connection.status === LSPServerStatus.RUNNING
      ) {
        return this.getServerState(connection.config.id);
      }
    }
    return undefined;
  }

  // === Document Synchronization ===

  async openDocument(
    uri: string,
    languageId: LanguageId,
    version: number,
    text: string
  ): Promise<LSPOperationResult> {
    const connection = this.getConnectionForLanguage(languageId);
    if (!connection) {
      return { success: false, error: `No server for language: ${languageId}` };
    }

    try {
      connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId,
          version,
          text,
        },
      });

      this.documentServers.set(uri, connection.config.id);
      return { success: true, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async closeDocument(uri: string): Promise<LSPOperationResult> {
    const connection = this.getConnectionForDocument(uri);
    if (!connection) {
      return { success: false, error: `No server for document: ${uri}` };
    }

    try {
      connection.sendNotification('textDocument/didClose', {
        textDocument: { uri },
      });

      this.documentServers.delete(uri);
      return { success: true, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async updateDocument(
    uri: string,
    version: number,
    changes: TextEdit[]
  ): Promise<LSPOperationResult> {
    const connection = this.getConnectionForDocument(uri);
    if (!connection) {
      return { success: false, error: `No server for document: ${uri}` };
    }

    try {
      connection.sendNotification('textDocument/didChange', {
        textDocument: { uri, version },
        contentChanges: changes.map((c) => ({
          range: c.range,
          text: c.newText,
        })),
      });

      return { success: true, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async replaceDocumentContent(
    uri: string,
    version: number,
    text: string
  ): Promise<LSPOperationResult> {
    const connection = this.getConnectionForDocument(uri);
    if (!connection) {
      return { success: false, error: `No server for document: ${uri}` };
    }

    try {
      connection.sendNotification('textDocument/didChange', {
        textDocument: { uri, version },
        contentChanges: [{ text }],
      });

      return { success: true, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // === Code Intelligence ===

  async hover(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<HoverResult | null>> {
    return this.executeRequest(uri, 'textDocument/hover', {
      textDocument: { uri },
      position,
    });
  }

  async gotoDefinition(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<Location[] | LocationLink[] | null>> {
    return this.executeRequest(uri, 'textDocument/definition', {
      textDocument: { uri },
      position,
    });
  }

  async gotoTypeDefinition(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<Location[] | LocationLink[] | null>> {
    return this.executeRequest(uri, 'textDocument/typeDefinition', {
      textDocument: { uri },
      position,
    });
  }

  async gotoImplementation(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<Location[] | LocationLink[] | null>> {
    return this.executeRequest(uri, 'textDocument/implementation', {
      textDocument: { uri },
      position,
    });
  }

  async findReferences(
    uri: string,
    position: Position,
    includeDeclaration = true
  ): Promise<LSPOperationResult<Location[] | null>> {
    return this.executeRequest(uri, 'textDocument/references', {
      textDocument: { uri },
      position,
      context: { includeDeclaration },
    });
  }

  async getDocumentSymbols(
    uri: string
  ): Promise<LSPOperationResult<DocumentSymbol[] | null>> {
    return this.executeRequest(uri, 'textDocument/documentSymbol', {
      textDocument: { uri },
    });
  }

  async searchWorkspaceSymbols(
    query: string
  ): Promise<LSPOperationResult<WorkspaceSymbol[] | null>> {
    // Use first running server
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest<WorkspaceSymbol[] | null>(
        'workspace/symbol',
        { query }
      );
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // === Diagnostics ===

  async getDiagnostics(
    uri: string
  ): Promise<LSPOperationResult<Diagnostic[] | null>> {
    return this.executeRequest(uri, 'textDocument/diagnostic', {
      textDocument: { uri },
    });
  }

  onDiagnostics(
    callback: (uri: string, diagnostics: Diagnostic[]) => void
  ): LSPSubscription {
    this.diagnosticCallbacks.push(callback);

    return {
      unsubscribe: () => {
        const index = this.diagnosticCallbacks.indexOf(callback);
        if (index >= 0) {
          this.diagnosticCallbacks.splice(index, 1);
        }
      },
    };
  }

  // === Completion ===

  async getCompletions(
    uri: string,
    position: Position,
    context?: { triggerKind: number; triggerCharacter?: string }
  ): Promise<LSPOperationResult<CompletionList | CompletionItem[] | null>> {
    return this.executeRequest(uri, 'textDocument/completion', {
      textDocument: { uri },
      position,
      context,
    });
  }

  async resolveCompletion(
    item: CompletionItem
  ): Promise<LSPOperationResult<CompletionItem>> {
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest<CompletionItem>(
        'completionItem/resolve',
        item
      );
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // === Signature Help ===

  async getSignatureHelp(
    uri: string,
    position: Position,
    context?: {
      triggerKind: number;
      triggerCharacter?: string;
      isRetrigger: boolean;
    }
  ): Promise<LSPOperationResult<SignatureHelp | null>> {
    return this.executeRequest(uri, 'textDocument/signatureHelp', {
      textDocument: { uri },
      position,
      context,
    });
  }

  // === Code Actions ===

  async getCodeActions(
    uri: string,
    range: Range,
    context: CodeActionContext
  ): Promise<LSPOperationResult<CodeAction[] | null>> {
    return this.executeRequest(uri, 'textDocument/codeAction', {
      textDocument: { uri },
      range,
      context,
    });
  }

  async resolveCodeAction(
    action: CodeAction
  ): Promise<LSPOperationResult<CodeAction>> {
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest<CodeAction>(
        'codeAction/resolve',
        action
      );
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async executeCommand(
    command: string,
    args?: unknown[]
  ): Promise<LSPOperationResult<unknown>> {
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest('workspace/executeCommand', {
        command,
        arguments: args,
      });
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // === Refactoring ===

  async prepareRename(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<PrepareRenameResult | null>> {
    return this.executeRequest(uri, 'textDocument/prepareRename', {
      textDocument: { uri },
      position,
    });
  }

  async rename(
    uri: string,
    position: Position,
    newName: string
  ): Promise<LSPOperationResult<WorkspaceEdit | null>> {
    return this.executeRequest(uri, 'textDocument/rename', {
      textDocument: { uri },
      position,
      newName,
    });
  }

  // === Formatting ===

  async formatDocument(
    uri: string,
    options: FormattingOptions
  ): Promise<LSPOperationResult<TextEdit[] | null>> {
    return this.executeRequest(uri, 'textDocument/formatting', {
      textDocument: { uri },
      options,
    });
  }

  async formatRange(
    uri: string,
    range: Range,
    options: FormattingOptions
  ): Promise<LSPOperationResult<TextEdit[] | null>> {
    return this.executeRequest(uri, 'textDocument/rangeFormatting', {
      textDocument: { uri },
      range,
      options,
    });
  }

  async formatOnType(
    uri: string,
    position: Position,
    character: string,
    options: FormattingOptions
  ): Promise<LSPOperationResult<TextEdit[] | null>> {
    return this.executeRequest(uri, 'textDocument/onTypeFormatting', {
      textDocument: { uri },
      position,
      ch: character,
      options,
    });
  }

  // === Call Hierarchy ===

  async prepareCallHierarchy(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<CallHierarchyItem[] | null>> {
    return this.executeRequest(uri, 'textDocument/prepareCallHierarchy', {
      textDocument: { uri },
      position,
    });
  }

  async getIncomingCalls(
    item: CallHierarchyItem
  ): Promise<LSPOperationResult<CallHierarchyIncomingCall[] | null>> {
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest<
        CallHierarchyIncomingCall[] | null
      >('callHierarchy/incomingCalls', { item });
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getOutgoingCalls(
    item: CallHierarchyItem
  ): Promise<LSPOperationResult<CallHierarchyOutgoingCall[] | null>> {
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest<
        CallHierarchyOutgoingCall[] | null
      >('callHierarchy/outgoingCalls', { item });
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // === Type Hierarchy ===

  async prepareTypeHierarchy(
    uri: string,
    position: Position
  ): Promise<LSPOperationResult<TypeHierarchyItem[] | null>> {
    return this.executeRequest(uri, 'textDocument/prepareTypeHierarchy', {
      textDocument: { uri },
      position,
    });
  }

  async getSupertypes(
    item: TypeHierarchyItem
  ): Promise<LSPOperationResult<TypeHierarchyItem[] | null>> {
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest<TypeHierarchyItem[] | null>(
        'typeHierarchy/supertypes',
        { item }
      );
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getSubtypes(
    item: TypeHierarchyItem
  ): Promise<LSPOperationResult<TypeHierarchyItem[] | null>> {
    const connection = this.getFirstRunningConnection();
    if (!connection) {
      return { success: false, error: 'No running server' };
    }

    try {
      const result = await connection.sendRequest<TypeHierarchyItem[] | null>(
        'typeHierarchy/subtypes',
        { item }
      );
      return { success: true, data: result, serverId: connection.config.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // === Lifecycle ===

  async initialize(options?: LSPClientOptions): Promise<LSPOperationResult> {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    this._initialized = true;
    return { success: true };
  }

  async dispose(): Promise<void> {
    await this.stopAllServers();
    this.diagnosticCallbacks = [];
    this._initialized = false;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  // === Private Helpers ===

  private getConnectionForDocument(uri: string): LSPServerConnection | undefined {
    const serverId = this.documentServers.get(uri);
    if (serverId) {
      return this.servers.get(serverId);
    }
    return undefined;
  }

  private getConnectionForLanguage(
    language: LanguageId
  ): LSPServerConnection | undefined {
    for (const connection of this.servers.values()) {
      if (
        connection.config.languages.includes(language) &&
        connection.status === LSPServerStatus.RUNNING
      ) {
        return connection;
      }
    }
    return undefined;
  }

  private getFirstRunningConnection(): LSPServerConnection | undefined {
    for (const connection of this.servers.values()) {
      if (connection.status === LSPServerStatus.RUNNING) {
        return connection;
      }
    }
    return undefined;
  }

  private async executeRequest<T>(
    uri: string,
    method: string,
    params: unknown
  ): Promise<LSPOperationResult<T>> {
    const connection = this.getConnectionForDocument(uri);
    if (!connection) {
      return { success: false, error: `No server for document: ${uri}` };
    }

    const startTime = Date.now();

    try {
      const result = await connection.sendRequest<T>(method, params);
      return {
        success: true,
        data: result,
        serverId: connection.config.id,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        serverId: connection.config.id,
        duration: Date.now() - startTime,
      };
    }
  }
}

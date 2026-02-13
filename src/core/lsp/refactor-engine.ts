/**
 * Refactor Engine
 *
 * Provides LSP-based refactoring operations (rename, extract function).
 * Delegates to configurable handler functions or an LSP client.
 * When a connected LSP client is available, uses real LSP requests
 * (textDocument/rename, textDocument/codeAction) instead of stubs.
 *
 * @module core/lsp
 */

import type {
  ILSPClient,
  IRefactorEngine,
  Position,
  Range,
  RefactorResult,
} from './interfaces/lsp.interface';
import { createAgentLogger } from '../../shared/logging/logger';

const log = createAgentLogger('RefactorEngine', 'refactor-engine');

// ============================================================================
// Types
// ============================================================================

export interface RefactorEngineOptions {
  /** Custom rename handler */
  renameHandler?: (uri: string, position: Position, newName: string) => Promise<RefactorResult>;
  /** Custom extract function handler */
  extractFunctionHandler?: (uri: string, range: Range, name: string) => Promise<RefactorResult>;
  /** LSP client for automatic delegation */
  client?: ILSPClient;
}

/** LSP WorkspaceEdit as returned by textDocument/rename */
interface LSPWorkspaceEdit {
  changes?: Record<string, Array<{ range: Range; newText: string }>>;
  documentChanges?: Array<{
    textDocument: { uri: string; version?: number | null };
    edits: Array<{ range: Range; newText: string }>;
  }>;
}

/** LSP CodeAction response from textDocument/codeAction */
interface LSPCodeAction {
  title: string;
  kind?: string;
  edit?: LSPWorkspaceEdit;
  command?: { title: string; command: string; arguments?: unknown[] };
}

// ============================================================================
// Implementation
// ============================================================================

export class RefactorEngine implements IRefactorEngine {
  private readonly renameHandler: ((uri: string, position: Position, newName: string) => Promise<RefactorResult>) | null;
  private readonly extractFunctionHandler: ((uri: string, range: Range, name: string) => Promise<RefactorResult>) | null;
  private readonly client: ILSPClient | null;

  constructor(options?: RefactorEngineOptions) {
    this.renameHandler = options?.renameHandler ?? null;
    this.extractFunctionHandler = options?.extractFunctionHandler ?? null;
    this.client = options?.client ?? null;
  }

  async rename(uri: string, position: Position, newName: string): Promise<RefactorResult> {
    if (!newName || newName.trim().length === 0) {
      return {
        success: false,
        changes: [],
        error: 'New name cannot be empty',
      };
    }

    // Custom handler takes priority
    if (this.renameHandler) {
      return this.renameHandler(uri, position, newName);
    }

    // LSP client: use real textDocument/rename request
    if (this.client && this.client.isConnected()) {
      try {
        const workspaceEdit = await this.client.sendRequest<LSPWorkspaceEdit>(
          'textDocument/rename',
          {
            textDocument: { uri },
            position,
            newName,
          },
        );

        return RefactorEngine.workspaceEditToResult(workspaceEdit);
      } catch (error) {
        const message = (error as Error).message;
        log.warn('LSP rename request failed', { uri, error: message });
        return {
          success: false,
          changes: [],
          error: `LSP rename failed: ${message}`,
        };
      }
    }

    return RefactorEngine.defaultRenameHandler(uri, position, newName);
  }

  async extractFunction(uri: string, range: Range, name: string): Promise<RefactorResult> {
    if (!name || name.trim().length === 0) {
      return {
        success: false,
        changes: [],
        error: 'Function name cannot be empty',
      };
    }

    // Custom handler takes priority
    if (this.extractFunctionHandler) {
      return this.extractFunctionHandler(uri, range, name);
    }

    // LSP client: request extract refactoring via textDocument/codeAction
    if (this.client && this.client.isConnected()) {
      try {
        const actions = await this.client.sendRequest<LSPCodeAction[] | null>(
          'textDocument/codeAction',
          {
            textDocument: { uri },
            range,
            context: {
              diagnostics: [],
              only: ['refactor.extract'],
            },
          },
        );

        // Find an extract function action from the response
        const extractAction = actions?.find(
          (a) => a.kind?.startsWith('refactor.extract') && a.edit,
        );

        if (extractAction?.edit) {
          return RefactorEngine.workspaceEditToResult(extractAction.edit);
        }

        // No extract action available from server
        log.debug('No extract refactoring available from LSP server', { uri });
        return RefactorEngine.defaultExtractFunctionHandler(uri, range, name);
      } catch (error) {
        const message = (error as Error).message;
        log.warn('LSP codeAction request failed', { uri, error: message });
        return RefactorEngine.defaultExtractFunctionHandler(uri, range, name);
      }
    }

    return RefactorEngine.defaultExtractFunctionHandler(uri, range, name);
  }

  // ============================================================================
  // LSP Response Conversion
  // ============================================================================

  /**
   * Convert an LSP WorkspaceEdit into our RefactorResult format.
   */
  private static workspaceEditToResult(edit: LSPWorkspaceEdit): RefactorResult {
    const changes: RefactorResult['changes'] = [];

    // Handle flat changes map: { [uri]: TextEdit[] }
    if (edit.changes) {
      for (const [editUri, edits] of Object.entries(edit.changes)) {
        changes.push({
          uri: editUri,
          edits: edits.map((e) => ({ range: e.range, newText: e.newText })),
        });
      }
    }

    // Handle documentChanges array (preferred by newer LSP servers)
    if (edit.documentChanges) {
      for (const docChange of edit.documentChanges) {
        changes.push({
          uri: docChange.textDocument.uri,
          edits: docChange.edits.map((e) => ({ range: e.range, newText: e.newText })),
        });
      }
    }

    return {
      success: changes.length > 0,
      changes,
      error: changes.length === 0 ? 'No changes returned by LSP server' : undefined,
    };
  }

  // ============================================================================
  // Default Handlers (fallback when no client or custom handler)
  // ============================================================================

  private static async defaultRenameHandler(
    uri: string,
    position: Position,
    newName: string,
  ): Promise<RefactorResult> {
    return {
      success: true,
      changes: [
        {
          uri,
          edits: [
            {
              range: {
                start: position,
                end: { line: position.line, character: position.character + newName.length },
              },
              newText: newName,
            },
          ],
        },
      ],
    };
  }

  private static async defaultExtractFunctionHandler(
    uri: string,
    range: Range,
    name: string,
  ): Promise<RefactorResult> {
    return {
      success: true,
      changes: [
        {
          uri,
          edits: [
            {
              range,
              newText: `${name}()`,
            },
          ],
        },
      ],
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRefactorEngine(options?: RefactorEngineOptions): RefactorEngine {
  return new RefactorEngine(options);
}

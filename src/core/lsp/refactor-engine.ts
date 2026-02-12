/**
 * Refactor Engine
 *
 * Provides LSP-based refactoring operations (rename, extract function).
 * Delegates to configurable handler functions for actual refactoring logic.
 *
 * @module core/lsp
 */

import type {
  IRefactorEngine,
  Position,
  Range,
  RefactorResult,
} from './interfaces/lsp.interface';

// ============================================================================
// Types
// ============================================================================

export interface RefactorEngineOptions {
  /** Custom rename handler */
  renameHandler?: (uri: string, position: Position, newName: string) => Promise<RefactorResult>;
  /** Custom extract function handler */
  extractFunctionHandler?: (uri: string, range: Range, name: string) => Promise<RefactorResult>;
}

// ============================================================================
// Implementation
// ============================================================================

export class RefactorEngine implements IRefactorEngine {
  private readonly renameHandler: (uri: string, position: Position, newName: string) => Promise<RefactorResult>;
  private readonly extractFunctionHandler: (uri: string, range: Range, name: string) => Promise<RefactorResult>;

  constructor(options?: RefactorEngineOptions) {
    this.renameHandler = options?.renameHandler ?? RefactorEngine.defaultRenameHandler;
    this.extractFunctionHandler = options?.extractFunctionHandler ?? RefactorEngine.defaultExtractFunctionHandler;
  }

  async rename(uri: string, position: Position, newName: string): Promise<RefactorResult> {
    if (!newName || newName.trim().length === 0) {
      return {
        success: false,
        changes: [],
        error: 'New name cannot be empty',
      };
    }

    return this.renameHandler(uri, position, newName);
  }

  async extractFunction(uri: string, range: Range, name: string): Promise<RefactorResult> {
    if (!name || name.trim().length === 0) {
      return {
        success: false,
        changes: [],
        error: 'Function name cannot be empty',
      };
    }

    return this.extractFunctionHandler(uri, range, name);
  }

  // ============================================================================
  // Default Handlers
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

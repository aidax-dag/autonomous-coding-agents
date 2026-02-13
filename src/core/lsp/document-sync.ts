/**
 * Document Sync
 *
 * Sends LSP text document lifecycle notifications (didOpen, didChange,
 * didClose, didSave) to keep the language server in sync with the
 * editor's document state.
 *
 * @module core/lsp
 */

import type { ILSPClient, Range } from './interfaces/lsp.interface';
import { createAgentLogger } from '../../shared/logging/logger';

const log = createAgentLogger('DocumentSync', 'document-sync');

// ============================================================================
// Types
// ============================================================================

export interface DocumentSyncConfig {
  /** LSP client to send notifications through */
  client: ILSPClient;
}

export interface TextDocumentContentChangeEvent {
  /** Range of the document that changed (omit for full replacement) */
  range?: Range;
  /** New text for the range (or full document if range is omitted) */
  text: string;
}

export interface IDocumentSync {
  didOpen(uri: string, languageId: string, version: number, text: string): Promise<void>;
  didChange(uri: string, version: number, changes: TextDocumentContentChangeEvent[]): Promise<void>;
  didClose(uri: string): Promise<void>;
  didSave(uri: string, text?: string): Promise<void>;
  getOpenDocuments(): string[];
}

interface TrackedDocument {
  languageId: string;
  version: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class DocumentSync implements IDocumentSync {
  private readonly client: ILSPClient;
  private readonly openDocuments: Map<string, TrackedDocument> = new Map();

  constructor(config: DocumentSyncConfig) {
    this.client = config.client;
  }

  /**
   * Notify the server that a document was opened.
   * Tracks the document URI, language, and version locally.
   */
  async didOpen(
    uri: string,
    languageId: string,
    version: number,
    text: string,
  ): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('LSP client is not connected');
    }

    await this.client.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId, version, text },
    });

    this.openDocuments.set(uri, { languageId, version });
    log.debug(`Document opened: ${uri}`, { languageId, version });
  }

  /**
   * Notify the server that a document changed.
   * Updates the tracked version for the URI.
   */
  async didChange(
    uri: string,
    version: number,
    changes: TextDocumentContentChangeEvent[],
  ): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('LSP client is not connected');
    }

    const tracked = this.openDocuments.get(uri);
    if (!tracked) {
      throw new Error(`Document not open: ${uri}`);
    }

    await this.client.sendNotification('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: changes,
    });

    tracked.version = version;
    log.debug(`Document changed: ${uri}`, { version });
  }

  /**
   * Notify the server that a document was closed.
   * Removes the document from local tracking.
   */
  async didClose(uri: string): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('LSP client is not connected');
    }

    await this.client.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });

    this.openDocuments.delete(uri);
    log.debug(`Document closed: ${uri}`);
  }

  /**
   * Notify the server that a document was saved.
   * Optionally includes the full text content.
   */
  async didSave(uri: string, text?: string): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('LSP client is not connected');
    }

    const params: { textDocument: { uri: string }; text?: string } = {
      textDocument: { uri },
    };
    if (text !== undefined) {
      params.text = text;
    }

    await this.client.sendNotification('textDocument/didSave', params);
    log.debug(`Document saved: ${uri}`);
  }

  /**
   * Return URIs of all currently open documents.
   */
  getOpenDocuments(): string[] {
    return Array.from(this.openDocuments.keys());
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDocumentSync(config: DocumentSyncConfig): DocumentSync {
  return new DocumentSync(config);
}

/**
 * Document Sync Tests
 */

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { DocumentSync, createDocumentSync } from '../../../../src/core/lsp/document-sync';
import type { ILSPClient } from '../../../../src/core/lsp/interfaces/lsp.interface';

function createMockClient(connected = true): jest.Mocked<ILSPClient> {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(connected),
    sendRequest: jest.fn(),
    sendNotification: jest.fn().mockResolvedValue(undefined),
    onNotification: jest.fn(),
    getCapabilities: jest.fn().mockReturnValue(null),
  };
}

describe('DocumentSync', () => {
  let client: jest.Mocked<ILSPClient>;
  let sync: DocumentSync;

  beforeEach(() => {
    client = createMockClient();
    sync = new DocumentSync({ client });
  });

  // ==========================================================================
  // didOpen
  // ==========================================================================

  describe('didOpen', () => {
    it('sends textDocument/didOpen notification with correct params', async () => {
      await sync.didOpen('file:///test.ts', 'typescript', 1, 'const x = 1;');

      expect(client.sendNotification).toHaveBeenCalledWith('textDocument/didOpen', {
        textDocument: {
          uri: 'file:///test.ts',
          languageId: 'typescript',
          version: 1,
          text: 'const x = 1;',
        },
      });
    });

    it('tracks opened document URI', async () => {
      await sync.didOpen('file:///test.ts', 'typescript', 1, 'code');

      expect(sync.getOpenDocuments()).toContain('file:///test.ts');
    });

    it('throws when client is disconnected', async () => {
      client.isConnected.mockReturnValue(false);

      await expect(
        sync.didOpen('file:///test.ts', 'typescript', 1, 'code'),
      ).rejects.toThrow('LSP client is not connected');
    });
  });

  // ==========================================================================
  // didChange
  // ==========================================================================

  describe('didChange', () => {
    beforeEach(async () => {
      await sync.didOpen('file:///test.ts', 'typescript', 1, 'const x = 1;');
      client.sendNotification.mockClear();
    });

    it('sends textDocument/didChange notification', async () => {
      const changes = [{ text: 'const x = 2;' }];
      await sync.didChange('file:///test.ts', 2, changes);

      expect(client.sendNotification).toHaveBeenCalledWith('textDocument/didChange', {
        textDocument: { uri: 'file:///test.ts', version: 2 },
        contentChanges: changes,
      });
    });

    it('updates tracked version', async () => {
      await sync.didChange('file:///test.ts', 5, [{ text: 'updated' }]);
      // The document remains tracked
      expect(sync.getOpenDocuments()).toContain('file:///test.ts');
    });

    it('throws when document is not open', async () => {
      await expect(
        sync.didChange('file:///unknown.ts', 2, [{ text: 'code' }]),
      ).rejects.toThrow('Document not open: file:///unknown.ts');
    });

    it('throws when client is disconnected', async () => {
      client.isConnected.mockReturnValue(false);

      await expect(
        sync.didChange('file:///test.ts', 2, [{ text: 'code' }]),
      ).rejects.toThrow('LSP client is not connected');
    });

    it('supports incremental changes with range', async () => {
      const changes = [
        {
          range: {
            start: { line: 0, character: 10 },
            end: { line: 0, character: 11 },
          },
          text: '2',
        },
      ];
      await sync.didChange('file:///test.ts', 2, changes);

      expect(client.sendNotification).toHaveBeenCalledWith('textDocument/didChange', {
        textDocument: { uri: 'file:///test.ts', version: 2 },
        contentChanges: changes,
      });
    });
  });

  // ==========================================================================
  // didClose
  // ==========================================================================

  describe('didClose', () => {
    beforeEach(async () => {
      await sync.didOpen('file:///test.ts', 'typescript', 1, 'code');
      client.sendNotification.mockClear();
    });

    it('sends textDocument/didClose notification', async () => {
      await sync.didClose('file:///test.ts');

      expect(client.sendNotification).toHaveBeenCalledWith('textDocument/didClose', {
        textDocument: { uri: 'file:///test.ts' },
      });
    });

    it('removes document from tracking', async () => {
      await sync.didClose('file:///test.ts');

      expect(sync.getOpenDocuments()).not.toContain('file:///test.ts');
    });

    it('throws when client is disconnected', async () => {
      client.isConnected.mockReturnValue(false);

      await expect(sync.didClose('file:///test.ts')).rejects.toThrow(
        'LSP client is not connected',
      );
    });
  });

  // ==========================================================================
  // didSave
  // ==========================================================================

  describe('didSave', () => {
    beforeEach(async () => {
      await sync.didOpen('file:///test.ts', 'typescript', 1, 'code');
      client.sendNotification.mockClear();
    });

    it('sends textDocument/didSave notification with text', async () => {
      await sync.didSave('file:///test.ts', 'saved content');

      expect(client.sendNotification).toHaveBeenCalledWith('textDocument/didSave', {
        textDocument: { uri: 'file:///test.ts' },
        text: 'saved content',
      });
    });

    it('sends textDocument/didSave notification without text', async () => {
      await sync.didSave('file:///test.ts');

      expect(client.sendNotification).toHaveBeenCalledWith('textDocument/didSave', {
        textDocument: { uri: 'file:///test.ts' },
      });
    });

    it('throws when client is disconnected', async () => {
      client.isConnected.mockReturnValue(false);

      await expect(sync.didSave('file:///test.ts')).rejects.toThrow(
        'LSP client is not connected',
      );
    });
  });

  // ==========================================================================
  // getOpenDocuments
  // ==========================================================================

  describe('getOpenDocuments', () => {
    it('returns empty array initially', () => {
      expect(sync.getOpenDocuments()).toEqual([]);
    });

    it('returns all open document URIs', async () => {
      await sync.didOpen('file:///a.ts', 'typescript', 1, 'a');
      await sync.didOpen('file:///b.ts', 'typescript', 1, 'b');
      await sync.didOpen('file:///c.py', 'python', 1, 'c');

      const docs = sync.getOpenDocuments();
      expect(docs).toHaveLength(3);
      expect(docs).toContain('file:///a.ts');
      expect(docs).toContain('file:///b.ts');
      expect(docs).toContain('file:///c.py');
    });

    it('reflects close operations', async () => {
      await sync.didOpen('file:///a.ts', 'typescript', 1, 'a');
      await sync.didOpen('file:///b.ts', 'typescript', 1, 'b');
      await sync.didClose('file:///a.ts');

      const docs = sync.getOpenDocuments();
      expect(docs).toHaveLength(1);
      expect(docs).toContain('file:///b.ts');
    });
  });

  // ==========================================================================
  // Factory function
  // ==========================================================================

  describe('createDocumentSync', () => {
    it('returns a DocumentSync instance', () => {
      const instance = createDocumentSync({ client });
      expect(instance).toBeInstanceOf(DocumentSync);
    });
  });
});

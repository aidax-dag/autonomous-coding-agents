/**
 * LSP Connection Manager Tests
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

// Mock createLSPClient to return controllable mock clients
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockIsConnected = jest.fn().mockReturnValue(true);
const mockGetCapabilities = jest.fn().mockReturnValue({
  definitionProvider: true,
  referencesProvider: true,
  renameProvider: true,
});
const mockSendRequest = jest.fn();
const mockSendNotification = jest.fn();
const mockOnNotification = jest.fn();
const mockGetConfig = jest.fn().mockReturnValue(null);
const mockGetRequestTimeoutMs = jest.fn().mockReturnValue(30000);
const mockGetNextRequestId = jest.fn().mockReturnValue(1);

function createMockLSPClient() {
  return {
    connect: mockConnect,
    disconnect: mockDisconnect,
    isConnected: mockIsConnected,
    getCapabilities: mockGetCapabilities,
    sendRequest: mockSendRequest,
    sendNotification: mockSendNotification,
    onNotification: mockOnNotification,
    getConfig: mockGetConfig,
    getRequestTimeoutMs: mockGetRequestTimeoutMs,
    getNextRequestId: mockGetNextRequestId,
  };
}

jest.mock('../../../../src/core/lsp/lsp-client', () => ({
  LSPClient: jest.fn(),
  createLSPClient: jest.fn(() => createMockLSPClient()),
}));

import {
  LSPConnectionManager,
  createLSPConnectionManager,
  type LSPServerEntry,
} from '../../../../src/core/lsp/lsp-connection-manager';
import { createLSPClient } from '../../../../src/core/lsp/lsp-client';

const mockedCreateLSPClient = createLSPClient as jest.MockedFunction<typeof createLSPClient>;

describe('LSPConnectionManager', () => {
  const tsServer: LSPServerEntry = {
    name: 'typescript',
    languages: ['typescript', 'javascript'],
    command: 'typescript-language-server',
    args: ['--stdio'],
    rootUri: 'file:///project',
  };

  const pyServer: LSPServerEntry = {
    name: 'python',
    languages: ['python'],
    command: 'pylsp',
    args: [],
  };

  const disabledServer: LSPServerEntry = {
    name: 'disabled',
    languages: ['rust'],
    command: 'rust-analyzer',
    enabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockIsConnected.mockReturnValue(true);
    mockGetCapabilities.mockReturnValue({
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: true,
    });
  });

  // ==========================================================================
  // connectAll
  // ==========================================================================

  describe('connectAll', () => {
    it('connects all enabled servers', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer, disabledServer],
      });

      await manager.connectAll();

      // Should create 2 clients (not the disabled one)
      expect(mockedCreateLSPClient).toHaveBeenCalledTimes(2);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('skips disabled servers', async () => {
      const manager = new LSPConnectionManager({
        servers: [disabledServer],
      });

      await manager.connectAll();

      expect(mockedCreateLSPClient).not.toHaveBeenCalled();
    });

    it('handles empty server list', async () => {
      const manager = new LSPConnectionManager({ servers: [] });

      await manager.connectAll();

      expect(mockedCreateLSPClient).not.toHaveBeenCalled();
    });

    it('isolates failures between servers', async () => {
      let callCount = 0;
      mockConnect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Connection refused'));
        }
        return Promise.resolve();
      });

      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer],
      });

      // Should not throw — failures are isolated
      await manager.connectAll();

      // Both servers attempted connection
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // connectServer
  // ==========================================================================

  describe('connectServer', () => {
    it('connects a specific server by name', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer],
      });

      await manager.connectServer('typescript');

      expect(mockedCreateLSPClient).toHaveBeenCalledTimes(1);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('throws for unknown server name', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await expect(manager.connectServer('unknown')).rejects.toThrow(
        "LSP server 'unknown' not found in configuration",
      );
    });

    it('throws for disabled server', async () => {
      const manager = new LSPConnectionManager({
        servers: [disabledServer],
      });

      await expect(manager.connectServer('disabled')).rejects.toThrow(
        "LSP server 'disabled' is disabled",
      );
    });

    it('disconnects existing connection before reconnecting', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectServer('typescript');
      await manager.connectServer('typescript');

      // Second connection should have triggered disconnect first
      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockedCreateLSPClient).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // disconnectAll
  // ==========================================================================

  describe('disconnectAll', () => {
    it('disconnects all connected servers', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer],
      });

      await manager.connectAll();
      mockDisconnect.mockClear();

      await manager.disconnectAll();

      expect(mockDisconnect).toHaveBeenCalledTimes(2);
    });

    it('handles empty connections gracefully', async () => {
      const manager = new LSPConnectionManager({ servers: [] });

      // Should not throw
      await manager.disconnectAll();
    });

    it('continues disconnecting if one fails', async () => {
      let disconnectCallCount = 0;
      mockDisconnect.mockImplementation(() => {
        disconnectCallCount++;
        if (disconnectCallCount === 1) {
          return Promise.reject(new Error('Disconnect error'));
        }
        return Promise.resolve();
      });

      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer],
      });

      await manager.connectAll();
      disconnectCallCount = 0;

      // Should not throw
      await manager.disconnectAll();
    });
  });

  // ==========================================================================
  // disconnectServer
  // ==========================================================================

  describe('disconnectServer', () => {
    it('disconnects a specific server', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();
      mockDisconnect.mockClear();

      await manager.disconnectServer('typescript');

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('handles non-existent server gracefully', async () => {
      const manager = new LSPConnectionManager({ servers: [] });

      // Should not throw
      await manager.disconnectServer('nonexistent');
    });
  });

  // ==========================================================================
  // getClientForLanguage
  // ==========================================================================

  describe('getClientForLanguage', () => {
    it('returns correct client for a registered language', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer],
      });

      await manager.connectAll();

      const client = manager.getClientForLanguage('typescript');
      expect(client).toBeTruthy();
    });

    it('returns same client for multiple languages of one server', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();

      const tsClient = manager.getClientForLanguage('typescript');
      const jsClient = manager.getClientForLanguage('javascript');

      // Both should return the same mock (same server)
      expect(tsClient).toBeTruthy();
      expect(jsClient).toBeTruthy();
    });

    it('returns null for unregistered language', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();

      const client = manager.getClientForLanguage('rust');
      expect(client).toBeNull();
    });

    it('returns null when server is disconnected', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();
      mockIsConnected.mockReturnValue(false);

      const client = manager.getClientForLanguage('typescript');
      expect(client).toBeNull();
    });
  });

  // ==========================================================================
  // getClient
  // ==========================================================================

  describe('getClient', () => {
    it('returns client by server name', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();

      const client = manager.getClient('typescript');
      expect(client).toBeTruthy();
    });

    it('returns null for unknown server name', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();

      const client = manager.getClient('unknown');
      expect(client).toBeNull();
    });

    it('returns null when server is disconnected', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();
      mockIsConnected.mockReturnValue(false);

      const client = manager.getClient('typescript');
      expect(client).toBeNull();
    });
  });

  // ==========================================================================
  // getStatus
  // ==========================================================================

  describe('getStatus', () => {
    it('returns status for all configured servers', async () => {
      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer, disabledServer],
      });

      await manager.connectAll();

      const statuses = manager.getStatus();
      expect(statuses).toHaveLength(3);

      const tsStatus = statuses.find((s) => s.name === 'typescript');
      expect(tsStatus).toBeDefined();
      expect(tsStatus!.connected).toBe(true);
      expect(tsStatus!.languages).toEqual(['typescript', 'javascript']);
      expect(tsStatus!.capabilities.length).toBeGreaterThan(0);

      const disabledStatus = statuses.find((s) => s.name === 'disabled');
      expect(disabledStatus).toBeDefined();
      expect(disabledStatus!.connected).toBe(false);
      expect(disabledStatus!.error).toBe('Disabled');
    });

    it('reports error for failed connections', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();

      const statuses = manager.getStatus();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].error).toBe('Connection refused');
    });

    it('includes capability names', async () => {
      mockGetCapabilities.mockReturnValue({
        definitionProvider: true,
        referencesProvider: true,
        hoverProvider: false,
        completionProvider: { triggerCharacters: ['.'] },
      });

      const manager = new LSPConnectionManager({
        servers: [tsServer],
      });

      await manager.connectAll();

      const statuses = manager.getStatus();
      expect(statuses[0].capabilities).toContain('definitionProvider');
      expect(statuses[0].capabilities).toContain('referencesProvider');
      expect(statuses[0].capabilities).toContain('completionProvider');
      // hoverProvider is false, should not be included
      expect(statuses[0].capabilities).not.toContain('hoverProvider');
    });
  });

  // ==========================================================================
  // Error isolation
  // ==========================================================================

  describe('error isolation', () => {
    it('one server failure does not block others', async () => {
      let connectCallCount = 0;

      // Per-client isConnected tracking: first client fails, second succeeds
      let clientIdx = 0;
      mockedCreateLSPClient.mockImplementation(() => {
        const myIdx = clientIdx++;
        const client = createMockLSPClient();
        client.connect = jest.fn(() => {
          connectCallCount++;
          if (connectCallCount === 1) {
            return Promise.reject(new Error('Server crash'));
          }
          return Promise.resolve();
        });
        // Failed client should report disconnected
        client.isConnected = jest.fn(() => myIdx !== 0);
        return client as unknown as ReturnType<typeof createLSPClient>;
      });

      const manager = new LSPConnectionManager({
        servers: [tsServer, pyServer],
      });

      await manager.connectAll();

      const statuses = manager.getStatus();
      // One should have an error, the other should be connected
      const errors = statuses.filter((s) => s.error);
      const connected = statuses.filter((s) => s.connected);

      expect(errors).toHaveLength(1);
      expect(connected).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Language mapping
  // ==========================================================================

  describe('language mapping', () => {
    it('maps multiple languages to one server', async () => {
      const multiLangServer: LSPServerEntry = {
        name: 'web',
        languages: ['html', 'css', 'javascript'],
        command: 'web-language-server',
        args: ['--stdio'],
      };

      const manager = new LSPConnectionManager({
        servers: [multiLangServer],
      });

      await manager.connectAll();

      expect(manager.getClientForLanguage('html')).toBeTruthy();
      expect(manager.getClientForLanguage('css')).toBeTruthy();
      expect(manager.getClientForLanguage('javascript')).toBeTruthy();
    });

    it('does not map languages of disabled servers', () => {
      const manager = new LSPConnectionManager({
        servers: [disabledServer],
      });

      // No connection needed — disabled languages should not be mapped
      expect(manager.getClientForLanguage('rust')).toBeNull();
    });
  });

  // ==========================================================================
  // Factory function
  // ==========================================================================

  describe('createLSPConnectionManager', () => {
    it('returns an LSPConnectionManager instance', () => {
      const manager = createLSPConnectionManager({
        servers: [tsServer],
      });

      expect(manager).toBeInstanceOf(LSPConnectionManager);
    });
  });
});

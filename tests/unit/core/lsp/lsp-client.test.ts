/**
 * Tests for LSP Client
 */

import { LSPClient, createLSPClient } from '@/core/lsp';
import type { LSPServerConfig } from '@/core/lsp';

const makeConfig = (overrides: Partial<LSPServerConfig> = {}): LSPServerConfig => ({
  language: 'typescript',
  command: 'typescript-language-server',
  args: ['--stdio'],
  rootUri: 'file:///project',
  ...overrides,
});

describe('LSPClient', () => {
  describe('connect', () => {
    it('should connect with valid config', async () => {
      const client = new LSPClient();
      const config = makeConfig();

      await client.connect(config);

      expect(client.isConnected()).toBe(true);
      expect(client.getConfig()).toEqual(config);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear state', async () => {
      const client = new LSPClient();
      await client.connect(makeConfig());

      await client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(client.getConfig()).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      const client = new LSPClient();
      expect(client.isConnected()).toBe(false);
    });

    it('should return true after connect', async () => {
      const client = new LSPClient();
      await client.connect(makeConfig());
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('sendRequest', () => {
    it('should throw when not connected', () => {
      const client = new LSPClient();

      expect(() => {
        client.sendRequest('textDocument/definition', {});
      }).toThrow('LSP client is not connected');
    });

    it('should succeed when connected', async () => {
      const client = new LSPClient();
      await client.connect(makeConfig());

      expect(() => {
        client.sendRequest('textDocument/definition', { uri: 'file:///test.ts' });
      }).not.toThrow();
    });
  });

  describe('createLSPClient factory', () => {
    it('should create an LSPClient instance', () => {
      const client = createLSPClient();
      expect(client).toBeInstanceOf(LSPClient);
      expect(client.isConnected()).toBe(false);
    });

    it('should accept options', () => {
      const client = createLSPClient({ requestTimeoutMs: 5000 });
      expect(client).toBeInstanceOf(LSPClient);
      expect(client.getRequestTimeoutMs()).toBe(5000);
    });
  });
});

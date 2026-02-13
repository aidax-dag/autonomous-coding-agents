/**
 * LSP Connection Manager
 *
 * Manages multiple language server connections, one per language server.
 * Provides language-based client routing so callers can request the
 * correct LSP client for a given file language.
 *
 * @module core/lsp
 */

import { LSPClient, createLSPClient } from './lsp-client';
import type { LSPServerCapabilities } from './interfaces/lsp.interface';
import { createAgentLogger } from '../../shared/logging/logger';

const log = createAgentLogger('LSPConnectionManager', 'lsp-connection-manager');

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration entry for a single language server
 */
export interface LSPServerEntry {
  /** Unique identifier for this language server */
  name: string;
  /** Languages this server handles (e.g. ['typescript', 'javascript']) */
  languages: string[];
  /** Command to launch the language server process */
  command: string;
  /** Arguments for the command (e.g. ['--stdio']) */
  args?: string[];
  /** Root URI of the workspace */
  rootUri?: string;
  /** Initialization options passed to the server */
  initializationOptions?: Record<string, unknown>;
  /** Whether this server is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Configuration for the LSPConnectionManager
 */
export interface LSPConnectionManagerConfig {
  /** List of language servers to manage */
  servers: LSPServerEntry[];
}

/**
 * Status information for a single language server connection
 */
export interface LSPConnectionStatus {
  /** Server name */
  name: string;
  /** Languages this server handles */
  languages: string[];
  /** Whether the server is currently connected */
  connected: boolean;
  /** Capability names discovered from the server */
  capabilities: string[];
  /** Error message if connection failed */
  error?: string;
}

interface LSPConnection {
  client: LSPClient;
  entry: LSPServerEntry;
  error?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * LSPConnectionManager
 *
 * Manages lifecycle for multiple language server connections.
 * Each server connects independently — one failure does not block others.
 */
export class LSPConnectionManager {
  private readonly connections: Map<string, LSPConnection> = new Map();
  private readonly languageMap: Map<string, string> = new Map();
  private readonly config: LSPConnectionManagerConfig;

  constructor(config: LSPConnectionManagerConfig) {
    this.config = config;

    // Build language → server name mapping
    for (const entry of config.servers) {
      if (entry.enabled !== false) {
        for (const lang of entry.languages) {
          this.languageMap.set(lang, entry.name);
        }
      }
    }
  }

  /**
   * Connect to all enabled servers.
   * Failures are isolated per server — one server failing does not block others.
   */
  async connectAll(): Promise<void> {
    const enabled = this.config.servers.filter((s) => s.enabled !== false);

    if (enabled.length === 0) {
      log.info('No LSP servers configured');
      return;
    }

    log.info('Connecting to LSP servers', { count: enabled.length });

    const results = await Promise.allSettled(
      enabled.map((entry) => this.connectServerInternal(entry)),
    );

    let successCount = 0;
    let failCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failCount++;
      }
    }

    log.info('LSP server connection complete', { successCount, failCount });
  }

  /**
   * Connect to a specific server by name.
   * If already connected, disconnects first.
   */
  async connectServer(name: string): Promise<void> {
    const entry = this.config.servers.find((s) => s.name === name);
    if (!entry) {
      throw new Error(`LSP server '${name}' not found in configuration`);
    }

    if (entry.enabled === false) {
      throw new Error(`LSP server '${name}' is disabled`);
    }

    // Disconnect existing connection if any
    if (this.connections.has(name)) {
      await this.disconnectServer(name);
    }

    await this.connectServerInternal(entry);
  }

  /**
   * Disconnect all connected servers.
   */
  async disconnectAll(): Promise<void> {
    const names = [...this.connections.keys()];

    if (names.length === 0) {
      return;
    }

    log.info('Disconnecting all LSP servers', { count: names.length });

    await Promise.allSettled(
      names.map((name) => this.disconnectServer(name)),
    );

    this.connections.clear();
    log.info('All LSP servers disconnected');
  }

  /**
   * Disconnect a specific server by name.
   */
  async disconnectServer(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (!conn) {
      return;
    }

    try {
      if (conn.client.isConnected()) {
        await conn.client.disconnect();
      }
    } catch (error) {
      log.warn(`Error disconnecting LSP server '${name}'`, {
        error: (error as Error).message,
      });
    }

    this.connections.delete(name);
    log.debug(`LSP server '${name}' disconnected`);
  }

  /**
   * Get the LSPClient for a given language identifier.
   * Returns null if no server handles the language or the server is not connected.
   */
  getClientForLanguage(language: string): LSPClient | null {
    const serverName = this.languageMap.get(language);
    if (!serverName) {
      return null;
    }
    return this.getClient(serverName);
  }

  /**
   * Get the LSPClient for a specific server by name.
   * Returns null if the server is not connected.
   */
  getClient(serverName: string): LSPClient | null {
    const conn = this.connections.get(serverName);
    if (!conn || !conn.client.isConnected()) {
      return null;
    }
    return conn.client;
  }

  /**
   * Get connection status for all configured servers.
   */
  getStatus(): LSPConnectionStatus[] {
    return this.config.servers.map((entry) => {
      const conn = this.connections.get(entry.name);
      if (!conn) {
        return {
          name: entry.name,
          languages: entry.languages,
          connected: false,
          capabilities: [],
          error: entry.enabled === false ? 'Disabled' : undefined,
        };
      }

      const caps = conn.client.getCapabilities();
      const capabilityNames = caps ? extractCapabilityNames(caps) : [];

      return {
        name: entry.name,
        languages: entry.languages,
        connected: conn.client.isConnected(),
        capabilities: capabilityNames,
        error: conn.error,
      };
    });
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private async connectServerInternal(entry: LSPServerEntry): Promise<void> {
    // Guard against duplicate names
    if (this.connections.has(entry.name)) {
      log.warn(`Duplicate LSP server name '${entry.name}', replacing existing connection`);
      await this.disconnectServer(entry.name);
    }

    const client = createLSPClient();

    try {
      log.info(`Connecting to LSP server '${entry.name}'`, {
        command: entry.command,
        languages: entry.languages,
      });

      await client.connect({
        language: entry.languages[0],
        command: entry.command,
        args: entry.args,
        rootUri: entry.rootUri,
      });

      this.connections.set(entry.name, { client, entry });

      log.info(`LSP server '${entry.name}' connected`, {
        capabilities: extractCapabilityNames(client.getCapabilities() ?? {}),
      });
    } catch (error) {
      const message = (error as Error).message;
      log.error(`Failed to connect to LSP server '${entry.name}'`, undefined, {
        error: message,
        command: entry.command,
      });

      // Store the failed connection info for status reporting
      this.connections.set(entry.name, {
        client,
        entry,
        error: message,
      });

      throw error;
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract the names of enabled capabilities from a server capabilities object.
 */
function extractCapabilityNames(caps: LSPServerCapabilities): string[] {
  const names: string[] = [];
  for (const [key, value] of Object.entries(caps)) {
    if (value !== undefined && value !== false && value !== null) {
      names.push(key);
    }
  }
  return names;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLSPConnectionManager(
  config: LSPConnectionManagerConfig,
): LSPConnectionManager {
  return new LSPConnectionManager(config);
}

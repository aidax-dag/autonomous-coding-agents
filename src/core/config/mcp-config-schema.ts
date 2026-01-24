/**
 * MCP Configuration Schema
 *
 * Provides Zod schemas for .mcp.json configuration files.
 * Compatible with Claude Code's MCP server configuration format.
 *
 * @module core/config/mcp-config-schema
 */

import { z } from 'zod';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

// ============================================================================
// Constants
// ============================================================================

/**
 * Supported MCP configuration file names
 */
export const MCP_CONFIG_FILE_NAMES = [
  '.mcp.json',
  'mcp.json',
  '.mcp/config.json',
] as const;

/**
 * Default MCP server timeouts
 */
export const MCP_DEFAULT_TIMEOUTS = {
  connection: 30000,
  request: 60000,
  startup: 10000,
} as const;

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Environment variable schema
 * Supports both string values and ${VAR} references
 */
export const MCPEnvSchema = z.record(
  z.string(),
  z.union([z.string(), z.number()]).transform((v) => String(v))
);

/**
 * STDIO transport configuration schema
 */
export const MCPStdioConfigSchema = z.object({
  /** Command to execute (e.g., "npx", "node", "python") */
  command: z.string().min(1, 'Command is required'),

  /** Command arguments */
  args: z.array(z.string()).optional().default([]),

  /** Environment variables */
  env: MCPEnvSchema.optional(),

  /** Working directory */
  cwd: z.string().optional(),

  /** Shell to use (defaults to system shell) */
  shell: z.union([z.boolean(), z.string()]).optional(),

  /** Windows-specific configuration */
  windowsHide: z.boolean().optional(),
});

/**
 * HTTP/SSE transport configuration schema
 */
export const MCPHttpConfigSchema = z.object({
  /** Server URL */
  url: z.string().url('Invalid URL format'),

  /** HTTP headers */
  headers: z.record(z.string(), z.string()).optional(),

  /** Connection timeout in milliseconds */
  timeout: z.number().positive().optional(),
});

/**
 * WebSocket transport configuration schema
 */
export const MCPWebSocketConfigSchema = z.object({
  /** WebSocket URL */
  url: z.string().url('Invalid WebSocket URL'),

  /** HTTP headers for handshake */
  headers: z.record(z.string(), z.string()).optional(),

  /** Auto-reconnect on disconnect */
  reconnect: z.boolean().optional().default(true),

  /** Reconnect interval in milliseconds */
  reconnectInterval: z.number().positive().optional().default(1000),

  /** Maximum reconnect attempts */
  maxReconnectAttempts: z.number().nonnegative().optional().default(10),
});

/**
 * Server scope enum
 */
export const MCPServerScopeSchema = z.enum(['global', 'project', 'user']);

/**
 * Individual MCP server configuration schema
 */
export const MCPServerConfigSchema = z
  .object({
    /** STDIO configuration (mutually exclusive with url) */
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: MCPEnvSchema.optional(),
    cwd: z.string().optional(),
    shell: z.union([z.boolean(), z.string()]).optional(),

    /** HTTP/WebSocket configuration (mutually exclusive with command) */
    url: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),

    /** Common configuration */
    /** Whether the server is enabled */
    disabled: z.boolean().optional().default(false),

    /** Server scope */
    scope: MCPServerScopeSchema.optional(),

    /** Auto-approve all tool calls from this server */
    alwaysAllow: z.array(z.string()).optional(),

    /** Connection timeout in milliseconds */
    timeout: z.number().positive().optional(),

    /** Request timeout in milliseconds */
    requestTimeout: z.number().positive().optional(),

    /** Auto-reconnect settings */
    reconnect: z.boolean().optional(),
    reconnectInterval: z.number().positive().optional(),
    maxReconnectAttempts: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => {
      // Must have either command (stdio) or url (http/ws)
      const hasCommand = !!data.command;
      const hasUrl = !!data.url;
      return hasCommand !== hasUrl; // XOR: exactly one must be true
    },
    {
      message: 'Server must have either "command" (for stdio) or "url" (for http/ws), but not both',
    }
  );

/**
 * MCP servers map schema
 */
export const MCPServersSchema = z.record(
  z.string().min(1, 'Server name cannot be empty'),
  MCPServerConfigSchema
);

/**
 * Root .mcp.json configuration schema
 */
export const MCPConfigSchema = z.object({
  /** MCP servers configuration */
  mcpServers: MCPServersSchema.optional().default({}),

  /** Global settings */
  settings: z
    .object({
      /** Default connection timeout */
      defaultTimeout: z.number().positive().optional(),

      /** Default request timeout */
      defaultRequestTimeout: z.number().positive().optional(),

      /** Enable debug logging */
      debug: z.boolean().optional(),

      /** Auto-connect on load */
      autoConnect: z.boolean().optional().default(true),
    })
    .optional(),

  /** Schema version */
  version: z.string().optional(),
});

// ============================================================================
// TypeScript Types
// ============================================================================

/**
 * Environment variables type
 */
export type MCPEnv = z.infer<typeof MCPEnvSchema>;

/**
 * STDIO transport configuration
 */
export type MCPStdioConfig = z.infer<typeof MCPStdioConfigSchema>;

/**
 * HTTP transport configuration
 */
export type MCPHttpConfig = z.infer<typeof MCPHttpConfigSchema>;

/**
 * WebSocket transport configuration
 */
export type MCPWebSocketConfig = z.infer<typeof MCPWebSocketConfigSchema>;

/**
 * Server scope type
 */
export type MCPServerScope = z.infer<typeof MCPServerScopeSchema>;

/**
 * Individual server configuration
 */
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

/**
 * Servers map type
 */
export type MCPServers = z.infer<typeof MCPServersSchema>;

/**
 * Root configuration type
 */
export type MCPConfig = z.infer<typeof MCPConfigSchema>;

/**
 * Parsed MCP configuration with metadata
 */
export interface ParsedMCPConfig {
  /** Source file path */
  filePath: string;
  /** Parsed configuration */
  config: MCPConfig;
  /** Parse timestamp */
  parsedAt: Date;
  /** Validation errors (if any) */
  errors?: string[];
}

/**
 * MCP config loader options
 */
export interface MCPConfigLoaderOptions {
  /** Whether to throw on validation errors */
  throwOnError?: boolean;
  /** Whether to expand environment variables */
  expandEnvVars?: boolean;
  /** Additional search paths */
  searchPaths?: string[];
}

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation result
 */
export interface MCPConfigValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Parsed config (if valid) */
  config?: MCPConfig;
  /** Validation errors */
  errors: MCPConfigValidationError[];
}

/**
 * Validation error
 */
export interface MCPConfigValidationError {
  /** Error path (e.g., "mcpServers.myServer.command") */
  path: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

// ============================================================================
// MCP Config Loader Class
// ============================================================================

/**
 * MCP Configuration Loader
 *
 * Loads and validates .mcp.json configuration files.
 */
export class MCPConfigLoader {
  private readonly options: Required<MCPConfigLoaderOptions>;

  constructor(options: MCPConfigLoaderOptions = {}) {
    this.options = {
      throwOnError: options.throwOnError ?? false,
      expandEnvVars: options.expandEnvVars ?? true,
      searchPaths: options.searchPaths ?? [],
    };
  }

  /**
   * Load MCP configuration from a file
   */
  load(filePath: string): ParsedMCPConfig {
    if (!existsSync(filePath)) {
      throw new Error(`MCP config file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    return this.parseContent(content, filePath);
  }

  /**
   * Parse MCP configuration content
   */
  parseContent(content: string, filePath: string = 'unknown'): ParsedMCPConfig {
    let rawConfig: unknown;

    try {
      rawConfig = JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      if (this.options.throwOnError) {
        throw new Error(`Invalid JSON in MCP config: ${message}`);
      }
      return {
        filePath,
        config: { mcpServers: {} },
        parsedAt: new Date(),
        errors: [`Invalid JSON: ${message}`],
      };
    }

    const validation = this.validate(rawConfig);

    if (!validation.valid) {
      if (this.options.throwOnError) {
        throw new Error(
          `Invalid MCP config: ${validation.errors.map((e) => e.message).join(', ')}`
        );
      }
      return {
        filePath,
        config: { mcpServers: {} },
        parsedAt: new Date(),
        errors: validation.errors.map((e) => `${e.path}: ${e.message}`),
      };
    }

    let config = validation.config!;

    // Expand environment variables if enabled
    if (this.options.expandEnvVars) {
      config = this.expandEnvironmentVariables(config);
    }

    return {
      filePath,
      config,
      parsedAt: new Date(),
    };
  }

  /**
   * Find and load MCP configuration in a directory
   */
  findAndLoad(directory: string): ParsedMCPConfig | null {
    // Check standard locations
    for (const fileName of MCP_CONFIG_FILE_NAMES) {
      const filePath = join(directory, fileName);
      if (existsSync(filePath)) {
        return this.load(filePath);
      }
    }

    // Check additional search paths
    for (const searchPath of this.options.searchPaths) {
      for (const fileName of MCP_CONFIG_FILE_NAMES) {
        const filePath = join(searchPath, fileName);
        if (existsSync(filePath)) {
          return this.load(filePath);
        }
      }
    }

    return null;
  }

  /**
   * Find all MCP configurations (local and parent directories)
   */
  findAll(directory: string, maxDepth: number = 3): ParsedMCPConfig[] {
    const results: ParsedMCPConfig[] = [];
    let currentDir = directory;
    let depth = 0;

    while (depth < maxDepth) {
      const config = this.findAndLoad(currentDir);
      if (config) {
        results.push(config);
      }

      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        break; // Reached root
      }
      currentDir = parentDir;
      depth++;
    }

    // Also check user home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      const homeConfig = this.findAndLoad(join(homeDir, '.claude'));
      if (homeConfig) {
        results.push(homeConfig);
      }
    }

    return results;
  }

  /**
   * Merge multiple configurations (later configs override earlier)
   */
  merge(...configs: MCPConfig[]): MCPConfig {
    // Start with a minimal base
    const merged = MCPConfigSchema.parse({
      mcpServers: {},
    });

    for (const config of configs) {
      // Merge servers
      if (config.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          merged.mcpServers[name] = {
            ...merged.mcpServers[name],
            ...serverConfig,
          };
        }
      }

      // Merge settings
      if (config.settings) {
        merged.settings = {
          ...(merged.settings ?? {}),
          ...config.settings,
        };
      }

      // Use latest version
      if (config.version) {
        merged.version = config.version;
      }
    }

    return merged;
  }

  /**
   * Validate raw configuration
   */
  validate(raw: unknown): MCPConfigValidationResult {
    const result = MCPConfigSchema.safeParse(raw);

    if (result.success) {
      return {
        valid: true,
        config: result.data,
        errors: [],
      };
    }

    const errors: MCPConfigValidationError[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    return {
      valid: false,
      errors,
    };
  }

  /**
   * Expand environment variables in configuration
   */
  private expandEnvironmentVariables(config: MCPConfig): MCPConfig {
    const expanded = JSON.parse(JSON.stringify(config)) as MCPConfig;

    if (expanded.mcpServers) {
      for (const serverConfig of Object.values(expanded.mcpServers)) {
        // Expand env values
        if (serverConfig.env) {
          for (const [key, value] of Object.entries(serverConfig.env)) {
            serverConfig.env[key] = this.expandEnvVar(value);
          }
        }

        // Expand command if it contains env vars
        if (serverConfig.command) {
          serverConfig.command = this.expandEnvVar(serverConfig.command);
        }

        // Expand args
        if (serverConfig.args) {
          serverConfig.args = serverConfig.args.map((arg) => this.expandEnvVar(arg));
        }

        // Expand cwd
        if (serverConfig.cwd) {
          serverConfig.cwd = this.expandEnvVar(serverConfig.cwd);
        }

        // Expand url
        if (serverConfig.url) {
          serverConfig.url = this.expandEnvVar(serverConfig.url);
        }

        // Expand headers
        if (serverConfig.headers) {
          for (const [key, value] of Object.entries(serverConfig.headers)) {
            serverConfig.headers[key] = this.expandEnvVar(value);
          }
        }
      }
    }

    return expanded;
  }

  /**
   * Expand a single environment variable reference
   */
  private expandEnvVar(value: string): string {
    // Match ${VAR} or $VAR patterns
    return value.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/gi, (_, bracedVar, plainVar) => {
      const varName = bracedVar || plainVar;
      return process.env[varName] || '';
    });
  }

  /**
   * Get enabled servers from config
   */
  getEnabledServers(config: MCPConfig): Map<string, MCPServerConfig> {
    const enabled = new Map<string, MCPServerConfig>();

    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        if (!serverConfig.disabled) {
          enabled.set(name, serverConfig);
        }
      }
    }

    return enabled;
  }

  /**
   * Get servers by scope
   */
  getServersByScope(config: MCPConfig, scope: MCPServerScope): Map<string, MCPServerConfig> {
    const filtered = new Map<string, MCPServerConfig>();

    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        if (serverConfig.scope === scope) {
          filtered.set(name, serverConfig);
        }
      }
    }

    return filtered;
  }

  /**
   * Determine transport type from server config
   */
  getTransportType(serverConfig: MCPServerConfig): 'stdio' | 'http' | 'websocket' {
    if (serverConfig.command) {
      return 'stdio';
    }

    if (serverConfig.url) {
      const url = serverConfig.url.toLowerCase();
      if (url.startsWith('ws://') || url.startsWith('wss://')) {
        return 'websocket';
      }
      return 'http';
    }

    throw new Error('Cannot determine transport type: no command or url specified');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an MCP config loader
 */
export function createMCPConfigLoader(options?: MCPConfigLoaderOptions): MCPConfigLoader {
  return new MCPConfigLoader(options);
}

/**
 * Load MCP configuration from a file (convenience function)
 */
export function loadMCPConfig(filePath: string): ParsedMCPConfig {
  const loader = new MCPConfigLoader();
  return loader.load(filePath);
}

/**
 * Find and load MCP configuration (convenience function)
 */
export function findMCPConfig(directory: string): ParsedMCPConfig | null {
  const loader = new MCPConfigLoader();
  return loader.findAndLoad(directory);
}

/**
 * Validate MCP configuration (convenience function)
 */
export function validateMCPConfig(raw: unknown): MCPConfigValidationResult {
  const loader = new MCPConfigLoader();
  return loader.validate(raw);
}

// ============================================================================
// Server Config Builders
// ============================================================================

/**
 * Build a stdio server configuration
 */
export function buildStdioServerConfig(options: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
  alwaysAllow?: string[];
}): MCPServerConfig {
  return MCPServerConfigSchema.parse({
    command: options.command,
    args: options.args,
    env: options.env,
    cwd: options.cwd,
    disabled: options.disabled,
    alwaysAllow: options.alwaysAllow,
  });
}

/**
 * Build an HTTP server configuration
 */
export function buildHttpServerConfig(options: {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  disabled?: boolean;
  alwaysAllow?: string[];
}): MCPServerConfig {
  return MCPServerConfigSchema.parse({
    url: options.url,
    headers: options.headers,
    timeout: options.timeout,
    disabled: options.disabled,
    alwaysAllow: options.alwaysAllow,
  });
}

/**
 * Build a WebSocket server configuration
 */
export function buildWebSocketServerConfig(options: {
  url: string;
  headers?: Record<string, string>;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  disabled?: boolean;
  alwaysAllow?: string[];
}): MCPServerConfig {
  return MCPServerConfigSchema.parse({
    url: options.url,
    headers: options.headers,
    reconnect: options.reconnect,
    reconnectInterval: options.reconnectInterval,
    maxReconnectAttempts: options.maxReconnectAttempts,
    disabled: options.disabled,
    alwaysAllow: options.alwaysAllow,
  });
}

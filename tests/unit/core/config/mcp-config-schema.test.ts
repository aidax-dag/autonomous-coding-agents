/**
 * MCP Config Schema Tests
 *
 * Tests for .mcp.json configuration schema and loader.
 */

import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { z } from 'zod';
import {
  MCPConfigSchema,
  MCPServerConfigSchema,
  MCPConfigLoader,
  createMCPConfigLoader,
  loadMCPConfig,
  findMCPConfig,
  validateMCPConfig,
  buildStdioServerConfig,
  buildHttpServerConfig,
  buildWebSocketServerConfig,
  MCP_CONFIG_FILE_NAMES,
} from '@/core/config/mcp-config-schema';

// Use input types for test data (before defaults are applied)
type MCPConfigInput = z.input<typeof MCPConfigSchema>;

describe('MCP Config Schema', () => {
  const testDir = join(__dirname, '.test-mcp-config');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('MCPServerConfigSchema', () => {
    it('should validate stdio server config', () => {
      const config = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: { HOME: '/home/user' },
      };

      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.command).toBe('npx');
        expect(result.data.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
      }
    });

    it('should validate http server config', () => {
      const config = {
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer token' },
      };

      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('https://api.example.com/mcp');
      }
    });

    it('should validate websocket server config', () => {
      const config = {
        url: 'wss://api.example.com/mcp',
        reconnect: true,
        reconnectInterval: 5000,
      };

      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject config with both command and url', () => {
      const config = {
        command: 'npx',
        url: 'https://api.example.com/mcp',
      };

      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject config with neither command nor url', () => {
      const config = {
        env: { KEY: 'value' },
      };

      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept disabled server', () => {
      const config = {
        command: 'npx',
        disabled: true,
      };

      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.disabled).toBe(true);
      }
    });

    it('should accept alwaysAllow list', () => {
      const config = {
        command: 'node',
        args: ['server.js'],
        alwaysAllow: ['read_file', 'write_file'],
      };

      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alwaysAllow).toEqual(['read_file', 'write_file']);
      }
    });
  });

  describe('MCPConfigSchema', () => {
    it('should validate full config', () => {
      const config: MCPConfigInput = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          },
        },
        settings: {
          defaultTimeout: 30000,
          autoConnect: true,
        },
        version: '1.0.0',
      };

      const result = MCPConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept empty config', () => {
      const config = {};

      const result = MCPConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mcpServers).toEqual({});
      }
    });

    it('should accept config with only mcpServers', () => {
      const config = {
        mcpServers: {
          test: { command: 'echo' },
        },
      };

      const result = MCPConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid server name', () => {
      const config = {
        mcpServers: {
          '': { command: 'echo' },
        },
      };

      const result = MCPConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('MCPConfigLoader', () => {
    let loader: MCPConfigLoader;

    beforeEach(() => {
      loader = new MCPConfigLoader();
    });

    describe('load', () => {
      it('should load valid config file', () => {
        const configPath = join(testDir, '.mcp.json');
        const config = {
          mcpServers: {
            test: { command: 'echo', args: ['hello'] },
          },
        };
        writeFileSync(configPath, JSON.stringify(config));

        const result = loader.load(configPath);

        expect(result.config.mcpServers).toBeDefined();
        expect(result.config.mcpServers!['test'].command).toBe('echo');
        expect(result.errors).toBeUndefined();
      });

      it('should throw error for non-existent file', () => {
        expect(() => loader.load('/non/existent/.mcp.json')).toThrow('MCP config file not found');
      });

      it('should handle invalid JSON', () => {
        const configPath = join(testDir, '.mcp.json');
        writeFileSync(configPath, '{ invalid json }');

        const result = loader.load(configPath);

        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });

      it('should throw on invalid JSON when throwOnError is true', () => {
        const strictLoader = new MCPConfigLoader({ throwOnError: true });
        const configPath = join(testDir, '.mcp.json');
        writeFileSync(configPath, '{ invalid json }');

        expect(() => strictLoader.load(configPath)).toThrow('Invalid JSON');
      });
    });

    describe('parseContent', () => {
      it('should parse valid JSON content', () => {
        const content = JSON.stringify({
          mcpServers: {
            test: { command: 'node', args: ['server.js'] },
          },
        });

        const result = loader.parseContent(content);

        expect(result.config.mcpServers!['test'].command).toBe('node');
      });

      it('should return errors for invalid config', () => {
        const content = JSON.stringify({
          mcpServers: {
            test: { invalid: 'config' },
          },
        });

        const result = loader.parseContent(content);

        expect(result.errors).toBeDefined();
      });
    });

    describe('findAndLoad', () => {
      it('should find .mcp.json in directory', () => {
        const configPath = join(testDir, '.mcp.json');
        writeFileSync(configPath, JSON.stringify({ mcpServers: { test: { command: 'echo' } } }));

        const result = loader.findAndLoad(testDir);

        expect(result).not.toBeNull();
        expect(result!.config.mcpServers!['test']).toBeDefined();
      });

      it('should find mcp.json when .mcp.json not present', () => {
        const configPath = join(testDir, 'mcp.json');
        writeFileSync(configPath, JSON.stringify({ mcpServers: { alt: { command: 'ls' } } }));

        const result = loader.findAndLoad(testDir);

        expect(result).not.toBeNull();
        expect(result!.config.mcpServers!['alt']).toBeDefined();
      });

      it('should return null when no config found', () => {
        const result = loader.findAndLoad(testDir);

        expect(result).toBeNull();
      });
    });

    describe('findAll', () => {
      it('should find configs in parent directories', () => {
        const subDir = join(testDir, 'sub', 'deep');
        mkdirSync(subDir, { recursive: true });

        writeFileSync(
          join(testDir, '.mcp.json'),
          JSON.stringify({ mcpServers: { root: { command: 'echo' } } })
        );
        writeFileSync(
          join(testDir, 'sub', '.mcp.json'),
          JSON.stringify({ mcpServers: { sub: { command: 'ls' } } })
        );

        const results = loader.findAll(subDir);

        expect(results.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('merge', () => {
      it('should merge multiple configs', () => {
        const config1 = MCPConfigSchema.parse({
          mcpServers: {
            server1: { command: 'cmd1' },
          },
          settings: { defaultTimeout: 1000 },
        });

        const config2 = MCPConfigSchema.parse({
          mcpServers: {
            server2: { command: 'cmd2' },
          },
          settings: { debug: true },
        });

        const merged = loader.merge(config1, config2);

        expect(merged.mcpServers!['server1']).toBeDefined();
        expect(merged.mcpServers!['server2']).toBeDefined();
        expect(merged.settings!.defaultTimeout).toBe(1000);
        expect(merged.settings!.debug).toBe(true);
      });

      it('should override with later configs', () => {
        const config1 = MCPConfigSchema.parse({
          mcpServers: {
            server: { command: 'old' },
          },
        });

        const config2 = MCPConfigSchema.parse({
          mcpServers: {
            server: { command: 'new' },
          },
        });

        const merged = loader.merge(config1, config2);

        expect(merged.mcpServers!['server'].command).toBe('new');
      });
    });

    describe('validate', () => {
      it('should return valid result for correct config', () => {
        const config = {
          mcpServers: {
            test: { command: 'echo' },
          },
        };

        const result = loader.validate(config);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return errors for invalid config', () => {
        const config = {
          mcpServers: {
            test: { noCommandOrUrl: true },
          },
        };

        const result = loader.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('environment variable expansion', () => {
      it('should expand ${VAR} syntax', () => {
        const originalEnv = process.env.TEST_VAR;
        process.env.TEST_VAR = 'test-value';

        try {
          const content = JSON.stringify({
            mcpServers: {
              test: {
                command: 'echo',
                env: { KEY: '${TEST_VAR}' },
              },
            },
          });

          const result = loader.parseContent(content);

          expect(result.config.mcpServers!['test'].env!['KEY']).toBe('test-value');
        } finally {
          if (originalEnv !== undefined) {
            process.env.TEST_VAR = originalEnv;
          } else {
            delete process.env.TEST_VAR;
          }
        }
      });

      it('should not expand when disabled', () => {
        const noExpandLoader = new MCPConfigLoader({ expandEnvVars: false });
        process.env.TEST_VAR = 'test-value';

        try {
          const content = JSON.stringify({
            mcpServers: {
              test: {
                command: 'echo',
                env: { KEY: '${TEST_VAR}' },
              },
            },
          });

          const result = noExpandLoader.parseContent(content);

          expect(result.config.mcpServers!['test'].env!['KEY']).toBe('${TEST_VAR}');
        } finally {
          delete process.env.TEST_VAR;
        }
      });
    });

    describe('getEnabledServers', () => {
      it('should return only enabled servers', () => {
        const config = MCPConfigSchema.parse({
          mcpServers: {
            enabled: { command: 'echo' },
            disabled: { command: 'ls', disabled: true },
          },
        });

        const enabled = loader.getEnabledServers(config);

        expect(enabled.size).toBe(1);
        expect(enabled.has('enabled')).toBe(true);
        expect(enabled.has('disabled')).toBe(false);
      });
    });

    describe('getTransportType', () => {
      it('should detect stdio transport', () => {
        const config = MCPServerConfigSchema.parse({ command: 'node' });
        expect(loader.getTransportType(config)).toBe('stdio');
      });

      it('should detect http transport', () => {
        const config = MCPServerConfigSchema.parse({ url: 'https://api.example.com' });
        expect(loader.getTransportType(config)).toBe('http');
      });

      it('should detect websocket transport', () => {
        const config = MCPServerConfigSchema.parse({ url: 'wss://api.example.com' });
        expect(loader.getTransportType(config)).toBe('websocket');

        const config2 = MCPServerConfigSchema.parse({ url: 'ws://localhost:8080' });
        expect(loader.getTransportType(config2)).toBe('websocket');
      });
    });
  });

  describe('convenience functions', () => {
    it('createMCPConfigLoader should create loader', () => {
      const loader = createMCPConfigLoader();
      expect(loader).toBeInstanceOf(MCPConfigLoader);
    });

    it('loadMCPConfig should load file', () => {
      const configPath = join(testDir, '.mcp.json');
      writeFileSync(configPath, JSON.stringify({ mcpServers: { t: { command: 'x' } } }));

      const result = loadMCPConfig(configPath);

      expect(result.config.mcpServers!['t']).toBeDefined();
    });

    it('findMCPConfig should find config', () => {
      const configPath = join(testDir, '.mcp.json');
      writeFileSync(configPath, JSON.stringify({ mcpServers: { t: { command: 'x' } } }));

      const result = findMCPConfig(testDir);

      expect(result).not.toBeNull();
    });

    it('validateMCPConfig should validate', () => {
      const result = validateMCPConfig({
        mcpServers: { test: { command: 'echo' } },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('server config builders', () => {
    it('buildStdioServerConfig should create valid config', () => {
      const config = buildStdioServerConfig({
        command: 'npx',
        args: ['-y', 'package'],
        env: { KEY: 'value' },
      });

      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['-y', 'package']);
    });

    it('buildHttpServerConfig should create valid config', () => {
      const config = buildHttpServerConfig({
        url: 'https://api.example.com',
        headers: { Auth: 'Bearer token' },
      });

      expect(config.url).toBe('https://api.example.com');
    });

    it('buildWebSocketServerConfig should create valid config', () => {
      const config = buildWebSocketServerConfig({
        url: 'wss://api.example.com',
        reconnect: true,
      });

      expect(config.url).toBe('wss://api.example.com');
      expect(config.reconnect).toBe(true);
    });
  });

  describe('MCP_CONFIG_FILE_NAMES', () => {
    it('should contain expected file names', () => {
      expect(MCP_CONFIG_FILE_NAMES).toContain('.mcp.json');
      expect(MCP_CONFIG_FILE_NAMES).toContain('mcp.json');
      expect(MCP_CONFIG_FILE_NAMES).toContain('.mcp/config.json');
    });
  });

  describe('real-world config examples', () => {
    it('should validate Claude Code style config', () => {
      const config = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
          },
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}',
            },
          },
          puppeteer: {
            command: 'npx',
            args: ['-y', '@anthropic/claude-mcp-server-puppeteer'],
          },
        },
      };

      const result = MCPConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate mixed transport config', () => {
      const config = {
        mcpServers: {
          local: {
            command: 'python',
            args: ['-m', 'mcp_server'],
            cwd: '/path/to/server',
          },
          remote: {
            url: 'https://mcp.example.com/api',
            headers: {
              'X-API-Key': 'secret',
            },
            timeout: 30000,
          },
          realtime: {
            url: 'wss://mcp.example.com/ws',
            reconnect: true,
            maxReconnectAttempts: 5,
          },
        },
        settings: {
          defaultTimeout: 60000,
          debug: false,
          autoConnect: true,
        },
      };

      const result = MCPConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

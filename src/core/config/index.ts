/**
 * Configuration System
 *
 * Type-safe configuration management with:
 * - Environment-based profiles (development, staging, production, test)
 * - Schema validation via Zod
 * - DI Container integration
 * - Runtime configuration overrides
 * - Change notifications
 *
 * @module core/config
 *
 * @example
 * ```typescript
 * import { createConfigService, CommonSchemas } from '@core/config';
 * import { z } from 'zod';
 *
 * // Define your config schema
 * const AppConfigSchema = z.object({
 *   server: CommonSchemas.server,
 *   database: CommonSchemas.database,
 *   logging: CommonSchemas.logging,
 * });
 *
 * type AppConfig = z.infer<typeof AppConfigSchema>;
 *
 * // Create config service
 * const configService = createConfigService<AppConfig>(
 *   {
 *     server: { host: 'localhost', port: 3000 },
 *     database: { host: 'localhost', port: 5432, name: 'app', user: 'admin' },
 *     logging: { level: 'info', format: 'json' },
 *   },
 *   {
 *     schema: AppConfigSchema,
 *     validateOnLoad: true,
 *   }
 * );
 *
 * // Access configuration
 * const port = configService.get<number>('server.port');
 * const dbHost = configService.get('database.host', 'localhost');
 *
 * // Runtime overrides
 * configService.set('logging.level', 'debug');
 *
 * // Listen for changes
 * configService.onChange('logging.level', (event) => {
 *   console.log(`Log level changed to ${event.newValue}`);
 * });
 * ```
 */

// Interfaces
export type {
  Environment,
  ConfigSource,
  ConfigValueMeta,
  ConfigChangeEvent,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigLoaderOptions,
  ConfigServiceOptions,
  ConfigChangeListener,
  ConfigSubscription,
  IConfigLoader,
  IConfigValidator,
  IConfigService,
  CreateConfigServiceOptions,
} from './interfaces';

export { CONFIG_SERVICE_TOKEN } from './interfaces';

// Implementations
export { ConfigLoader, createConfigLoader } from './config-loader';
export { ConfigValidator, createConfigValidator, CommonSchemas } from './config-validator';
export {
  ConfigService,
  createConfigService,
  createConfigServiceAsync,
} from './config-service';

// Instruction Parser (CLAUDE.md, AGENT.md support)
export {
  InstructionParser,
  createInstructionParser,
  parseInstructionFile,
  findInstructions,
  INSTRUCTION_FILE_NAMES,
  InstructionSectionType,
} from './instruction-parser';

export type {
  CodeBlock,
  InstructionItem,
  InstructionSection,
  ParsedInstructions,
  InstructionParserOptions,
} from './instruction-parser';

// MCP Configuration (.mcp.json support)
export {
  MCPConfigLoader,
  createMCPConfigLoader,
  loadMCPConfig,
  findMCPConfig,
  validateMCPConfig,
  buildStdioServerConfig,
  buildHttpServerConfig,
  buildWebSocketServerConfig,
  MCP_CONFIG_FILE_NAMES,
  MCP_DEFAULT_TIMEOUTS,
  // Zod Schemas
  MCPConfigSchema,
  MCPServerConfigSchema,
  MCPServersSchema,
  MCPEnvSchema,
  MCPStdioConfigSchema,
  MCPHttpConfigSchema,
  MCPWebSocketConfigSchema,
  MCPServerScopeSchema,
} from './mcp-config-schema';

export type {
  MCPEnv,
  MCPStdioConfig,
  MCPHttpConfig,
  MCPWebSocketConfig,
  MCPServerScope,
  MCPServerConfig,
  MCPServers,
  MCPConfig,
  ParsedMCPConfig,
  MCPConfigLoaderOptions,
  MCPConfigValidationResult,
  MCPConfigValidationError,
} from './mcp-config-schema';

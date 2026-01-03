/**
 * Configuration System Interfaces
 *
 * Provides type-safe configuration management with:
 * - Environment-based profiles (development, staging, production, test)
 * - Schema validation via Zod
 * - DI Container integration
 * - Runtime configuration overrides
 *
 * @module core/config
 */

import { z } from 'zod';

/**
 * Environment types supported by the configuration system
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Configuration source types
 */
export type ConfigSource = 'default' | 'file' | 'env' | 'override';

/**
 * Configuration value with metadata
 */
export interface ConfigValueMeta<T> {
  value: T;
  source: ConfigSource;
  path: string;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent<T = unknown> {
  path: string;
  oldValue: T | undefined;
  newValue: T;
  source: ConfigSource;
  timestamp: number;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  path: string;
  message: string;
  code: string;
  received?: unknown;
  expected?: string;
}

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  /** Base directory for config files */
  configDir?: string;
  /** Environment to load */
  environment?: Environment;
  /** Whether to load .env file */
  loadDotEnv?: boolean;
  /** Custom .env file path */
  dotEnvPath?: string;
}

/**
 * Configuration service options
 */
export interface ConfigServiceOptions extends ConfigLoaderOptions {
  /** Schema for validation */
  schema?: z.ZodSchema;
  /** Whether to validate on load */
  validateOnLoad?: boolean;
  /** Whether to freeze config (prevent modifications) */
  freeze?: boolean;
  /** Enable change notifications */
  enableChangeNotifications?: boolean;
}

/**
 * Configuration change listener
 */
export type ConfigChangeListener<T = unknown> = (event: ConfigChangeEvent<T>) => void;

/**
 * Configuration subscription handle
 */
export interface ConfigSubscription {
  unsubscribe(): void;
}

/**
 * Configuration loader interface
 * Responsible for loading configuration from various sources
 */
export interface IConfigLoader {
  /**
   * Load configuration from all sources
   * @param options Loader options
   * @returns Merged configuration object
   */
  load<T extends Record<string, unknown>>(options?: ConfigLoaderOptions): Promise<T>;

  /**
   * Load configuration from a specific file
   * @param filePath Path to config file
   * @returns Configuration object
   */
  loadFile<T extends Record<string, unknown>>(filePath: string): Promise<T>;

  /**
   * Load configuration from environment variables
   * @param prefix Optional prefix for env vars
   * @returns Configuration object from env
   */
  loadEnv<T extends Record<string, unknown>>(prefix?: string): T;
}

/**
 * Configuration validator interface
 * Responsible for validating configuration against schemas
 */
export interface IConfigValidator {
  /**
   * Validate configuration against schema
   * @param config Configuration to validate
   * @param schema Zod schema
   * @returns Validation result
   */
  validate<T>(config: unknown, schema: z.ZodSchema<T>): ConfigValidationResult;

  /**
   * Parse and validate configuration
   * @param config Configuration to parse
   * @param schema Zod schema
   * @returns Parsed configuration or throws
   */
  parse<T>(config: unknown, schema: z.ZodSchema<T>): T;

  /**
   * Safe parse without throwing
   * @param config Configuration to parse
   * @param schema Zod schema
   * @returns Parsed config or null with errors
   */
  safeParse<T>(
    config: unknown,
    schema: z.ZodSchema<T>
  ): { success: true; data: T } | { success: false; errors: ConfigValidationError[] };
}

/**
 * Configuration service interface
 * Main interface for configuration management
 */
export interface IConfigService<T extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Get the current environment
   */
  readonly environment: Environment;

  /**
   * Get the full configuration object
   */
  readonly config: Readonly<T>;

  /**
   * Get a configuration value by path
   * @param path Dot-notation path (e.g., 'database.host')
   * @returns Configuration value or undefined
   */
  get<V>(path: string): V | undefined;

  /**
   * Get a configuration value with default
   * @param path Dot-notation path
   * @param defaultValue Default if not found
   * @returns Configuration value or default
   */
  get<V>(path: string, defaultValue: V): V;

  /**
   * Get a configuration value with metadata
   * @param path Dot-notation path
   * @returns Value with source information
   */
  getWithMeta<V>(path: string): ConfigValueMeta<V> | undefined;

  /**
   * Check if a configuration path exists
   * @param path Dot-notation path
   * @returns True if path exists
   */
  has(path: string): boolean;

  /**
   * Set a runtime configuration override
   * @param path Dot-notation path
   * @param value Value to set
   */
  set<V>(path: string, value: V): void;

  /**
   * Remove a runtime override
   * @param path Dot-notation path
   * @returns True if override was removed
   */
  removeOverride(path: string): boolean;

  /**
   * Clear all runtime overrides
   */
  clearOverrides(): void;

  /**
   * Subscribe to configuration changes
   * @param path Dot-notation path to watch (or '*' for all)
   * @param listener Change listener
   * @returns Subscription handle
   */
  onChange<V>(path: string, listener: ConfigChangeListener<V>): ConfigSubscription;

  /**
   * Reload configuration from sources
   */
  reload(): Promise<void>;

  /**
   * Validate current configuration
   * @returns Validation result
   */
  validate(): ConfigValidationResult;

  /**
   * Check if running in production
   */
  isProduction(): boolean;

  /**
   * Check if running in development
   */
  isDevelopment(): boolean;

  /**
   * Check if running in test environment
   */
  isTest(): boolean;

  /**
   * Dispose the service and clean up resources
   */
  dispose(): void;
}

/**
 * Configuration service factory options
 */
export interface CreateConfigServiceOptions<T extends Record<string, unknown>>
  extends ConfigServiceOptions {
  /** Default configuration values */
  defaults?: Partial<T>;
  /** Initial overrides */
  overrides?: Partial<T>;
}

/**
 * DI Token for configuration service
 */
export const CONFIG_SERVICE_TOKEN = Symbol.for('ConfigService');

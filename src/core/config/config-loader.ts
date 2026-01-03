/**
 * Configuration Loader Implementation
 *
 * Loads configuration from multiple sources:
 * - Default values
 * - Config files (JSON, JS)
 * - Environment variables
 * - .env files
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { IConfigLoader, ConfigLoaderOptions, Environment } from './interfaces';

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Parse environment variable to appropriate type
 */
function parseEnvValue(value: string): unknown {
  // Boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Number
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;

  // JSON object or array
  if (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, return as string
    }
  }

  return value;
}

/**
 * Convert environment variable name to config path
 * APP_DATABASE_HOST -> database.host
 */
function envToPath(envVar: string, prefix: string): string {
  let path = envVar;

  if (prefix && path.startsWith(prefix + '_')) {
    path = path.slice(prefix.length + 1);
  }

  return path.toLowerCase().replace(/_/g, '.');
}

/**
 * Set a nested value in an object by path
 */
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Load .env file manually (without dotenv dependency in core)
 */
function loadDotEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!existsSync(filePath)) {
    return result;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }
  }

  return result;
}

/**
 * Configuration loader implementation
 */
export class ConfigLoader implements IConfigLoader {
  /**
   * Load configuration from all sources
   */
  async load<T extends Record<string, unknown>>(
    options: ConfigLoaderOptions = {}
  ): Promise<T> {
    const {
      configDir = process.cwd(),
      environment = (process.env.NODE_ENV as Environment) || 'development',
      loadDotEnv = true,
      dotEnvPath,
    } = options;

    let config: Record<string, unknown> = {};

    // 1. Load .env file if enabled
    if (loadDotEnv) {
      const envPath = dotEnvPath || join(configDir, '.env');
      const envVars = loadDotEnvFile(envPath);

      // Apply to process.env
      for (const [key, value] of Object.entries(envVars)) {
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    }

    // 2. Load base config file
    const baseConfigPath = join(configDir, 'config', 'default');
    const baseConfig = await this.tryLoadConfigFile(baseConfigPath);
    if (baseConfig) {
      config = deepMerge(config as T, baseConfig as Partial<T>);
    }

    // 3. Load environment-specific config
    const envConfigPath = join(configDir, 'config', environment);
    const envConfig = await this.tryLoadConfigFile(envConfigPath);
    if (envConfig) {
      config = deepMerge(config as T, envConfig as Partial<T>);
    }

    // 4. Load local config (gitignored)
    const localConfigPath = join(configDir, 'config', 'local');
    const localConfig = await this.tryLoadConfigFile(localConfigPath);
    if (localConfig) {
      config = deepMerge(config as T, localConfig as Partial<T>);
    }

    // 5. Apply environment variables
    const envVarConfig = this.loadEnv<T>();
    config = deepMerge(config as T, envVarConfig as Partial<T>);

    return config as T;
  }

  /**
   * Load configuration from a specific file
   */
  async loadFile<T extends Record<string, unknown>>(filePath: string): Promise<T> {
    const resolved = resolve(filePath);

    if (!existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }

    const ext = resolved.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'json':
        return JSON.parse(readFileSync(resolved, 'utf-8')) as T;

      case 'js':
      case 'cjs': {
        const module = await import(resolved);
        return (module.default || module) as T;
      }

      case 'ts':
      case 'mts': {
        // TypeScript files need to be handled by the runtime
        const module = await import(resolved);
        return (module.default || module) as T;
      }

      default:
        throw new Error(`Unsupported config file format: ${ext}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadEnv<T extends Record<string, unknown>>(prefix?: string): T {
    const config: Record<string, unknown> = {};
    const envPrefix = prefix || 'APP';

    for (const [key, value] of Object.entries(process.env)) {
      if (!value) continue;

      // Only process prefixed variables or known config keys
      if (prefix && !key.startsWith(envPrefix + '_')) {
        continue;
      }

      const path = envToPath(key, envPrefix);
      const parsedValue = parseEnvValue(value);
      setByPath(config, path, parsedValue);
    }

    return config as T;
  }

  /**
   * Try to load a config file (with various extensions)
   */
  private async tryLoadConfigFile(
    basePath: string
  ): Promise<Record<string, unknown> | null> {
    const extensions = ['.json', '.js', '.cjs', '.ts', '.mts'];

    for (const ext of extensions) {
      const fullPath = basePath + ext;
      if (existsSync(fullPath)) {
        try {
          return await this.loadFile(fullPath);
        } catch {
          // Try next extension
        }
      }
    }

    return null;
  }
}

/**
 * Create a configuration loader instance
 */
export function createConfigLoader(): IConfigLoader {
  return new ConfigLoader();
}

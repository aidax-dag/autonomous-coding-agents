/**
 * Configuration Service Implementation
 *
 * Main configuration management service with:
 * - Type-safe access
 * - Runtime overrides
 * - Change notifications
 * - DI Container integration
 */

import { z } from 'zod';
import type {
  IConfigService,
  IConfigLoader,
  IConfigValidator,
  Environment,
  ConfigSource,
  ConfigValueMeta,
  ConfigChangeEvent,
  ConfigChangeListener,
  ConfigSubscription,
  ConfigValidationResult,
  CreateConfigServiceOptions,
} from './interfaces';
import { ConfigLoader } from './config-loader';
import { ConfigValidator } from './config-validator';

/**
 * Get a nested value from an object by path
 */
function getByPath<T>(obj: Record<string, unknown>, path: string): T | undefined {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current as T;
}

/**
 * Set a nested value in an object by path
 */
function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
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
 * Delete a nested value from an object by path
 */
function deleteByPath(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      return false;
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart in current) {
    delete current[lastPart];
    return true;
  }

  return false;
}

/**
 * Deep freeze an object
 */
function deepFreeze<T extends Record<string, unknown>>(obj: T): Readonly<T> {
  Object.freeze(obj);

  for (const key in obj) {
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as Record<string, unknown>);
    }
  }

  return obj;
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const key in obj) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }

  return cloned as T;
}

/**
 * Listener entry with path pattern
 */
interface ListenerEntry<T = unknown> {
  id: number;
  path: string;
  listener: ConfigChangeListener<T>;
}

/**
 * Configuration service implementation
 */
export class ConfigService<T extends Record<string, unknown> = Record<string, unknown>>
  implements IConfigService<T>
{
  private _config: T;
  private _environment: Environment;
  private _overrides: Record<string, unknown> = {};
  private _sources: Map<string, ConfigSource> = new Map();
  private _listeners: ListenerEntry[] = [];
  private _listenerIdCounter = 0;
  private _disposed = false;
  private _frozen: boolean;
  private _enableChangeNotifications: boolean;

  private readonly loader: IConfigLoader;
  private readonly validator: IConfigValidator;
  private readonly schema?: z.ZodSchema<T>;
  private readonly options: CreateConfigServiceOptions<T>;

  constructor(
    config: T,
    options: CreateConfigServiceOptions<T> = {}
  ) {
    this.options = options;
    this.loader = new ConfigLoader();
    this.validator = new ConfigValidator();
    this.schema = options.schema;
    this._frozen = options.freeze ?? false;
    this._enableChangeNotifications = options.enableChangeNotifications ?? true;
    this._environment =
      options.environment ||
      (process.env.NODE_ENV as Environment) ||
      'development';

    // Initialize with defaults
    this._config = deepClone(config);

    // Track sources for all root keys
    for (const key in this._config) {
      this._sources.set(key, 'default');
    }

    // Apply initial overrides if provided
    if (options.overrides) {
      for (const [key, value] of Object.entries(options.overrides)) {
        if (value !== undefined) {
          setByPath(this._config as Record<string, unknown>, key, value);
          this._overrides[key] = value;
          this._sources.set(key, 'override');
        }
      }
    }

    // Freeze if requested
    if (this._frozen) {
      this._config = deepFreeze(deepClone(this._config));
    }
  }

  get environment(): Environment {
    this.ensureNotDisposed();
    return this._environment;
  }

  get config(): Readonly<T> {
    this.ensureNotDisposed();
    return this._config;
  }

  get<V>(path: string, defaultValue?: V): V | undefined {
    this.ensureNotDisposed();

    // Check overrides first
    const overrideValue = getByPath<V>(this._overrides, path);
    if (overrideValue !== undefined) {
      return overrideValue;
    }

    // Then check main config
    const value = getByPath<V>(this._config as Record<string, unknown>, path);
    return value !== undefined ? value : defaultValue;
  }

  getWithMeta<V>(path: string): ConfigValueMeta<V> | undefined {
    this.ensureNotDisposed();

    const value = this.get<V>(path);
    if (value === undefined) {
      return undefined;
    }

    // Determine source
    let source: ConfigSource = 'default';
    const rootKey = path.split('.')[0];

    if (path in this._overrides || getByPath(this._overrides, path) !== undefined) {
      source = 'override';
    } else if (this._sources.has(rootKey)) {
      source = this._sources.get(rootKey)!;
    }

    return { value, source, path };
  }

  has(path: string): boolean {
    this.ensureNotDisposed();
    return this.get(path) !== undefined;
  }

  set<V>(path: string, value: V): void {
    this.ensureNotDisposed();

    if (this._frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }

    const oldValue = this.get<V>(path);

    // Store in overrides
    setByPath(this._overrides, path, value);

    // Also update main config for consistency
    setByPath(this._config as Record<string, unknown>, path, value);
    this._sources.set(path.split('.')[0], 'override');

    // Notify listeners
    if (this._enableChangeNotifications) {
      this.notifyListeners(path, oldValue, value, 'override');
    }
  }

  removeOverride(path: string): boolean {
    this.ensureNotDisposed();

    if (this._frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }

    return deleteByPath(this._overrides, path);
  }

  clearOverrides(): void {
    this.ensureNotDisposed();

    if (this._frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }

    this._overrides = {};
  }

  onChange<V>(path: string, listener: ConfigChangeListener<V>): ConfigSubscription {
    this.ensureNotDisposed();

    const id = ++this._listenerIdCounter;
    const entry: ListenerEntry<V> = { id, path, listener };
    this._listeners.push(entry as ListenerEntry);

    return {
      unsubscribe: () => {
        const index = this._listeners.findIndex((l) => l.id === id);
        if (index !== -1) {
          this._listeners.splice(index, 1);
        }
      },
    };
  }

  async reload(): Promise<void> {
    this.ensureNotDisposed();

    if (this._frozen) {
      throw new Error('Configuration is frozen and cannot be reloaded');
    }

    const newConfig = await this.loader.load<T>(this.options);

    // Apply defaults
    if (this.options.defaults) {
      for (const [key, value] of Object.entries(this.options.defaults)) {
        if (!(key in newConfig)) {
          (newConfig as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Validate if schema provided
    if (this.schema) {
      this.validator.parse(newConfig, this.schema);
    }

    // Track changes
    const oldConfig = this._config;
    this._config = newConfig;

    // Re-apply overrides
    for (const [path, value] of Object.entries(this._overrides)) {
      setByPath(this._config as Record<string, unknown>, path, value);
    }

    // Notify about changes
    if (this._enableChangeNotifications) {
      this.notifyConfigReload(oldConfig, newConfig);
    }
  }

  validate(): ConfigValidationResult {
    this.ensureNotDisposed();

    if (!this.schema) {
      return { valid: true, errors: [] };
    }

    return this.validator.validate(this._config, this.schema);
  }

  isProduction(): boolean {
    return this._environment === 'production';
  }

  isDevelopment(): boolean {
    return this._environment === 'development';
  }

  isTest(): boolean {
    return this._environment === 'test';
  }

  dispose(): void {
    this._listeners = [];
    this._overrides = {};
    this._sources.clear();
    this._disposed = true;
  }

  private ensureNotDisposed(): void {
    if (this._disposed) {
      throw new Error('ConfigService has been disposed');
    }
  }

  private notifyListeners<V>(
    path: string,
    oldValue: V | undefined,
    newValue: V,
    source: ConfigSource
  ): void {
    const event: ConfigChangeEvent<V> = {
      path,
      oldValue,
      newValue,
      source,
      timestamp: Date.now(),
    };

    for (const entry of this._listeners) {
      // Match path patterns
      if (entry.path === '*' || entry.path === path || path.startsWith(entry.path + '.')) {
        try {
          entry.listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  private notifyConfigReload(oldConfig: T, newConfig: T): void {
    // Find changed paths
    const findChanges = (
      oldObj: Record<string, unknown>,
      newObj: Record<string, unknown>,
      prefix = ''
    ): void => {
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

      for (const key of allKeys) {
        const path = prefix ? `${prefix}.${key}` : key;
        const oldVal = oldObj[key];
        const newVal = newObj[key];

        if (oldVal !== newVal) {
          if (
            typeof oldVal === 'object' &&
            typeof newVal === 'object' &&
            oldVal !== null &&
            newVal !== null
          ) {
            findChanges(
              oldVal as Record<string, unknown>,
              newVal as Record<string, unknown>,
              path
            );
          } else {
            this.notifyListeners(path, oldVal, newVal, 'file');
          }
        }
      }
    };

    findChanges(
      oldConfig as Record<string, unknown>,
      newConfig as Record<string, unknown>
    );
  }
}

/**
 * Create a configuration service
 */
export function createConfigService<T extends Record<string, unknown>>(
  defaults: T,
  options?: CreateConfigServiceOptions<T>
): IConfigService<T> {
  return new ConfigService<T>(defaults, options);
}

/**
 * Create a configuration service with async loading
 */
export async function createConfigServiceAsync<T extends Record<string, unknown>>(
  defaults: T,
  options?: CreateConfigServiceOptions<T>
): Promise<IConfigService<T>> {
  const loader = new ConfigLoader();
  const validator = new ConfigValidator();

  // Load from sources
  let config = await loader.load<T>(options);

  // Merge with defaults
  config = { ...defaults, ...config };

  // Validate if schema provided
  if (options?.schema) {
    config = validator.parse(config, options.schema);
  }

  return new ConfigService<T>(config, options);
}

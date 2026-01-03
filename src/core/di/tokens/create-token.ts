/**
 * Token Creation Utilities
 *
 * @module core/di/tokens
 */

import type { Token } from '../interfaces/container.interface';

/**
 * Create a typed dependency injection token
 *
 * @param name - Human-readable name for the token
 * @returns A unique token for dependency injection
 *
 * @example
 * ```typescript
 * interface ILogger {
 *   log(message: string): void;
 * }
 *
 * const LOGGER_TOKEN = createToken<ILogger>('Logger');
 *
 * // Registration
 * container.registerSingleton(LOGGER_TOKEN, { useClass: ConsoleLogger });
 *
 * // Resolution
 * const logger = container.resolve(LOGGER_TOKEN);
 * logger.log('Hello'); // Type-safe!
 * ```
 */
export function createToken<T>(name: string): Token<T> {
  return {
    symbol: Symbol.for(`di:${name}`),
    name,
  };
}

/**
 * Create a multi-binding token for arrays of dependencies
 *
 * @param name - Human-readable name for the token
 * @returns A unique token for multi-binding
 *
 * @example
 * ```typescript
 * const PLUGINS_TOKEN = createMultiToken<IPlugin>('Plugins');
 *
 * // Registration (multiple times)
 * container.register(PLUGINS_TOKEN, { useClass: PluginA });
 * container.register(PLUGINS_TOKEN, { useClass: PluginB });
 *
 * // Resolution (returns array)
 * const plugins = container.resolveAll(PLUGINS_TOKEN);
 * ```
 */
export function createMultiToken<T>(name: string): Token<T[]> {
  return {
    symbol: Symbol.for(`di:multi:${name}`),
    name: `Multi<${name}>`,
  };
}

/**
 * Create a lazy token for deferred resolution
 *
 * @param name - Human-readable name for the token
 * @returns A unique token for lazy resolution
 */
export function createLazyToken<T>(name: string): Token<() => T> {
  return {
    symbol: Symbol.for(`di:lazy:${name}`),
    name: `Lazy<${name}>`,
  };
}

/**
 * Create an optional token that returns undefined if not registered
 *
 * @param name - Human-readable name for the token
 * @returns A unique token for optional resolution
 */
export function createOptionalToken<T>(name: string): Token<T | undefined> {
  return {
    symbol: Symbol.for(`di:optional:${name}`),
    name: `Optional<${name}>`,
  };
}

/**
 * Dependency Injection Module
 *
 * Provides a lightweight DI container with support for:
 * - Type-safe tokens
 * - Singleton and transient scopes
 * - Child scopes
 * - Factory functions
 * - Async resolution
 * - Auto-dispose
 *
 * @module core/di
 *
 * @example
 * ```typescript
 * import { createContainer, createToken, TOKENS } from '@/core/di';
 *
 * // Create tokens
 * interface ILogger { log(msg: string): void; }
 * const LOGGER = createToken<ILogger>('Logger');
 *
 * // Create container
 * const container = createContainer();
 *
 * // Register dependencies
 * container.registerSingleton(LOGGER, {
 *   useClass: ConsoleLogger
 * });
 *
 * // Resolve dependencies
 * const logger = container.resolve(LOGGER);
 * logger.log('Hello!');
 * ```
 */

// Interfaces
export {
  type Token,
  type Provider,
  type ClassProvider,
  type FactoryProvider,
  type ValueProvider,
  type IContainer,
  type IScope,
  type BindingOptions,
  type BindingInfo,
  type ResolutionContext,
  type ContainerConfig,
  type IContainerModule,
  type IDisposable,
  Scope,
  isClassProvider,
  isFactoryProvider,
  isValueProvider,
  isDisposable,
} from './interfaces/container.interface';

// Token utilities
export {
  createToken,
  createMultiToken,
  createLazyToken,
  createOptionalToken,
} from './tokens/create-token';

// System tokens
export { TOKENS, type TokenKey, getToken } from './tokens/tokens';

// Implementation
export { Container, createContainer } from './impl/container.impl';

/**
 * DI Container Interfaces
 *
 * SOLID Principles:
 * - S: Container focuses only on dependency registration/resolution
 * - I: Core functionality exposed through minimal interface
 * - D: All components depend on abstractions (Token<T>)
 *
 * @module core/di/interfaces
 */

/**
 * Token for identifying dependencies
 * Uses symbol + generics for type-safe dependency injection
 */
export interface Token<T> {
  readonly symbol: symbol;
  readonly name: string;
  readonly _type?: T; // Phantom type for type inference
}

/**
 * Scope for dependency lifecycle
 */
export enum Scope {
  TRANSIENT = 'transient',  // New instance on each resolution
  SINGLETON = 'singleton',  // Single instance for container lifetime
  SCOPED = 'scoped',        // Single instance per scope
}

/**
 * Provider types for dependency registration
 */
export type Provider<T> =
  | ClassProvider<T>
  | FactoryProvider<T>
  | ValueProvider<T>;

/**
 * Class provider - instantiates a class
 */
export interface ClassProvider<T> {
  useClass: new (...args: unknown[]) => T;
  scope?: Scope;
}

/**
 * Factory provider - uses a factory function
 */
export interface FactoryProvider<T> {
  useFactory: (container: IContainer) => T | Promise<T>;
  scope?: Scope;
}

/**
 * Value provider - uses an existing value
 */
export interface ValueProvider<T> {
  useValue: T;
}

/**
 * Type guards for providers
 */
export function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T> {
  return 'useClass' in provider;
}

export function isFactoryProvider<T>(provider: Provider<T>): provider is FactoryProvider<T> {
  return 'useFactory' in provider;
}

export function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
  return 'useValue' in provider;
}

/**
 * Binding options for registration
 */
export interface BindingOptions {
  scope?: Scope;
  tags?: string[];
  when?: (context: ResolutionContext) => boolean;
}

/**
 * Resolution context for conditional bindings
 */
export interface ResolutionContext {
  target?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Container Interface
 *
 * Core dependency injection container
 */
export interface IContainer {
  // === Registration ===

  /**
   * Register a transient dependency (new instance each time)
   */
  register<T>(token: Token<T>, provider: Provider<T>, options?: BindingOptions): this;

  /**
   * Register a singleton dependency (shared instance)
   */
  registerSingleton<T>(token: Token<T>, provider: Provider<T>, options?: BindingOptions): this;

  /**
   * Register an existing instance
   */
  registerInstance<T>(token: Token<T>, instance: T): this;

  /**
   * Register a factory function
   */
  registerFactory<T>(
    token: Token<T>,
    factory: (container: IContainer) => T | Promise<T>,
    options?: BindingOptions
  ): this;

  // === Resolution ===

  /**
   * Resolve a dependency synchronously
   * @throws Error if not registered or requires async initialization
   */
  resolve<T>(token: Token<T>, context?: ResolutionContext): T;

  /**
   * Resolve a dependency asynchronously
   * @throws Error if not registered
   */
  resolveAsync<T>(token: Token<T>, context?: ResolutionContext): Promise<T>;

  /**
   * Try to resolve a dependency, returns undefined if not found
   */
  tryResolve<T>(token: Token<T>, context?: ResolutionContext): T | undefined;

  /**
   * Try to resolve a dependency asynchronously
   */
  tryResolveAsync<T>(token: Token<T>, context?: ResolutionContext): Promise<T | undefined>;

  /**
   * Resolve all bindings for a token (multi-binding support)
   */
  resolveAll<T>(token: Token<T>, context?: ResolutionContext): T[];

  // === Scope Management ===

  /**
   * Create a child scope
   */
  createScope(name?: string): IScope;

  /**
   * Get current scope
   */
  getCurrentScope(): IScope | undefined;

  // === Introspection ===

  /**
   * Check if a token is registered
   */
  isRegistered<T>(token: Token<T>): boolean;

  /**
   * Get all registered tokens
   */
  getRegisteredTokens(): Token<unknown>[];

  /**
   * Get binding info for a token
   */
  getBindingInfo<T>(token: Token<T>): BindingInfo<T> | undefined;

  // === Lifecycle ===

  /**
   * Dispose of all resources and singletons
   */
  dispose(): Promise<void>;

  /**
   * Check if container is disposed
   */
  isDisposed(): boolean;
}

/**
 * Scope Interface
 *
 * Child container for scoped dependencies
 */
export interface IScope extends IContainer {
  /**
   * Scope name for debugging
   */
  readonly name: string;

  /**
   * Parent container
   */
  readonly parent: IContainer;

  /**
   * End the scope and dispose resources
   */
  endScope(): Promise<void>;
}

/**
 * Binding information for introspection
 */
export interface BindingInfo<T> {
  token: Token<T>;
  provider: Provider<T>;
  scope: Scope;
  tags: string[];
  isSingleton: boolean;
  instance?: T;
}

/**
 * Container configuration
 */
export interface ContainerConfig {
  defaultScope?: Scope;
  enableAutoDispose?: boolean;
  parentContainer?: IContainer;
  name?: string;
}

/**
 * Module interface for organizing bindings
 */
export interface IContainerModule {
  /**
   * Module name
   */
  readonly name: string;

  /**
   * Register bindings in the container
   */
  register(container: IContainer): void | Promise<void>;
}

/**
 * Disposable interface for cleanup
 */
export interface IDisposable {
  dispose(): void | Promise<void>;
}

/**
 * Type guard for disposable
 */
export function isDisposable(obj: unknown): obj is IDisposable {
  return obj !== null &&
         typeof obj === 'object' &&
         'dispose' in obj &&
         typeof (obj as IDisposable).dispose === 'function';
}

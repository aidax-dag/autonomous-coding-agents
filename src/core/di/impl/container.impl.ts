/**
 * DI Container Implementation
 *
 * A lightweight dependency injection container with support for:
 * - Singleton and transient scopes
 * - Factory functions
 * - Child scopes
 * - Async resolution
 * - Auto-dispose
 *
 * @module core/di/impl
 */

import {
  type Token,
  type Provider,
  type IContainer,
  type IScope,
  type BindingOptions,
  type BindingInfo,
  type ResolutionContext,
  type ContainerConfig,
  type IContainerModule,
  Scope,
  isClassProvider,
  isFactoryProvider,
  isValueProvider,
  isDisposable,
} from '../interfaces/container.interface';

/**
 * Internal binding structure
 */
interface Binding<T> {
  token: Token<T>;
  provider: Provider<T>;
  scope: Scope;
  tags: string[];
  condition?: (context: ResolutionContext) => boolean;
  instance?: T;
  resolving?: boolean;
}

/**
 * Container Implementation
 */
export class Container implements IContainer {
  private bindings = new Map<symbol, Binding<unknown>[]>();
  private multiBindings = new Map<symbol, Binding<unknown>[]>();
  private disposed = false;
  private scopes = new Map<string, ContainerScope>();
  private currentScope?: ContainerScope;
  private readonly config: ContainerConfig;

  constructor(config: ContainerConfig = {}) {
    this.config = {
      defaultScope: Scope.TRANSIENT,
      enableAutoDispose: true,
      ...config,
    };
  }

  /**
   * Register a dependency
   */
  register<T>(
    token: Token<T>,
    provider: Provider<T>,
    options: BindingOptions = {}
  ): this {
    this.ensureNotDisposed();

    const binding: Binding<T> = {
      token,
      provider,
      scope: options.scope ?? this.config.defaultScope ?? Scope.TRANSIENT,
      tags: options.tags ?? [],
      condition: options.when,
    };

    this.addBinding(token.symbol, binding);
    return this;
  }

  /**
   * Register a singleton dependency
   */
  registerSingleton<T>(
    token: Token<T>,
    provider: Provider<T>,
    options: BindingOptions = {}
  ): this {
    return this.register(token, provider, { ...options, scope: Scope.SINGLETON });
  }

  /**
   * Register an existing instance
   */
  registerInstance<T>(token: Token<T>, instance: T): this {
    this.ensureNotDisposed();

    const binding: Binding<T> = {
      token,
      provider: { useValue: instance },
      scope: Scope.SINGLETON,
      tags: [],
      instance,
    };

    this.addBinding(token.symbol, binding);
    return this;
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(
    token: Token<T>,
    factory: (container: IContainer) => T | Promise<T>,
    options: BindingOptions = {}
  ): this {
    return this.register(
      token,
      { useFactory: factory, scope: options.scope },
      options
    );
  }

  /**
   * Resolve a dependency synchronously
   */
  resolve<T>(token: Token<T>, context: ResolutionContext = {}): T {
    this.ensureNotDisposed();

    const binding = this.findBinding(token.symbol, context);
    if (!binding) {
      throw new Error(
        `No binding found for token: ${token.name}. ` +
        `Make sure to register the dependency before resolving it.`
      );
    }

    return this.resolveBinding(binding as Binding<T>, context);
  }

  /**
   * Resolve a dependency asynchronously
   */
  async resolveAsync<T>(
    token: Token<T>,
    context: ResolutionContext = {}
  ): Promise<T> {
    this.ensureNotDisposed();

    const binding = this.findBinding(token.symbol, context);
    if (!binding) {
      throw new Error(
        `No binding found for token: ${token.name}. ` +
        `Make sure to register the dependency before resolving it.`
      );
    }

    return this.resolveBindingAsync(binding as Binding<T>, context);
  }

  /**
   * Try to resolve a dependency
   */
  tryResolve<T>(
    token: Token<T>,
    context: ResolutionContext = {}
  ): T | undefined {
    try {
      return this.resolve(token, context);
    } catch {
      return undefined;
    }
  }

  /**
   * Try to resolve a dependency asynchronously
   */
  async tryResolveAsync<T>(
    token: Token<T>,
    context: ResolutionContext = {}
  ): Promise<T | undefined> {
    try {
      return await this.resolveAsync(token, context);
    } catch {
      return undefined;
    }
  }

  /**
   * Resolve all bindings for a token
   */
  resolveAll<T>(token: Token<T>, context: ResolutionContext = {}): T[] {
    this.ensureNotDisposed();

    const bindings = this.bindings.get(token.symbol) ?? [];
    const multiBindings = this.multiBindings.get(token.symbol) ?? [];
    const allBindings = [...bindings, ...multiBindings];

    return allBindings
      .filter((b) => !b.condition || b.condition(context))
      .map((b) => this.resolveBinding(b as Binding<T>, context));
  }

  /**
   * Create a child scope
   */
  createScope(name?: string): IScope {
    this.ensureNotDisposed();

    const scopeName = name ?? `scope-${Date.now()}`;
    const scope = new ContainerScope(scopeName, this);
    this.scopes.set(scopeName, scope);
    return scope;
  }

  /**
   * Get current scope
   */
  getCurrentScope(): IScope | undefined {
    return this.currentScope;
  }

  /**
   * Check if a token is registered
   */
  isRegistered<T>(token: Token<T>): boolean {
    return this.bindings.has(token.symbol);
  }

  /**
   * Get all registered tokens
   */
  getRegisteredTokens(): Token<unknown>[] {
    const tokens: Token<unknown>[] = [];
    for (const bindings of this.bindings.values()) {
      if (bindings.length > 0) {
        tokens.push(bindings[0].token);
      }
    }
    return tokens;
  }

  /**
   * Get binding info for a token
   */
  getBindingInfo<T>(token: Token<T>): BindingInfo<T> | undefined {
    const bindings = this.bindings.get(token.symbol);
    if (!bindings || bindings.length === 0) {
      return undefined;
    }

    const binding = bindings[0] as Binding<T>;
    return {
      token: binding.token,
      provider: binding.provider,
      scope: binding.scope,
      tags: binding.tags,
      isSingleton: binding.scope === Scope.SINGLETON,
      instance: binding.instance,
    };
  }

  /**
   * Load a module
   */
  async loadModule(module: IContainerModule): Promise<void> {
    await module.register(this);
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;

    // Dispose scopes first
    for (const scope of this.scopes.values()) {
      await scope.endScope();
    }
    this.scopes.clear();

    // Dispose singleton instances
    if (this.config.enableAutoDispose) {
      for (const bindings of this.bindings.values()) {
        for (const binding of bindings) {
          if (binding.instance && isDisposable(binding.instance)) {
            await binding.instance.dispose();
          }
        }
      }
    }

    this.bindings.clear();
    this.multiBindings.clear();
    this.disposed = true;
  }

  /**
   * Check if container is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  // === Private Methods ===

  private addBinding(symbol: symbol, binding: Binding<unknown>): void {
    // For multi-bindings, add to the array
    if (symbol.description?.includes('di:multi:')) {
      const existing = this.multiBindings.get(symbol) ?? [];
      existing.push(binding);
      this.multiBindings.set(symbol, existing);
    } else {
      // For regular bindings, replace the existing binding
      this.bindings.set(symbol, [binding]);
    }
  }

  private findBinding(
    symbol: symbol,
    context: ResolutionContext
  ): Binding<unknown> | undefined {
    const bindings = this.bindings.get(symbol);
    if (!bindings || bindings.length === 0) {
      // Check parent container if available
      if (this.config.parentContainer) {
        const parentBinding = (this.config.parentContainer as Container)
          .findBinding(symbol, context);
        if (parentBinding) return parentBinding;
      }
      return undefined;
    }

    // Find first matching binding based on conditions
    for (const binding of bindings) {
      if (!binding.condition || binding.condition(context)) {
        return binding;
      }
    }

    return undefined;
  }

  private resolveBinding<T>(
    binding: Binding<T>,
    _context: ResolutionContext
  ): T {
    // Check for circular dependency
    if (binding.resolving) {
      throw new Error(
        `Circular dependency detected for token: ${binding.token.name}`
      );
    }

    // Return cached singleton instance
    if (binding.scope === Scope.SINGLETON && binding.instance !== undefined) {
      return binding.instance;
    }

    // Return cached scoped instance
    if (binding.scope === Scope.SCOPED && this.currentScope) {
      const cached = this.currentScope.getCachedInstance(binding.token.symbol);
      if (cached !== undefined) {
        return cached as T;
      }
    }

    binding.resolving = true;

    try {
      let instance: T;

      if (isValueProvider(binding.provider)) {
        instance = binding.provider.useValue;
      } else if (isClassProvider(binding.provider)) {
        instance = new binding.provider.useClass() as T;
      } else if (isFactoryProvider(binding.provider)) {
        const result = binding.provider.useFactory(this);
        if (result instanceof Promise) {
          throw new Error(
            `Token ${binding.token.name} requires async resolution. Use resolveAsync() instead.`
          );
        }
        instance = result;
      } else {
        throw new Error(`Invalid provider for token: ${binding.token.name}`);
      }

      // Cache singleton
      if (binding.scope === Scope.SINGLETON) {
        binding.instance = instance;
      }

      // Cache scoped
      if (binding.scope === Scope.SCOPED && this.currentScope) {
        this.currentScope.setCachedInstance(binding.token.symbol, instance);
      }

      return instance;
    } finally {
      binding.resolving = false;
    }
  }

  private async resolveBindingAsync<T>(
    binding: Binding<T>,
    _context: ResolutionContext
  ): Promise<T> {
    // Check for circular dependency
    if (binding.resolving) {
      throw new Error(
        `Circular dependency detected for token: ${binding.token.name}`
      );
    }

    // Return cached singleton instance
    if (binding.scope === Scope.SINGLETON && binding.instance !== undefined) {
      return binding.instance;
    }

    binding.resolving = true;

    try {
      let instance: T;

      if (isValueProvider(binding.provider)) {
        instance = binding.provider.useValue;
      } else if (isClassProvider(binding.provider)) {
        instance = new binding.provider.useClass() as T;
      } else if (isFactoryProvider(binding.provider)) {
        const result = binding.provider.useFactory(this);
        instance = result instanceof Promise ? await result : result;
      } else {
        throw new Error(`Invalid provider for token: ${binding.token.name}`);
      }

      // Cache singleton
      if (binding.scope === Scope.SINGLETON) {
        binding.instance = instance;
      }

      return instance;
    } finally {
      binding.resolving = false;
    }
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Container has been disposed');
    }
  }
}

/**
 * Container Scope Implementation
 */
class ContainerScope implements IScope {
  readonly name: string;
  readonly parent: IContainer;
  private cache = new Map<symbol, unknown>();
  private disposed = false;

  constructor(name: string, parent: IContainer) {
    this.name = name;
    this.parent = parent;
  }

  // === Delegation to Parent ===

  register<T>(
    token: Token<T>,
    provider: Provider<T>,
    options?: BindingOptions
  ): this {
    // Register scoped bindings in parent with scope context
    this.parent.register(token, provider, { ...options, scope: Scope.SCOPED });
    return this;
  }

  registerSingleton<T>(
    token: Token<T>,
    provider: Provider<T>,
    options?: BindingOptions
  ): this {
    this.parent.registerSingleton(token, provider, options);
    return this;
  }

  registerInstance<T>(token: Token<T>, instance: T): this {
    this.parent.registerInstance(token, instance);
    return this;
  }

  registerFactory<T>(
    token: Token<T>,
    factory: (container: IContainer) => T | Promise<T>,
    options?: BindingOptions
  ): this {
    this.parent.registerFactory(token, factory, options);
    return this;
  }

  resolve<T>(token: Token<T>, context?: ResolutionContext): T {
    return this.parent.resolve(token, context);
  }

  resolveAsync<T>(
    token: Token<T>,
    context?: ResolutionContext
  ): Promise<T> {
    return this.parent.resolveAsync(token, context);
  }

  tryResolve<T>(
    token: Token<T>,
    context?: ResolutionContext
  ): T | undefined {
    return this.parent.tryResolve(token, context);
  }

  tryResolveAsync<T>(
    token: Token<T>,
    context?: ResolutionContext
  ): Promise<T | undefined> {
    return this.parent.tryResolveAsync(token, context);
  }

  resolveAll<T>(token: Token<T>, context?: ResolutionContext): T[] {
    return this.parent.resolveAll(token, context);
  }

  createScope(name?: string): IScope {
    return this.parent.createScope(name);
  }

  getCurrentScope(): IScope | undefined {
    return this;
  }

  isRegistered<T>(token: Token<T>): boolean {
    return this.parent.isRegistered(token);
  }

  getRegisteredTokens(): Token<unknown>[] {
    return this.parent.getRegisteredTokens();
  }

  getBindingInfo<T>(token: Token<T>): BindingInfo<T> | undefined {
    return this.parent.getBindingInfo(token);
  }

  async dispose(): Promise<void> {
    await this.endScope();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  // === Scope-specific Methods ===

  getCachedInstance(symbol: symbol): unknown {
    return this.cache.get(symbol);
  }

  setCachedInstance(symbol: symbol, instance: unknown): void {
    this.cache.set(symbol, instance);
  }

  async endScope(): Promise<void> {
    if (this.disposed) return;

    // Dispose scoped instances
    for (const instance of this.cache.values()) {
      if (isDisposable(instance)) {
        await instance.dispose();
      }
    }

    this.cache.clear();
    this.disposed = true;
  }
}

/**
 * Create a new container instance
 */
export function createContainer(config?: ContainerConfig): IContainer {
  return new Container(config);
}

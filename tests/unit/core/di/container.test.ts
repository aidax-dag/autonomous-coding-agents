/**
 * DI Container Tests
 */

import {
  createContainer,
  createToken,
  Scope,
  type IContainer,
} from '../../../../src/core/di';

describe('DI Container', () => {
  let container: IContainer;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe('Token Creation', () => {
    it('should create a unique token', () => {
      const token1 = createToken<string>('test1');
      const token2 = createToken<string>('test2');

      expect(token1.name).toBe('test1');
      expect(token2.name).toBe('test2');
      expect(token1.symbol).not.toBe(token2.symbol);
    });

    it('should create tokens with same name and same symbol (Symbol.for behavior)', () => {
      // Symbol.for() returns the same symbol for the same name
      const token1 = createToken<string>('same');
      const token2 = createToken<string>('same');

      expect(token1.name).toBe(token2.name);
      expect(token1.symbol).toBe(token2.symbol);
    });
  });

  describe('Registration', () => {
    it('should register and resolve a class provider', () => {
      class TestService {
        getValue() {
          return 'test';
        }
      }

      const token = createToken<TestService>('TestService');
      container.register(token, { useClass: TestService });

      const instance = container.resolve(token);
      expect(instance).toBeInstanceOf(TestService);
      expect(instance.getValue()).toBe('test');
    });

    it('should register and resolve a factory provider', () => {
      const token = createToken<string>('config');
      container.registerFactory(token, () => 'factory-value');

      const value = container.resolve(token);
      expect(value).toBe('factory-value');
    });

    it('should register and resolve an instance', () => {
      const token = createToken<{ name: string }>('instance');
      const instance = { name: 'test-instance' };
      container.registerInstance(token, instance);

      const resolved = container.resolve(token);
      expect(resolved).toBe(instance);
      expect(resolved.name).toBe('test-instance');
    });

    it('should support chained registration', () => {
      const token1 = createToken<string>('t1');
      const token2 = createToken<number>('t2');

      container
        .registerFactory(token1, () => 'value1')
        .registerFactory(token2, () => 42);

      expect(container.resolve(token1)).toBe('value1');
      expect(container.resolve(token2)).toBe(42);
    });
  });

  describe('Singleton Scope', () => {
    it('should return same instance for singleton', () => {
      class SingletonService {
        id = Math.random();
      }

      const token = createToken<SingletonService>('Singleton');
      container.registerSingleton(token, { useClass: SingletonService });

      const instance1 = container.resolve(token);
      const instance2 = container.resolve(token);

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    it('should create new instance for transient scope', () => {
      class TransientService {
        id = Math.random();
      }

      const token = createToken<TransientService>('Transient');
      container.register(token, { useClass: TransientService }, { scope: Scope.TRANSIENT });

      const instance1 = container.resolve(token);
      const instance2 = container.resolve(token);

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });
  });

  describe('Scoped Resolution', () => {
    it('should create scope', () => {
      const scope = container.createScope('test-scope');
      expect(scope).toBeDefined();
      expect(scope.name).toBe('test-scope');
    });

    it('should resolve dependencies through scope', () => {
      class ScopedService {
        id = Math.random();
      }

      const token = createToken<ScopedService>('Scoped');
      container.register(token, { useClass: ScopedService }, { scope: Scope.SCOPED });

      const scope = container.createScope('test-scope');
      const instance = scope.resolve(token);

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(ScopedService);
    });
  });

  describe('tryResolve', () => {
    it('should return undefined for unregistered token', () => {
      const token = createToken<string>('unregistered');
      const result = container.tryResolve(token);
      expect(result).toBeUndefined();
    });

    it('should return instance for registered token', () => {
      const token = createToken<string>('registered');
      container.registerFactory(token, () => 'value');

      const result = container.tryResolve(token);
      expect(result).toBe('value');
    });
  });

  describe('resolveAll', () => {
    it('should resolve the last registration for a token (regular bindings replace)', () => {
      const token = createToken<string>('multi');

      // Regular bindings replace each other, last one wins
      container.registerFactory(token, () => 'first');
      container.registerFactory(token, () => 'second');
      container.registerFactory(token, () => 'third');

      const all = container.resolveAll(token);
      // Only the last registration is returned
      expect(all).toHaveLength(1);
      expect(all[0]).toBe('third');
    });

    it('should return empty array for unregistered token', () => {
      const token = createToken<string>('none');
      const all = container.resolveAll(token);
      expect(all).toEqual([]);
    });
  });

  describe('Async Resolution', () => {
    it('should resolve async factory', async () => {
      const token = createToken<string>('async');
      container.registerFactory(token, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'async-value';
      });

      const value = await container.resolveAsync(token);
      expect(value).toBe('async-value');
    });
  });

  describe('Error Handling', () => {
    it('should throw for unregistered token', () => {
      const token = createToken<string>('missing');

      expect(() => container.resolve(token)).toThrow(
        /No binding found for token/
      );
    });

    it('should detect circular dependencies', () => {
      interface IA {
        b: IB;
      }
      interface IB {
        a: IA;
      }

      const tokenA = createToken<IA>('A');
      const tokenB = createToken<IB>('B');

      container.registerFactory(tokenA, (c) => ({
        b: c.resolve(tokenB),
      }));
      container.registerFactory(tokenB, (c) => ({
        a: c.resolve(tokenA),
      }));

      expect(() => container.resolve(tokenA)).toThrow(/Circular dependency/);
    });

    it('should throw after dispose', async () => {
      const token = createToken<string>('test');
      container.registerFactory(token, () => 'value');

      await container.dispose();

      expect(() => container.resolve(token)).toThrow(/disposed/);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered token', () => {
      const token = createToken<string>('exists');
      container.registerFactory(token, () => 'value');

      expect(container.isRegistered(token)).toBe(true);
    });

    it('should return false for unregistered token', () => {
      const token = createToken<string>('notexists');
      expect(container.isRegistered(token)).toBe(false);
    });
  });
});

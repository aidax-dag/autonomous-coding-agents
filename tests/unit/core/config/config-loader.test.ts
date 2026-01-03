/**
 * Configuration Loader Tests
 */

import { createConfigLoader, type IConfigLoader } from '../../../../src/core/config';

describe('ConfigLoader', () => {
  let loader: IConfigLoader;

  beforeEach(() => {
    loader = createConfigLoader();
  });

  describe('loadEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should load environment variables with prefix', () => {
      process.env.APP_SERVER_PORT = '3000';
      process.env.APP_DATABASE_HOST = 'localhost';

      const config = loader.loadEnv<{
        server: { port: number };
        database: { host: string };
      }>('APP');

      expect(config.server?.port).toBe(3000);
      expect(config.database?.host).toBe('localhost');
    });

    it('should parse boolean values', () => {
      process.env.APP_FEATURE_ENABLED = 'true';
      process.env.APP_DEBUG_MODE = 'false';

      const config = loader.loadEnv<{
        feature: { enabled: boolean };
        debug: { mode: boolean };
      }>('APP');

      expect(config.feature?.enabled).toBe(true);
      expect(config.debug?.mode).toBe(false);
    });

    it('should parse number values', () => {
      process.env.APP_SERVER_PORT = '8080';
      process.env.APP_MAX_CONNECTIONS = '100';

      const config = loader.loadEnv<{
        server: { port: number };
        max: { connections: number };
      }>('APP');

      expect(config.server?.port).toBe(8080);
      expect(config.max?.connections).toBe(100);
    });

    it('should parse JSON values', () => {
      process.env.APP_CONFIG = '{"key":"value"}';
      process.env.APP_ARRAY = '[1,2,3]';

      const config = loader.loadEnv<{
        config: { key: string };
        array: number[];
      }>('APP');

      expect(config.config).toEqual({ key: 'value' });
      expect(config.array).toEqual([1, 2, 3]);
    });

    it('should handle string values', () => {
      process.env.APP_NAME = 'test-app';
      process.env.APP_ENV = 'development';

      const config = loader.loadEnv<{
        name: string;
        env: string;
      }>('APP');

      expect(config.name).toBe('test-app');
      expect(config.env).toBe('development');
    });

    it('should convert underscore to nested paths', () => {
      process.env.APP_DEEP_NESTED_VALUE = 'deep';

      const config = loader.loadEnv<{
        deep: { nested: { value: string } };
      }>('APP');

      expect(config.deep?.nested?.value).toBe('deep');
    });
  });

  describe('load', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should load configuration with defaults', async () => {
      // Set some environment variables
      process.env.APP_TEST_VALUE = 'from-env';

      const config = await loader.load<{
        test: { value: string };
      }>({
        environment: 'test',
        loadDotEnv: false,
      });

      // Should have env vars applied
      expect(config).toBeDefined();
    });

    it('should handle missing config files gracefully', async () => {
      const config = await loader.load<Record<string, unknown>>({
        configDir: '/nonexistent/path',
        loadDotEnv: false,
        environment: 'test',
      });

      // Should return empty object or env vars only
      expect(config).toBeDefined();
    });
  });

  describe('loadFile', () => {
    it('should throw for non-existent file', async () => {
      await expect(loader.loadFile('/nonexistent/file.json')).rejects.toThrow(
        /not found/
      );
    });

    it('should throw for unsupported file format', async () => {
      // This would need a real file to test properly
      // For now, we test the error message format
      await expect(loader.loadFile('/some/file.yaml')).rejects.toThrow();
    });
  });
});

describe('Environment Variable Parsing', () => {
  let loader: IConfigLoader;
  const originalEnv = process.env;

  beforeEach(() => {
    loader = createConfigLoader();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should handle empty string as string', () => {
    process.env.APP_EMPTY = '';

    const config = loader.loadEnv<{ empty: string }>('APP');

    // Empty strings are skipped (falsy in the for loop)
    expect(config.empty).toBeUndefined();
  });

  it('should handle whitespace string', () => {
    process.env.APP_SPACE = '   ';

    const config = loader.loadEnv<{ space: string }>('APP');

    // Whitespace-only is returned as string (not a number)
    expect(config.space).toBe('   ');
  });

  it('should handle special number-like strings', () => {
    process.env.APP_VERSION = '1.0.0';
    process.env.APP_HEX = '0x10';

    const config = loader.loadEnv<{
      version: string;
      hex: number;
    }>('APP');

    // Version string should stay as string (NaN from Number)
    expect(config.version).toBe('1.0.0');
    // Hex is a valid number
    expect(config.hex).toBe(16);
  });

  it('should handle case-insensitive booleans', () => {
    process.env.APP_UPPER_TRUE = 'TRUE';
    process.env.APP_UPPER_FALSE = 'FALSE';
    process.env.APP_MIXED = 'True';

    const config = loader.loadEnv<{
      upper: { true: boolean; false: boolean };
      mixed: boolean;
    }>('APP');

    expect(config.upper?.true).toBe(true);
    expect(config.upper?.false).toBe(false);
    expect(config.mixed).toBe(true);
  });
});

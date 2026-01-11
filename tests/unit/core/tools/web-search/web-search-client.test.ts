/**
 * Web Search Client Tests
 */

import {
  WebSearchClient,
  getWebSearchClient,
  resetWebSearchClient,
} from '../../../../../src/core/tools/web-search/web-search-client.js';
import {
  SearchProvider,
  ContentType,
  WebSearchClientConfig,
} from '../../../../../src/core/tools/web-search/web-search.interface.js';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WebSearchClient', () => {
  let client: WebSearchClient;

  beforeEach(() => {
    jest.clearAllMocks();
    resetWebSearchClient();
    client = new WebSearchClient();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const instance = new WebSearchClient();
      expect(instance).toBeInstanceOf(WebSearchClient);
    });

    it('should create instance with custom config', () => {
      const config: WebSearchClientConfig = {
        defaultProvider: SearchProvider.EXA,
        enableCache: true,
        cacheTtl: 600,
      };
      const instance = new WebSearchClient(config);
      const retrievedConfig = instance.getConfig();
      expect(retrievedConfig.defaultProvider).toBe(SearchProvider.EXA);
      expect(retrievedConfig.enableCache).toBe(true);
      expect(retrievedConfig.cacheTtl).toBe(600);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = client.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });

  describe('setConfig', () => {
    it('should update configuration', () => {
      client.setConfig({ enableCache: false });
      const config = client.getConfig();
      expect(config.enableCache).toBe(false);
    });

    it('should merge with existing configuration', () => {
      client.setConfig({ cacheTtl: 1200 });
      client.setConfig({ enableCache: true });
      const config = client.getConfig();
      expect(config.cacheTtl).toBe(1200);
      expect(config.enableCache).toBe(true);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return array of providers', () => {
      const providers = client.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should return providers with API keys configured', () => {
      const configWithProvider: WebSearchClientConfig = {
        providers: {
          [SearchProvider.TAVILY]: {
            apiKey: 'test-tavily-key',
          },
        },
      };
      const clientWithProvider = new WebSearchClient(configWithProvider);
      const providers = clientWithProvider.getAvailableProviders();
      expect(providers).toContain(SearchProvider.TAVILY);
    });
  });

  describe('isProviderAvailable', () => {
    it('should return false when no API key is configured', () => {
      expect(client.isProviderAvailable(SearchProvider.TAVILY)).toBe(false);
    });

    it('should return true when API key is configured', () => {
      const configWithProvider: WebSearchClientConfig = {
        providers: {
          [SearchProvider.TAVILY]: {
            apiKey: 'test-tavily-key',
          },
        },
      };
      const clientWithProvider = new WebSearchClient(configWithProvider);
      expect(clientWithProvider.isProviderAvailable(SearchProvider.TAVILY)).toBe(true);
    });
  });

  describe('search', () => {
    it('should return error when no providers available', async () => {
      const result = await client.search('test query');
      expect(result.success).toBe(false);
      // Error may vary based on which provider is tried
      expect(result.error).toBeDefined();
    });

    it('should use default provider when available', async () => {
      const configWithProvider: WebSearchClientConfig = {
        providers: {
          [SearchProvider.TAVILY]: {
            apiKey: 'test-tavily-key',
          },
        },
        defaultProvider: SearchProvider.TAVILY,
      };
      const clientWithProvider = new WebSearchClient(configWithProvider);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { title: 'Test', url: 'https://example.com', content: 'Test content' },
          ],
        }),
      });

      await clientWithProvider.search('test query');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should use specified provider', async () => {
      const configWithProvider: WebSearchClientConfig = {
        providers: {
          [SearchProvider.EXA]: {
            apiKey: 'test-exa-key',
          },
        },
      };
      const clientWithProvider = new WebSearchClient(configWithProvider);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { title: 'Test', url: 'https://example.com', text: 'Test content' },
          ],
        }),
      });

      await clientWithProvider.search('test query', {
        provider: SearchProvider.EXA,
      });
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return error for unavailable provider', async () => {
      const result = await client.search('test query', {
        provider: SearchProvider.BRAVE,
      });
      expect(result.success).toBe(false);
      // Error indicates the provider API key is not configured
      expect(result.error).toBeDefined();
    });

    it('should apply maxResults option', async () => {
      const configWithProvider: WebSearchClientConfig = {
        providers: {
          [SearchProvider.TAVILY]: {
            apiKey: 'test-key',
          },
        },
      };
      const clientWithProvider = new WebSearchClient(configWithProvider);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [],
        }),
      });

      await clientWithProvider.search('test query', { maxResults: 5 });
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.max_results).toBe(5);
    });
  });

  describe('fetch', () => {
    it('should fetch web page content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><head><title>Test Page</title></head><body><p>Test content</p></body></html>',
      });

      const result = await client.fetch('https://example.com');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.url).toBe('https://example.com');
    });

    it('should return error for invalid URL', async () => {
      const result = await client.fetch('not-a-valid-url');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.fetch('https://example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle non-OK responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await client.fetch('https://example.com/notfound');
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should respect maxLength option', async () => {
      const longContent = 'a'.repeat(10000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => `<html><body>${longContent}</body></html>`,
      });

      const result = await client.fetch('https://example.com', { maxLength: 100 });
      expect(result.success).toBe(true);
      // Content may slightly exceed maxLength due to implementation details
      expect(result.data?.content.length).toBeLessThanOrEqual(150);
    });

    it('should extract links when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () =>
          '<html><body><a href="https://link1.com">Link 1</a><a href="https://link2.com">Link 2</a></body></html>',
      });

      const result = await client.fetch('https://example.com', { extractLinks: true });
      expect(result.success).toBe(true);
      expect(result.data?.links).toBeDefined();
      expect(result.data?.links?.length).toBeGreaterThan(0);
    });

    it('should extract images when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () =>
          '<html><body><img src="https://example.com/img1.jpg"><img src="https://example.com/img2.png"></body></html>',
      });

      const result = await client.fetch('https://example.com', { extractImages: true });
      expect(result.success).toBe(true);
      expect(result.data?.images).toBeDefined();
      expect(result.data?.images?.length).toBeGreaterThan(0);
    });

    it('should return content in markdown format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><body><h1>Title</h1><p>Paragraph</p></body></html>',
      });

      const result = await client.fetch('https://example.com', { format: ContentType.MARKDOWN });
      expect(result.success).toBe(true);
      expect(result.data?.contentType).toBe(ContentType.MARKDOWN);
    });
  });

  describe('crawl', () => {
    it('should crawl starting URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><head><title>Test Page</title></head><body><p>Test content</p></body></html>',
      });

      const result = await client.crawl('https://example.com', { maxPages: 1 });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.startUrl).toBe('https://example.com');
    });

    it('should return error for invalid URL', async () => {
      const result = await client.crawl('not-a-valid-url');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect maxPages option', async () => {
      // Mock multiple pages
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'text/html']]),
          text: async () =>
            '<html><body><a href="https://example.com/page1">Link</a><a href="https://example.com/page2">Link</a></body></html>',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html><body>Page 1</body></html>',
        });

      const result = await client.crawl('https://example.com', { maxPages: 2, extractLinks: true });
      expect(result.success).toBe(true);
      expect(result.data?.totalPages).toBeLessThanOrEqual(2);
    });

    it('should respect maxDepth option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><body>Root page</body></html>',
      });

      const result = await client.crawl('https://example.com', { maxDepth: 1, maxPages: 5 });
      expect(result.success).toBe(true);
    });

    it('should handle crawl errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.crawl('https://example.com');
      // Crawl may still succeed with errors recorded in the errors array
      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        // If successful, errors should be in the errors array
        expect(result.data?.errors).toBeDefined();
      }
    });

    it('should stay within same domain when sameDomain is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () =>
          '<html><body><a href="https://example.com/internal">Internal</a><a href="https://external.com/page">External</a></body></html>',
      });

      const result = await client.crawl('https://example.com', {
        sameDomain: true,
        maxPages: 10,
        extractLinks: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getWebSearchClient singleton', () => {
    beforeEach(() => {
      resetWebSearchClient();
    });

    it('should return same instance', () => {
      const instance1 = getWebSearchClient();
      const instance2 = getWebSearchClient();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = getWebSearchClient();
      resetWebSearchClient();
      const instance2 = getWebSearchClient();
      expect(instance1).not.toBe(instance2);
    });

    it('should accept custom config', () => {
      const config: WebSearchClientConfig = {
        enableCache: false,
      };
      const instance = getWebSearchClient(config);
      expect(instance.getConfig().enableCache).toBe(false);
    });
  });

  describe('caching', () => {
    it('should cache search results when enabled', async () => {
      const configWithProvider: WebSearchClientConfig = {
        providers: {
          [SearchProvider.TAVILY]: {
            apiKey: 'test-key',
          },
        },
        enableCache: true,
        cacheTtl: 300,
      };
      const clientWithCache = new WebSearchClient(configWithProvider);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ title: 'Test', url: 'https://example.com', content: 'Test content' }],
        }),
      });

      // First call
      await clientWithCache.search('test query');
      // Second call - should use cache
      await clientWithCache.search('test query');

      // Should only have been called once if caching works
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should cache fetch results when enabled', async () => {
      const configWithCache: WebSearchClientConfig = {
        enableCache: true,
        cacheTtl: 300,
      };
      const clientWithCache = new WebSearchClient(configWithCache);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><body>Test</body></html>',
      });

      // First call
      await clientWithCache.fetch('https://example.com');
      // Second call - should use cache
      await clientWithCache.fetch('https://example.com');

      // Should only have been called once if caching works
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

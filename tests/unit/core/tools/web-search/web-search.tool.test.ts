/**
 * Web Search Tool Tests
 */

import { WebSearchTool } from '../../../../../src/core/tools/web-search/web-search.tool.js';
import { WebSearchClient } from '../../../../../src/core/tools/web-search/web-search-client.js';
import {
  SearchProvider,
  SearchResultType,
  ContentType,
  SearchResults,
  SearchOperationResult,
} from '../../../../../src/core/tools/web-search/web-search.interface.js';
import { ToolCategory } from '../../../../../src/core/interfaces/tool.interface.js';

describe('WebSearchTool', () => {
  let tool: WebSearchTool;
  let mockClient: jest.Mocked<WebSearchClient>;

  beforeEach(() => {
    mockClient = {
      search: jest.fn(),
      fetch: jest.fn(),
      crawl: jest.fn(),
      isProviderAvailable: jest.fn(),
      getAvailableProviders: jest.fn().mockReturnValue([SearchProvider.TAVILY]),
      getConfig: jest.fn().mockReturnValue({}),
      setConfig: jest.fn(),
    } as unknown as jest.Mocked<WebSearchClient>;

    tool = new WebSearchTool(mockClient);
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_search');
    });

    it('should have correct description', () => {
      expect(tool.description).toContain('Search the web');
    });

    it('should have correct schema', () => {
      expect(tool.schema.name).toBe('web_search');
      expect(tool.schema.category).toBe(ToolCategory.NETWORK);
      expect(tool.schema.version).toBe('1.0.0');
    });

    it('should have query as required parameter', () => {
      const queryParam = tool.schema.parameters.find((p) => p.name === 'query');
      expect(queryParam).toBeDefined();
      expect(queryParam?.required).toBe(true);
      expect(queryParam?.type).toBe('string');
    });

    it('should have provider as optional parameter', () => {
      const providerParam = tool.schema.parameters.find((p) => p.name === 'provider');
      expect(providerParam).toBeDefined();
      expect(providerParam?.required).toBe(false);
      expect(providerParam?.enum).toEqual(Object.values(SearchProvider));
    });

    it('should have maxResults as optional parameter', () => {
      const maxResultsParam = tool.schema.parameters.find((p) => p.name === 'maxResults');
      expect(maxResultsParam).toBeDefined();
      expect(maxResultsParam?.required).toBe(false);
      expect(maxResultsParam?.type).toBe('number');
    });
  });

  describe('execute', () => {
    it('should execute search successfully', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [
            {
              title: 'Test Result',
              url: 'https://example.com',
              snippet: 'Test snippet',
              type: SearchResultType.WEB,
            },
          ],
          duration: 100,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      const result = await tool.execute({ query: 'test query' });

      expect(result.success).toBe(true);
      expect(result.data?.query).toBe('test query');
      expect(result.data?.resultCount).toBe(1);
      expect(result.data?.results).toHaveLength(1);
    });

    it('should return error for empty query', async () => {
      const result = await tool.execute({ query: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should pass provider option to client', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.EXA,
          results: [],
          duration: 50,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      await tool.execute({
        query: 'test query',
        provider: SearchProvider.EXA,
      });

      expect(mockClient.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ provider: SearchProvider.EXA })
      );
    });

    it('should pass maxResults option to client', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [],
          duration: 50,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      await tool.execute({
        query: 'test query',
        maxResults: 5,
      });

      expect(mockClient.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ maxResults: 5 })
      );
    });

    it('should pass resultType option to client', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [],
          duration: 50,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      await tool.execute({
        query: 'test query',
        resultType: SearchResultType.NEWS,
      });

      expect(mockClient.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ resultType: SearchResultType.NEWS })
      );
    });

    it('should pass domain filters to client', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [],
          duration: 50,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      await tool.execute({
        query: 'test query',
        includeDomains: ['example.com'],
        excludeDomains: ['spam.com'],
      });

      expect(mockClient.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({
          includeDomains: ['example.com'],
          excludeDomains: ['spam.com'],
        })
      );
    });

    it('should pass timeRange option to client', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [],
          duration: 50,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      await tool.execute({
        query: 'test query',
        timeRange: 'week',
      });

      expect(mockClient.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ timeRange: 'week' })
      );
    });

    it('should pass fetchContent option to client', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [
            {
              title: 'Test',
              url: 'https://example.com',
              snippet: 'Snippet',
              content: 'Full content',
              type: SearchResultType.WEB,
            },
          ],
          duration: 50,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      const result = await tool.execute({
        query: 'test query',
        fetchContent: true,
        contentFormat: ContentType.MARKDOWN,
        maxContentLength: 5000,
      });

      expect(mockClient.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({
          fetchContent: true,
          contentFormat: ContentType.MARKDOWN,
          maxContentLength: 5000,
        })
      );

      expect(result.data?.results[0].content).toBe('Full content');
    });

    it('should handle search error', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: false,
        error: 'Search failed',
      };

      mockClient.search.mockResolvedValue(mockResults);

      const result = await tool.execute({ query: 'test query' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEARCH_ERROR');
    });

    it('should include relatedQueries in output', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [],
          duration: 50,
          relatedQueries: ['related 1', 'related 2'],
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      const result = await tool.execute({ query: 'test query' });

      expect(result.data?.relatedQueries).toEqual(['related 1', 'related 2']);
    });

    it('should include score in results when available', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [
            {
              title: 'Test',
              url: 'https://example.com',
              snippet: 'Snippet',
              score: 0.95,
              type: SearchResultType.WEB,
            },
          ],
          duration: 50,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      const result = await tool.execute({ query: 'test query' });

      expect(result.data?.results[0].score).toBe(0.95);
    });

    it('should include duration in output', async () => {
      const mockResults: SearchOperationResult<SearchResults> = {
        success: true,
        data: {
          query: 'test query',
          provider: SearchProvider.TAVILY,
          results: [],
          duration: 150,
        },
      };

      mockClient.search.mockResolvedValue(mockResults);

      const result = await tool.execute({ query: 'test query' });

      expect(result.data?.duration).toBe(150);
    });
  });

  describe('isAvailable', () => {
    it('should return true when providers are available', async () => {
      mockClient.getAvailableProviders.mockReturnValue([SearchProvider.TAVILY]);
      const available = await tool.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when no providers are available', async () => {
      mockClient.getAvailableProviders.mockReturnValue([]);
      const available = await tool.isAvailable();
      expect(available).toBe(false);
    });
  });
});

/**
 * Web Crawl Tool Tests
 */

import { WebCrawlTool } from '../../../../../src/core/tools/web-search/web-crawl.tool.js';
import { WebSearchClient } from '../../../../../src/core/tools/web-search/web-search-client.js';
import {
  ContentType,
  CrawlResult,
  SearchOperationResult,
} from '../../../../../src/core/tools/web-search/web-search.interface.js';
import { ToolCategory } from '../../../../../src/core/interfaces/tool.interface.js';

describe('WebCrawlTool', () => {
  let tool: WebCrawlTool;
  let mockClient: jest.Mocked<WebSearchClient>;

  beforeEach(() => {
    mockClient = {
      search: jest.fn(),
      fetch: jest.fn(),
      crawl: jest.fn(),
      isProviderAvailable: jest.fn(),
      getAvailableProviders: jest.fn(),
      getConfig: jest.fn().mockReturnValue({}),
      setConfig: jest.fn(),
    } as unknown as jest.Mocked<WebSearchClient>;

    tool = new WebCrawlTool(mockClient);
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_crawl');
    });

    it('should have correct description', () => {
      expect(tool.description).toContain('Crawl');
    });

    it('should have correct schema', () => {
      expect(tool.schema.name).toBe('web_crawl');
      expect(tool.schema.category).toBe(ToolCategory.NETWORK);
      expect(tool.schema.version).toBe('1.0.0');
    });

    it('should have startUrl as required parameter', () => {
      const startUrlParam = tool.schema.parameters.find((p) => p.name === 'startUrl');
      expect(startUrlParam).toBeDefined();
      expect(startUrlParam?.required).toBe(true);
      expect(startUrlParam?.type).toBe('string');
    });

    it('should have maxDepth as optional parameter', () => {
      const maxDepthParam = tool.schema.parameters.find((p) => p.name === 'maxDepth');
      expect(maxDepthParam).toBeDefined();
      expect(maxDepthParam?.required).toBe(false);
      expect(maxDepthParam?.type).toBe('number');
    });

    it('should have maxPages as optional parameter', () => {
      const maxPagesParam = tool.schema.parameters.find((p) => p.name === 'maxPages');
      expect(maxPagesParam).toBeDefined();
      expect(maxPagesParam?.required).toBe(false);
      expect(maxPagesParam?.type).toBe('number');
    });

    it('should have sameDomain as optional parameter', () => {
      const sameDomainParam = tool.schema.parameters.find((p) => p.name === 'sameDomain');
      expect(sameDomainParam).toBeDefined();
      expect(sameDomainParam?.required).toBe(false);
      expect(sameDomainParam?.type).toBe('boolean');
    });
  });

  describe('execute', () => {
    it('should execute crawl successfully', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [
            {
              url: 'https://example.com',
              title: 'Example Page',
              content: 'Page content',
              contentType: ContentType.TEXT,
              length: 12,
              duration: 100,
            },
          ],
          totalPages: 1,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      const result = await tool.execute({ startUrl: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data?.startUrl).toBe('https://example.com');
      expect(result.data?.totalPages).toBe(1);
      expect(result.data?.pages).toHaveLength(1);
    });

    it('should return error for invalid URL', async () => {
      const result = await tool.execute({ startUrl: 'not-a-valid-url' });

      expect(result.success).toBe(false);
      // URL validation happens during validation phase
      expect(['VALIDATION_ERROR', 'INVALID_URL']).toContain(result.error?.code);
    });

    it('should return error for empty URL', async () => {
      const result = await tool.execute({ startUrl: '' });

      expect(result.success).toBe(false);
    });

    it('should pass maxDepth option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        maxDepth: 3,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ maxDepth: 3 })
      );
    });

    it('should pass maxPages option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        maxPages: 20,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ maxPages: 20 })
      );
    });

    it('should pass includePatterns option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        includePatterns: ['/docs/', '/api/'],
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ includePatterns: ['/docs/', '/api/'] })
      );
    });

    it('should pass excludePatterns option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        excludePatterns: ['/admin/', '/private/'],
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ excludePatterns: ['/admin/', '/private/'] })
      );
    });

    it('should return error for invalid includePatterns regex', async () => {
      const result = await tool.execute({
        startUrl: 'https://example.com',
        includePatterns: ['[invalid'],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PATTERN');
    });

    it('should return error for invalid excludePatterns regex', async () => {
      const result = await tool.execute({
        startUrl: 'https://example.com',
        excludePatterns: ['(invalid'],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PATTERN');
    });

    it('should pass sameDomain option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        sameDomain: true,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ sameDomain: true })
      );
    });

    it('should pass format option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        format: ContentType.MARKDOWN,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ format: ContentType.MARKDOWN })
      );
    });

    it('should pass maxContentLength option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        maxContentLength: 5000,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ maxContentLength: 5000 })
      );
    });

    it('should pass delay option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        delay: 500,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ delay: 500 })
      );
    });

    it('should pass timeout option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        timeout: 10000,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should pass respectRobots option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        respectRobots: false,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ respectRobots: false })
      );
    });

    it('should pass extractLinks option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [
            {
              url: 'https://example.com',
              content: 'Content',
              contentType: ContentType.TEXT,
              length: 7,
              duration: 100,
              links: ['https://example.com/page1', 'https://example.com/page2'],
            },
          ],
          totalPages: 1,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      const result = await tool.execute({
        startUrl: 'https://example.com',
        extractLinks: true,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ extractLinks: true })
      );
      expect(result.data?.pages[0].links).toEqual([
        'https://example.com/page1',
        'https://example.com/page2',
      ]);
    });

    it('should pass concurrency option to client', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      await tool.execute({
        startUrl: 'https://example.com',
        concurrency: 5,
      });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ concurrency: 5 })
      );
    });

    it('should handle crawl error', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: false,
        error: 'Crawl failed',
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      const result = await tool.execute({ startUrl: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CRAWL_ERROR');
    });

    it('should include errors in output', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [
            { url: 'https://example.com/error1', error: 'Not found' },
            { url: 'https://example.com/error2', error: 'Timeout' },
          ],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      const result = await tool.execute({ startUrl: 'https://example.com' });

      expect(result.data?.errors).toHaveLength(2);
      expect(result.data?.errors[0].url).toBe('https://example.com/error1');
      expect(result.data?.errors[0].error).toBe('Not found');
    });

    it('should include skipped URLs in output', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 100,
          errors: [],
          skipped: ['https://external.com', 'https://another.com'],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      const result = await tool.execute({ startUrl: 'https://example.com' });

      expect(result.data?.skipped).toHaveLength(2);
      expect(result.data?.skipped).toContain('https://external.com');
    });

    it('should include duration in output', async () => {
      const mockResult: SearchOperationResult<CrawlResult> = {
        success: true,
        data: {
          startUrl: 'https://example.com',
          pages: [],
          totalPages: 0,
          duration: 2500,
          errors: [],
          skipped: [],
        },
      };

      mockClient.crawl.mockResolvedValue(mockResult);

      const result = await tool.execute({ startUrl: 'https://example.com' });

      expect(result.data?.duration).toBe(2500);
    });
  });

  describe('isAvailable', () => {
    it('should always return true', async () => {
      const available = await tool.isAvailable();
      expect(available).toBe(true);
    });
  });
});

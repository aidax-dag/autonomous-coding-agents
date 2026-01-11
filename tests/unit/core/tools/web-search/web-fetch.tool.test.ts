/**
 * Web Fetch Tool Tests
 */

import { WebFetchTool } from '../../../../../src/core/tools/web-search/web-fetch.tool.js';
import { WebSearchClient } from '../../../../../src/core/tools/web-search/web-search-client.js';
import {
  ContentType,
  WebPageContent,
  SearchOperationResult,
} from '../../../../../src/core/tools/web-search/web-search.interface.js';
import { ToolCategory } from '../../../../../src/core/interfaces/tool.interface.js';

describe('WebFetchTool', () => {
  let tool: WebFetchTool;
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

    tool = new WebFetchTool(mockClient);
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_fetch');
    });

    it('should have correct description', () => {
      expect(tool.description).toContain('Fetch');
    });

    it('should have correct schema', () => {
      expect(tool.schema.name).toBe('web_fetch');
      expect(tool.schema.category).toBe(ToolCategory.NETWORK);
      expect(tool.schema.version).toBe('1.0.0');
    });

    it('should have url as required parameter', () => {
      const urlParam = tool.schema.parameters.find((p) => p.name === 'url');
      expect(urlParam).toBeDefined();
      expect(urlParam?.required).toBe(true);
      expect(urlParam?.type).toBe('string');
    });

    it('should have format as optional parameter', () => {
      const formatParam = tool.schema.parameters.find((p) => p.name === 'format');
      expect(formatParam).toBeDefined();
      expect(formatParam?.required).toBe(false);
      expect(formatParam?.enum).toEqual(Object.values(ContentType));
    });

    it('should have maxLength as optional parameter', () => {
      const maxLengthParam = tool.schema.parameters.find((p) => p.name === 'maxLength');
      expect(maxLengthParam).toBeDefined();
      expect(maxLengthParam?.required).toBe(false);
      expect(maxLengthParam?.type).toBe('number');
    });

    it('should have extractLinks as optional parameter', () => {
      const extractLinksParam = tool.schema.parameters.find((p) => p.name === 'extractLinks');
      expect(extractLinksParam).toBeDefined();
      expect(extractLinksParam?.required).toBe(false);
      expect(extractLinksParam?.type).toBe('boolean');
    });

    it('should have extractImages as optional parameter', () => {
      const extractImagesParam = tool.schema.parameters.find((p) => p.name === 'extractImages');
      expect(extractImagesParam).toBeDefined();
      expect(extractImagesParam?.required).toBe(false);
      expect(extractImagesParam?.type).toBe('boolean');
    });
  });

  describe('execute', () => {
    it('should execute fetch successfully', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          title: 'Example Page',
          content: 'Page content',
          contentType: ContentType.TEXT,
          length: 12,
          duration: 100,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data?.url).toBe('https://example.com');
      expect(result.data?.title).toBe('Example Page');
      expect(result.data?.content).toBe('Page content');
    });

    it('should return error for invalid URL', async () => {
      const result = await tool.execute({ url: 'not-a-valid-url' });

      expect(result.success).toBe(false);
      // URL validation happens during validation phase
      expect(['VALIDATION_ERROR', 'INVALID_URL']).toContain(result.error?.code);
    });

    it('should return error for empty URL', async () => {
      const result = await tool.execute({ url: '' });

      expect(result.success).toBe(false);
    });

    it('should pass format option to client', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          content: '# Markdown Content',
          contentType: ContentType.MARKDOWN,
          length: 18,
          duration: 100,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      await tool.execute({
        url: 'https://example.com',
        format: ContentType.MARKDOWN,
      });

      expect(mockClient.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ format: ContentType.MARKDOWN })
      );
    });

    it('should pass maxLength option to client', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          content: 'Short',
          contentType: ContentType.TEXT,
          length: 5,
          duration: 100,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      await tool.execute({
        url: 'https://example.com',
        maxLength: 1000,
      });

      expect(mockClient.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ maxLength: 1000 })
      );
    });

    it('should pass timeout option to client', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          content: 'Content',
          contentType: ContentType.TEXT,
          length: 7,
          duration: 100,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      await tool.execute({
        url: 'https://example.com',
        timeout: 5000,
      });

      expect(mockClient.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should pass extractLinks option to client', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          content: 'Content',
          contentType: ContentType.TEXT,
          length: 7,
          duration: 100,
          links: ['https://link1.com', 'https://link2.com'],
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      const result = await tool.execute({
        url: 'https://example.com',
        extractLinks: true,
      });

      expect(mockClient.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ extractLinks: true })
      );
      expect(result.data?.links).toEqual(['https://link1.com', 'https://link2.com']);
    });

    it('should pass extractImages option to client', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          content: 'Content',
          contentType: ContentType.TEXT,
          length: 7,
          duration: 100,
          images: ['https://example.com/img1.jpg', 'https://example.com/img2.png'],
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      const result = await tool.execute({
        url: 'https://example.com',
        extractImages: true,
      });

      expect(mockClient.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ extractImages: true })
      );
      expect(result.data?.images).toEqual([
        'https://example.com/img1.jpg',
        'https://example.com/img2.png',
      ]);
    });

    it('should pass headers option to client', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          content: 'Content',
          contentType: ContentType.TEXT,
          length: 7,
          duration: 100,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      const headers = { Authorization: 'Bearer token' };

      await tool.execute({
        url: 'https://example.com',
        headers,
      });

      expect(mockClient.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ headers })
      );
    });

    it('should pass followRedirects option to client', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com/redirected',
          content: 'Content',
          contentType: ContentType.TEXT,
          length: 7,
          duration: 100,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      await tool.execute({
        url: 'https://example.com',
        followRedirects: true,
      });

      expect(mockClient.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ followRedirects: true })
      );
    });

    it('should handle fetch error', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: false,
        error: 'Failed to fetch page',
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FETCH_ERROR');
    });

    it('should include metadata in output', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          title: 'Example',
          content: 'Content',
          contentType: ContentType.TEXT,
          length: 7,
          description: 'Page description',
          author: 'Author Name',
          publishedDate: new Date('2024-01-15'),
          language: 'en',
          duration: 100,
          statusCode: 200,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.data?.description).toBe('Page description');
      expect(result.data?.author).toBe('Author Name');
      expect(result.data?.publishedDate).toBe('2024-01-15T00:00:00.000Z');
      expect(result.data?.language).toBe('en');
      expect(result.data?.statusCode).toBe(200);
    });

    it('should include duration in output', async () => {
      const mockResult: SearchOperationResult<WebPageContent> = {
        success: true,
        data: {
          url: 'https://example.com',
          content: 'Content',
          contentType: ContentType.TEXT,
          length: 7,
          duration: 150,
        },
      };

      mockClient.fetch.mockResolvedValue(mockResult);

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.data?.duration).toBe(150);
    });
  });

  describe('isAvailable', () => {
    it('should always return true', async () => {
      const available = await tool.isAvailable();
      expect(available).toBe(true);
    });
  });
});

/**
 * Web Crawl Tool
 *
 * Tool for crawling websites and extracting content from multiple pages.
 *
 * @module core/tools/web-search/web-crawl.tool
 */

import { BaseTool } from '../base-tool.js';
import { ToolSchema, ToolResult, ToolCategory, ToolExecutionOptions } from '../../interfaces/tool.interface.js';
import { WebSearchClient, getWebSearchClient } from './web-search-client.js';
import { ContentType, CrawlOptions } from './web-search.interface.js';

/**
 * Web crawl input parameters
 */
export interface WebCrawlInput {
  startUrl: string;
  maxDepth?: number;
  maxPages?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  sameDomain?: boolean;
  format?: ContentType;
  maxContentLength?: number;
  delay?: number;
  timeout?: number;
  respectRobots?: boolean;
  extractLinks?: boolean;
  concurrency?: number;
}

/**
 * Web crawl output
 */
export interface WebCrawlOutput {
  startUrl: string;
  totalPages: number;
  pages: Array<{
    url: string;
    title?: string;
    content: string;
    contentType: string;
    length: number;
    links?: string[];
  }>;
  errors: Array<{
    url: string;
    error: string;
  }>;
  skipped: string[];
  duration: number;
}

/**
 * Web Crawl Tool implementation
 */
export class WebCrawlTool extends BaseTool<WebCrawlInput, WebCrawlOutput> {
  readonly name = 'web_crawl';
  readonly description = 'Crawl a website and extract content from multiple pages';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.NETWORK,
    version: '1.0.0',
    parameters: [
      {
        name: 'startUrl',
        type: 'string',
        description: 'Starting URL for the crawl',
        required: true,
        validation: {
          pattern: '^https?://.+',
        },
      },
      {
        name: 'maxDepth',
        type: 'number',
        description: 'Maximum depth to crawl (link hops from start)',
        required: false,
        validation: {
          min: 1,
          max: 5,
        },
      },
      {
        name: 'maxPages',
        type: 'number',
        description: 'Maximum number of pages to crawl',
        required: false,
        validation: {
          min: 1,
          max: 100,
        },
      },
      {
        name: 'includePatterns',
        type: 'array',
        description: 'URL patterns to include (regex)',
        required: false,
      },
      {
        name: 'excludePatterns',
        type: 'array',
        description: 'URL patterns to exclude (regex)',
        required: false,
      },
      {
        name: 'sameDomain',
        type: 'boolean',
        description: 'Only crawl pages on the same domain',
        required: false,
      },
      {
        name: 'format',
        type: 'string',
        description: 'Output format for content',
        required: false,
        enum: Object.values(ContentType),
      },
      {
        name: 'maxContentLength',
        type: 'number',
        description: 'Maximum content length per page',
        required: false,
        validation: {
          min: 100,
          max: 100000,
        },
      },
      {
        name: 'delay',
        type: 'number',
        description: 'Delay between requests in milliseconds',
        required: false,
        validation: {
          min: 0,
          max: 10000,
        },
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in milliseconds',
        required: false,
        validation: {
          min: 1000,
          max: 60000,
        },
      },
      {
        name: 'respectRobots',
        type: 'boolean',
        description: 'Respect robots.txt rules',
        required: false,
      },
      {
        name: 'extractLinks',
        type: 'boolean',
        description: 'Extract links from each page',
        required: false,
      },
      {
        name: 'concurrency',
        type: 'number',
        description: 'Number of concurrent requests',
        required: false,
        validation: {
          min: 1,
          max: 10,
        },
      },
    ],
    returns: {
      type: 'object',
      description: 'Crawl results with page content and metadata',
    },
  };

  private client: WebSearchClient;

  constructor(client?: WebSearchClient) {
    super();
    this.client = client || getWebSearchClient();
  }

  /**
   * Execute web crawl
   */
  async execute(
    params: WebCrawlInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<WebCrawlOutput>> {
    const startTime = Date.now();

    // Validate input
    const validation = this.validate(params);
    if (!validation.valid) {
      return this.failure(
        'VALIDATION_ERROR',
        `Invalid parameters: ${validation.errors.map((e) => e.message).join(', ')}`,
        Date.now() - startTime
      );
    }

    // Validate URL
    try {
      new URL(params.startUrl);
    } catch {
      return this.failure(
        'INVALID_URL',
        `Invalid start URL: ${params.startUrl}`,
        Date.now() - startTime
      );
    }

    // Validate patterns if provided
    if (params.includePatterns) {
      for (const pattern of params.includePatterns) {
        try {
          new RegExp(pattern);
        } catch {
          return this.failure(
            'INVALID_PATTERN',
            `Invalid include pattern: ${pattern}`,
            Date.now() - startTime
          );
        }
      }
    }

    if (params.excludePatterns) {
      for (const pattern of params.excludePatterns) {
        try {
          new RegExp(pattern);
        } catch {
          return this.failure(
            'INVALID_PATTERN',
            `Invalid exclude pattern: ${pattern}`,
            Date.now() - startTime
          );
        }
      }
    }

    const crawlOptions: CrawlOptions = {
      maxDepth: params.maxDepth,
      maxPages: params.maxPages,
      includePatterns: params.includePatterns,
      excludePatterns: params.excludePatterns,
      sameDomain: params.sameDomain,
      format: params.format,
      maxContentLength: params.maxContentLength,
      delay: params.delay,
      timeout: params.timeout,
      respectRobots: params.respectRobots,
      extractLinks: params.extractLinks,
      concurrency: params.concurrency,
    };

    const result = await this.client.crawl(params.startUrl, crawlOptions);

    if (!result.success || !result.data) {
      return this.failure(
        'CRAWL_ERROR',
        result.error || 'Crawl failed',
        Date.now() - startTime
      );
    }

    const data = result.data;
    const output: WebCrawlOutput = {
      startUrl: data.startUrl,
      totalPages: data.totalPages,
      pages: data.pages.map((p) => ({
        url: p.url,
        title: p.title,
        content: p.content,
        contentType: p.contentType,
        length: p.length,
        links: p.links,
      })),
      errors: data.errors,
      skipped: data.skipped,
      duration: data.duration,
    };

    return this.success(output, Date.now() - startTime);
  }

  /**
   * Check if tool is available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }
}

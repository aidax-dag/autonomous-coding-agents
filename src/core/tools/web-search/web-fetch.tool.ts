/**
 * Web Fetch Tool
 *
 * Tool for fetching and extracting content from web pages.
 *
 * @module core/tools/web-search/web-fetch.tool
 */

import { BaseTool } from '../base-tool.js';
import { ToolSchema, ToolResult, ToolCategory, ToolExecutionOptions } from '../../interfaces/tool.interface.js';
import { WebSearchClient, getWebSearchClient } from './web-search-client.js';
import { ContentType, FetchOptions } from './web-search.interface.js';

/**
 * Web fetch input parameters
 */
export interface WebFetchInput {
  url: string;
  format?: ContentType;
  maxLength?: number;
  timeout?: number;
  extractLinks?: boolean;
  extractImages?: boolean;
  headers?: Record<string, string>;
  followRedirects?: boolean;
}

/**
 * Web fetch output
 */
export interface WebFetchOutput {
  url: string;
  title?: string;
  content: string;
  contentType: string;
  length: number;
  description?: string;
  author?: string;
  publishedDate?: string;
  language?: string;
  links?: string[];
  images?: string[];
  duration: number;
  statusCode?: number;
}

/**
 * Web Fetch Tool implementation
 */
export class WebFetchTool extends BaseTool<WebFetchInput, WebFetchOutput> {
  readonly name = 'web_fetch';
  readonly description = 'Fetch and extract content from a web page URL';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.NETWORK,
    version: '1.0.0',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL of the web page to fetch',
        required: true,
        validation: {
          pattern: '^https?://.+',
        },
      },
      {
        name: 'format',
        type: 'string',
        description: 'Output format for content',
        required: false,
        enum: Object.values(ContentType),
      },
      {
        name: 'maxLength',
        type: 'number',
        description: 'Maximum content length to return',
        required: false,
        validation: {
          min: 100,
          max: 500000,
        },
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in milliseconds',
        required: false,
        validation: {
          min: 1000,
          max: 120000,
        },
      },
      {
        name: 'extractLinks',
        type: 'boolean',
        description: 'Extract links from the page',
        required: false,
      },
      {
        name: 'extractImages',
        type: 'boolean',
        description: 'Extract image URLs from the page',
        required: false,
      },
      {
        name: 'headers',
        type: 'object',
        description: 'Custom HTTP headers',
        required: false,
      },
      {
        name: 'followRedirects',
        type: 'boolean',
        description: 'Follow HTTP redirects',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Fetched page content and metadata',
    },
  };

  private client: WebSearchClient;

  constructor(client?: WebSearchClient) {
    super();
    this.client = client || getWebSearchClient();
  }

  /**
   * Execute web fetch
   */
  async execute(
    params: WebFetchInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<WebFetchOutput>> {
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
      new URL(params.url);
    } catch {
      return this.failure(
        'INVALID_URL',
        `Invalid URL: ${params.url}`,
        Date.now() - startTime
      );
    }

    const fetchOptions: FetchOptions = {
      format: params.format,
      maxLength: params.maxLength,
      timeout: params.timeout,
      extractLinks: params.extractLinks,
      extractImages: params.extractImages,
      headers: params.headers,
      followRedirects: params.followRedirects,
    };

    const result = await this.client.fetch(params.url, fetchOptions);

    if (!result.success || !result.data) {
      return this.failure(
        'FETCH_ERROR',
        result.error || 'Failed to fetch page',
        Date.now() - startTime
      );
    }

    const data = result.data;
    const output: WebFetchOutput = {
      url: data.url,
      title: data.title,
      content: data.content,
      contentType: data.contentType,
      length: data.length,
      description: data.description,
      author: data.author,
      publishedDate: data.publishedDate?.toISOString(),
      language: data.language,
      links: data.links,
      images: data.images,
      duration: data.duration,
      statusCode: data.statusCode,
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

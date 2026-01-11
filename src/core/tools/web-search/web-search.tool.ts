/**
 * Web Search Tool
 *
 * Tool for searching the web using various providers.
 *
 * @module core/tools/web-search/web-search.tool
 */

import { BaseTool } from '../base-tool.js';
import { ToolSchema, ToolResult, ToolCategory, ToolExecutionOptions } from '../../interfaces/tool.interface.js';
import { WebSearchClient, getWebSearchClient } from './web-search-client.js';
import {
  SearchProvider,
  SearchResultType,
  ContentType,
  SearchOptions,
} from './web-search.interface.js';

/**
 * Web search input parameters
 */
export interface WebSearchInput {
  query: string;
  provider?: SearchProvider;
  maxResults?: number;
  resultType?: SearchResultType;
  includeDomains?: string[];
  excludeDomains?: string[];
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  language?: string;
  country?: string;
  safeSearch?: boolean;
  fetchContent?: boolean;
  contentFormat?: ContentType;
  maxContentLength?: number;
}

/**
 * Web search output
 */
export interface WebSearchOutput {
  query: string;
  provider: string;
  resultCount: number;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    content?: string;
    score?: number;
  }>;
  relatedQueries?: string[];
  duration: number;
}

/**
 * Web Search Tool implementation
 */
export class WebSearchTool extends BaseTool<WebSearchInput, WebSearchOutput> {
  readonly name = 'web_search';
  readonly description = 'Search the web using various search providers (Tavily, Exa, Serper, Brave)';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.NETWORK,
    version: '1.0.0',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: true,
        validation: {
          minLength: 1,
          maxLength: 500,
        },
      },
      {
        name: 'provider',
        type: 'string',
        description: 'Search provider to use',
        required: false,
        enum: Object.values(SearchProvider),
      },
      {
        name: 'maxResults',
        type: 'number',
        description: 'Maximum number of results to return',
        required: false,
        validation: {
          min: 1,
          max: 50,
        },
      },
      {
        name: 'resultType',
        type: 'string',
        description: 'Type of results to return',
        required: false,
        enum: Object.values(SearchResultType),
      },
      {
        name: 'includeDomains',
        type: 'array',
        description: 'Only include results from these domains',
        required: false,
      },
      {
        name: 'excludeDomains',
        type: 'array',
        description: 'Exclude results from these domains',
        required: false,
      },
      {
        name: 'timeRange',
        type: 'string',
        description: 'Time range filter',
        required: false,
        enum: ['day', 'week', 'month', 'year', 'all'],
      },
      {
        name: 'language',
        type: 'string',
        description: 'Language filter (ISO 639-1 code)',
        required: false,
      },
      {
        name: 'country',
        type: 'string',
        description: 'Country filter (ISO 3166-1 alpha-2 code)',
        required: false,
      },
      {
        name: 'safeSearch',
        type: 'boolean',
        description: 'Enable safe search',
        required: false,
      },
      {
        name: 'fetchContent',
        type: 'boolean',
        description: 'Fetch full content for each result',
        required: false,
      },
      {
        name: 'contentFormat',
        type: 'string',
        description: 'Format for fetched content',
        required: false,
        enum: Object.values(ContentType),
      },
      {
        name: 'maxContentLength',
        type: 'number',
        description: 'Maximum content length per result',
        required: false,
        validation: {
          min: 100,
          max: 100000,
        },
      },
    ],
    returns: {
      type: 'object',
      description: 'Search results with metadata',
    },
  };

  private client: WebSearchClient;

  constructor(client?: WebSearchClient) {
    super();
    this.client = client || getWebSearchClient();
  }

  /**
   * Execute web search
   */
  async execute(
    params: WebSearchInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<WebSearchOutput>> {
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

    const searchOptions: SearchOptions = {
      provider: params.provider,
      maxResults: params.maxResults,
      resultType: params.resultType,
      includeDomains: params.includeDomains,
      excludeDomains: params.excludeDomains,
      timeRange: params.timeRange,
      language: params.language,
      country: params.country,
      safeSearch: params.safeSearch,
      fetchContent: params.fetchContent,
      contentFormat: params.contentFormat,
      maxContentLength: params.maxContentLength,
    };

    const result = await this.client.search(params.query, searchOptions);

    if (!result.success || !result.data) {
      return this.failure(
        'SEARCH_ERROR',
        result.error || 'Search failed',
        Date.now() - startTime
      );
    }

    const data = result.data;
    const output: WebSearchOutput = {
      query: data.query,
      provider: data.provider,
      resultCount: data.results.length,
      results: data.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        content: r.content,
        score: r.score,
      })),
      relatedQueries: data.relatedQueries,
      duration: data.duration,
    };

    return this.success(output, Date.now() - startTime);
  }

  /**
   * Check if tool is available
   */
  async isAvailable(): Promise<boolean> {
    return this.client.getAvailableProviders().length > 0;
  }
}

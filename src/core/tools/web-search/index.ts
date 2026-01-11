/**
 * Web Search Module
 *
 * Provides tools for web searching, content fetching, and website crawling.
 *
 * @module core/tools/web-search
 */

// Interfaces and types - renamed to avoid conflicts with other modules
export {
  SearchProvider,
  SearchResultType,
  ContentType,
  SearchResultItem,
  SearchResults,
  SearchOptions as WebSearchOptions,
  WebPageContent,
  FetchOptions as WebFetchOptions,
  CrawlResult,
  CrawlOptions,
  SearchOperationResult,
  ProviderConfig,
  WebSearchClientConfig,
  IWebSearchClient,
  DEFAULT_USER_AGENT,
  DEFAULT_SEARCH_OPTIONS,
  DEFAULT_FETCH_OPTIONS,
  DEFAULT_CRAWL_OPTIONS,
} from './web-search.interface.js';

// Client
export { WebSearchClient, getWebSearchClient, resetWebSearchClient } from './web-search-client.js';

// Tools
export { WebSearchTool, WebSearchInput, WebSearchOutput } from './web-search.tool.js';
export { WebFetchTool, WebFetchInput, WebFetchOutput } from './web-fetch.tool.js';
export { WebCrawlTool, WebCrawlInput, WebCrawlOutput } from './web-crawl.tool.js';

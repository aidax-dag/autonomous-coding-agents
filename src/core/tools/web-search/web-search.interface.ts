/**
 * Web Search Tool Interfaces
 *
 * Defines types and interfaces for web search and content fetching.
 *
 * @module core/tools/web-search/web-search.interface
 */

/**
 * Search provider types
 */
export enum SearchProvider {
  TAVILY = 'tavily',
  EXA = 'exa',
  SERPER = 'serper',
  BRAVE = 'brave',
}

/**
 * Search result type
 */
export enum SearchResultType {
  WEB = 'web',
  NEWS = 'news',
  IMAGE = 'image',
  VIDEO = 'video',
  ACADEMIC = 'academic',
}

/**
 * Content type for fetched pages
 */
export enum ContentType {
  HTML = 'html',
  TEXT = 'text',
  MARKDOWN = 'markdown',
  JSON = 'json',
}

/**
 * Search result item
 */
export interface SearchResultItem {
  /**
   * Result title
   */
  title: string;

  /**
   * URL of the result
   */
  url: string;

  /**
   * Snippet or description
   */
  snippet: string;

  /**
   * Content of the page (if fetched)
   */
  content?: string;

  /**
   * Published date (if available)
   */
  publishedDate?: Date;

  /**
   * Source domain
   */
  source?: string;

  /**
   * Relevance score (0-1)
   */
  score?: number;

  /**
   * Result type
   */
  type: SearchResultType;

  /**
   * Raw data from provider
   */
  raw?: Record<string, unknown>;
}

/**
 * Search results response
 */
export interface SearchResults {
  /**
   * Search query
   */
  query: string;

  /**
   * Search provider used
   */
  provider: SearchProvider;

  /**
   * Result items
   */
  results: SearchResultItem[];

  /**
   * Total results found (if available)
   */
  totalResults?: number;

  /**
   * Search duration in milliseconds
   */
  duration: number;

  /**
   * Next page token (if pagination supported)
   */
  nextPageToken?: string;

  /**
   * Related queries (if available)
   */
  relatedQueries?: string[];

  /**
   * Error message if any
   */
  error?: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  /**
   * Search provider to use
   */
  provider?: SearchProvider;

  /**
   * Maximum number of results
   */
  maxResults?: number;

  /**
   * Result type filter
   */
  resultType?: SearchResultType;

  /**
   * Include domains filter
   */
  includeDomains?: string[];

  /**
   * Exclude domains filter
   */
  excludeDomains?: string[];

  /**
   * Time range filter (e.g., 'day', 'week', 'month', 'year')
   */
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';

  /**
   * Language filter (ISO 639-1 code)
   */
  language?: string;

  /**
   * Country filter (ISO 3166-1 alpha-2 code)
   */
  country?: string;

  /**
   * Safe search mode
   */
  safeSearch?: boolean;

  /**
   * Fetch page content for each result
   */
  fetchContent?: boolean;

  /**
   * Content format for fetched pages
   */
  contentFormat?: ContentType;

  /**
   * Maximum content length per result
   */
  maxContentLength?: number;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Include raw provider response
   */
  includeRaw?: boolean;
}

/**
 * Web page content
 */
export interface WebPageContent {
  /**
   * Page URL
   */
  url: string;

  /**
   * Page title
   */
  title?: string;

  /**
   * Page content
   */
  content: string;

  /**
   * Content type
   */
  contentType: ContentType;

  /**
   * Content length in characters
   */
  length: number;

  /**
   * Page description (meta)
   */
  description?: string;

  /**
   * Page author (meta)
   */
  author?: string;

  /**
   * Published date (meta)
   */
  publishedDate?: Date;

  /**
   * Page language
   */
  language?: string;

  /**
   * Links found on the page
   */
  links?: string[];

  /**
   * Images found on the page
   */
  images?: string[];

  /**
   * Fetch duration in milliseconds
   */
  duration: number;

  /**
   * HTTP status code
   */
  statusCode?: number;

  /**
   * Error message if any
   */
  error?: string;
}

/**
 * Fetch options
 */
export interface FetchOptions {
  /**
   * Content format
   */
  format?: ContentType;

  /**
   * Maximum content length
   */
  maxLength?: number;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Extract links from content
   */
  extractLinks?: boolean;

  /**
   * Extract images from content
   */
  extractImages?: boolean;

  /**
   * Custom headers
   */
  headers?: Record<string, string>;

  /**
   * Follow redirects
   */
  followRedirects?: boolean;

  /**
   * Maximum redirects to follow
   */
  maxRedirects?: number;

  /**
   * Use JavaScript rendering
   */
  renderJs?: boolean;

  /**
   * Wait time for JS rendering (ms)
   */
  waitTime?: number;
}

/**
 * Crawl result
 */
export interface CrawlResult {
  /**
   * Starting URL
   */
  startUrl: string;

  /**
   * Pages crawled
   */
  pages: WebPageContent[];

  /**
   * Total pages crawled
   */
  totalPages: number;

  /**
   * Total duration in milliseconds
   */
  duration: number;

  /**
   * Errors encountered
   */
  errors: Array<{
    url: string;
    error: string;
  }>;

  /**
   * URLs that were skipped
   */
  skipped: string[];
}

/**
 * Crawl options
 */
export interface CrawlOptions {
  /**
   * Maximum depth to crawl
   */
  maxDepth?: number;

  /**
   * Maximum pages to crawl
   */
  maxPages?: number;

  /**
   * URL patterns to include (regex)
   */
  includePatterns?: string[];

  /**
   * URL patterns to exclude (regex)
   */
  excludePatterns?: string[];

  /**
   * Stay within the same domain
   */
  sameDomain?: boolean;

  /**
   * Content format
   */
  format?: ContentType;

  /**
   * Maximum content length per page
   */
  maxContentLength?: number;

  /**
   * Delay between requests in milliseconds
   */
  delay?: number;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Respect robots.txt
   */
  respectRobots?: boolean;

  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Extract links from content
   */
  extractLinks?: boolean;

  /**
   * Concurrent requests
   */
  concurrency?: number;
}

/**
 * Search operation result
 */
export interface SearchOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /**
   * API key
   */
  apiKey: string;

  /**
   * Base URL (optional, for custom endpoints)
   */
  baseUrl?: string;

  /**
   * Default timeout
   */
  timeout?: number;

  /**
   * Rate limit (requests per minute)
   */
  rateLimit?: number;
}

/**
 * Search client configuration
 */
export interface WebSearchClientConfig {
  /**
   * Provider configurations
   */
  providers?: Partial<Record<SearchProvider, ProviderConfig>>;

  /**
   * Default provider
   */
  defaultProvider?: SearchProvider;

  /**
   * Default search options
   */
  defaultOptions?: Partial<SearchOptions>;

  /**
   * Default fetch options
   */
  defaultFetchOptions?: Partial<FetchOptions>;

  /**
   * Enable caching
   */
  enableCache?: boolean;

  /**
   * Cache TTL in seconds
   */
  cacheTtl?: number;

  /**
   * User agent string
   */
  userAgent?: string;
}

/**
 * Default user agent
 */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; AutonomousCodingAgent/1.0; +https://github.com/aidax-dag/autonomous-coding-agents)';

/**
 * Default search options
 */
export const DEFAULT_SEARCH_OPTIONS: Partial<SearchOptions> = {
  maxResults: 10,
  resultType: SearchResultType.WEB,
  timeRange: 'all',
  safeSearch: true,
  fetchContent: false,
  contentFormat: ContentType.TEXT,
  maxContentLength: 10000,
  timeout: 30000,
  includeRaw: false,
};

/**
 * Default fetch options
 */
export const DEFAULT_FETCH_OPTIONS: Partial<FetchOptions> = {
  format: ContentType.TEXT,
  maxLength: 50000,
  timeout: 30000,
  extractLinks: false,
  extractImages: false,
  followRedirects: true,
  maxRedirects: 5,
  renderJs: false,
  waitTime: 2000,
};

/**
 * Default crawl options
 */
export const DEFAULT_CRAWL_OPTIONS: Partial<CrawlOptions> = {
  maxDepth: 2,
  maxPages: 10,
  sameDomain: true,
  format: ContentType.TEXT,
  maxContentLength: 10000,
  delay: 1000,
  timeout: 30000,
  respectRobots: true,
  extractLinks: true,
  concurrency: 3,
};

/**
 * Search client interface
 */
export interface IWebSearchClient {
  /**
   * Search the web
   */
  search(query: string, options?: SearchOptions): Promise<SearchOperationResult<SearchResults>>;

  /**
   * Fetch a web page
   */
  fetch(url: string, options?: FetchOptions): Promise<SearchOperationResult<WebPageContent>>;

  /**
   * Crawl a website
   */
  crawl(startUrl: string, options?: CrawlOptions): Promise<SearchOperationResult<CrawlResult>>;

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: SearchProvider): boolean;

  /**
   * Get available providers
   */
  getAvailableProviders(): SearchProvider[];

  /**
   * Get client configuration
   */
  getConfig(): WebSearchClientConfig;

  /**
   * Update client configuration
   */
  setConfig(config: Partial<WebSearchClientConfig>): void;
}

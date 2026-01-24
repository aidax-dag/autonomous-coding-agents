/**
 * Web Search Client Implementation
 *
 * Core client for web search, content fetching, and crawling.
 *
 * @module core/tools/web-search/web-search-client
 */

import {
  IWebSearchClient,
  WebSearchClientConfig,
  SearchProvider,
  SearchOptions,
  SearchResults,
  SearchResultItem,
  SearchResultType,
  FetchOptions,
  WebPageContent,
  CrawlOptions,
  CrawlResult,
  ContentType,
  SearchOperationResult,
  ProviderConfig,
  DEFAULT_SEARCH_OPTIONS,
  DEFAULT_FETCH_OPTIONS,
  DEFAULT_CRAWL_OPTIONS,
  DEFAULT_USER_AGENT,
} from './web-search.interface.js';

/**
 * HTML to text converter (simple implementation)
 */
function htmlToText(html: string): string {
  // Remove scripts and styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * HTML to markdown converter (simple implementation)
 */
function htmlToMarkdown(html: string): string {
  let md = html;

  // Remove scripts and styles
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Convert headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');

  // Convert paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');

  // Convert bold and italic
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Convert links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Convert code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n');

  // Convert lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  // Convert line breaks
  md = md.replace(/<br[^>]*>/gi, '\n');
  md = md.replace(/<hr[^>]*>/gi, '\n---\n');

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

/**
 * Extract links from HTML
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /<a[^>]+href="([^"]+)"/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      if (href.startsWith('http://') || href.startsWith('https://')) {
        links.push(href);
      } else if (href.startsWith('/')) {
        const url = new URL(baseUrl);
        links.push(`${url.origin}${href}`);
      } else if (!href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
        const url = new URL(href, baseUrl);
        links.push(url.href);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return [...new Set(links)];
}

/**
 * Extract images from HTML
 */
function extractImages(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    try {
      const src = match[1];
      if (src.startsWith('http://') || src.startsWith('https://')) {
        images.push(src);
      } else if (src.startsWith('/')) {
        const url = new URL(baseUrl);
        images.push(`${url.origin}${src}`);
      } else if (src.startsWith('data:')) {
        // Data URL, skip
      } else {
        const url = new URL(src, baseUrl);
        images.push(url.href);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return [...new Set(images)];
}

/**
 * Extract metadata from HTML
 */
function extractMetadata(html: string): {
  title?: string;
  description?: string;
  author?: string;
  publishedDate?: Date;
  language?: string;
} {
  const result: ReturnType<typeof extractMetadata> = {};

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    result.title = htmlToText(titleMatch[1]);
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  if (descMatch) {
    result.description = descMatch[1];
  }

  // Extract author
  const authorMatch = html.match(/<meta[^>]+name="author"[^>]+content="([^"]+)"/i);
  if (authorMatch) {
    result.author = authorMatch[1];
  }

  // Extract published date
  const dateMatch =
    html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i) ||
    html.match(/<meta[^>]+name="date"[^>]+content="([^"]+)"/i);
  if (dateMatch) {
    try {
      result.publishedDate = new Date(dateMatch[1]);
    } catch {
      // Invalid date, skip
    }
  }

  // Extract language
  const langMatch = html.match(/<html[^>]+lang="([^"]+)"/i);
  if (langMatch) {
    result.language = langMatch[1];
  }

  return result;
}

/**
 * Web Search Client implementation
 */
export class WebSearchClient implements IWebSearchClient {
  private config: WebSearchClientConfig;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

  constructor(config: WebSearchClientConfig = {}) {
    this.config = {
      providers: config.providers || {},
      defaultProvider: config.defaultProvider || SearchProvider.TAVILY,
      defaultOptions: { ...DEFAULT_SEARCH_OPTIONS, ...config.defaultOptions },
      defaultFetchOptions: { ...DEFAULT_FETCH_OPTIONS, ...config.defaultFetchOptions },
      enableCache: config.enableCache ?? true,
      cacheTtl: config.cacheTtl ?? 300,
      userAgent: config.userAgent || DEFAULT_USER_AGENT,
    };
  }

  /**
   * Search the web
   */
  async search(query: string, options?: SearchOptions): Promise<SearchOperationResult<SearchResults>> {
    const startTime = Date.now();
    const opts = { ...this.config.defaultOptions, ...options };
    const provider = opts.provider || this.config.defaultProvider || SearchProvider.TAVILY;

    // Check cache
    if (this.config.enableCache) {
      const cacheKey = `search:${provider}:${query}:${JSON.stringify(opts)}`;
      const cached = this.getFromCache<SearchResults>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    try {
      let results: SearchResults;

      switch (provider) {
        case SearchProvider.TAVILY:
          results = await this.searchWithTavily(query, opts);
          break;
        case SearchProvider.EXA:
          results = await this.searchWithExa(query, opts);
          break;
        case SearchProvider.SERPER:
          results = await this.searchWithSerper(query, opts);
          break;
        case SearchProvider.BRAVE:
          results = await this.searchWithBrave(query, opts);
          break;
        default:
          return {
            success: false,
            error: `Unsupported search provider: ${provider}`,
          };
      }

      results.duration = Date.now() - startTime;

      // Fetch content if requested
      if (opts.fetchContent && results.results.length > 0) {
        await this.fetchContentForResults(results.results, opts);
      }

      // Cache results
      if (this.config.enableCache) {
        const cacheKey = `search:${provider}:${query}:${JSON.stringify(opts)}`;
        this.setInCache(cacheKey, results);
      }

      return { success: true, data: results };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch a web page
   */
  async fetch(url: string, options?: FetchOptions): Promise<SearchOperationResult<WebPageContent>> {
    const startTime = Date.now();
    const opts = { ...this.config.defaultFetchOptions, ...options };

    // Check cache
    if (this.config.enableCache) {
      const cacheKey = `fetch:${url}:${JSON.stringify(opts)}`;
      const cached = this.getFromCache<WebPageContent>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout || 30000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': opts.userAgent || this.config.userAgent || DEFAULT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          ...opts.headers,
        },
        redirect: opts.followRedirects ? 'follow' : 'manual',
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();
      const metadata = extractMetadata(html);

      let content: string;
      switch (opts.format) {
        case ContentType.MARKDOWN:
          content = htmlToMarkdown(html);
          break;
        case ContentType.HTML:
          content = html;
          break;
        case ContentType.TEXT:
        default:
          content = htmlToText(html);
          break;
      }

      // Truncate if needed
      if (opts.maxLength && content.length > opts.maxLength) {
        content = content.substring(0, opts.maxLength) + '...';
      }

      const result: WebPageContent = {
        url,
        title: metadata.title,
        content,
        contentType: opts.format || ContentType.TEXT,
        length: content.length,
        description: metadata.description,
        author: metadata.author,
        publishedDate: metadata.publishedDate,
        language: metadata.language,
        duration: Date.now() - startTime,
        statusCode: response.status,
      };

      if (opts.extractLinks) {
        result.links = extractLinks(html, url);
      }

      if (opts.extractImages) {
        result.images = extractImages(html, url);
      }

      // Cache result
      if (this.config.enableCache) {
        const cacheKey = `fetch:${url}:${JSON.stringify(opts)}`;
        this.setInCache(cacheKey, result);
      }

      clearTimeout(timeoutId);
      return { success: true, data: result };
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle abort error
      if (errorMessage.includes('aborted')) {
        return {
          success: false,
          error: `Request timed out after ${opts.timeout || 30000}ms`,
        };
      }

      return {
        success: false,
        error: errorMessage,
        data: {
          url,
          content: '',
          contentType: opts.format || ContentType.TEXT,
          length: 0,
          duration,
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Crawl a website
   */
  async crawl(startUrl: string, options?: CrawlOptions): Promise<SearchOperationResult<CrawlResult>> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_CRAWL_OPTIONS, ...options };

    // Validate URL
    let baseUrl: URL;
    try {
      baseUrl = new URL(startUrl);
    } catch {
      return {
        success: false,
        error: `Invalid URL: ${startUrl}`,
      };
    }

    const visited = new Set<string>();
    const toVisit: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
    const pages: WebPageContent[] = [];
    const errors: Array<{ url: string; error: string }> = [];
    const skipped: string[] = [];

    // Compile include/exclude patterns
    const includePatterns = (opts.includePatterns || []).map((p) => new RegExp(p));
    const excludePatterns = (opts.excludePatterns || []).map((p) => new RegExp(p));

    while (toVisit.length > 0 && pages.length < (opts.maxPages || 10)) {
      const current = toVisit.shift()!;

      if (visited.has(current.url)) {
        continue;
      }

      if (current.depth > (opts.maxDepth || 2)) {
        skipped.push(current.url);
        continue;
      }

      // Check same domain
      if (opts.sameDomain) {
        try {
          const currentUrl = new URL(current.url);
          if (currentUrl.hostname !== baseUrl.hostname) {
            skipped.push(current.url);
            continue;
          }
        } catch {
          skipped.push(current.url);
          continue;
        }
      }

      // Check include patterns
      if (includePatterns.length > 0) {
        const included = includePatterns.some((p) => p.test(current.url));
        if (!included) {
          skipped.push(current.url);
          continue;
        }
      }

      // Check exclude patterns
      if (excludePatterns.length > 0) {
        const excluded = excludePatterns.some((p) => p.test(current.url));
        if (excluded) {
          skipped.push(current.url);
          continue;
        }
      }

      visited.add(current.url);

      // Fetch page
      const result = await this.fetch(current.url, {
        format: opts.format,
        maxLength: opts.maxContentLength,
        timeout: opts.timeout,
        userAgent: opts.userAgent,
        extractLinks: opts.extractLinks,
      });

      if (result.success && result.data) {
        pages.push(result.data);

        // Add links to visit
        if (opts.extractLinks && result.data.links) {
          for (const link of result.data.links) {
            if (!visited.has(link) && !toVisit.some((t) => t.url === link)) {
              toVisit.push({ url: link, depth: current.depth + 1 });
            }
          }
        }
      } else {
        errors.push({ url: current.url, error: result.error || 'Unknown error' });
      }

      // Delay between requests
      if (opts.delay && toVisit.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, opts.delay));
      }
    }

    return {
      success: true,
      data: {
        startUrl,
        pages,
        totalPages: pages.length,
        duration: Date.now() - startTime,
        errors,
        skipped,
      },
    };
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: SearchProvider): boolean {
    const config = this.config.providers?.[provider];
    return !!(config && config.apiKey);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): SearchProvider[] {
    return Object.values(SearchProvider).filter((p) => this.isProviderAvailable(p));
  }

  /**
   * Get client configuration
   */
  getConfig(): WebSearchClientConfig {
    return { ...this.config };
  }

  /**
   * Update client configuration
   */
  setConfig(config: Partial<WebSearchClientConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      providers: { ...this.config.providers, ...config.providers },
      defaultOptions: { ...this.config.defaultOptions, ...config.defaultOptions },
      defaultFetchOptions: { ...this.config.defaultFetchOptions, ...config.defaultFetchOptions },
    };
  }

  /**
   * Search with Tavily
   */
  private async searchWithTavily(query: string, options: SearchOptions): Promise<SearchResults> {
    const config = this.getProviderConfig(SearchProvider.TAVILY);
    if (!config) {
      throw new Error('Tavily API key not configured');
    }

    const baseUrl = config.baseUrl || 'https://api.tavily.com';
    const response = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: config.apiKey,
        query,
        max_results: options.maxResults || 10,
        search_depth: 'advanced',
        include_domains: options.includeDomains,
        exclude_domains: options.excludeDomains,
        include_answer: true,
        include_raw_content: options.fetchContent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    const results: SearchResultItem[] = ((data.results as Record<string, unknown>[]) || []).map(
      (r: Record<string, unknown>) => ({
        title: r.title as string,
        url: r.url as string,
        snippet: r.content as string,
        content: r.raw_content as string | undefined,
        score: r.score as number | undefined,
        type: SearchResultType.WEB,
        raw: options.includeRaw ? r : undefined,
      })
    );

    return {
      query,
      provider: SearchProvider.TAVILY,
      results,
      relatedQueries: data.follow_up_questions as string[] | undefined,
      duration: 0,
    };
  }

  /**
   * Search with Exa
   */
  private async searchWithExa(query: string, options: SearchOptions): Promise<SearchResults> {
    const config = this.getProviderConfig(SearchProvider.EXA);
    if (!config) {
      throw new Error('Exa API key not configured');
    }

    const baseUrl = config.baseUrl || 'https://api.exa.ai';
    const response = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        query,
        numResults: options.maxResults || 10,
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        contents: options.fetchContent
          ? {
              text: {
                maxCharacters: options.maxContentLength || 10000,
              },
            }
          : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    const results: SearchResultItem[] = ((data.results as Record<string, unknown>[]) || []).map(
      (r: Record<string, unknown>) => ({
        title: r.title as string,
        url: r.url as string,
        snippet: (r.text as string)?.substring(0, 200) || '',
        content: r.text as string | undefined,
        publishedDate: r.publishedDate ? new Date(r.publishedDate as string) : undefined,
        score: r.score as number | undefined,
        type: SearchResultType.WEB,
        raw: options.includeRaw ? r : undefined,
      })
    );

    return {
      query,
      provider: SearchProvider.EXA,
      results,
      duration: 0,
    };
  }

  /**
   * Search with Serper
   */
  private async searchWithSerper(query: string, options: SearchOptions): Promise<SearchResults> {
    const config = this.getProviderConfig(SearchProvider.SERPER);
    if (!config) {
      throw new Error('Serper API key not configured');
    }

    const baseUrl = config.baseUrl || 'https://google.serper.dev';
    const response = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: options.maxResults || 10,
        gl: options.country,
        hl: options.language,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    const results: SearchResultItem[] = ((data.organic as Record<string, unknown>[]) || []).map(
      (r: Record<string, unknown>) => ({
        title: r.title as string,
        url: r.link as string,
        snippet: r.snippet as string,
        source: r.source as string | undefined,
        type: SearchResultType.WEB,
        raw: options.includeRaw ? r : undefined,
      })
    );

    return {
      query,
      provider: SearchProvider.SERPER,
      results,
      relatedQueries: ((data.relatedSearches as Record<string, unknown>[]) || []).map(
        (r: Record<string, unknown>) => r.query as string
      ),
      duration: 0,
    };
  }

  /**
   * Search with Brave
   */
  private async searchWithBrave(query: string, options: SearchOptions): Promise<SearchResults> {
    const config = this.getProviderConfig(SearchProvider.BRAVE);
    if (!config) {
      throw new Error('Brave API key not configured');
    }

    const baseUrl = config.baseUrl || 'https://api.search.brave.com/res/v1';
    const params = new URLSearchParams({
      q: query,
      count: String(options.maxResults || 10),
    });

    if (options.country) params.set('country', options.country);
    if (options.language) params.set('search_lang', options.language);
    if (options.safeSearch !== undefined) params.set('safesearch', options.safeSearch ? 'strict' : 'off');

    const response = await fetch(`${baseUrl}/web/search?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    const webData = data.web as Record<string, unknown> | undefined;
    const results: SearchResultItem[] = ((webData?.results as Record<string, unknown>[]) || []).map(
      (r: Record<string, unknown>) => ({
        title: r.title as string,
        url: r.url as string,
        snippet: r.description as string,
        source: (r.meta_url as Record<string, unknown>)?.hostname as string | undefined,
        type: SearchResultType.WEB,
        raw: options.includeRaw ? r : undefined,
      })
    );

    return {
      query,
      provider: SearchProvider.BRAVE,
      results,
      duration: 0,
    };
  }

  /**
   * Fetch content for search results
   */
  private async fetchContentForResults(results: SearchResultItem[], options: SearchOptions): Promise<void> {
    const fetchPromises = results.map(async (result) => {
      if (!result.content) {
        const fetchResult = await this.fetch(result.url, {
          format: options.contentFormat,
          maxLength: options.maxContentLength,
          timeout: options.timeout,
        });

        if (fetchResult.success && fetchResult.data) {
          result.content = fetchResult.data.content;
        }
      }
    });

    await Promise.allSettled(fetchPromises);
  }

  /**
   * Get provider configuration
   */
  private getProviderConfig(provider: SearchProvider): ProviderConfig | undefined {
    return this.config.providers?.[provider];
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (cached) {
      const ttl = (this.config.cacheTtl || 300) * 1000;
      if (Date.now() - cached.timestamp < ttl) {
        return cached.data as T;
      }
      this.cache.delete(key);
    }
    return undefined;
  }

  /**
   * Set in cache
   */
  private setInCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

/**
 * Global web search client instance
 */
let globalClient: WebSearchClient | null = null;

/**
 * Get global web search client
 */
export function getWebSearchClient(config?: WebSearchClientConfig): WebSearchClient {
  if (!globalClient) {
    globalClient = new WebSearchClient(config);
  } else if (config) {
    globalClient.setConfig(config);
  }
  return globalClient;
}

/**
 * Reset global web search client
 */
export function resetWebSearchClient(): void {
  globalClient = null;
}

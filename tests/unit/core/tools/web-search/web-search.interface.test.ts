/**
 * Web Search Interface Tests
 */

import {
  SearchProvider,
  SearchResultType,
  ContentType,
  DEFAULT_USER_AGENT,
  DEFAULT_SEARCH_OPTIONS,
  DEFAULT_FETCH_OPTIONS,
  DEFAULT_CRAWL_OPTIONS,
} from '../../../../../src/core/tools/web-search/web-search.interface.js';

describe('Web Search Interface', () => {
  describe('SearchProvider enum', () => {
    it('should have all expected providers', () => {
      expect(SearchProvider.TAVILY).toBe('tavily');
      expect(SearchProvider.EXA).toBe('exa');
      expect(SearchProvider.SERPER).toBe('serper');
      expect(SearchProvider.BRAVE).toBe('brave');
    });

    it('should have 4 providers', () => {
      expect(Object.keys(SearchProvider)).toHaveLength(4);
    });
  });

  describe('SearchResultType enum', () => {
    it('should have all expected result types', () => {
      expect(SearchResultType.WEB).toBe('web');
      expect(SearchResultType.NEWS).toBe('news');
      expect(SearchResultType.IMAGE).toBe('image');
      expect(SearchResultType.VIDEO).toBe('video');
      expect(SearchResultType.ACADEMIC).toBe('academic');
    });

    it('should have 5 result types', () => {
      expect(Object.keys(SearchResultType)).toHaveLength(5);
    });
  });

  describe('ContentType enum', () => {
    it('should have all expected content types', () => {
      expect(ContentType.HTML).toBe('html');
      expect(ContentType.TEXT).toBe('text');
      expect(ContentType.MARKDOWN).toBe('markdown');
      expect(ContentType.JSON).toBe('json');
    });

    it('should have 4 content types', () => {
      expect(Object.keys(ContentType)).toHaveLength(4);
    });
  });

  describe('DEFAULT_USER_AGENT', () => {
    it('should be a non-empty string', () => {
      expect(typeof DEFAULT_USER_AGENT).toBe('string');
      expect(DEFAULT_USER_AGENT.length).toBeGreaterThan(0);
    });

    it('should contain identifying information', () => {
      expect(DEFAULT_USER_AGENT).toContain('AutonomousCodingAgent');
    });
  });

  describe('DEFAULT_SEARCH_OPTIONS', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_SEARCH_OPTIONS.maxResults).toBe(10);
      expect(DEFAULT_SEARCH_OPTIONS.resultType).toBe(SearchResultType.WEB);
      expect(DEFAULT_SEARCH_OPTIONS.timeRange).toBe('all');
      expect(DEFAULT_SEARCH_OPTIONS.safeSearch).toBe(true);
      expect(DEFAULT_SEARCH_OPTIONS.fetchContent).toBe(false);
      expect(DEFAULT_SEARCH_OPTIONS.contentFormat).toBe(ContentType.TEXT);
      expect(DEFAULT_SEARCH_OPTIONS.maxContentLength).toBe(10000);
      expect(DEFAULT_SEARCH_OPTIONS.timeout).toBe(30000);
      expect(DEFAULT_SEARCH_OPTIONS.includeRaw).toBe(false);
    });
  });

  describe('DEFAULT_FETCH_OPTIONS', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_FETCH_OPTIONS.format).toBe(ContentType.TEXT);
      expect(DEFAULT_FETCH_OPTIONS.maxLength).toBe(50000);
      expect(DEFAULT_FETCH_OPTIONS.timeout).toBe(30000);
      expect(DEFAULT_FETCH_OPTIONS.extractLinks).toBe(false);
      expect(DEFAULT_FETCH_OPTIONS.extractImages).toBe(false);
      expect(DEFAULT_FETCH_OPTIONS.followRedirects).toBe(true);
      expect(DEFAULT_FETCH_OPTIONS.maxRedirects).toBe(5);
      expect(DEFAULT_FETCH_OPTIONS.renderJs).toBe(false);
      expect(DEFAULT_FETCH_OPTIONS.waitTime).toBe(2000);
    });
  });

  describe('DEFAULT_CRAWL_OPTIONS', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_CRAWL_OPTIONS.maxDepth).toBe(2);
      expect(DEFAULT_CRAWL_OPTIONS.maxPages).toBe(10);
      expect(DEFAULT_CRAWL_OPTIONS.sameDomain).toBe(true);
      expect(DEFAULT_CRAWL_OPTIONS.format).toBe(ContentType.TEXT);
      expect(DEFAULT_CRAWL_OPTIONS.maxContentLength).toBe(10000);
      expect(DEFAULT_CRAWL_OPTIONS.delay).toBe(1000);
      expect(DEFAULT_CRAWL_OPTIONS.timeout).toBe(30000);
      expect(DEFAULT_CRAWL_OPTIONS.respectRobots).toBe(true);
      expect(DEFAULT_CRAWL_OPTIONS.extractLinks).toBe(true);
      expect(DEFAULT_CRAWL_OPTIONS.concurrency).toBe(3);
    });
  });
});

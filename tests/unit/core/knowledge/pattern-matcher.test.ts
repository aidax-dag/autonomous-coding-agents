/**
 * Pattern Matcher Tests
 *
 * Tests for the PatternMatcher class.
 */

import {
  KnowledgeStore,
  PatternMatcher,
  createPatternMatcher,
  DEFAULT_PATTERN_MATCHER_CONFIG,
  ProblemContext,
  MatchResult,
  Recommendation,
} from '../../../../src/core/knowledge';

describe('PatternMatcher', () => {
  let store: KnowledgeStore;
  let matcher: PatternMatcher;

  beforeEach(() => {
    store = new KnowledgeStore();
    matcher = new PatternMatcher(store);

    // Seed with test data
    store.addPattern({
      name: 'Repository Pattern',
      description: 'Abstract data access layer for database operations',
      category: 'architecture',
      language: 'typescript',
      problem: 'Direct database access couples business logic to storage',
      solution: 'Create repository interfaces that abstract data access',
      whenToUse: ['Complex data access', 'Multiple data sources'],
      whenNotToUse: ['Simple CRUD apps'],
      confidence: 'verified',
    });

    store.addPattern({
      name: 'Singleton Pattern',
      description: 'Ensure a class has only one instance',
      category: 'design',
      language: 'typescript',
      problem: 'Need exactly one instance of a class',
      solution: 'Private constructor with static getInstance method',
      whenToUse: ['Configuration', 'Connection pools'],
      whenNotToUse: ['When multiple instances are needed'],
      confidence: 'high',
    });

    store.addLesson({
      title: 'Always validate input',
      description: 'Input validation prevents security issues',
      context: 'Security audit',
      whatHappened: 'SQL injection vulnerability found',
      whatWeLearned: 'All user input must be validated',
      recommendedActions: ['Add input validation', 'Use parameterized queries'],
      severity: 'critical',
      category: 'security',
      tags: [{ name: 'security' }, { name: 'validation' }],
      confidence: 'verified',
    });

    store.addEntry({
      type: 'anti-pattern',
      title: 'God Object',
      content: 'A class that does too much. Split into smaller, focused classes.',
      tags: [{ name: 'design' }, { name: 'refactoring' }],
      status: 'accepted',
      confidence: 'verified',
      metadata: {},
    });
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_PATTERN_MATCHER_CONFIG.minMatchScore).toBe(0.3);
      expect(DEFAULT_PATTERN_MATCHER_CONFIG.maxResults).toBe(5);
    });

    it('should accept custom configuration', () => {
      const customMatcher = new PatternMatcher(store, { minMatchScore: 0.5 });
      expect(customMatcher).toBeDefined();
    });
  });

  // ============================================================================
  // Find Matches
  // ============================================================================

  describe('Find Matches', () => {
    it('should find matches for a problem context', () => {
      const context: ProblemContext = {
        description: 'Need to abstract database access in our TypeScript application',
        language: 'typescript',
      };

      const matches = matcher.findMatches(context);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].title).toContain('Repository');
    });

    it('should return empty array when no matches', () => {
      const context: ProblemContext = {
        description: 'Something completely unrelated xyz123',
      };

      const matches = matcher.findMatches(context);
      expect(matches.length).toBe(0);
    });

    it('should score higher for matching language', () => {
      const tsContext: ProblemContext = {
        description: 'database access pattern',
        language: 'typescript',
      };

      const pyContext: ProblemContext = {
        description: 'database access pattern',
        language: 'python',
      };

      const tsMatches = matcher.findMatches(tsContext);
      const pyMatches = matcher.findMatches(pyContext);

      // TypeScript context should score higher
      if (tsMatches.length > 0 && pyMatches.length > 0) {
        expect(tsMatches[0].score).toBeGreaterThanOrEqual(pyMatches[0].score);
      }
    });

    it('should include match results with proper structure', () => {
      const context: ProblemContext = {
        description: 'data access repository pattern',
      };

      const matches = matcher.findMatches(context);
      if (matches.length > 0) {
        const match = matches[0];
        expect(match.id).toBeDefined();
        expect(match.type).toBeDefined();
        expect(match.score).toBeGreaterThanOrEqual(0);
        expect(match.score).toBeLessThanOrEqual(1);
        expect(match.confidence).toBeDefined();
        expect(match.title).toBeDefined();
        expect(match.summary).toBeDefined();
      }
    });

    it('should respect maxResults configuration', () => {
      const limitedMatcher = new PatternMatcher(store, { maxResults: 1 });
      const context: ProblemContext = {
        description: 'pattern design class',
      };

      const matches = limitedMatcher.findMatches(context);
      expect(matches.length).toBeLessThanOrEqual(1);
    });

    it('should respect minMatchScore configuration', () => {
      const strictMatcher = new PatternMatcher(store, { minMatchScore: 0.9 });
      const context: ProblemContext = {
        description: 'something partially related',
      };

      const matches = strictMatcher.findMatches(context);
      for (const match of matches) {
        expect(match.score).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  // ============================================================================
  // Find Similar Patterns
  // ============================================================================

  describe('Find Similar Patterns', () => {
    it('should find similar patterns', () => {
      const pattern = store.listPatterns()[0];
      const similar = matcher.findSimilarPatterns(pattern);

      // Should not include the original pattern
      expect(similar.every(p => p.id !== pattern.id)).toBe(true);
    });
  });

  // ============================================================================
  // Find Relevant Lessons
  // ============================================================================

  describe('Find Relevant Lessons', () => {
    it('should find relevant lessons', () => {
      const context: ProblemContext = {
        description: 'security issue with user input validation',
        tags: ['security'],
      };

      const lessons = matcher.findRelevantLessons(context);
      expect(lessons.length).toBeGreaterThan(0);
    });

    it('should match on tags', () => {
      const context: ProblemContext = {
        description: 'need validation',
        tags: ['validation'],
      };

      const lessons = matcher.findRelevantLessons(context);
      expect(lessons.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Recommendations
  // ============================================================================

  describe('Recommendations', () => {
    it('should generate recommendation for a problem', () => {
      const context: ProblemContext = {
        description: 'Need to abstract database operations with repository pattern',
        language: 'typescript',
      };

      const recommendation = matcher.recommend(context);

      expect(recommendation).toBeDefined();
      expect(recommendation.problem).toBe(context.description);
      expect(recommendation.timestamp).toBeInstanceOf(Date);
    });

    it('should include primary recommendation when matches found', () => {
      const context: ProblemContext = {
        description: 'database access repository pattern typescript',
        language: 'typescript',
      };

      const recommendation = matcher.recommend(context);

      if (recommendation.primary) {
        expect(recommendation.primary.title).toBeDefined();
        expect(recommendation.primary.score).toBeGreaterThan(0);
      }
    });

    it('should include alternatives', () => {
      const context: ProblemContext = {
        description: 'design pattern class instance',
      };

      const recommendation = matcher.recommend(context);
      // Alternatives are the matches after the primary
      expect(recommendation.alternatives).toBeDefined();
    });

    it('should include lessons', () => {
      const context: ProblemContext = {
        description: 'security validation input',
        tags: ['security'],
      };

      const recommendation = matcher.recommend(context);
      expect(recommendation.lessons).toBeDefined();
      expect(recommendation.lessons.length).toBeGreaterThanOrEqual(0);
    });

    it('should include anti-patterns', () => {
      const context: ProblemContext = {
        description: 'class design refactoring',
      };

      const recommendation = matcher.recommend(context);
      expect(recommendation.antiPatterns).toBeDefined();
    });

    it('should calculate overall confidence', () => {
      const context: ProblemContext = {
        description: 'repository pattern database',
      };

      const recommendation = matcher.recommend(context);
      expect(['low', 'medium', 'high', 'verified']).toContain(recommendation.overallConfidence);
    });
  });

  // ============================================================================
  // Find Anti-Patterns
  // ============================================================================

  describe('Find Anti-Patterns', () => {
    it('should find relevant anti-patterns', () => {
      const context: ProblemContext = {
        description: 'god object pattern class does too much',
        tags: ['design'],
      };

      const antiPatterns = matcher.findAntiPatterns(context);
      expect(antiPatterns.length).toBeGreaterThan(0);
      expect(antiPatterns[0].type).toBe('anti-pattern');
    });

    it('should return empty array when no anti-patterns match', () => {
      const context: ProblemContext = {
        description: 'completely unrelated xyz123',
      };

      const antiPatterns = matcher.findAntiPatterns(context);
      expect(antiPatterns.length).toBe(0);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics', () => {
    it('should track match statistics', () => {
      matcher.findMatches({ description: 'database repository' });
      matcher.findMatches({ description: 'singleton pattern' });

      const stats = matcher.getStats();
      expect(stats.totalMatches).toBe(2);
    });

    it('should track successful matches', () => {
      matcher.findMatches({ description: 'repository pattern database' });
      matcher.findMatches({ description: 'xyz123 no match here' });

      const stats = matcher.getStats();
      expect(stats.totalMatches).toBe(2);
      // At least one should be successful
      expect(stats.successfulMatches).toBeGreaterThanOrEqual(1);
    });

    it('should calculate average score', () => {
      matcher.findMatches({ description: 'database repository pattern' });

      const stats = matcher.getStats();
      if (stats.successfulMatches > 0) {
        expect(stats.averageScore).toBeGreaterThan(0);
      }
    });

    it('should track matches by type', () => {
      matcher.findMatches({ description: 'repository pattern' });

      const stats = matcher.getStats();
      expect(stats.matchesByType).toBeDefined();
    });

    it('should reset statistics', () => {
      matcher.findMatches({ description: 'test' });
      matcher.resetStats();

      const stats = matcher.getStats();
      expect(stats.totalMatches).toBe(0);
      expect(stats.successfulMatches).toBe(0);
    });
  });

  // ============================================================================
  // Events
  // ============================================================================

  describe('Events', () => {
    it('should emit match:found event', (done) => {
      matcher.on('match:found', (context: ProblemContext, results: MatchResult[]) => {
        expect(context.description).toContain('repository');
        expect(results.length).toBeGreaterThan(0);
        done();
      });

      matcher.findMatches({ description: 'database repository pattern' });
    });

    it('should emit match:none event', (done) => {
      matcher.on('match:none', (context: ProblemContext) => {
        expect(context.description).toContain('xyz');
        done();
      });

      matcher.findMatches({ description: 'xyz123 no match' });
    });

    it('should emit recommendation:generated event', (done) => {
      matcher.on('recommendation:generated', (recommendation: Recommendation) => {
        expect(recommendation.problem).toBeDefined();
        done();
      });

      matcher.recommend({ description: 'repository pattern' });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty description', () => {
      const matches = matcher.findMatches({ description: '' });
      expect(matches).toBeDefined();
    });

    it('should handle context with only error info', () => {
      const context: ProblemContext = {
        description: 'Error occurred',
        errorMessage: 'Cannot read property of undefined',
        errorType: 'TypeError',
      };

      const matches = matcher.findMatches(context);
      expect(matches).toBeDefined();
    });

    it('should handle context with stack trace', () => {
      const context: ProblemContext = {
        description: 'Runtime error',
        stackTrace: 'at Object.<anonymous> (/app/index.js:10:5)',
      };

      const matches = matcher.findMatches(context);
      expect(matches).toBeDefined();
    });

    it('should handle special characters in description', () => {
      const context: ProblemContext = {
        description: 'Error: $special & <characters> "quotes"',
      };

      const matches = matcher.findMatches(context);
      expect(matches).toBeDefined();
    });
  });

  // ============================================================================
  // Factory Function
  // ============================================================================

  describe('Factory Function', () => {
    it('should create matcher with defaults', () => {
      const created = createPatternMatcher(store);
      expect(created).toBeInstanceOf(PatternMatcher);
    });

    it('should create matcher with custom config', () => {
      const created = createPatternMatcher(store, { maxResults: 10 });
      expect(created).toBeDefined();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should work with real-world problem context', () => {
      const context: ProblemContext = {
        description: 'Our application has grown too complex. We need to refactor the data access layer to use a proper abstraction.',
        language: 'typescript',
        framework: 'express',
        tags: ['refactoring', 'architecture'],
      };

      const recommendation = matcher.recommend(context);

      expect(recommendation).toBeDefined();
      expect(recommendation.overallConfidence).toBeDefined();
    });

    it('should prioritize verified patterns', () => {
      const context: ProblemContext = {
        description: 'database repository pattern',
        language: 'typescript',
      };

      const matches = matcher.findMatches(context);
      if (matches.length > 0) {
        // Verified patterns should score higher
        const verifiedMatches = matches.filter(m => m.confidence === 'verified');
        if (verifiedMatches.length > 0 && matches[0].confidence !== 'verified') {
          // If there are verified matches but they're not first,
          // their score should still be competitive
          expect(verifiedMatches[0].score).toBeGreaterThan(0.3);
        }
      }
    });

    it('should provide actionable recommendations', () => {
      // Add a solution entry
      store.addEntry({
        type: 'solution',
        title: 'Database Connection Error',
        content: '## Problem\nConnection timeout\n\n## Solution\nIncrease timeout and add retry logic',
        tags: [{ name: 'database' }, { name: 'error' }],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });

      const context: ProblemContext = {
        description: 'database connection timeout error',
        errorType: 'ConnectionError',
      };

      const matches = matcher.findMatches(context);
      if (matches.length > 0) {
        // Should find the solution
        const solutionMatch = matches.find(m => m.title.includes('Connection'));
        if (solutionMatch) {
          expect(solutionMatch.recommendation).toBeDefined();
        }
      }
    });
  });
});

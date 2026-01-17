/**
 * Pattern Matcher
 *
 * Finds similar problems and recommends solutions based on
 * stored knowledge patterns and lessons learned.
 *
 * Feature: Knowledge Management System (Phase 3.3)
 */

import { EventEmitter } from 'events';
import {
  KnowledgeStore,
  KnowledgeEntry,
  PatternEntry,
  LessonEntry,
  KnowledgeType,
  ConfidenceLevel,
} from './knowledge-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Problem context for matching
 */
export interface ProblemContext {
  /** Problem description */
  description: string;
  /** Error message if applicable */
  errorMessage?: string;
  /** Error type/class */
  errorType?: string;
  /** File or component involved */
  file?: string;
  /** Programming language */
  language?: string;
  /** Framework being used */
  framework?: string;
  /** Additional context tags */
  tags?: string[];
  /** Stack trace if available */
  stackTrace?: string;
}

/**
 * Match result for a pattern or lesson
 */
export interface MatchResult {
  /** Entry ID */
  id: string;
  /** Entry type */
  type: KnowledgeType;
  /** Match score (0-1) */
  score: number;
  /** Match confidence */
  confidence: ConfidenceLevel;
  /** Title of the matched entry */
  title: string;
  /** Relevant excerpt or summary */
  summary: string;
  /** Recommended action */
  recommendation?: string;
  /** Related entries */
  relatedIds?: string[];
}

/**
 * Recommendation result
 */
export interface Recommendation {
  /** Problem that was matched */
  problem: string;
  /** Primary recommendation */
  primary?: MatchResult;
  /** Alternative recommendations */
  alternatives: MatchResult[];
  /** Lessons that might apply */
  lessons: MatchResult[];
  /** Anti-patterns to avoid */
  antiPatterns: MatchResult[];
  /** Confidence in recommendations */
  overallConfidence: ConfidenceLevel;
  /** Generated at */
  timestamp: Date;
}

/**
 * Pattern matcher configuration
 */
export interface PatternMatcherConfig {
  /** Minimum score threshold for matches */
  minMatchScore?: number;
  /** Maximum results per category */
  maxResults?: number;
  /** Enable fuzzy matching */
  fuzzyMatch?: boolean;
  /** Weight for keyword matches */
  keywordWeight?: number;
  /** Weight for context matches */
  contextWeight?: number;
  /** Weight for historical success */
  successWeight?: number;
}

/**
 * Pattern matcher events
 */
export interface PatternMatcherEvents {
  'match:found': (context: ProblemContext, results: MatchResult[]) => void;
  'match:none': (context: ProblemContext) => void;
  'recommendation:generated': (recommendation: Recommendation) => void;
}

/**
 * Match statistics
 */
export interface MatchStats {
  totalMatches: number;
  successfulMatches: number;
  averageScore: number;
  matchesByType: Record<KnowledgeType, number>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PATTERN_MATCHER_CONFIG: Required<PatternMatcherConfig> = {
  minMatchScore: 0.3,
  maxResults: 5,
  fuzzyMatch: true,
  keywordWeight: 0.4,
  contextWeight: 0.3,
  successWeight: 0.3,
};

// ============================================================================
// Pattern Matcher Implementation
// ============================================================================

/**
 * Pattern Matcher
 *
 * Matches problems against stored patterns and lessons to
 * provide relevant recommendations.
 */
export class PatternMatcher extends EventEmitter {
  private config: Required<PatternMatcherConfig>;
  private store: KnowledgeStore;
  private stats: MatchStats;

  constructor(store: KnowledgeStore, config: PatternMatcherConfig = {}) {
    super();

    this.store = store;
    this.config = {
      ...DEFAULT_PATTERN_MATCHER_CONFIG,
      ...config,
    };

    this.stats = {
      totalMatches: 0,
      successfulMatches: 0,
      averageScore: 0,
      matchesByType: {
        'adr': 0,
        'pattern': 0,
        'lesson': 0,
        'best-practice': 0,
        'anti-pattern': 0,
        'template': 0,
        'solution': 0,
      },
    };
  }

  // ==========================================================================
  // Matching
  // ==========================================================================

  /**
   * Find matches for a problem context
   */
  findMatches(context: ProblemContext): MatchResult[] {
    const results: MatchResult[] = [];

    // Extract keywords from context
    const keywords = this.extractKeywords(context);

    // Search in store
    const searchResults = this.store.search({
      query: context.description,
      types: ['pattern', 'solution', 'best-practice', 'lesson'],
      limit: this.config.maxResults * 3, // Get more, then filter
    });

    // Score each result
    for (const entry of searchResults.entries) {
      const score = this.calculateScore(entry, context, keywords);

      if (score >= this.config.minMatchScore) {
        results.push(this.createMatchResult(entry, score));
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = results.slice(0, this.config.maxResults);

    // Update stats
    this.updateStats(limited);

    if (limited.length > 0) {
      this.emit('match:found', context, limited);
    } else {
      this.emit('match:none', context);
    }

    return limited;
  }

  /**
   * Find similar patterns
   */
  findSimilarPatterns(pattern: PatternEntry): PatternEntry[] {
    const patterns = this.store.listPatterns(pattern.category, pattern.language);

    return patterns
      .filter(p => p.id !== pattern.id)
      .filter(p => {
        // Check for related patterns
        if (pattern.relatedPatterns?.includes(p.id)) return true;
        if (p.relatedPatterns?.includes(pattern.id)) return true;

        // Check keyword overlap
        const patternWords = new Set(pattern.description.toLowerCase().split(/\s+/));
        const pWords = p.description.toLowerCase().split(/\s+/);
        const overlap = pWords.filter(w => patternWords.has(w)).length;

        return overlap >= 3;
      })
      .slice(0, this.config.maxResults);
  }

  /**
   * Find relevant lessons for a context
   */
  findRelevantLessons(context: ProblemContext): LessonEntry[] {
    const allLessons = this.store.listLessons();
    const keywords = this.extractKeywords(context);

    const scored = allLessons.map(lesson => {
      let score = 0;

      // Check keyword matches
      const lessonText = `${lesson.title} ${lesson.description} ${lesson.whatHappened}`.toLowerCase();
      for (const keyword of keywords) {
        if (lessonText.includes(keyword.toLowerCase())) {
          score += 0.2;
        }
      }

      // Check tag matches
      if (context.tags) {
        for (const tag of context.tags) {
          if (lesson.tags.some(t => t.name.toLowerCase() === tag.toLowerCase())) {
            score += 0.3;
          }
        }
      }

      // Boost for error type match
      if (context.errorType && lesson.category === 'error') {
        const errorInLesson = lesson.whatHappened.toLowerCase().includes(context.errorType.toLowerCase());
        if (errorInLesson) {
          score += 0.4;
        }
      }

      return { lesson, score };
    });

    return scored
      .filter(s => s.score >= this.config.minMatchScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults)
      .map(s => s.lesson);
  }

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  /**
   * Generate recommendations for a problem
   */
  recommend(context: ProblemContext): Recommendation {
    const matches = this.findMatches(context);
    const lessons = this.findRelevantLessons(context);

    // Find anti-patterns to avoid
    const antiPatterns = this.findAntiPatterns(context);

    // Determine primary recommendation
    const primary = matches.length > 0 ? matches[0] : undefined;

    // Convert lessons to match results
    const lessonResults = lessons.map(l => this.lessonToMatchResult(l));

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(matches, lessons);

    const recommendation: Recommendation = {
      problem: context.description,
      primary,
      alternatives: matches.slice(1),
      lessons: lessonResults,
      antiPatterns,
      overallConfidence,
      timestamp: new Date(),
    };

    this.emit('recommendation:generated', recommendation);

    return recommendation;
  }

  /**
   * Find anti-patterns relevant to context
   */
  findAntiPatterns(context: ProblemContext): MatchResult[] {
    const searchResults = this.store.search({
      types: ['anti-pattern'],
      query: context.description,
      limit: this.config.maxResults,
    });

    const keywords = this.extractKeywords(context);

    return searchResults.entries
      .map(entry => {
        const score = this.calculateScore(entry, context, keywords);
        return this.createMatchResult(entry, score);
      })
      .filter(r => r.score >= this.config.minMatchScore)
      .sort((a, b) => b.score - a.score);
  }

  // ==========================================================================
  // Scoring
  // ==========================================================================

  /**
   * Calculate match score
   */
  private calculateScore(
    entry: KnowledgeEntry,
    context: ProblemContext,
    keywords: string[]
  ): number {
    let score = 0;

    // Keyword matching
    const entryText = `${entry.title} ${entry.content}`.toLowerCase();
    let keywordMatches = 0;

    for (const keyword of keywords) {
      if (entryText.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    }

    const keywordScore = keywords.length > 0
      ? keywordMatches / keywords.length
      : 0;

    score += keywordScore * this.config.keywordWeight;

    // Context matching
    let contextScore = 0;
    const metadata = entry.metadata as Record<string, unknown>;

    if (context.language && metadata.language === context.language) {
      contextScore += 0.4;
    }
    if (context.framework && metadata.framework === context.framework) {
      contextScore += 0.4;
    }

    // Tag matching
    if (context.tags && context.tags.length > 0) {
      const matchingTags = entry.tags.filter(t =>
        context.tags!.some(ct => ct.toLowerCase() === t.name.toLowerCase())
      );
      contextScore += (matchingTags.length / context.tags.length) * 0.2;
    }

    score += contextScore * this.config.contextWeight;

    // Historical success
    const successScore = this.calculateSuccessScore(entry);
    score += successScore * this.config.successWeight;

    // Confidence boost
    if (entry.confidence === 'verified') score *= 1.2;
    if (entry.confidence === 'high') score *= 1.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate success score based on usage
   */
  private calculateSuccessScore(entry: KnowledgeEntry): number {
    // Normalize usage count to 0-1 range
    const usageScore = Math.min(entry.usageCount / 100, 1.0);

    // Recent usage boost
    const recencyBoost = entry.lastUsedAt
      ? Math.max(0, 1 - (Date.now() - entry.lastUsedAt.getTime()) / (30 * 24 * 60 * 60 * 1000))
      : 0;

    return (usageScore + recencyBoost) / 2;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    matches: MatchResult[],
    lessons: LessonEntry[]
  ): ConfidenceLevel {
    if (matches.length === 0 && lessons.length === 0) {
      return 'low';
    }

    const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / (matches.length || 1);

    if (avgScore >= 0.8 && matches.some(m => m.confidence === 'verified')) {
      return 'verified';
    }
    if (avgScore >= 0.6) {
      return 'high';
    }
    if (avgScore >= 0.4) {
      return 'medium';
    }

    return 'low';
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Extract keywords from context
   */
  private extractKeywords(context: ProblemContext): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once',
      'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
      'you', 'your', 'yours', 'yourself', 'he', 'him', 'his',
      'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these',
      'those', 'am', 'and', 'but', 'if', 'or', 'because', 'as',
      'until', 'while', 'not', 'no', 'nor', 'only', 'own', 'same',
      'than', 'too', 'very', 's', 't', 'just', 'don', 'now',
    ]);

    const text = [
      context.description,
      context.errorMessage,
      context.errorType,
      context.file,
      ...(context.tags || []),
    ].filter(Boolean).join(' ');

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, self) => self.indexOf(word) === index);
  }

  /**
   * Create match result from entry
   */
  private createMatchResult(entry: KnowledgeEntry, score: number): MatchResult {
    return {
      id: entry.id,
      type: entry.type,
      score,
      confidence: entry.confidence,
      title: entry.title,
      summary: entry.content.slice(0, 200) + (entry.content.length > 200 ? '...' : ''),
      recommendation: this.extractRecommendation(entry),
      relatedIds: entry.references?.filter(r => r.id).map(r => r.id!) || [],
    };
  }

  /**
   * Convert lesson to match result
   */
  private lessonToMatchResult(lesson: LessonEntry): MatchResult {
    return {
      id: lesson.id,
      type: 'lesson',
      score: 0.7, // Default score for lessons
      confidence: lesson.confidence,
      title: lesson.title,
      summary: lesson.whatWeLearned,
      recommendation: lesson.recommendedActions[0],
    };
  }

  /**
   * Extract recommendation from entry content
   */
  private extractRecommendation(entry: KnowledgeEntry): string | undefined {
    // Try to find solution section
    const solutionMatch = entry.content.match(/## Solution\n([\s\S]*?)(?=\n##|$)/i);
    if (solutionMatch) {
      return solutionMatch[1].trim().slice(0, 200);
    }

    // Try to find recommendation section
    const recMatch = entry.content.match(/## Recommendation[s]?\n([\s\S]*?)(?=\n##|$)/i);
    if (recMatch) {
      return recMatch[1].trim().slice(0, 200);
    }

    return undefined;
  }

  /**
   * Update match statistics
   */
  private updateStats(results: MatchResult[]): void {
    this.stats.totalMatches++;

    if (results.length > 0) {
      this.stats.successfulMatches++;

      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      this.stats.averageScore =
        ((this.stats.averageScore * (this.stats.totalMatches - 1)) + avgScore) /
        this.stats.totalMatches;

      for (const result of results) {
        this.stats.matchesByType[result.type]++;
      }
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get matcher statistics
   */
  getStats(): MatchStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalMatches: 0,
      successfulMatches: 0,
      averageScore: 0,
      matchesByType: {
        'adr': 0,
        'pattern': 0,
        'lesson': 0,
        'best-practice': 0,
        'anti-pattern': 0,
        'template': 0,
        'solution': 0,
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a pattern matcher instance
 */
export function createPatternMatcher(
  store: KnowledgeStore,
  config: PatternMatcherConfig = {}
): PatternMatcher {
  return new PatternMatcher(store, config);
}

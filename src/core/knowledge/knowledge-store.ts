/**
 * Knowledge Store
 *
 * Centralized storage for architectural decisions, code patterns,
 * and lessons learned across the agent system.
 *
 * Feature: Knowledge Management System (Phase 3.3)
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

/**
 * Types of knowledge entries
 */
export type KnowledgeType =
  | 'adr'           // Architecture Decision Record
  | 'pattern'       // Code pattern
  | 'lesson'        // Lesson learned
  | 'best-practice' // Best practice
  | 'anti-pattern'  // Anti-pattern to avoid
  | 'template'      // Code template
  | 'solution';     // Problem solution

/**
 * Knowledge entry status
 */
export type KnowledgeStatus =
  | 'draft'
  | 'proposed'
  | 'accepted'
  | 'deprecated'
  | 'superseded';

/**
 * Confidence level for knowledge entries
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'verified';

/**
 * Tags for categorization
 */
export interface KnowledgeTag {
  name: string;
  category?: string;
}

/**
 * Reference to related knowledge or external resources
 */
export interface KnowledgeReference {
  id?: string;           // Internal knowledge ID
  url?: string;          // External URL
  title: string;
  type: 'internal' | 'external';
}

/**
 * Architecture Decision Record (ADR)
 */
export interface ADREntry {
  id: string;
  title: string;
  status: KnowledgeStatus;
  context: string;
  decision: string;
  consequences: string;
  alternatives?: string[];
  supersededBy?: string;
  references?: KnowledgeReference[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Code pattern entry
 */
export interface PatternEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  language?: string;
  framework?: string;
  problem: string;
  solution: string;
  example?: string;
  whenToUse: string[];
  whenNotToUse: string[];
  relatedPatterns?: string[];
  confidence: ConfidenceLevel;
  usageCount: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lesson learned entry
 */
export interface LessonEntry {
  id: string;
  title: string;
  description: string;
  context: string;
  whatHappened: string;
  whatWeLearned: string;
  recommendedActions: string[];
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  tags: KnowledgeTag[];
  confidence: ConfidenceLevel;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generic knowledge entry
 */
export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  tags: KnowledgeTag[];
  status: KnowledgeStatus;
  confidence: ConfidenceLevel;
  metadata: Record<string, unknown>;
  references?: KnowledgeReference[];
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Search options for knowledge queries
 */
export interface KnowledgeSearchOptions {
  types?: KnowledgeType[];
  tags?: string[];
  status?: KnowledgeStatus[];
  confidence?: ConfidenceLevel[];
  query?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'createdAt' | 'updatedAt' | 'usageCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search result
 */
export interface KnowledgeSearchResult {
  entries: KnowledgeEntry[];
  total: number;
  query?: string;
  filters: Partial<KnowledgeSearchOptions>;
}

/**
 * Knowledge store configuration
 */
export interface KnowledgeStoreConfig {
  /** Store name */
  name?: string;
  /** Maximum entries to store */
  maxEntries?: number;
  /** Auto-cleanup old entries */
  autoCleanup?: boolean;
  /** Days before cleanup */
  cleanupAfterDays?: number;
  /** Enable persistence */
  persistenceEnabled?: boolean;
  /** Persistence path */
  persistencePath?: string;
}

/**
 * Knowledge store events
 */
export interface KnowledgeStoreEvents {
  'entry:added': (entry: KnowledgeEntry) => void;
  'entry:updated': (entry: KnowledgeEntry, previous: KnowledgeEntry) => void;
  'entry:deleted': (entry: KnowledgeEntry) => void;
  'adr:added': (adr: ADREntry) => void;
  'pattern:added': (pattern: PatternEntry) => void;
  'lesson:added': (lesson: LessonEntry) => void;
  'search:performed': (query: KnowledgeSearchOptions, resultCount: number) => void;
  'cleanup:performed': (deletedCount: number) => void;
}

/**
 * Knowledge store statistics
 */
export interface KnowledgeStoreStats {
  totalEntries: number;
  entriesByType: Record<KnowledgeType, number>;
  entriesByStatus: Record<KnowledgeStatus, number>;
  totalSearches: number;
  averageUsageCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_KNOWLEDGE_STORE_CONFIG: Required<KnowledgeStoreConfig> = {
  name: 'knowledge-store',
  maxEntries: 10000,
  autoCleanup: true,
  cleanupAfterDays: 365,
  persistenceEnabled: false,
  persistencePath: './data/knowledge',
};

// ============================================================================
// Knowledge Store Implementation
// ============================================================================

/**
 * Knowledge Store
 *
 * Centralized storage for architectural decisions, code patterns,
 * and lessons learned.
 */
export class KnowledgeStore extends EventEmitter {
  private config: Required<KnowledgeStoreConfig>;
  private entries: Map<string, KnowledgeEntry>;
  private adrs: Map<string, ADREntry>;
  private patterns: Map<string, PatternEntry>;
  private lessons: Map<string, LessonEntry>;
  private searchCount: number;

  constructor(config: KnowledgeStoreConfig = {}) {
    super();

    this.config = {
      ...DEFAULT_KNOWLEDGE_STORE_CONFIG,
      ...config,
    };

    this.entries = new Map();
    this.adrs = new Map();
    this.patterns = new Map();
    this.lessons = new Map();
    this.searchCount = 0;
  }

  // ==========================================================================
  // Entry Management
  // ==========================================================================

  /**
   * Add a knowledge entry
   */
  addEntry(entry: Omit<KnowledgeEntry, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): KnowledgeEntry {
    const now = new Date();
    const newEntry: KnowledgeEntry = {
      ...entry,
      id: uuidv4(),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Check max entries
    if (this.entries.size >= this.config.maxEntries) {
      this.cleanup();
    }

    this.entries.set(newEntry.id, newEntry);
    this.emit('entry:added', newEntry);

    return newEntry;
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): KnowledgeEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      // Update usage stats
      entry.usageCount++;
      entry.lastUsedAt = new Date();
    }
    return entry;
  }

  /**
   * Update an entry
   */
  updateEntry(id: string, updates: Partial<Omit<KnowledgeEntry, 'id' | 'createdAt'>>): KnowledgeEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;

    const previous = { ...entry };
    const updated: KnowledgeEntry = {
      ...entry,
      ...updates,
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: new Date(),
    };

    this.entries.set(id, updated);
    this.emit('entry:updated', updated, previous);

    return updated;
  }

  /**
   * Delete an entry
   */
  deleteEntry(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    this.entries.delete(id);
    this.emit('entry:deleted', entry);

    return true;
  }

  // ==========================================================================
  // ADR Management
  // ==========================================================================

  /**
   * Add an Architecture Decision Record
   */
  addADR(adr: Omit<ADREntry, 'id' | 'createdAt' | 'updatedAt'>): ADREntry {
    const now = new Date();
    const newADR: ADREntry = {
      ...adr,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    this.adrs.set(newADR.id, newADR);

    // Also add as generic entry
    this.addEntry({
      type: 'adr',
      title: adr.title,
      content: `${adr.context}\n\n## Decision\n${adr.decision}\n\n## Consequences\n${adr.consequences}`,
      tags: [{ name: 'adr' }],
      status: adr.status,
      confidence: 'verified',
      metadata: { adrId: newADR.id },
    });

    this.emit('adr:added', newADR);
    return newADR;
  }

  /**
   * Get ADR by ID
   */
  getADR(id: string): ADREntry | undefined {
    return this.adrs.get(id);
  }

  /**
   * List all ADRs
   */
  listADRs(status?: KnowledgeStatus): ADREntry[] {
    const adrs = Array.from(this.adrs.values());
    if (status) {
      return adrs.filter(adr => adr.status === status);
    }
    return adrs;
  }

  /**
   * Update ADR status
   */
  updateADRStatus(id: string, status: KnowledgeStatus, supersededBy?: string): ADREntry | undefined {
    const adr = this.adrs.get(id);
    if (!adr) return undefined;

    adr.status = status;
    adr.updatedAt = new Date();
    if (supersededBy) {
      adr.supersededBy = supersededBy;
    }

    return adr;
  }

  // ==========================================================================
  // Pattern Management
  // ==========================================================================

  /**
   * Add a code pattern
   */
  addPattern(pattern: Omit<PatternEntry, 'id' | 'usageCount' | 'successRate' | 'createdAt' | 'updatedAt'>): PatternEntry {
    const now = new Date();
    const newPattern: PatternEntry = {
      ...pattern,
      id: uuidv4(),
      usageCount: 0,
      successRate: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.patterns.set(newPattern.id, newPattern);

    // Also add as generic entry
    this.addEntry({
      type: 'pattern',
      title: pattern.name,
      content: `${pattern.description}\n\n## Problem\n${pattern.problem}\n\n## Solution\n${pattern.solution}`,
      tags: [{ name: 'pattern', category: pattern.category }],
      status: 'accepted',
      confidence: pattern.confidence,
      metadata: { patternId: newPattern.id, language: pattern.language, framework: pattern.framework },
    });

    this.emit('pattern:added', newPattern);
    return newPattern;
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): PatternEntry | undefined {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.usageCount++;
    }
    return pattern;
  }

  /**
   * Record pattern usage result
   */
  recordPatternUsage(id: string, success: boolean): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.usageCount++;
      // Update success rate with weighted average
      const oldTotal = pattern.usageCount - 1;
      if (oldTotal > 0) {
        pattern.successRate = ((pattern.successRate * oldTotal) + (success ? 100 : 0)) / pattern.usageCount;
      } else {
        pattern.successRate = success ? 100 : 0;
      }
      pattern.updatedAt = new Date();
    }
  }

  /**
   * List patterns by category
   */
  listPatterns(category?: string, language?: string): PatternEntry[] {
    let patterns = Array.from(this.patterns.values());

    if (category) {
      patterns = patterns.filter(p => p.category === category);
    }
    if (language) {
      patterns = patterns.filter(p => p.language === language);
    }

    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  // ==========================================================================
  // Lesson Management
  // ==========================================================================

  /**
   * Add a lesson learned
   */
  addLesson(lesson: Omit<LessonEntry, 'id' | 'createdAt' | 'updatedAt'>): LessonEntry {
    const now = new Date();
    const newLesson: LessonEntry = {
      ...lesson,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    this.lessons.set(newLesson.id, newLesson);

    // Also add as generic entry
    this.addEntry({
      type: 'lesson',
      title: lesson.title,
      content: `${lesson.description}\n\n## What Happened\n${lesson.whatHappened}\n\n## What We Learned\n${lesson.whatWeLearned}`,
      tags: lesson.tags,
      status: 'accepted',
      confidence: lesson.confidence,
      metadata: { lessonId: newLesson.id, severity: lesson.severity },
    });

    this.emit('lesson:added', newLesson);
    return newLesson;
  }

  /**
   * Get lesson by ID
   */
  getLesson(id: string): LessonEntry | undefined {
    return this.lessons.get(id);
  }

  /**
   * List lessons by category
   */
  listLessons(category?: string, severity?: LessonEntry['severity']): LessonEntry[] {
    let lessons = Array.from(this.lessons.values());

    if (category) {
      lessons = lessons.filter(l => l.category === category);
    }
    if (severity) {
      lessons = lessons.filter(l => l.severity === severity);
    }

    return lessons.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ==========================================================================
  // Search
  // ==========================================================================

  /**
   * Search knowledge entries
   */
  search(options: KnowledgeSearchOptions = {}): KnowledgeSearchResult {
    this.searchCount++;
    let results = Array.from(this.entries.values());

    // Filter by types
    if (options.types && options.types.length > 0) {
      results = results.filter(e => options.types!.includes(e.type));
    }

    // Filter by status
    if (options.status && options.status.length > 0) {
      results = results.filter(e => options.status!.includes(e.status));
    }

    // Filter by confidence
    if (options.confidence && options.confidence.length > 0) {
      results = results.filter(e => options.confidence!.includes(e.confidence));
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(e =>
        e.tags.some(t => options.tags!.includes(t.name))
      );
    }

    // Text search - match any word from query
    if (options.query) {
      const queryWords = options.query.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2);

      if (queryWords.length > 0) {
        results = results.filter(e => {
          const entryText = `${e.title} ${e.content}`.toLowerCase();
          return queryWords.some(word => entryText.includes(word));
        });
      }
    }

    // Sort
    const sortBy = options.sortBy || 'relevance';
    const sortOrder = options.sortOrder || 'desc';
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    results.sort((a, b) => {
      switch (sortBy) {
        case 'createdAt':
          return multiplier * (a.createdAt.getTime() - b.createdAt.getTime());
        case 'updatedAt':
          return multiplier * (a.updatedAt.getTime() - b.updatedAt.getTime());
        case 'usageCount':
          return multiplier * (a.usageCount - b.usageCount);
        case 'relevance':
        default:
          // Relevance: combination of usage and recency
          const aScore = a.usageCount + (a.lastUsedAt ? 1 : 0);
          const bScore = b.usageCount + (b.lastUsedAt ? 1 : 0);
          return multiplier * (aScore - bScore);
      }
    });

    const total = results.length;

    // Pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    this.emit('search:performed', options, results.length);

    return {
      entries: results,
      total,
      query: options.query,
      filters: {
        types: options.types,
        tags: options.tags,
        status: options.status,
        confidence: options.confidence,
      },
    };
  }

  /**
   * Find similar entries
   */
  findSimilar(text: string, type?: KnowledgeType, limit: number = 5): KnowledgeEntry[] {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let entries = Array.from(this.entries.values());

    if (type) {
      entries = entries.filter(e => e.type === type);
    }

    // Score by word matches
    const scored = entries.map(entry => {
      const entryText = `${entry.title} ${entry.content}`.toLowerCase();
      const matchCount = words.filter(w => entryText.includes(w)).length;
      return { entry, score: matchCount / words.length };
    });

    return scored
      .filter(s => s.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  // ==========================================================================
  // Statistics & Maintenance
  // ==========================================================================

  /**
   * Get store statistics
   */
  getStats(): KnowledgeStoreStats {
    const entries = Array.from(this.entries.values());

    const entriesByType: Record<KnowledgeType, number> = {
      'adr': 0,
      'pattern': 0,
      'lesson': 0,
      'best-practice': 0,
      'anti-pattern': 0,
      'template': 0,
      'solution': 0,
    };

    const entriesByStatus: Record<KnowledgeStatus, number> = {
      'draft': 0,
      'proposed': 0,
      'accepted': 0,
      'deprecated': 0,
      'superseded': 0,
    };

    let totalUsage = 0;
    let oldest: Date | undefined;
    let newest: Date | undefined;

    for (const entry of entries) {
      entriesByType[entry.type]++;
      entriesByStatus[entry.status]++;
      totalUsage += entry.usageCount;

      if (!oldest || entry.createdAt < oldest) oldest = entry.createdAt;
      if (!newest || entry.createdAt > newest) newest = entry.createdAt;
    }

    return {
      totalEntries: entries.length,
      entriesByType,
      entriesByStatus,
      totalSearches: this.searchCount,
      averageUsageCount: entries.length > 0 ? totalUsage / entries.length : 0,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Cleanup old/unused entries
   */
  cleanup(): number {
    if (!this.config.autoCleanup) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupAfterDays);

    let deletedCount = 0;
    const entriesToDelete: string[] = [];

    for (const [id, entry] of this.entries) {
      // Don't delete high-usage or verified entries
      if (entry.usageCount > 10 || entry.confidence === 'verified') continue;

      // Delete old, unused entries
      if (entry.updatedAt < cutoffDate && entry.usageCount < 3) {
        entriesToDelete.push(id);
      }
    }

    for (const id of entriesToDelete) {
      this.entries.delete(id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      this.emit('cleanup:performed', deletedCount);
    }

    return deletedCount;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.adrs.clear();
    this.patterns.clear();
    this.lessons.clear();
    this.searchCount = 0;
  }

  /**
   * Get entry count
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Get store name
   */
  get name(): string {
    return this.config.name;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a knowledge store instance
 */
export function createKnowledgeStore(config: KnowledgeStoreConfig = {}): KnowledgeStore {
  return new KnowledgeStore(config);
}

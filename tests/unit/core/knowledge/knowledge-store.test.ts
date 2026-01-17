/**
 * Knowledge Store Tests
 *
 * Tests for the KnowledgeStore class.
 */

import {
  KnowledgeStore,
  createKnowledgeStore,
  DEFAULT_KNOWLEDGE_STORE_CONFIG,
  KnowledgeEntry,
  ADREntry,
  PatternEntry,
  LessonEntry,
} from '../../../../src/core/knowledge';

describe('KnowledgeStore', () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    store = new KnowledgeStore();
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(store.name).toBe(DEFAULT_KNOWLEDGE_STORE_CONFIG.name);
    });

    it('should accept custom configuration', () => {
      const customStore = new KnowledgeStore({ name: 'custom-store' });
      expect(customStore.name).toBe('custom-store');
    });

    it('should have sensible defaults', () => {
      expect(DEFAULT_KNOWLEDGE_STORE_CONFIG.maxEntries).toBe(10000);
      expect(DEFAULT_KNOWLEDGE_STORE_CONFIG.autoCleanup).toBe(true);
      expect(DEFAULT_KNOWLEDGE_STORE_CONFIG.cleanupAfterDays).toBe(365);
    });
  });

  // ============================================================================
  // Entry Management
  // ============================================================================

  describe('Entry Management', () => {
    it('should add entry and return with ID', () => {
      const entry = store.addEntry({
        type: 'pattern',
        title: 'Test Pattern',
        content: 'Test content',
        tags: [{ name: 'test' }],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });

      expect(entry.id).toBeDefined();
      expect(entry.title).toBe('Test Pattern');
      expect(entry.usageCount).toBe(0);
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('should get entry by ID and increment usage', () => {
      const created = store.addEntry({
        type: 'solution',
        title: 'Test Solution',
        content: 'Solution content',
        tags: [],
        status: 'accepted',
        confidence: 'medium',
        metadata: {},
      });

      const retrieved = store.getEntry(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.usageCount).toBe(1);
      expect(retrieved!.lastUsedAt).toBeDefined();
    });

    it('should return undefined for non-existent entry', () => {
      const entry = store.getEntry('non-existent-id');
      expect(entry).toBeUndefined();
    });

    it('should update entry', () => {
      const created = store.addEntry({
        type: 'pattern',
        title: 'Original Title',
        content: 'Original content',
        tags: [],
        status: 'draft',
        confidence: 'low',
        metadata: {},
      });

      const updated = store.updateEntry(created.id, {
        title: 'Updated Title',
        status: 'accepted',
      });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.status).toBe('accepted');
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime());
    });

    it('should delete entry', () => {
      const created = store.addEntry({
        type: 'lesson',
        title: 'To Delete',
        content: 'Content',
        tags: [],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });

      expect(store.deleteEntry(created.id)).toBe(true);
      expect(store.getEntry(created.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent entry', () => {
      expect(store.deleteEntry('non-existent')).toBe(false);
    });
  });

  // ============================================================================
  // ADR Management
  // ============================================================================

  describe('ADR Management', () => {
    it('should add ADR', () => {
      const adr = store.addADR({
        title: 'Use TypeScript',
        status: 'accepted',
        context: 'Need type safety',
        decision: 'Adopt TypeScript',
        consequences: 'Better IDE support',
      });

      expect(adr.id).toBeDefined();
      expect(adr.title).toBe('Use TypeScript');
      expect(adr.status).toBe('accepted');
    });

    it('should also create generic entry for ADR', () => {
      store.addADR({
        title: 'Test ADR',
        status: 'proposed',
        context: 'Context',
        decision: 'Decision',
        consequences: 'Consequences',
      });

      const entries = store.search({ types: ['adr'] });
      expect(entries.entries.length).toBeGreaterThan(0);
    });

    it('should get ADR by ID', () => {
      const created = store.addADR({
        title: 'Get Test',
        status: 'accepted',
        context: 'Context',
        decision: 'Decision',
        consequences: 'Consequences',
      });

      const retrieved = store.getADR(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Get Test');
    });

    it('should list all ADRs', () => {
      store.addADR({
        title: 'ADR 1',
        status: 'accepted',
        context: 'C1',
        decision: 'D1',
        consequences: 'R1',
      });
      store.addADR({
        title: 'ADR 2',
        status: 'deprecated',
        context: 'C2',
        decision: 'D2',
        consequences: 'R2',
      });

      expect(store.listADRs().length).toBe(2);
      expect(store.listADRs('accepted').length).toBe(1);
      expect(store.listADRs('deprecated').length).toBe(1);
    });

    it('should update ADR status', () => {
      const adr = store.addADR({
        title: 'Status Update Test',
        status: 'accepted',
        context: 'C',
        decision: 'D',
        consequences: 'R',
      });

      const updated = store.updateADRStatus(adr.id, 'superseded', 'new-adr-id');
      expect(updated!.status).toBe('superseded');
      expect(updated!.supersededBy).toBe('new-adr-id');
    });
  });

  // ============================================================================
  // Pattern Management
  // ============================================================================

  describe('Pattern Management', () => {
    it('should add pattern', () => {
      const pattern = store.addPattern({
        name: 'Repository Pattern',
        description: 'Abstract data access',
        category: 'architecture',
        language: 'typescript',
        problem: 'Coupled data access',
        solution: 'Use repository interface',
        whenToUse: ['Complex queries', 'Multiple data sources'],
        whenNotToUse: ['Simple CRUD'],
        confidence: 'high',
      });

      expect(pattern.id).toBeDefined();
      expect(pattern.name).toBe('Repository Pattern');
      expect(pattern.usageCount).toBe(0);
      expect(pattern.successRate).toBe(0);
    });

    it('should get pattern and increment usage', () => {
      const created = store.addPattern({
        name: 'Test Pattern',
        description: 'Description',
        category: 'test',
        problem: 'Problem',
        solution: 'Solution',
        whenToUse: [],
        whenNotToUse: [],
        confidence: 'medium',
      });

      const retrieved = store.getPattern(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.usageCount).toBe(1);
    });

    it('should record pattern usage success', () => {
      const pattern = store.addPattern({
        name: 'Success Pattern',
        description: 'D',
        category: 'test',
        problem: 'P',
        solution: 'S',
        whenToUse: [],
        whenNotToUse: [],
        confidence: 'high',
      });

      store.recordPatternUsage(pattern.id, true);
      expect(store.getPattern(pattern.id)!.successRate).toBe(100);

      store.recordPatternUsage(pattern.id, false);
      // (100 * 2 + 0) / 3 = 66.67
      expect(store.getPattern(pattern.id)!.successRate).toBeCloseTo(66.67, 0);
    });

    it('should list patterns by category', () => {
      store.addPattern({
        name: 'Pattern A',
        description: 'D',
        category: 'arch',
        language: 'typescript',
        problem: 'P',
        solution: 'S',
        whenToUse: [],
        whenNotToUse: [],
        confidence: 'high',
      });
      store.addPattern({
        name: 'Pattern B',
        description: 'D',
        category: 'design',
        language: 'typescript',
        problem: 'P',
        solution: 'S',
        whenToUse: [],
        whenNotToUse: [],
        confidence: 'medium',
      });

      expect(store.listPatterns('arch').length).toBe(1);
      expect(store.listPatterns(undefined, 'typescript').length).toBe(2);
    });
  });

  // ============================================================================
  // Lesson Management
  // ============================================================================

  describe('Lesson Management', () => {
    it('should add lesson', () => {
      const lesson = store.addLesson({
        title: 'Null Check Lesson',
        description: 'Always check for null',
        context: 'Production bug',
        whatHappened: 'NPE in production',
        whatWeLearned: 'Add null checks',
        recommendedActions: ['Add null checks', 'Use optional chaining'],
        severity: 'error',
        category: 'bugs',
        tags: [{ name: 'null-safety' }],
        confidence: 'verified',
      });

      expect(lesson.id).toBeDefined();
      expect(lesson.title).toBe('Null Check Lesson');
      expect(lesson.severity).toBe('error');
    });

    it('should get lesson by ID', () => {
      const created = store.addLesson({
        title: 'Get Lesson Test',
        description: 'D',
        context: 'C',
        whatHappened: 'W',
        whatWeLearned: 'L',
        recommendedActions: [],
        severity: 'info',
        category: 'test',
        tags: [],
        confidence: 'high',
      });

      const retrieved = store.getLesson(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Get Lesson Test');
    });

    it('should list lessons by category and severity', () => {
      store.addLesson({
        title: 'Lesson 1',
        description: 'D',
        context: 'C',
        whatHappened: 'W',
        whatWeLearned: 'L',
        recommendedActions: [],
        severity: 'error',
        category: 'bugs',
        tags: [],
        confidence: 'high',
      });
      store.addLesson({
        title: 'Lesson 2',
        description: 'D',
        context: 'C',
        whatHappened: 'W',
        whatWeLearned: 'L',
        recommendedActions: [],
        severity: 'warning',
        category: 'performance',
        tags: [],
        confidence: 'medium',
      });

      expect(store.listLessons('bugs').length).toBe(1);
      expect(store.listLessons(undefined, 'error').length).toBe(1);
      expect(store.listLessons().length).toBe(2);
    });
  });

  // ============================================================================
  // Search
  // ============================================================================

  describe('Search', () => {
    beforeEach(() => {
      store.addEntry({
        type: 'pattern',
        title: 'React Hooks Pattern',
        content: 'Use hooks for state management in React',
        tags: [{ name: 'react' }, { name: 'hooks' }],
        status: 'accepted',
        confidence: 'high',
        metadata: { language: 'typescript', framework: 'react' },
      });
      store.addEntry({
        type: 'solution',
        title: 'API Error Handling',
        content: 'Handle API errors with try-catch and proper messaging',
        tags: [{ name: 'api' }, { name: 'errors' }],
        status: 'accepted',
        confidence: 'medium',
        metadata: { language: 'typescript' },
      });
      store.addEntry({
        type: 'anti-pattern',
        title: 'Callback Hell',
        content: 'Avoid nested callbacks, use async/await instead',
        tags: [{ name: 'async' }],
        status: 'accepted',
        confidence: 'verified',
        metadata: {},
      });
    });

    it('should search by query text', () => {
      const results = store.search({ query: 'react hooks' });
      expect(results.entries.length).toBeGreaterThan(0);
      expect(results.entries[0].title).toContain('React');
    });

    it('should filter by type', () => {
      const results = store.search({ types: ['anti-pattern'] });
      expect(results.entries.length).toBe(1);
      expect(results.entries[0].type).toBe('anti-pattern');
    });

    it('should filter by tags', () => {
      const results = store.search({ tags: ['react'] });
      expect(results.entries.length).toBe(1);
      expect(results.entries[0].tags.some(t => t.name === 'react')).toBe(true);
    });

    it('should filter by status', () => {
      const results = store.search({ status: ['accepted'] });
      expect(results.total).toBe(3);
    });

    it('should filter by confidence', () => {
      const results = store.search({ confidence: ['verified'] });
      expect(results.entries.length).toBe(1);
    });

    it('should sort by different criteria', () => {
      const byCreated = store.search({ sortBy: 'createdAt', sortOrder: 'desc' });
      expect(byCreated.entries.length).toBeGreaterThan(0);

      const byUsage = store.search({ sortBy: 'usageCount', sortOrder: 'desc' });
      expect(byUsage.entries.length).toBeGreaterThan(0);
    });

    it('should paginate results', () => {
      const page1 = store.search({ limit: 1, offset: 0 });
      const page2 = store.search({ limit: 1, offset: 1 });

      expect(page1.entries.length).toBe(1);
      expect(page2.entries.length).toBe(1);
      expect(page1.entries[0].id).not.toBe(page2.entries[0].id);
    });

    it('should return total count with pagination', () => {
      const results = store.search({ limit: 1 });
      expect(results.entries.length).toBe(1);
      expect(results.total).toBe(3);
    });
  });

  // ============================================================================
  // Find Similar
  // ============================================================================

  describe('Find Similar', () => {
    beforeEach(() => {
      store.addEntry({
        type: 'pattern',
        title: 'Database Connection Pool',
        content: 'Use connection pooling for database access to improve performance',
        tags: [{ name: 'database' }],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });
      store.addEntry({
        type: 'pattern',
        title: 'HTTP Connection Pool',
        content: 'Use HTTP connection pooling for API calls to improve throughput',
        tags: [{ name: 'http' }],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });
    });

    it('should find similar entries', () => {
      const similar = store.findSimilar('connection pooling database');
      expect(similar.length).toBeGreaterThan(0);
    });

    it('should filter by type', () => {
      const similar = store.findSimilar('connection pooling', 'pattern');
      expect(similar.every(e => e.type === 'pattern')).toBe(true);
    });

    it('should limit results', () => {
      const similar = store.findSimilar('connection pooling', undefined, 1);
      expect(similar.length).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics', () => {
    it('should track entry counts by type', () => {
      store.addEntry({
        type: 'pattern',
        title: 'P1',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });
      store.addEntry({
        type: 'lesson',
        title: 'L1',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'medium',
        metadata: {},
      });

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.entriesByType['pattern']).toBe(1);
      expect(stats.entriesByType['lesson']).toBe(1);
    });

    it('should track search count', () => {
      store.search({ query: 'test1' });
      store.search({ query: 'test2' });

      const stats = store.getStats();
      expect(stats.totalSearches).toBe(2);
    });

    it('should calculate average usage', () => {
      const entry1 = store.addEntry({
        type: 'pattern',
        title: 'P1',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });

      store.getEntry(entry1.id); // usage +1
      store.getEntry(entry1.id); // usage +1

      const stats = store.getStats();
      expect(stats.averageUsageCount).toBe(2);
    });

    it('should track oldest and newest entries', () => {
      store.addEntry({
        type: 'pattern',
        title: 'First',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });

      const stats = store.getStats();
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    it('should not cleanup verified entries', () => {
      const entry = store.addEntry({
        type: 'pattern',
        title: 'Verified',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'verified',
        metadata: {},
      });

      // Force old updatedAt
      const e = store.getEntry(entry.id)!;
      (e as any).updatedAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

      store.cleanup();
      expect(store.getEntry(entry.id)).toBeDefined();
    });

    it('should not cleanup high-usage entries', () => {
      const entry = store.addEntry({
        type: 'pattern',
        title: 'Popular',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'low',
        metadata: {},
      });

      // Simulate high usage
      for (let i = 0; i < 15; i++) {
        store.getEntry(entry.id);
      }

      // Force old updatedAt
      const e = store.getEntry(entry.id)!;
      (e as any).updatedAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

      store.cleanup();
      expect(store.getEntry(entry.id)).toBeDefined();
    });
  });

  // ============================================================================
  // Clear
  // ============================================================================

  describe('Clear', () => {
    it('should clear all entries', () => {
      store.addEntry({
        type: 'pattern',
        title: 'P1',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });
      store.addADR({
        title: 'ADR',
        status: 'accepted',
        context: 'C',
        decision: 'D',
        consequences: 'R',
      });

      store.clear();

      expect(store.size).toBe(0);
      expect(store.listADRs().length).toBe(0);
    });
  });

  // ============================================================================
  // Events
  // ============================================================================

  describe('Events', () => {
    it('should emit entry:added event', (done) => {
      store.on('entry:added', (entry: KnowledgeEntry) => {
        expect(entry.title).toBe('Event Test');
        done();
      });

      store.addEntry({
        type: 'pattern',
        title: 'Event Test',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });
    });

    it('should emit entry:updated event', (done) => {
      const entry = store.addEntry({
        type: 'pattern',
        title: 'Original',
        content: 'C',
        tags: [],
        status: 'draft',
        confidence: 'low',
        metadata: {},
      });

      store.on('entry:updated', (updated: KnowledgeEntry, previous: KnowledgeEntry) => {
        expect(updated.title).toBe('Updated');
        expect(previous.title).toBe('Original');
        done();
      });

      store.updateEntry(entry.id, { title: 'Updated' });
    });

    it('should emit entry:deleted event', (done) => {
      const entry = store.addEntry({
        type: 'pattern',
        title: 'To Delete',
        content: 'C',
        tags: [],
        status: 'accepted',
        confidence: 'high',
        metadata: {},
      });

      store.on('entry:deleted', (deleted: KnowledgeEntry) => {
        expect(deleted.id).toBe(entry.id);
        done();
      });

      store.deleteEntry(entry.id);
    });

    it('should emit adr:added event', (done) => {
      store.on('adr:added', (adr: ADREntry) => {
        expect(adr.title).toBe('ADR Event');
        done();
      });

      store.addADR({
        title: 'ADR Event',
        status: 'accepted',
        context: 'C',
        decision: 'D',
        consequences: 'R',
      });
    });

    it('should emit pattern:added event', (done) => {
      store.on('pattern:added', (pattern: PatternEntry) => {
        expect(pattern.name).toBe('Pattern Event');
        done();
      });

      store.addPattern({
        name: 'Pattern Event',
        description: 'D',
        category: 'test',
        problem: 'P',
        solution: 'S',
        whenToUse: [],
        whenNotToUse: [],
        confidence: 'high',
      });
    });

    it('should emit lesson:added event', (done) => {
      store.on('lesson:added', (lesson: LessonEntry) => {
        expect(lesson.title).toBe('Lesson Event');
        done();
      });

      store.addLesson({
        title: 'Lesson Event',
        description: 'D',
        context: 'C',
        whatHappened: 'W',
        whatWeLearned: 'L',
        recommendedActions: [],
        severity: 'info',
        category: 'test',
        tags: [],
        confidence: 'high',
      });
    });
  });

  // ============================================================================
  // Factory Function
  // ============================================================================

  describe('Factory Function', () => {
    it('should create store with defaults', () => {
      const created = createKnowledgeStore();
      expect(created).toBeInstanceOf(KnowledgeStore);
      expect(created.name).toBe('knowledge-store');
    });

    it('should create store with custom config', () => {
      const created = createKnowledgeStore({ name: 'custom' });
      expect(created.name).toBe('custom');
    });
  });
});

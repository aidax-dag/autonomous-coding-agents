/**
 * ConfidenceChecker Tests - TDD RED Phase
 *
 * F001-ConfidenceChecker: Pre-execution confidence checking system
 * Tests written first following RED-GREEN TDD pattern
 */

import {
  ConfidenceChecker,
  createConfidenceChecker,
  DEFAULT_CHECK_ITEMS,
  type TaskContext,
  type ConfidenceCheckItem,
  type IConfidenceChecker,
} from '@/core/validation/confidence-checker.js';

describe('ConfidenceChecker', () => {
  let checker: IConfidenceChecker;

  beforeEach(() => {
    checker = createConfidenceChecker();
  });

  describe('Basic Instantiation', () => {
    it('should create a ConfidenceChecker instance', () => {
      expect(checker).toBeDefined();
      expect(checker).toBeInstanceOf(ConfidenceChecker);
    });

    it('should have default check items', () => {
      expect(DEFAULT_CHECK_ITEMS).toBeDefined();
      expect(Array.isArray(DEFAULT_CHECK_ITEMS)).toBe(true);
      expect(DEFAULT_CHECK_ITEMS.length).toBe(5);
    });

    it('should have default thresholds (90% proceed, 70% alternatives)', () => {
      // Thresholds are tested via check() results
      expect(checker).toBeDefined();
    });
  });

  describe('DEFAULT_CHECK_ITEMS', () => {
    it('should contain duplicate_check_complete with weight 0.25', () => {
      const item = DEFAULT_CHECK_ITEMS.find(i => i.name === 'duplicate_check_complete');
      expect(item).toBeDefined();
      expect(item?.weight).toBe(0.25);
    });

    it('should contain architecture_check_complete with weight 0.25', () => {
      const item = DEFAULT_CHECK_ITEMS.find(i => i.name === 'architecture_check_complete');
      expect(item).toBeDefined();
      expect(item?.weight).toBe(0.25);
    });

    it('should contain official_docs_verified with weight 0.20', () => {
      const item = DEFAULT_CHECK_ITEMS.find(i => i.name === 'official_docs_verified');
      expect(item).toBeDefined();
      expect(item?.weight).toBe(0.20);
    });

    it('should contain oss_reference_complete with weight 0.15', () => {
      const item = DEFAULT_CHECK_ITEMS.find(i => i.name === 'oss_reference_complete');
      expect(item).toBeDefined();
      expect(item?.weight).toBe(0.15);
    });

    it('should contain root_cause_identified with weight 0.15', () => {
      const item = DEFAULT_CHECK_ITEMS.find(i => i.name === 'root_cause_identified');
      expect(item).toBeDefined();
      expect(item?.weight).toBe(0.15);
    });

    it('should have weights that sum to 1.0', () => {
      const totalWeight = DEFAULT_CHECK_ITEMS.reduce((sum, item) => sum + item.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });
  });

  describe('check()', () => {
    const mockContext: TaskContext = {
      taskId: 'task-001',
      taskType: 'implementation',
      description: 'Implement user authentication',
      files: ['src/auth/login.ts'],
      dependencies: ['bcrypt', 'jsonwebtoken'],
      complexity: 'moderate',
    };

    it('should return ConfidenceCheckResult with required fields', async () => {
      const result = await checker.check(mockContext);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('threshold');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('recommendation');
    });

    it('should return score between 0 and 100', async () => {
      const result = await checker.check(mockContext);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return items array with check results', async () => {
      const result = await checker.check(mockContext);

      expect(Array.isArray(result.items)).toBe(true);
      result.items.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('passed');
        expect(item).toHaveProperty('weight');
        expect(typeof item.name).toBe('string');
        expect(typeof item.passed).toBe('boolean');
        expect(typeof item.weight).toBe('number');
      });
    });

    it('should return recommendation as proceed, alternatives, or stop', async () => {
      const result = await checker.check(mockContext);

      expect(['proceed', 'alternatives', 'stop']).toContain(result.recommendation);
    });
  });

  describe('Threshold Logic', () => {
    it('should recommend "proceed" when score >= 90', async () => {
      // Create checker with all-passing items
      const allPassChecker = createConfidenceChecker({
        checkItems: [
          { name: 'test1', weight: 0.5, check: async () => true },
          { name: 'test2', weight: 0.5, check: async () => true },
        ],
      });

      const result = await allPassChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      expect(result.score).toBe(100);
      expect(result.recommendation).toBe('proceed');
      expect(result.passed).toBe(true);
    });

    it('should recommend "alternatives" when 70 <= score < 90', async () => {
      // Create checker with 80% passing
      const partialPassChecker = createConfidenceChecker({
        checkItems: [
          { name: 'test1', weight: 0.4, check: async () => true },
          { name: 'test2', weight: 0.4, check: async () => true },
          { name: 'test3', weight: 0.2, check: async () => false },
        ],
      });

      const result = await partialPassChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      expect(result.score).toBe(80);
      expect(result.recommendation).toBe('alternatives');
      expect(result.passed).toBe(false);
    });

    it('should recommend "stop" when score < 70', async () => {
      // Create checker with low passing rate
      const lowPassChecker = createConfidenceChecker({
        checkItems: [
          { name: 'test1', weight: 0.5, check: async () => true },
          { name: 'test2', weight: 0.5, check: async () => false },
        ],
      });

      const result = await lowPassChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      expect(result.score).toBe(50);
      expect(result.recommendation).toBe('stop');
      expect(result.passed).toBe(false);
    });
  });

  describe('setCheckItems()', () => {
    it('should allow setting custom check items', async () => {
      const customItems: ConfidenceCheckItem[] = [
        {
          name: 'custom_check_1',
          weight: 0.6,
          check: async () => true,
          description: 'Custom check 1',
        },
        {
          name: 'custom_check_2',
          weight: 0.4,
          check: async () => false,
          description: 'Custom check 2',
        },
      ];

      checker.setCheckItems(customItems);
      const result = await checker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      expect(result.items.length).toBe(2);
      expect(result.items.find(i => i.name === 'custom_check_1')).toBeDefined();
      expect(result.items.find(i => i.name === 'custom_check_2')).toBeDefined();
    });

    it('should validate that weights sum to approximately 1.0', () => {
      const invalidItems: ConfidenceCheckItem[] = [
        { name: 'test1', weight: 0.3, check: async () => true },
        { name: 'test2', weight: 0.3, check: async () => true },
        // Total: 0.6, not 1.0
      ];

      expect(() => checker.setCheckItems(invalidItems)).toThrow();
    });

    it('should validate that weights are between 0 and 1', () => {
      const invalidItems: ConfidenceCheckItem[] = [
        { name: 'test1', weight: 1.5, check: async () => true },
        { name: 'test2', weight: -0.5, check: async () => true },
      ];

      expect(() => checker.setCheckItems(invalidItems)).toThrow();
    });
  });

  describe('setThresholds()', () => {
    it('should allow setting custom thresholds', async () => {
      checker.setThresholds(80, 60);

      // Create checker with 75% passing rate
      const customChecker = createConfidenceChecker({
        checkItems: [
          { name: 'test1', weight: 0.75, check: async () => true },
          { name: 'test2', weight: 0.25, check: async () => false },
        ],
      });
      customChecker.setThresholds(80, 60);

      const result = await customChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      expect(result.score).toBe(75);
      expect(result.recommendation).toBe('alternatives'); // 60 <= 75 < 80
    });

    it('should validate that proceed threshold > alternatives threshold', () => {
      expect(() => checker.setThresholds(50, 70)).toThrow();
    });

    it('should validate that thresholds are between 0 and 100', () => {
      expect(() => checker.setThresholds(110, 50)).toThrow();
      expect(() => checker.setThresholds(90, -10)).toThrow();
    });
  });

  describe('Context Handling', () => {
    it('should pass context to check functions', async () => {
      let receivedContext: TaskContext | null = null;

      const contextChecker = createConfidenceChecker({
        checkItems: [
          {
            name: 'context_test',
            weight: 1.0,
            check: async (ctx) => {
              receivedContext = ctx;
              return true;
            },
          },
        ],
      });

      const testContext: TaskContext = {
        taskId: 'ctx-test-001',
        taskType: 'bug-fix',
        description: 'Fix authentication bug',
        files: ['src/auth.ts'],
        complexity: 'simple',
      };

      await contextChecker.check(testContext);

      expect(receivedContext).toEqual(testContext);
    });

    it('should handle minimal context (only required fields)', async () => {
      const minimalContext: TaskContext = {
        taskId: 'min-001',
        taskType: 'task',
        description: 'Minimal task',
      };

      const result = await checker.check(minimalContext);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle check function errors gracefully', async () => {
      const errorChecker = createConfidenceChecker({
        checkItems: [
          {
            name: 'error_check',
            weight: 0.5,
            check: async () => {
              throw new Error('Check failed');
            },
          },
          {
            name: 'success_check',
            weight: 0.5,
            check: async () => true,
          },
        ],
      });

      const result = await errorChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      // Error should be treated as failed check
      expect(result.score).toBe(50);
      expect(result.items.find(i => i.name === 'error_check')?.passed).toBe(false);
    });

    it('should include explanation when score is below threshold', async () => {
      const lowScoreChecker = createConfidenceChecker({
        checkItems: [
          { name: 'failing_check', weight: 1.0, check: async () => false },
        ],
      });

      const result = await lowScoreChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      expect(result.explanation).toBeDefined();
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation!.length).toBeGreaterThan(0);
    });
  });

  describe('Async Check Execution', () => {
    it('should execute all checks in parallel', async () => {
      const executionOrder: string[] = [];

      const parallelChecker = createConfidenceChecker({
        checkItems: [
          {
            name: 'slow_check',
            weight: 0.5,
            check: async () => {
              await new Promise(r => setTimeout(r, 50));
              executionOrder.push('slow');
              return true;
            },
          },
          {
            name: 'fast_check',
            weight: 0.5,
            check: async () => {
              executionOrder.push('fast');
              return true;
            },
          },
        ],
      });

      const startTime = Date.now();
      await parallelChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });
      const elapsed = Date.now() - startTime;

      // If parallel, should complete in ~50ms; if sequential, ~50ms+ for slow alone
      // Fast should complete first if parallel
      expect(executionOrder[0]).toBe('fast');
      expect(elapsed).toBeLessThan(250); // Allow CI/load jitter while preserving parallelism signal
    });
  });

  describe('Factory Function', () => {
    it('should create checker with default options', () => {
      const defaultChecker = createConfidenceChecker();
      expect(defaultChecker).toBeInstanceOf(ConfidenceChecker);
    });

    it('should create checker with custom check items', () => {
      const customChecker = createConfidenceChecker({
        checkItems: [
          { name: 'custom', weight: 1.0, check: async () => true },
        ],
      });
      expect(customChecker).toBeInstanceOf(ConfidenceChecker);
    });

    it('should create checker with custom thresholds', () => {
      const customChecker = createConfidenceChecker({
        proceedThreshold: 85,
        alternativesThreshold: 65,
      });
      expect(customChecker).toBeInstanceOf(ConfidenceChecker);
    });

    it('should create checker with all custom options', async () => {
      const customChecker = createConfidenceChecker({
        checkItems: [
          { name: 'custom', weight: 1.0, check: async () => true },
        ],
        proceedThreshold: 85,
        alternativesThreshold: 65,
      });

      const result = await customChecker.check({
        taskId: 'test',
        taskType: 'test',
        description: 'test',
      });

      expect(result.score).toBe(100);
      expect(result.recommendation).toBe('proceed');
    });
  });
});

describe('TaskContext Interface', () => {
  it('should accept valid TaskContext', () => {
    const context: TaskContext = {
      taskId: 'task-123',
      taskType: 'implementation',
      description: 'Implement feature X',
      files: ['src/feature.ts', 'src/feature.test.ts'],
      dependencies: ['lodash'],
      complexity: 'complex',
    };

    expect(context.taskId).toBe('task-123');
    expect(context.complexity).toBe('complex');
  });

  it('should accept TaskContext with only required fields', () => {
    const minimalContext: TaskContext = {
      taskId: 'min-task',
      taskType: 'bug-fix',
      description: 'Fix bug',
    };

    expect(minimalContext.files).toBeUndefined();
    expect(minimalContext.dependencies).toBeUndefined();
    expect(minimalContext.complexity).toBeUndefined();
  });
});

describe('ConfidenceCheckItem Interface', () => {
  it('should accept valid ConfidenceCheckItem', () => {
    const item: ConfidenceCheckItem = {
      name: 'test_check',
      weight: 0.5,
      check: async () => true,
      description: 'Test check description',
    };

    expect(item.name).toBe('test_check');
    expect(item.weight).toBe(0.5);
    expect(typeof item.check).toBe('function');
    expect(item.description).toBe('Test check description');
  });

  it('should accept ConfidenceCheckItem without description', () => {
    const item: ConfidenceCheckItem = {
      name: 'no_desc_check',
      weight: 0.3,
      check: async () => false,
    };

    expect(item.description).toBeUndefined();
  });
});

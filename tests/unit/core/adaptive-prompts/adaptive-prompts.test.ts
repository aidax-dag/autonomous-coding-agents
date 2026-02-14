/**
 * Tests for Adaptive Prompts — FeedbackTracker, PromptOptimizer, A/B Testing
 */

import { FeedbackTracker } from '@/core/adaptive-prompts/feedback-tracker';
import { PromptOptimizer } from '@/core/adaptive-prompts/prompt-optimizer';
import type { PromptFeedback, PromptModification } from '@/core/adaptive-prompts/types';
import { DEFAULT_ADAPTIVE_CONFIG } from '@/core/adaptive-prompts/types';

// ─── Helpers ───────────────────────────────────────────────────

function makeFeedback(overrides: Partial<PromptFeedback> = {}): PromptFeedback {
  return {
    templateId: 'tpl-1',
    taskId: 'task-1',
    success: true,
    tokensUsed: 500,
    qualityScore: 0.8,
    executionTime: 1000,
    agentType: 'coder',
    timestamp: new Date().toISOString(),
    context: {},
    ...overrides,
  };
}

function makeModification(overrides: Partial<PromptModification> = {}): PromptModification {
  return {
    type: 'add-context',
    description: 'Add more context',
    content: 'Additional context here.',
    ...overrides,
  };
}

/**
 * Feed N feedbacks into a tracker or optimizer for a template,
 * with optional per-item overrides.
 */
function feedMany(
  target: FeedbackTracker | PromptOptimizer,
  templateId: string,
  count: number,
  overrideFn?: (i: number) => Partial<PromptFeedback>,
): void {
  const recordFn =
    target instanceof FeedbackTracker
      ? (f: PromptFeedback) => target.record(f)
      : (f: PromptFeedback) => target.recordFeedback(f);

  for (let i = 0; i < count; i++) {
    const overrides = overrideFn ? overrideFn(i) : {};
    recordFn(
      makeFeedback({
        templateId,
        taskId: `task-${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        ...overrides,
      }),
    );
  }
}

// ─── FeedbackTracker ───────────────────────────────────────────

describe('FeedbackTracker', () => {
  let tracker: FeedbackTracker;

  beforeEach(() => {
    tracker = new FeedbackTracker();
  });

  it('should record feedback for a template', () => {
    tracker.record(makeFeedback({ templateId: 'tpl-1' }));

    const templates = tracker.getTrackedTemplates();
    expect(templates).toContain('tpl-1');
  });

  it('should record multiple feedbacks for the same template', () => {
    feedMany(tracker, 'tpl-1', 3);

    const perf = tracker.getPerformance('tpl-1');
    expect(perf.totalUses).toBe(3);
  });

  it('should compute correct success rate', () => {
    feedMany(tracker, 'tpl-1', 4, (i) => ({
      success: i < 3, // 3 success, 1 failure
    }));

    const perf = tracker.getPerformance('tpl-1');
    expect(perf.successRate).toBe(0.75);
  });

  it('should compute correct average tokens', () => {
    feedMany(tracker, 'tpl-1', 3, (i) => ({
      tokensUsed: (i + 1) * 100, // 100, 200, 300
    }));

    const perf = tracker.getPerformance('tpl-1');
    expect(perf.avgTokens).toBe(200);
  });

  it('should compute correct average quality', () => {
    feedMany(tracker, 'tpl-1', 2, (i) => ({
      qualityScore: i === 0 ? 0.6 : 0.8,
    }));

    const perf = tracker.getPerformance('tpl-1');
    expect(perf.avgQuality).toBe(0.7);
  });

  it('should compute correct average execution time', () => {
    feedMany(tracker, 'tpl-1', 2, (i) => ({
      executionTime: i === 0 ? 1000 : 3000,
    }));

    const perf = tracker.getPerformance('tpl-1');
    expect(perf.avgExecutionTime).toBe(2000);
  });

  it('should return zero-value performance for unknown template', () => {
    const perf = tracker.getPerformance('nonexistent');

    expect(perf.totalUses).toBe(0);
    expect(perf.successRate).toBe(0);
    expect(perf.avgTokens).toBe(0);
    expect(perf.avgQuality).toBe(0);
    expect(perf.avgExecutionTime).toBe(0);
  });

  it('should get recent feedbacks ordered by newest first', () => {
    feedMany(tracker, 'tpl-1', 5);

    const recent = tracker.getRecentFeedbacks('tpl-1', 3);
    expect(recent).toHaveLength(3);
    // Newest should be first
    expect(new Date(recent[0].timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(recent[1].timestamp).getTime(),
    );
  });

  it('should return all feedbacks when count not specified', () => {
    feedMany(tracker, 'tpl-1', 5);

    const all = tracker.getRecentFeedbacks('tpl-1');
    expect(all).toHaveLength(5);
  });

  it('should return empty array for unknown template recent feedbacks', () => {
    const recent = tracker.getRecentFeedbacks('nonexistent', 3);
    expect(recent).toEqual([]);
  });

  it('should compare performance and identify better template', () => {
    feedMany(tracker, 'tpl-a', 5, () => ({ qualityScore: 0.9, success: true }));
    feedMany(tracker, 'tpl-b', 5, () => ({ qualityScore: 0.5, success: false }));

    const result = tracker.comparePerformance('tpl-a', 'tpl-b');
    expect(result.better).toBe('tpl-a');
    expect(result.improvement).toBeGreaterThan(0);
  });

  it('should compare performance with equal templates', () => {
    feedMany(tracker, 'tpl-a', 5, () => ({ qualityScore: 0.7, success: true }));
    feedMany(tracker, 'tpl-b', 5, () => ({ qualityScore: 0.7, success: true }));

    const result = tracker.comparePerformance('tpl-a', 'tpl-b');
    expect(result.improvement).toBe(0);
  });

  it('should detect improving trend', () => {
    feedMany(tracker, 'tpl-1', 10, (i) => ({
      qualityScore: i < 5 ? 0.4 : 0.8, // first half low, second half high
    }));

    const trend = tracker.getTrend('tpl-1');
    expect(trend).toBe('improving');
  });

  it('should detect declining trend', () => {
    feedMany(tracker, 'tpl-1', 10, (i) => ({
      qualityScore: i < 5 ? 0.8 : 0.4, // first half high, second half low
    }));

    const trend = tracker.getTrend('tpl-1');
    expect(trend).toBe('declining');
  });

  it('should detect stable trend', () => {
    feedMany(tracker, 'tpl-1', 10, () => ({
      qualityScore: 0.7, // all the same
    }));

    const trend = tracker.getTrend('tpl-1');
    expect(trend).toBe('stable');
  });

  it('should return stable for insufficient data', () => {
    feedMany(tracker, 'tpl-1', 2);

    const trend = tracker.getTrend('tpl-1');
    expect(trend).toBe('stable');
  });

  it('should clear all tracked data', () => {
    feedMany(tracker, 'tpl-1', 5);
    feedMany(tracker, 'tpl-2', 3);

    tracker.clear();

    expect(tracker.getTrackedTemplates()).toHaveLength(0);
    expect(tracker.getPerformance('tpl-1').totalUses).toBe(0);
  });

  it('should list all tracked templates', () => {
    feedMany(tracker, 'tpl-a', 2);
    feedMany(tracker, 'tpl-b', 1);

    const tracked = tracker.getTrackedTemplates();
    expect(tracked).toContain('tpl-a');
    expect(tracked).toContain('tpl-b');
    expect(tracked).toHaveLength(2);
  });
});

// ─── PromptOptimizer ───────────────────────────────────────────

describe('PromptOptimizer', () => {
  let optimizer: PromptOptimizer;

  beforeEach(() => {
    optimizer = new PromptOptimizer();
  });

  afterEach(() => {
    optimizer.dispose();
  });

  describe('optimize', () => {
    it('should return passthrough for unknown template', async () => {
      const result = await optimizer.optimize('unknown', 'original content', {});

      expect(result.content).toBe('original content');
      expect(result.variantId).toBe('original');
    });

    it('should select best variant when available', async () => {
      // Create a variant with good performance
      const variant = optimizer.createVariant('tpl-1', [
        makeModification({ content: 'Enhanced context' }),
      ]);

      // Update variant performance to qualify
      variant.performance = {
        totalUses: 10,
        successRate: 0.95,
        avgQuality: 0.9,
        avgTokens: 400,
        avgExecutionTime: 800,
      };

      // Feed base template with lower performance
      feedMany(optimizer, 'tpl-1', 10, () => ({
        qualityScore: 0.5,
        success: true,
      }));

      const result = await optimizer.optimize('tpl-1', 'base content', {});

      expect(result.variantId).toBe(variant.id);
      expect(result.content).toContain('base content');
      expect(result.content).toContain('Enhanced context');
    });

    it('should return original when learning is disabled', async () => {
      const disabled = new PromptOptimizer({ learningEnabled: false });

      const result = await disabled.optimize('tpl-1', 'content', {});
      expect(result.variantId).toBe('original');
      expect(result.content).toBe('content');

      disabled.dispose();
    });
  });

  describe('recordFeedback', () => {
    it('should update the internal tracker', () => {
      optimizer.recordFeedback(makeFeedback({ templateId: 'tpl-1' }));

      const perf = optimizer.getFeedbackTracker().getPerformance('tpl-1');
      expect(perf.totalUses).toBe(1);
    });

    it('should emit feedback:recorded event', () => {
      const events: unknown[] = [];
      optimizer.on('feedback:recorded', (e) => events.push(e));

      optimizer.recordFeedback(makeFeedback({ templateId: 'tpl-1', success: true }));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ templateId: 'tpl-1', success: true });
    });
  });

  describe('createVariant', () => {
    it('should store variant correctly', () => {
      const variant = optimizer.createVariant('tpl-1', [makeModification()]);

      expect(variant.baseTemplateId).toBe('tpl-1');
      expect(variant.version).toBe(1);
      expect(variant.modifications).toHaveLength(1);
      expect(variant.performance.totalUses).toBe(0);
    });

    it('should increment version for subsequent variants', () => {
      const v1 = optimizer.createVariant('tpl-1', [makeModification()]);
      const v2 = optimizer.createVariant('tpl-1', [makeModification({ type: 'simplify' })]);

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v1.id).not.toBe(v2.id);
    });

    it('should emit variant:created event', () => {
      const events: unknown[] = [];
      optimizer.on('variant:created', (e) => events.push(e));

      optimizer.createVariant('tpl-1', [makeModification()]);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ templateId: 'tpl-1', variantId: 'tpl-1-v1' });
    });
  });

  describe('getVariants', () => {
    it('should return all variants for a template', () => {
      optimizer.createVariant('tpl-1', [makeModification()]);
      optimizer.createVariant('tpl-1', [makeModification({ type: 'simplify' })]);
      optimizer.createVariant('tpl-2', [makeModification()]);

      expect(optimizer.getVariants('tpl-1')).toHaveLength(2);
      expect(optimizer.getVariants('tpl-2')).toHaveLength(1);
    });

    it('should return empty array for template with no variants', () => {
      expect(optimizer.getVariants('nonexistent')).toEqual([]);
    });
  });

  describe('getBestVariant', () => {
    it('should return null when no variants exist', () => {
      expect(optimizer.getBestVariant('tpl-1')).toBeNull();
    });

    it('should return null when variants lack sufficient samples', () => {
      optimizer.createVariant('tpl-1', [makeModification()]);
      expect(optimizer.getBestVariant('tpl-1')).toBeNull();
    });

    it('should select best performing variant', () => {
      const v1 = optimizer.createVariant('tpl-1', [makeModification()]);
      const v2 = optimizer.createVariant('tpl-1', [makeModification({ type: 'expand' })]);

      v1.performance = {
        totalUses: 10,
        successRate: 0.6,
        avgQuality: 0.5,
        avgTokens: 500,
        avgExecutionTime: 1000,
      };

      v2.performance = {
        totalUses: 10,
        successRate: 0.95,
        avgQuality: 0.9,
        avgTokens: 400,
        avgExecutionTime: 800,
      };

      // Feed base with low performance
      feedMany(optimizer, 'tpl-1', 5, () => ({ qualityScore: 0.3, success: false }));

      const best = optimizer.getBestVariant('tpl-1');
      expect(best?.id).toBe(v2.id);
    });
  });

  describe('getOptimizationSuggestions', () => {
    it('should generate suggestions for declining performance', () => {
      feedMany(optimizer, 'tpl-1', 10, (i) => ({
        qualityScore: i < 5 ? 0.7 : 0.3,
        success: i < 5,
        tokensUsed: 500,
      }));

      const suggestions = optimizer.getOptimizationSuggestions('tpl-1');

      expect(suggestions.length).toBeGreaterThan(0);
      const types = suggestions.map((s) => s.type);
      expect(types).toContain('restructure');
    });

    it('should return no suggestions when performance is good', () => {
      feedMany(optimizer, 'tpl-1', 10, () => ({
        qualityScore: 0.9,
        success: true,
        tokensUsed: 500,
      }));

      const suggestions = optimizer.getOptimizationSuggestions('tpl-1');
      expect(suggestions).toHaveLength(0);
    });

    it('should return no suggestions with insufficient samples', () => {
      feedMany(optimizer, 'tpl-1', 2, () => ({
        qualityScore: 0.2,
        success: false,
      }));

      const suggestions = optimizer.getOptimizationSuggestions('tpl-1');
      expect(suggestions).toHaveLength(0);
    });

    it('should suggest add-examples for very low quality', () => {
      feedMany(optimizer, 'tpl-1', 10, () => ({
        qualityScore: 0.3,
        success: false,
        tokensUsed: 500,
      }));

      const suggestions = optimizer.getOptimizationSuggestions('tpl-1');
      const types = suggestions.map((s) => s.type);
      expect(types).toContain('add-examples');
    });

    it('should suggest simplify for high token usage', () => {
      feedMany(optimizer, 'tpl-1', 10, () => ({
        qualityScore: 0.4,
        success: false,
        tokensUsed: 5000,
      }));

      const suggestions = optimizer.getOptimizationSuggestions('tpl-1');
      const types = suggestions.map((s) => s.type);
      expect(types).toContain('simplify');
    });

    it('should emit optimization:suggested event', () => {
      const events: unknown[] = [];
      optimizer.on('optimization:suggested', (e) => events.push(e));

      feedMany(optimizer, 'tpl-1', 10, (i) => ({
        qualityScore: i < 5 ? 0.7 : 0.3,
        success: i < 5,
      }));

      optimizer.getOptimizationSuggestions('tpl-1');
      expect(events).toHaveLength(1);
    });
  });

  describe('events', () => {
    it('should emit variant:selected during optimize', async () => {
      const events: unknown[] = [];
      optimizer.on('variant:selected', (e) => events.push(e));

      const variant = optimizer.createVariant('tpl-1', [makeModification()]);
      variant.performance = {
        totalUses: 10,
        successRate: 0.95,
        avgQuality: 0.9,
        avgTokens: 400,
        avgExecutionTime: 800,
      };
      feedMany(optimizer, 'tpl-1', 5, () => ({ qualityScore: 0.3, success: false }));

      await optimizer.optimize('tpl-1', 'content', {});

      expect(events).toHaveLength(1);
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      feedMany(optimizer, 'tpl-1', 5);
      optimizer.createVariant('tpl-1', [makeModification()]);
      optimizer.startABTest('a', 'b');

      optimizer.dispose();

      expect(optimizer.getFeedbackTracker().getTrackedTemplates()).toHaveLength(0);
      expect(optimizer.getVariants('tpl-1')).toHaveLength(0);
      expect(optimizer.getActiveTests()).toHaveLength(0);
    });
  });
});

// ─── A/B Testing ───────────────────────────────────────────────

describe('A/B Testing', () => {
  let optimizer: PromptOptimizer;

  beforeEach(() => {
    optimizer = new PromptOptimizer({ minSamplesForAdaptation: 3 });
  });

  afterEach(() => {
    optimizer.dispose();
  });

  it('should start a test with running status', () => {
    const test = optimizer.startABTest('variant-a', 'variant-b');

    expect(test.status).toBe('running');
    expect(test.variantA).toBe('variant-a');
    expect(test.variantB).toBe('variant-b');
    expect(test.samplesA).toHaveLength(0);
    expect(test.samplesB).toHaveLength(0);
    expect(test.id).toBeDefined();
    expect(test.startedAt).toBeDefined();
  });

  it('should record results to correct variant', () => {
    const test = optimizer.startABTest('variant-a', 'variant-b');

    optimizer.recordABResult(test.id, 'variant-a', makeFeedback({ qualityScore: 0.8 }));
    optimizer.recordABResult(test.id, 'variant-b', makeFeedback({ qualityScore: 0.6 }));
    optimizer.recordABResult(test.id, 'variant-a', makeFeedback({ qualityScore: 0.9 }));

    expect(test.samplesA).toHaveLength(2);
    expect(test.samplesB).toHaveLength(1);
  });

  it('should not record results for nonexistent test', () => {
    // Should not throw
    optimizer.recordABResult('nonexistent', 'variant-a', makeFeedback());
  });

  it('should conclude test and select winner with higher quality', () => {
    const test = optimizer.startABTest('variant-a', 'variant-b');

    // Feed A with high quality
    for (let i = 0; i < 3; i++) {
      optimizer.recordABResult(
        test.id,
        'variant-a',
        makeFeedback({ qualityScore: 0.9, success: true }),
      );
    }

    // Feed B with lower quality
    for (let i = 0; i < 3; i++) {
      optimizer.recordABResult(
        test.id,
        'variant-b',
        makeFeedback({ qualityScore: 0.4, success: false }),
      );
    }

    const concluded = optimizer.concludeABTest(test.id);

    expect(concluded.status).toBe('completed');
    expect(concluded.winner).toBe('variant-a');
    expect(concluded.completedAt).toBeDefined();
  });

  it('should not conclude test before minimum samples reached', () => {
    const test = optimizer.startABTest('variant-a', 'variant-b');

    // Only 1 sample each (min is 3)
    optimizer.recordABResult(test.id, 'variant-a', makeFeedback());
    optimizer.recordABResult(test.id, 'variant-b', makeFeedback());

    const result = optimizer.concludeABTest(test.id);

    expect(result.status).toBe('running');
    expect(result.winner).toBeUndefined();
  });

  it('should throw when concluding nonexistent test', () => {
    expect(() => optimizer.concludeABTest('nonexistent')).toThrow('A/B test not found');
  });

  it('should get active tests only', () => {
    const test1 = optimizer.startABTest('a', 'b');
    optimizer.startABTest('c', 'd');

    // Conclude test1
    for (let i = 0; i < 3; i++) {
      optimizer.recordABResult(test1.id, 'a', makeFeedback({ qualityScore: 0.9, success: true }));
      optimizer.recordABResult(test1.id, 'b', makeFeedback({ qualityScore: 0.4, success: false }));
    }
    optimizer.concludeABTest(test1.id);

    const active = optimizer.getActiveTests();
    expect(active).toHaveLength(1);
    expect(active[0].variantA).toBe('c');
  });

  it('should emit ab-test:started event', () => {
    const events: unknown[] = [];
    optimizer.on('ab-test:started', (e) => events.push(e));

    optimizer.startABTest('a', 'b');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ variantA: 'a', variantB: 'b' });
  });

  it('should emit ab-test:completed event', () => {
    const events: unknown[] = [];
    optimizer.on('ab-test:completed', (e) => events.push(e));

    const test = optimizer.startABTest('a', 'b');
    for (let i = 0; i < 3; i++) {
      optimizer.recordABResult(test.id, 'a', makeFeedback({ qualityScore: 0.9, success: true }));
      optimizer.recordABResult(test.id, 'b', makeFeedback({ qualityScore: 0.4, success: false }));
    }
    optimizer.concludeABTest(test.id);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ testId: test.id, winner: 'a' });
  });

  it('should not record results to a completed test', () => {
    const test = optimizer.startABTest('a', 'b');
    for (let i = 0; i < 3; i++) {
      optimizer.recordABResult(test.id, 'a', makeFeedback({ qualityScore: 0.9, success: true }));
      optimizer.recordABResult(test.id, 'b', makeFeedback({ qualityScore: 0.4, success: false }));
    }
    optimizer.concludeABTest(test.id);

    // Try to record after completion
    optimizer.recordABResult(test.id, 'a', makeFeedback());

    expect(test.samplesA).toHaveLength(3); // unchanged
  });
});

// ─── Integration ───────────────────────────────────────────────

describe('Integration', () => {
  it('should complete full cycle: optimize -> feedback -> improve -> verify', async () => {
    const optimizer = new PromptOptimizer({ minSamplesForAdaptation: 3 });

    // Phase 1: Initial optimization (passthrough)
    const initial = await optimizer.optimize('tpl-1', 'Do the task.', {});
    expect(initial.variantId).toBe('original');

    // Phase 2: Record poor feedback
    feedMany(optimizer, 'tpl-1', 5, () => ({
      qualityScore: 0.3,
      success: false,
      tokensUsed: 500,
    }));

    // Phase 3: Get suggestions and create variant
    const suggestions = optimizer.getOptimizationSuggestions('tpl-1');
    expect(suggestions.length).toBeGreaterThan(0);

    const variant = optimizer.createVariant('tpl-1', suggestions);
    variant.performance = {
      totalUses: 5,
      successRate: 0.9,
      avgQuality: 0.85,
      avgTokens: 400,
      avgExecutionTime: 900,
    };

    // Phase 4: Verify variant is selected
    const improved = await optimizer.optimize('tpl-1', 'Do the task.', {});
    expect(improved.variantId).toBe(variant.id);
    expect(improved.content).not.toBe('Do the task.');

    optimizer.dispose();
  });

  it('should track multiple templates independently', () => {
    const optimizer = new PromptOptimizer();

    feedMany(optimizer, 'tpl-a', 10, () => ({ qualityScore: 0.9, success: true }));
    feedMany(optimizer, 'tpl-b', 10, () => ({ qualityScore: 0.3, success: false }));

    const perfA = optimizer.getFeedbackTracker().getPerformance('tpl-a');
    const perfB = optimizer.getFeedbackTracker().getPerformance('tpl-b');

    expect(perfA.avgQuality).toBeCloseTo(0.9);
    expect(perfB.avgQuality).toBeCloseTo(0.3);
    expect(perfA.successRate).toBe(1);
    expect(perfB.successRate).toBe(0);

    optimizer.dispose();
  });

  it('should create variant from feedback analysis', () => {
    const optimizer = new PromptOptimizer({ minSamplesForAdaptation: 5 });

    // Record poor performance
    feedMany(optimizer, 'tpl-1', 10, () => ({
      qualityScore: 0.3,
      success: false,
      tokensUsed: 3000,
    }));

    // Get suggestions
    const suggestions = optimizer.getOptimizationSuggestions('tpl-1');
    expect(suggestions.length).toBeGreaterThanOrEqual(2); // At least add-context + add-examples

    // Create variant from suggestions
    const variant = optimizer.createVariant('tpl-1', suggestions);
    expect(variant.modifications).toEqual(suggestions);

    optimizer.dispose();
  });

  it('should complete A/B test and select winner as default', async () => {
    const optimizer = new PromptOptimizer({ minSamplesForAdaptation: 3 });

    // Create two variants
    const v1 = optimizer.createVariant('tpl-1', [
      makeModification({ content: 'Variant A approach' }),
    ]);
    const v2 = optimizer.createVariant('tpl-1', [
      makeModification({ content: 'Variant B approach' }),
    ]);

    // Start A/B test
    const test = optimizer.startABTest(v1.id, v2.id);

    // Variant B performs better
    for (let i = 0; i < 3; i++) {
      optimizer.recordABResult(
        test.id,
        v1.id,
        makeFeedback({ qualityScore: 0.5, success: true }),
      );
      optimizer.recordABResult(
        test.id,
        v2.id,
        makeFeedback({ qualityScore: 0.9, success: true }),
      );
    }

    // Conclude test
    const result = optimizer.concludeABTest(test.id);
    expect(result.status).toBe('completed');
    expect(result.winner).toBe(v2.id);

    // Update winning variant's performance so it gets selected
    v2.performance = {
      totalUses: 5,
      successRate: 0.95,
      avgQuality: 0.9,
      avgTokens: 400,
      avgExecutionTime: 800,
    };

    // Feed base template with lower performance
    feedMany(optimizer, 'tpl-1', 5, () => ({
      qualityScore: 0.3,
      success: false,
    }));

    // Verify winning variant is used in optimization
    const optimized = await optimizer.optimize('tpl-1', 'base content', {});
    expect(optimized.variantId).toBe(v2.id);

    optimizer.dispose();
  });
});

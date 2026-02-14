/**
 * Prompt Optimizer
 *
 * Adaptive prompt optimization engine that learns from task outcomes,
 * creates prompt variants, runs A/B tests, and selects the best
 * performing prompt for each template.
 *
 * @module core/adaptive-prompts/prompt-optimizer
 */

import { EventEmitter } from 'events';
import { FeedbackTracker } from './feedback-tracker';
import type {
  AdaptivePromptConfig,
  ABTest,
  PromptFeedback,
  PromptModification,
  PromptVariant,
} from './types';
import { DEFAULT_ADAPTIVE_CONFIG } from './types';

/**
 * Prompt optimizer with feedback-driven variant selection and A/B testing
 */
export class PromptOptimizer extends EventEmitter {
  private readonly feedbackTracker: FeedbackTracker;
  private readonly variants: Map<string, PromptVariant[]> = new Map();
  private readonly abTests: Map<string, ABTest> = new Map();
  private readonly config: AdaptivePromptConfig;

  constructor(config?: Partial<AdaptivePromptConfig>) {
    super();
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
    this.feedbackTracker = new FeedbackTracker();
  }

  /**
   * Optimize a template by selecting the best known variant or returning passthrough.
   * Returns the content to use and the variant ID (or 'original' if no variant selected).
   */
  async optimize(
    templateId: string,
    template: string,
    _context: Record<string, unknown>,
  ): Promise<{ content: string; variantId: string }> {
    if (!this.config.learningEnabled) {
      return { content: template, variantId: 'original' };
    }

    const best = this.getBestVariant(templateId);
    if (best) {
      this.emit('variant:selected', { templateId, variantId: best.id });
      return { content: this.applyModifications(template, best.modifications), variantId: best.id };
    }

    return { content: template, variantId: 'original' };
  }

  /**
   * Record feedback for a prompt execution
   */
  recordFeedback(feedback: PromptFeedback): void {
    this.feedbackTracker.record(feedback);
    this.emit('feedback:recorded', { templateId: feedback.templateId, success: feedback.success });
  }

  /**
   * Create a new variant of a base template with specified modifications
   */
  createVariant(
    baseTemplateId: string,
    modifications: PromptModification[],
  ): PromptVariant {
    const existing = this.variants.get(baseTemplateId) ?? [];
    const nextVersion = existing.length + 1;

    const variant: PromptVariant = {
      id: `${baseTemplateId}-v${nextVersion}`,
      baseTemplateId,
      version: nextVersion,
      modifications,
      performance: {
        totalUses: 0,
        successRate: 0,
        avgTokens: 0,
        avgQuality: 0,
        avgExecutionTime: 0,
      },
      createdAt: new Date().toISOString(),
    };

    existing.push(variant);
    this.variants.set(baseTemplateId, existing);
    this.emit('variant:created', { templateId: baseTemplateId, variantId: variant.id });

    return variant;
  }

  /**
   * Get all variants for a base template
   */
  getVariants(baseTemplateId: string): PromptVariant[] {
    return this.variants.get(baseTemplateId) ?? [];
  }

  /**
   * Get the best performing variant for a base template.
   * Requires minimum samples and positive improvement over threshold.
   */
  getBestVariant(baseTemplateId: string): PromptVariant | null {
    const variants = this.variants.get(baseTemplateId);
    if (!variants || variants.length === 0) return null;

    const qualified = variants.filter(
      (v) => v.performance.totalUses >= this.config.minSamplesForAdaptation,
    );
    if (qualified.length === 0) return null;

    const basePerf = this.feedbackTracker.getPerformance(baseTemplateId);
    const baseScore = basePerf.avgQuality * 0.5 + basePerf.successRate * 0.3;

    let bestVariant: PromptVariant | null = null;
    let bestScore = baseScore;

    for (const variant of qualified) {
      const score = variant.performance.avgQuality * 0.5 + variant.performance.successRate * 0.3;
      if (score > bestScore + this.config.improvementThreshold) {
        bestScore = score;
        bestVariant = variant;
      }
    }

    return bestVariant;
  }

  /**
   * Start an A/B test between two template variants
   */
  startABTest(variantA: string, variantB: string): ABTest {
    const test: ABTest = {
      id: `ab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      variantA,
      variantB,
      samplesA: [],
      samplesB: [],
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.abTests.set(test.id, test);
    this.emit('ab-test:started', { testId: test.id, variantA, variantB });

    return test;
  }

  /**
   * Record a result for an active A/B test
   */
  recordABResult(testId: string, variantUsed: string, feedback: PromptFeedback): void {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') return;

    if (variantUsed === test.variantA) {
      test.samplesA.push(feedback);
    } else if (variantUsed === test.variantB) {
      test.samplesB.push(feedback);
    }
  }

  /**
   * Conclude an A/B test and determine the winner.
   * Requires minimum samples in each variant before concluding.
   */
  concludeABTest(testId: string): ABTest {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    if (test.status !== 'running') {
      return test;
    }

    const minSamples = this.config.minSamplesForAdaptation;
    if (test.samplesA.length < minSamples || test.samplesB.length < minSamples) {
      return test;
    }

    const scoreA = this.computeABScore(test.samplesA);
    const scoreB = this.computeABScore(test.samplesB);

    test.winner = scoreA >= scoreB ? test.variantA : test.variantB;
    test.status = 'completed';
    test.completedAt = new Date().toISOString();

    this.emit('ab-test:completed', { testId, winner: test.winner });

    return test;
  }

  /**
   * Get all currently active A/B tests
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.abTests.values()).filter((t) => t.status === 'running');
  }

  /**
   * Generate optimization suggestions for a template based on feedback trends.
   * Returns suggestions only when performance is below threshold or declining.
   */
  getOptimizationSuggestions(templateId: string): PromptModification[] {
    const perf = this.feedbackTracker.getPerformance(templateId);
    const trend = this.feedbackTracker.getTrend(templateId);
    const suggestions: PromptModification[] = [];

    if (perf.totalUses < this.config.minSamplesForAdaptation) {
      return suggestions;
    }

    if (perf.avgQuality < this.config.qualityThreshold || trend === 'declining') {
      if (perf.successRate < this.config.qualityThreshold) {
        suggestions.push({
          type: 'add-context',
          description: 'Add more context to improve task success rate',
          content: 'Include additional context about expected output format and constraints.',
        });
      }

      if (perf.avgTokens > 2000) {
        suggestions.push({
          type: 'simplify',
          description: 'Simplify prompt to reduce token consumption',
          content: 'Remove redundant instructions and consolidate requirements.',
        });
      }

      if (perf.avgQuality < 0.4) {
        suggestions.push({
          type: 'add-examples',
          description: 'Add examples to improve output quality',
          content: 'Include 1-2 examples of expected input/output patterns.',
        });
      }

      if (trend === 'declining') {
        suggestions.push({
          type: 'restructure',
          description: 'Restructure prompt to reverse declining performance',
          content: 'Reorganize prompt sections to prioritize critical instructions.',
        });
      }

      if (suggestions.length > 0) {
        this.emit('optimization:suggested', { templateId, count: suggestions.length });
      }
    }

    return suggestions;
  }

  /**
   * Get the underlying feedback tracker (for testing and advanced queries)
   */
  getFeedbackTracker(): FeedbackTracker {
    return this.feedbackTracker;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.feedbackTracker.clear();
    this.variants.clear();
    this.abTests.clear();
    this.removeAllListeners();
  }

  /**
   * Apply modifications to a template string.
   * Each modification type appends or transforms the content.
   */
  private applyModifications(template: string, modifications: PromptModification[]): string {
    let result = template;
    for (const mod of modifications) {
      switch (mod.type) {
        case 'add-context':
          result = `${result}\n\n${mod.content}`;
          break;
        case 'add-examples':
          result = `${result}\n\nExamples:\n${mod.content}`;
          break;
        case 'simplify':
        case 'expand':
        case 'restructure':
          result = `${result}\n\n[${mod.type}]: ${mod.content}`;
          break;
      }
    }
    return result;
  }

  /** Compute average quality score for A/B test samples */
  private computeABScore(samples: PromptFeedback[]): number {
    if (samples.length === 0) return 0;
    const avgQuality = samples.reduce((s, f) => s + f.qualityScore, 0) / samples.length;
    const successRate = samples.filter((f) => f.success).length / samples.length;
    return avgQuality * 0.6 + successRate * 0.4;
  }
}

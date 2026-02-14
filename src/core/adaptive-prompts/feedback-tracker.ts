/**
 * Feedback Tracker
 *
 * Collects and analyzes prompt feedback to compute
 * performance metrics, trends, and comparative analysis.
 *
 * @module core/adaptive-prompts/feedback-tracker
 */

import type { PromptFeedback, PromptPerformance } from './types';

/**
 * Tracks prompt feedback and computes performance analytics
 */
export class FeedbackTracker {
  private feedbacks: Map<string, PromptFeedback[]> = new Map();

  /**
   * Record a feedback entry for a template
   */
  record(feedback: PromptFeedback): void {
    const existing = this.feedbacks.get(feedback.templateId) ?? [];
    existing.push(feedback);
    this.feedbacks.set(feedback.templateId, existing);
  }

  /**
   * Compute aggregated performance for a template.
   * Returns zero-value performance if no feedbacks exist.
   */
  getPerformance(templateId: string): PromptPerformance {
    const items = this.feedbacks.get(templateId);
    if (!items || items.length === 0) {
      return {
        totalUses: 0,
        successRate: 0,
        avgTokens: 0,
        avgQuality: 0,
        avgExecutionTime: 0,
      };
    }

    const total = items.length;
    const successCount = items.filter((f) => f.success).length;
    const sumTokens = items.reduce((s, f) => s + f.tokensUsed, 0);
    const sumQuality = items.reduce((s, f) => s + f.qualityScore, 0);
    const sumTime = items.reduce((s, f) => s + f.executionTime, 0);

    return {
      totalUses: total,
      successRate: successCount / total,
      avgTokens: sumTokens / total,
      avgQuality: sumQuality / total,
      avgExecutionTime: sumTime / total,
    };
  }

  /**
   * Retrieve recent feedbacks for a template, ordered newest first.
   * @param count Maximum number to return (defaults to all)
   */
  getRecentFeedbacks(templateId: string, count?: number): PromptFeedback[] {
    const items = this.feedbacks.get(templateId) ?? [];
    const sorted = [...items].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return count !== undefined ? sorted.slice(0, count) : sorted;
  }

  /**
   * Compare performance between two templates.
   * Returns the better performer and the relative improvement.
   */
  comparePerformance(
    templateA: string,
    templateB: string,
  ): { better: string; improvement: number } {
    const perfA = this.getPerformance(templateA);
    const perfB = this.getPerformance(templateB);

    const scoreA = this.computeCompositeScore(perfA);
    const scoreB = this.computeCompositeScore(perfB);

    if (scoreA >= scoreB) {
      const improvement = scoreB > 0 ? (scoreA - scoreB) / scoreB : scoreA > 0 ? 1 : 0;
      return { better: templateA, improvement };
    }

    const improvement = scoreA > 0 ? (scoreB - scoreA) / scoreA : scoreB > 0 ? 1 : 0;
    return { better: templateB, improvement };
  }

  /**
   * Detect trend direction for a template over a rolling window.
   * Compares the first half of recent feedbacks against the second half.
   */
  getTrend(
    templateId: string,
    windowSize: number = 10,
  ): 'improving' | 'declining' | 'stable' {
    const items = this.feedbacks.get(templateId) ?? [];
    if (items.length < 4) return 'stable';

    const recent = items.slice(-windowSize);
    if (recent.length < 4) return 'stable';

    const mid = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, mid);
    const secondHalf = recent.slice(mid);

    const avgFirst = this.avgQualityOf(firstHalf);
    const avgSecond = this.avgQualityOf(secondHalf);

    const delta = avgSecond - avgFirst;
    const threshold = 0.05;

    if (delta > threshold) return 'improving';
    if (delta < -threshold) return 'declining';
    return 'stable';
  }

  /**
   * Remove all tracked feedbacks
   */
  clear(): void {
    this.feedbacks.clear();
  }

  /**
   * Get all template IDs that have recorded feedbacks
   */
  getTrackedTemplates(): string[] {
    return Array.from(this.feedbacks.keys());
  }

  /** Compute a composite score from performance metrics */
  private computeCompositeScore(perf: PromptPerformance): number {
    // Weighted: 50% quality, 30% success rate, 20% token efficiency (inverse)
    const tokenScore = perf.avgTokens > 0 ? 1 / (1 + perf.avgTokens / 1000) : 0;
    return perf.avgQuality * 0.5 + perf.successRate * 0.3 + tokenScore * 0.2;
  }

  /** Compute average quality score for a set of feedbacks */
  private avgQualityOf(items: PromptFeedback[]): number {
    if (items.length === 0) return 0;
    return items.reduce((s, f) => s + f.qualityScore, 0) / items.length;
  }
}

/**
 * Histogram Metric Implementation
 *
 * Feature: F0.7 - Metrics Foundation
 * Histogram metric for observing value distributions
 *
 * @module core/metrics
 */

import {
  MetricType,
  DEFAULT_BUCKETS,
  buildFullName,
  validateMetricName,
  validateLabelNames,
  labelKey,
} from './metrics.interface.js';
import type {
  IHistogram,
  HistogramOptions,
  MetricLabels,
  MetricValue,
  HistogramValue,
} from './metrics.interface.js';

/**
 * Internal histogram data structure
 */
interface HistogramData {
  buckets: Map<number, number>;
  sum: number;
  count: number;
}

/**
 * Histogram metric implementation
 */
export class Histogram implements IHistogram {
  readonly name: string;
  readonly fullName: string;
  readonly type = MetricType.HISTOGRAM;
  readonly help: string;
  readonly labelNames: string[];
  readonly options: HistogramOptions;

  private readonly buckets: number[];
  private values = new Map<string, HistogramData>();

  constructor(options: HistogramOptions) {
    this.options = options;
    this.name = options.name;
    this.help = options.help;
    this.labelNames = options.labelNames ?? [];
    this.buckets = [...(options.buckets ?? DEFAULT_BUCKETS)].sort((a, b) => a - b);

    validateMetricName(this.name);
    validateLabelNames(this.labelNames);

    this.fullName = buildFullName(options);

    // Ensure +Inf bucket
    if (!this.buckets.includes(Infinity)) {
      this.buckets.push(Infinity);
    }
  }

  /**
   * Observe a value
   */
  observe(value: number, labels: MetricLabels = {}): void {
    this.validateLabels(labels);
    const key = labelKey(labels);

    let data = this.values.get(key);
    if (!data) {
      data = this.createEmptyData();
      this.values.set(key, data);
    }

    // Update buckets
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        const current = data.buckets.get(bucket) ?? 0;
        data.buckets.set(bucket, current + 1);
      }
    }

    // Update sum and count
    data.sum += value;
    data.count += 1;
  }

  /**
   * Get histogram value
   */
  getHistogramValue(labels: MetricLabels = {}): HistogramValue | undefined {
    this.validateLabels(labels);
    const key = labelKey(labels);
    const data = this.values.get(key);

    if (!data) {
      return undefined;
    }

    return {
      value: data.count,
      labels: this.parseLabels(key),
      buckets: new Map(data.buckets),
      sum: data.sum,
      count: data.count,
      timestamp: new Date(),
    };
  }

  /**
   * Start a timer and return stop function
   */
  startTimer(labels: MetricLabels = {}): () => number {
    const start = performance.now();
    return () => {
      const duration = (performance.now() - start) / 1000;
      this.observe(duration, labels);
      return duration;
    };
  }

  /**
   * Get bucket boundaries
   */
  getBuckets(): number[] {
    return [...this.buckets];
  }

  /**
   * Get all values (returns count as the value)
   */
  getValues(): MetricValue[] {
    const result: MetricValue[] = [];

    for (const [key, data] of this.values.entries()) {
      const labels = this.parseLabels(key);
      result.push({
        value: data.count,
        labels,
        timestamp: new Date(),
      });
    }

    return result;
  }

  /**
   * Reset the histogram
   */
  reset(): void {
    this.values.clear();
  }

  /**
   * Create empty histogram data
   */
  private createEmptyData(): HistogramData {
    const buckets = new Map<number, number>();
    for (const bucket of this.buckets) {
      buckets.set(bucket, 0);
    }
    return {
      buckets,
      sum: 0,
      count: 0,
    };
  }

  /**
   * Validate that provided labels match expected label names
   */
  private validateLabels(labels: MetricLabels): void {
    const providedKeys = Object.keys(labels).sort();
    const expectedKeys = [...this.labelNames].sort();

    if (this.labelNames.length > 0) {
      for (const key of expectedKeys) {
        if (!(key in labels)) {
          throw new Error(
            `Missing required label "${key}" for metric "${this.name}"`
          );
        }
      }
    }

    for (const key of providedKeys) {
      if (!expectedKeys.includes(key)) {
        throw new Error(
          `Unexpected label "${key}" for metric "${this.name}". Expected: ${expectedKeys.join(', ')}`
        );
      }
    }
  }

  /**
   * Parse label key back to labels object
   */
  private parseLabels(key: string): MetricLabels {
    if (!key) return {};

    const labels: MetricLabels = {};
    const pairs = key.split(',');

    for (const pair of pairs) {
      const match = pair.match(/^([^=]+)="([^"]*)"$/);
      if (match) {
        labels[match[1]] = match[2];
      }
    }

    return labels;
  }
}

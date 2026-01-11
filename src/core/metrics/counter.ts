/**
 * Counter Metric Implementation
 *
 * Feature: F0.7 - Metrics Foundation
 * Monotonically increasing counter metric
 *
 * @module core/metrics
 */

import {
  MetricType,
  buildFullName,
  validateMetricName,
  validateLabelNames,
  labelKey,
} from './metrics.interface.js';
import type {
  ICounter,
  CounterOptions,
  MetricLabels,
  MetricValue,
} from './metrics.interface.js';

/**
 * Counter metric implementation
 */
export class Counter implements ICounter {
  readonly name: string;
  readonly fullName: string;
  readonly type = MetricType.COUNTER;
  readonly help: string;
  readonly labelNames: string[];
  readonly options: CounterOptions;

  private values = new Map<string, number>();

  constructor(options: CounterOptions) {
    this.options = options;
    this.name = options.name;
    this.help = options.help;
    this.labelNames = options.labelNames ?? [];

    validateMetricName(this.name);
    validateLabelNames(this.labelNames);

    this.fullName = buildFullName(options);
  }

  /**
   * Increment counter
   */
  inc(valueOrLabels?: number | MetricLabels, maybeLabels?: MetricLabels): void {
    let value = 1;
    let labels: MetricLabels = {};

    if (typeof valueOrLabels === 'number') {
      value = valueOrLabels;
      labels = maybeLabels ?? {};
    } else if (typeof valueOrLabels === 'object') {
      labels = valueOrLabels;
    }

    if (value < 0) {
      throw new Error('Counter can only be incremented by positive values');
    }

    this.validateLabels(labels);

    const key = labelKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current + value);
  }

  /**
   * Get counter value
   */
  get(labels: MetricLabels = {}): number {
    this.validateLabels(labels);
    const key = labelKey(labels);
    return this.values.get(key) ?? 0;
  }

  /**
   * Get all values
   */
  getValues(): MetricValue[] {
    const result: MetricValue[] = [];

    for (const [key, value] of this.values.entries()) {
      const labels = this.parseLabels(key);
      result.push({
        value,
        labels,
        timestamp: new Date(),
      });
    }

    return result;
  }

  /**
   * Reset the counter
   */
  reset(): void {
    this.values.clear();
  }

  /**
   * Validate that provided labels match expected label names
   */
  private validateLabels(labels: MetricLabels): void {
    const providedKeys = Object.keys(labels).sort();
    const expectedKeys = [...this.labelNames].sort();

    if (this.labelNames.length > 0) {
      // All expected labels must be provided
      for (const key of expectedKeys) {
        if (!(key in labels)) {
          throw new Error(
            `Missing required label "${key}" for metric "${this.name}"`
          );
        }
      }
    }

    // No extra labels allowed
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

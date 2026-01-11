/**
 * Gauge Metric Implementation
 *
 * Feature: F0.7 - Metrics Foundation
 * Gauge metric that can increase or decrease
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
  IGauge,
  GaugeOptions,
  MetricLabels,
  MetricValue,
} from './metrics.interface.js';

/**
 * Gauge metric implementation
 */
export class Gauge implements IGauge {
  readonly name: string;
  readonly fullName: string;
  readonly type = MetricType.GAUGE;
  readonly help: string;
  readonly labelNames: string[];
  readonly options: GaugeOptions;

  private values = new Map<string, number>();

  constructor(options: GaugeOptions) {
    this.options = options;
    this.name = options.name;
    this.help = options.help;
    this.labelNames = options.labelNames ?? [];

    validateMetricName(this.name);
    validateLabelNames(this.labelNames);

    this.fullName = buildFullName(options);
  }

  /**
   * Set gauge value
   */
  set(value: number, labels: MetricLabels = {}): void {
    this.validateLabels(labels);
    const key = labelKey(labels);
    this.values.set(key, value);
  }

  /**
   * Increment gauge
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

    this.validateLabels(labels);
    const key = labelKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current + value);
  }

  /**
   * Decrement gauge
   */
  dec(valueOrLabels?: number | MetricLabels, maybeLabels?: MetricLabels): void {
    let value = 1;
    let labels: MetricLabels = {};

    if (typeof valueOrLabels === 'number') {
      value = valueOrLabels;
      labels = maybeLabels ?? {};
    } else if (typeof valueOrLabels === 'object') {
      labels = valueOrLabels;
    }

    this.validateLabels(labels);
    const key = labelKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current - value);
  }

  /**
   * Get gauge value
   */
  get(labels: MetricLabels = {}): number {
    this.validateLabels(labels);
    const key = labelKey(labels);
    return this.values.get(key) ?? 0;
  }

  /**
   * Set gauge to current Unix timestamp in seconds
   */
  setToCurrentTime(labels: MetricLabels = {}): void {
    this.set(Date.now() / 1000, labels);
  }

  /**
   * Start a timer and return stop function
   * @returns Function that stops the timer and returns duration in seconds
   */
  startTimer(labels: MetricLabels = {}): () => number {
    const start = performance.now();
    return () => {
      const duration = (performance.now() - start) / 1000;
      this.set(duration, labels);
      return duration;
    };
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
   * Reset the gauge
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

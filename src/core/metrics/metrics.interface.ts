/**
 * Metrics Foundation Interfaces
 *
 * Feature: F0.7 - Metrics Foundation
 * Provides counter, gauge, histogram metrics with labels support
 *
 * @module core/metrics
 */

import type { IDisposable } from '../di/interfaces/container.interface.js';

/**
 * Metric type enumeration
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Metric labels type
 */
export type MetricLabels = Record<string, string>;

/**
 * Base metric options
 */
export interface MetricOptions {
  /** Metric name */
  name: string;
  /** Metric description */
  help: string;
  /** Label names */
  labelNames?: string[];
  /** Metric namespace/prefix */
  namespace?: string;
  /** Subsystem name */
  subsystem?: string;
}

/**
 * Counter metric options
 */
export interface CounterOptions extends MetricOptions {
  // Counter-specific options can be added here
}

/**
 * Gauge metric options
 */
export interface GaugeOptions extends MetricOptions {
  // Gauge-specific options can be added here
}

/**
 * Histogram metric options
 */
export interface HistogramOptions extends MetricOptions {
  /** Bucket boundaries */
  buckets?: number[];
}

/**
 * Summary metric options
 */
export interface SummaryOptions extends MetricOptions {
  /** Quantiles to observe */
  percentiles?: number[];
  /** Max age of observations in seconds */
  maxAgeSeconds?: number;
  /** Age buckets for sliding window */
  ageBuckets?: number;
}

/**
 * Metric value with labels
 */
export interface MetricValue {
  /** Metric value */
  value: number;
  /** Labels */
  labels: MetricLabels;
  /** Timestamp */
  timestamp?: Date;
}

/**
 * Histogram value with buckets
 */
export interface HistogramValue extends MetricValue {
  /** Bucket counts */
  buckets: Map<number, number>;
  /** Sum of all observations */
  sum: number;
  /** Count of observations */
  count: number;
}

/**
 * Summary value with quantiles
 */
export interface SummaryValue extends MetricValue {
  /** Quantile values */
  quantiles: Map<number, number>;
  /** Sum of all observations */
  sum: number;
  /** Count of observations */
  count: number;
}

/**
 * Base metric interface
 */
export interface IMetric<T extends MetricOptions = MetricOptions> {
  /** Metric name */
  readonly name: string;
  /** Full metric name (with namespace/subsystem) */
  readonly fullName: string;
  /** Metric type */
  readonly type: MetricType;
  /** Metric help text */
  readonly help: string;
  /** Label names */
  readonly labelNames: string[];
  /** Metric options */
  readonly options: T;

  /**
   * Get all values for this metric
   */
  getValues(): MetricValue[];

  /**
   * Reset the metric
   */
  reset(): void;
}

/**
 * Counter metric interface (monotonically increasing)
 */
export interface ICounter extends IMetric<CounterOptions> {
  /**
   * Increment counter by 1
   * @param labels Optional labels
   */
  inc(labels?: MetricLabels): void;

  /**
   * Increment counter by amount
   * @param value Amount to increment (must be positive)
   * @param labels Optional labels
   */
  inc(value: number, labels?: MetricLabels): void;

  /**
   * Get counter value
   * @param labels Optional labels
   */
  get(labels?: MetricLabels): number;
}

/**
 * Gauge metric interface (can increase or decrease)
 */
export interface IGauge extends IMetric<GaugeOptions> {
  /**
   * Set gauge value
   * @param value Value to set
   * @param labels Optional labels
   */
  set(value: number, labels?: MetricLabels): void;

  /**
   * Increment gauge by 1
   * @param labels Optional labels
   */
  inc(labels?: MetricLabels): void;

  /**
   * Increment gauge by amount
   * @param value Amount to increment
   * @param labels Optional labels
   */
  inc(value: number, labels?: MetricLabels): void;

  /**
   * Decrement gauge by 1
   * @param labels Optional labels
   */
  dec(labels?: MetricLabels): void;

  /**
   * Decrement gauge by amount
   * @param value Amount to decrement
   * @param labels Optional labels
   */
  dec(value: number, labels?: MetricLabels): void;

  /**
   * Get gauge value
   * @param labels Optional labels
   */
  get(labels?: MetricLabels): number;

  /**
   * Set gauge to current Unix timestamp
   * @param labels Optional labels
   */
  setToCurrentTime(labels?: MetricLabels): void;

  /**
   * Start a timer and return stop function
   * @param labels Optional labels
   */
  startTimer(labels?: MetricLabels): () => number;
}

/**
 * Histogram metric interface (distribution of values)
 */
export interface IHistogram extends IMetric<HistogramOptions> {
  /**
   * Observe a value
   * @param value Value to observe
   * @param labels Optional labels
   */
  observe(value: number, labels?: MetricLabels): void;

  /**
   * Get histogram values
   * @param labels Optional labels
   */
  getHistogramValue(labels?: MetricLabels): HistogramValue | undefined;

  /**
   * Start a timer and return stop function that observes duration
   * @param labels Optional labels
   */
  startTimer(labels?: MetricLabels): () => number;

  /**
   * Get bucket boundaries
   */
  getBuckets(): number[];
}

/**
 * Summary metric interface (quantiles over sliding window)
 */
export interface ISummary extends IMetric<SummaryOptions> {
  /**
   * Observe a value
   * @param value Value to observe
   * @param labels Optional labels
   */
  observe(value: number, labels?: MetricLabels): void;

  /**
   * Get summary values
   * @param labels Optional labels
   */
  getSummaryValue(labels?: MetricLabels): SummaryValue | undefined;

  /**
   * Start a timer and return stop function that observes duration
   * @param labels Optional labels
   */
  startTimer(labels?: MetricLabels): () => number;
}

/**
 * Metric registry interface
 */
export interface IMetricRegistry extends IDisposable {
  /**
   * Register a metric
   * @param metric Metric to register
   */
  register<T extends IMetric>(metric: T): T;

  /**
   * Unregister a metric
   * @param name Metric name
   */
  unregister(name: string): boolean;

  /**
   * Get a metric by name
   * @param name Metric name
   */
  get<T extends IMetric>(name: string): T | undefined;

  /**
   * Get all registered metrics
   */
  getAll(): IMetric[];

  /**
   * Create and register a counter
   * @param options Counter options
   */
  createCounter(options: CounterOptions): ICounter;

  /**
   * Create and register a gauge
   * @param options Gauge options
   */
  createGauge(options: GaugeOptions): IGauge;

  /**
   * Create and register a histogram
   * @param options Histogram options
   */
  createHistogram(options: HistogramOptions): IHistogram;

  /**
   * Create and register a summary
   * @param options Summary options
   */
  createSummary(options: SummaryOptions): ISummary;

  /**
   * Reset all metrics
   */
  resetAll(): void;

  /**
   * Get metrics in text format (Prometheus-compatible)
   */
  getMetricsAsText(): string;

  /**
   * Get metrics as JSON
   */
  getMetricsAsJson(): Record<string, unknown>[];
}

/**
 * Default histogram buckets
 */
export const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Default summary percentiles
 */
export const DEFAULT_PERCENTILES = [0.5, 0.9, 0.95, 0.99];

/**
 * HTTP request duration buckets
 */
export const HTTP_REQUEST_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Database query duration buckets
 */
export const DB_QUERY_DURATION_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

/**
 * Helper to create label key from labels object
 */
export function labelKey(labels: MetricLabels): string {
  const sortedKeys = Object.keys(labels).sort();
  return sortedKeys.map((k) => `${k}="${labels[k]}"`).join(',');
}

/**
 * Helper to validate label names
 */
export function validateLabelNames(labelNames: string[]): void {
  for (const name of labelNames) {
    if (!name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      throw new Error(
        `Invalid label name "${name}". Label names must match [a-zA-Z_][a-zA-Z0-9_]*`
      );
    }
    if (name.startsWith('__')) {
      throw new Error(`Label name "${name}" is reserved (starts with __)`);
    }
  }
}

/**
 * Helper to validate metric name
 */
export function validateMetricName(name: string): void {
  if (!name.match(/^[a-zA-Z_:][a-zA-Z0-9_:]*$/)) {
    throw new Error(
      `Invalid metric name "${name}". Metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*`
    );
  }
}

/**
 * Helper to build full metric name
 */
export function buildFullName(options: MetricOptions): string {
  const parts: string[] = [];
  if (options.namespace) {
    parts.push(options.namespace);
  }
  if (options.subsystem) {
    parts.push(options.subsystem);
  }
  parts.push(options.name);
  return parts.join('_');
}

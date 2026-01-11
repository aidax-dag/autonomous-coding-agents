/**
 * Metric Registry Implementation
 *
 * Feature: F0.7 - Metrics Foundation
 * Central registry for all metrics
 *
 * @module core/metrics
 */

import { MetricType } from './metrics.interface.js';
import type {
  IMetricRegistry,
  IMetric,
  ICounter,
  IGauge,
  IHistogram,
  ISummary,
  CounterOptions,
  GaugeOptions,
  HistogramOptions,
  SummaryOptions,
} from './metrics.interface.js';
import { Counter } from './counter.js';
import { Gauge } from './gauge.js';
import { Histogram } from './histogram.js';

/**
 * Metric Registry implementation
 */
export class MetricRegistry implements IMetricRegistry {
  private metrics = new Map<string, IMetric>();
  private disposed = false;

  /**
   * Register a metric
   */
  register<T extends IMetric>(metric: T): T {
    this.ensureNotDisposed();

    if (this.metrics.has(metric.fullName)) {
      throw new Error(`Metric "${metric.fullName}" is already registered`);
    }

    this.metrics.set(metric.fullName, metric);
    return metric;
  }

  /**
   * Unregister a metric
   */
  unregister(name: string): boolean {
    this.ensureNotDisposed();
    return this.metrics.delete(name);
  }

  /**
   * Get a metric by name
   */
  get<T extends IMetric>(name: string): T | undefined {
    this.ensureNotDisposed();
    return this.metrics.get(name) as T | undefined;
  }

  /**
   * Get all registered metrics
   */
  getAll(): IMetric[] {
    this.ensureNotDisposed();
    return Array.from(this.metrics.values());
  }

  /**
   * Create and register a counter
   */
  createCounter(options: CounterOptions): ICounter {
    const counter = new Counter(options);
    return this.register(counter);
  }

  /**
   * Create and register a gauge
   */
  createGauge(options: GaugeOptions): IGauge {
    const gauge = new Gauge(options);
    return this.register(gauge);
  }

  /**
   * Create and register a histogram
   */
  createHistogram(options: HistogramOptions): IHistogram {
    const histogram = new Histogram(options);
    return this.register(histogram);
  }

  /**
   * Create and register a summary (not implemented in this foundation)
   */
  createSummary(_options: SummaryOptions): ISummary {
    throw new Error('Summary metric is not implemented in the foundation');
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.ensureNotDisposed();
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }

  /**
   * Get metrics in Prometheus text format
   */
  getMetricsAsText(): string {
    this.ensureNotDisposed();

    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      // Add HELP line
      lines.push(`# HELP ${metric.fullName} ${this.escapeHelp(metric.help)}`);
      // Add TYPE line
      lines.push(`# TYPE ${metric.fullName} ${metric.type}`);

      // Add metric values based on type
      if (metric.type === MetricType.HISTOGRAM) {
        this.formatHistogramText(metric as IHistogram, lines);
      } else {
        this.formatSimpleMetricText(metric, lines);
      }

      // Empty line between metrics
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get metrics as JSON
   */
  getMetricsAsJson(): Record<string, unknown>[] {
    this.ensureNotDisposed();

    const result: Record<string, unknown>[] = [];

    for (const metric of this.metrics.values()) {
      const values = metric.getValues();

      for (const value of values) {
        const entry: Record<string, unknown> = {
          name: metric.fullName,
          type: metric.type,
          help: metric.help,
          value: value.value,
          labels: value.labels,
        };

        if (value.timestamp) {
          entry.timestamp = value.timestamp.toISOString();
        }

        result.push(entry);
      }
    }

    return result;
  }

  /**
   * Dispose the registry
   */
  dispose(): void {
    this.disposed = true;
    this.metrics.clear();
  }

  /**
   * Format histogram for text output
   */
  private formatHistogramText(histogram: IHistogram, lines: string[]): void {
    const values = histogram.getValues();

    for (const value of values) {
      const histValue = (histogram as Histogram).getHistogramValue(value.labels);
      if (!histValue) continue;

      const labelStr = this.formatLabels(value.labels);
      const baseLabelStr = labelStr ? `{${labelStr}` : '{';

      // Bucket values (cumulative)
      for (const [le, count] of histValue.buckets.entries()) {
        const leStr = le === Infinity ? '+Inf' : String(le);
        const bucketLabels = labelStr
          ? `${baseLabelStr},le="${leStr}"}`
          : `{le="${leStr}"}`;
        lines.push(`${histogram.fullName}_bucket${bucketLabels} ${count}`);
      }

      // Sum
      const sumLabels = labelStr ? `{${labelStr}}` : '';
      lines.push(`${histogram.fullName}_sum${sumLabels} ${histValue.sum}`);

      // Count
      lines.push(`${histogram.fullName}_count${sumLabels} ${histValue.count}`);
    }

    // If no values, output nothing for histogram
    if (values.length === 0) {
      // Output bucket structure with 0 values
      const buckets = histogram.getBuckets();
      for (const le of buckets) {
        const leStr = le === Infinity ? '+Inf' : String(le);
        lines.push(`${histogram.fullName}_bucket{le="${leStr}"} 0`);
      }
      lines.push(`${histogram.fullName}_sum 0`);
      lines.push(`${histogram.fullName}_count 0`);
    }
  }

  /**
   * Format simple metric (counter/gauge) for text output
   */
  private formatSimpleMetricText(metric: IMetric, lines: string[]): void {
    const values = metric.getValues();

    if (values.length === 0) {
      // Output metric with no labels and value 0
      lines.push(`${metric.fullName} 0`);
    } else {
      for (const value of values) {
        const labelStr = this.formatLabels(value.labels);
        const labelPart = labelStr ? `{${labelStr}}` : '';
        lines.push(`${metric.fullName}${labelPart} ${value.value}`);
      }
    }
  }

  /**
   * Format labels for Prometheus text format
   */
  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${this.escapeLabelValue(value)}"`)
      .join(',');
    return pairs;
  }

  /**
   * Escape help text for Prometheus format
   */
  private escapeHelp(help: string): string {
    return help.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
  }

  /**
   * Escape label value for Prometheus format
   */
  private escapeLabelValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  /**
   * Ensure registry is not disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('MetricRegistry has been disposed');
    }
  }
}

/**
 * Global metric registry instance
 */
let globalRegistry: MetricRegistry | null = null;

/**
 * Get global metric registry
 */
export function getMetricRegistry(): IMetricRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricRegistry();
  }
  return globalRegistry;
}

/**
 * Reset global metric registry (for testing)
 */
export function resetMetricRegistry(): void {
  if (globalRegistry) {
    globalRegistry.dispose();
    globalRegistry = null;
  }
}

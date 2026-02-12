/**
 * Metrics Exporter
 *
 * In-memory metrics collection supporting counter, gauge, and histogram
 * metric types. Provides an OTel-compatible recording surface without
 * requiring an external SDK.
 *
 * @module shared/telemetry/metrics-exporter
 */

import type { IMetricsExporter, MetricPoint } from './interfaces/telemetry.interface';

/**
 * In-memory metrics exporter.
 *
 * All recorded metric points are stored in an ordered list and can be
 * retrieved or cleared at any time.
 */
export class MetricsExporter implements IMetricsExporter {
  private metrics: MetricPoint[] = [];

  record(point: MetricPoint): void {
    this.metrics.push(point);
  }

  increment(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1,
  ): void {
    this.record({
      name,
      value,
      timestamp: Date.now(),
      labels,
      type: 'counter',
    });
  }

  gauge(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    this.record({
      name,
      value,
      timestamp: Date.now(),
      labels,
      type: 'gauge',
    });
  }

  histogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    this.record({
      name,
      value,
      timestamp: Date.now(),
      labels,
      type: 'histogram',
    });
  }

  getMetrics(): MetricPoint[] {
    return [...this.metrics];
  }

  reset(): void {
    this.metrics = [];
  }
}

/**
 * Factory: create a MetricsExporter instance.
 */
export function createMetricsExporter(): MetricsExporter {
  return new MetricsExporter();
}

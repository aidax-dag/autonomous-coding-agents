/**
 * Metrics Collector
 *
 * In-memory time-series metrics storage with name-based querying.
 *
 * @module core/hud
 */

import type { IMetricsCollector, MetricPoint } from './interfaces/hud.interface';

/**
 * Metrics collector config
 */
export interface MetricsCollectorConfig {
  /** Max data points to retain (default: 1000) */
  maxPoints?: number;
}

/**
 * In-memory metrics collector
 */
export class MetricsCollector implements IMetricsCollector {
  private readonly points: MetricPoint[] = [];
  private readonly maxPoints: number;

  constructor(config: MetricsCollectorConfig = {}) {
    this.maxPoints = config.maxPoints ?? 1000;
  }

  record(metric: MetricPoint): void {
    this.points.push({ ...metric });
    if (this.points.length > this.maxPoints) {
      this.points.splice(0, this.points.length - this.maxPoints);
    }
  }

  recordValue(name: string, value: number, unit = ''): void {
    this.record({
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
    });
  }

  getLatest(count = 10): MetricPoint[] {
    return this.points.slice(-count).map((p) => ({ ...p }));
  }

  getByName(name: string, count = 10): MetricPoint[] {
    return this.points
      .filter((p) => p.name === name)
      .slice(-count)
      .map((p) => ({ ...p }));
  }

  clear(): void {
    this.points.length = 0;
  }
}

/**
 * Factory function
 */
export function createMetricsCollector(config?: MetricsCollectorConfig): MetricsCollector {
  return new MetricsCollector(config);
}

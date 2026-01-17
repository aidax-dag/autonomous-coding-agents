/**
 * Metrics Collector
 *
 * Real-time metrics collection with time series storage and aggregation queries.
 * Collects metrics from various sources and provides analysis capabilities.
 *
 * Feature: Metrics System (Phase 3.2)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  IMetricRegistry,
  MetricLabels,
  MetricValue,
} from './metrics.interface';

// ============================================================================
// Types
// ============================================================================

/**
 * Time series data point
 */
export interface DataPoint {
  timestamp: Date;
  value: number;
  labels: MetricLabels;
}

/**
 * Time series for a metric
 */
export interface TimeSeries {
  metricName: string;
  labels: MetricLabels;
  dataPoints: DataPoint[];
}

/**
 * Aggregation type
 */
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'rate' | 'p50' | 'p90' | 'p99';

/**
 * Time range for queries
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Aggregation query options
 */
export interface AggregationQuery {
  metricName: string;
  aggregation: AggregationType;
  labels?: MetricLabels;
  timeRange?: TimeRange;
  groupBy?: string[];
  interval?: number; // milliseconds
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  metricName: string;
  aggregation: AggregationType;
  value: number;
  labels?: MetricLabels;
  dataPoints?: DataPoint[];
  groupedResults?: Map<string, number>;
}

/**
 * Metric snapshot
 */
export interface MetricSnapshot {
  id: string;
  timestamp: Date;
  metrics: Map<string, MetricValue[]>;
}

/**
 * Collection source
 */
export interface CollectionSource {
  id: string;
  name: string;
  type: 'registry' | 'callback' | 'push';
  registry?: IMetricRegistry;
  callback?: () => Promise<Map<string, number>>;
  interval?: number;
}

/**
 * Metrics collector configuration
 */
export interface MetricsCollectorConfig {
  /** Collector name */
  name?: string;
  /** Collection interval in ms */
  collectionInterval?: number;
  /** Maximum data points per series */
  maxDataPoints?: number;
  /** Data retention period in ms */
  retentionPeriod?: number;
  /** Enable auto-collection */
  autoCollect?: boolean;
  /** Snapshot interval in ms */
  snapshotInterval?: number;
  /** Maximum snapshots to keep */
  maxSnapshots?: number;
}

/**
 * Collector events
 */
export interface MetricsCollectorEvents {
  'collection:started': () => void;
  'collection:completed': (count: number) => void;
  'snapshot:created': (snapshot: MetricSnapshot) => void;
  'data:expired': (count: number) => void;
  'source:added': (source: CollectionSource) => void;
  'source:removed': (sourceId: string) => void;
}

/**
 * Collector statistics
 */
export interface CollectorStats {
  totalDataPoints: number;
  totalSeries: number;
  totalSnapshots: number;
  collectionCount: number;
  lastCollectionTime?: Date;
  oldestDataPoint?: Date;
  newestDataPoint?: Date;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_COLLECTOR_CONFIG: Required<MetricsCollectorConfig> = {
  name: 'metrics-collector',
  collectionInterval: 10000, // 10 seconds
  maxDataPoints: 10000,
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  autoCollect: true,
  snapshotInterval: 60000, // 1 minute
  maxSnapshots: 100,
};

// ============================================================================
// Metrics Collector Implementation
// ============================================================================

/**
 * Metrics Collector
 *
 * Collects and stores time series metrics data.
 */
export class MetricsCollector extends EventEmitter {
  private config: Required<MetricsCollectorConfig>;
  private sources: Map<string, CollectionSource>;
  private timeSeries: Map<string, TimeSeries>;
  private snapshots: MetricSnapshot[];
  private collectionTimer?: ReturnType<typeof setInterval>;
  private snapshotTimer?: ReturnType<typeof setInterval>;
  private collectionCount: number;
  private started: boolean;

  constructor(config: MetricsCollectorConfig = {}) {
    super();

    this.config = {
      ...DEFAULT_COLLECTOR_CONFIG,
      ...config,
    };

    this.sources = new Map();
    this.timeSeries = new Map();
    this.snapshots = [];
    this.collectionCount = 0;
    this.started = false;
  }

  // ==========================================================================
  // Source Management
  // ==========================================================================

  /**
   * Add a metric registry as source
   */
  addRegistry(name: string, registry: IMetricRegistry): string {
    const source: CollectionSource = {
      id: uuidv4(),
      name,
      type: 'registry',
      registry,
    };

    this.sources.set(source.id, source);
    this.emit('source:added', source);

    return source.id;
  }

  /**
   * Add a callback-based source
   */
  addCallback(name: string, callback: () => Promise<Map<string, number>>, interval?: number): string {
    const source: CollectionSource = {
      id: uuidv4(),
      name,
      type: 'callback',
      callback,
      interval: interval || this.config.collectionInterval,
    };

    this.sources.set(source.id, source);
    this.emit('source:added', source);

    return source.id;
  }

  /**
   * Remove a source
   */
  removeSource(sourceId: string): boolean {
    const removed = this.sources.delete(sourceId);
    if (removed) {
      this.emit('source:removed', sourceId);
    }
    return removed;
  }

  /**
   * Get all sources
   */
  getSources(): CollectionSource[] {
    return Array.from(this.sources.values());
  }

  // ==========================================================================
  // Collection
  // ==========================================================================

  /**
   * Start automatic collection
   */
  start(): void {
    if (this.started) return;

    this.started = true;
    this.emit('collection:started');

    if (this.config.autoCollect) {
      this.collectionTimer = setInterval(() => {
        this.collect().catch(() => {
          // Ignore collection errors in background
        });
      }, this.config.collectionInterval);

      this.snapshotTimer = setInterval(() => {
        this.createSnapshot();
      }, this.config.snapshotInterval);
    }

    // Initial collection
    this.collect().catch(() => {
      // Ignore initial collection errors
    });
  }

  /**
   * Stop automatic collection
   */
  stop(): void {
    this.started = false;

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
  }

  /**
   * Collect metrics from all sources
   */
  async collect(): Promise<number> {
    const timestamp = new Date();
    let count = 0;

    for (const source of this.sources.values()) {
      try {
        if (source.type === 'registry' && source.registry) {
          count += this.collectFromRegistry(source.registry, timestamp);
        } else if (source.type === 'callback' && source.callback) {
          const values = await source.callback();
          count += this.collectFromCallback(values, timestamp);
        }
      } catch (_error) {
        // Log error but continue with other sources
      }
    }

    this.collectionCount++;
    this.emit('collection:completed', count);

    // Cleanup old data
    this.cleanup();

    return count;
  }

  /**
   * Push a single metric value
   */
  push(metricName: string, value: number, labels: MetricLabels = {}): void {
    const key = this.getSeriesKey(metricName, labels);
    const timestamp = new Date();

    let series = this.timeSeries.get(key);
    if (!series) {
      series = {
        metricName,
        labels,
        dataPoints: [],
      };
      this.timeSeries.set(key, series);
    }

    series.dataPoints.push({ timestamp, value, labels });

    // Enforce max data points
    while (series.dataPoints.length > this.config.maxDataPoints) {
      series.dataPoints.shift();
    }
  }

  private collectFromRegistry(registry: IMetricRegistry, _timestamp: Date): number {
    let count = 0;
    const metrics = registry.getAll();

    for (const metric of metrics) {
      const values = metric.getValues();
      for (const metricValue of values) {
        this.push(metric.fullName, metricValue.value, metricValue.labels);
        count++;
      }
    }

    return count;
  }

  private collectFromCallback(values: Map<string, number>, _timestamp: Date): number {
    let count = 0;

    for (const [name, value] of values) {
      this.push(name, value, {});
      count++;
    }

    return count;
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get time series data
   */
  getSeries(metricName: string, labels?: MetricLabels, timeRange?: TimeRange): TimeSeries | undefined {
    const key = this.getSeriesKey(metricName, labels || {});
    const series = this.timeSeries.get(key);

    if (!series) return undefined;

    if (timeRange) {
      return {
        ...series,
        dataPoints: series.dataPoints.filter(
          dp => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end
        ),
      };
    }

    return series;
  }

  /**
   * Query all series matching a pattern
   */
  querySeries(metricName: string, labelFilter?: Partial<MetricLabels>): TimeSeries[] {
    const results: TimeSeries[] = [];

    for (const series of this.timeSeries.values()) {
      if (series.metricName !== metricName) continue;

      if (labelFilter) {
        const matches = Object.entries(labelFilter).every(
          ([key, value]) => series.labels[key] === value
        );
        if (!matches) continue;
      }

      results.push(series);
    }

    return results;
  }

  /**
   * Execute an aggregation query
   */
  aggregate(query: AggregationQuery): AggregationResult {
    const series = this.querySeries(query.metricName, query.labels);
    let dataPoints: DataPoint[] = [];

    for (const s of series) {
      let points = s.dataPoints;

      if (query.timeRange) {
        points = points.filter(
          dp => dp.timestamp >= query.timeRange!.start && dp.timestamp <= query.timeRange!.end
        );
      }

      dataPoints = dataPoints.concat(points);
    }

    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate aggregation
    const value = this.calculateAggregation(query.aggregation, dataPoints);

    // Group by if specified
    let groupedResults: Map<string, number> | undefined;
    if (query.groupBy && query.groupBy.length > 0) {
      groupedResults = this.groupByLabels(dataPoints, query.groupBy, query.aggregation);
    }

    return {
      metricName: query.metricName,
      aggregation: query.aggregation,
      value,
      labels: query.labels,
      dataPoints: query.interval ? this.downsample(dataPoints, query.interval) : undefined,
      groupedResults,
    };
  }

  private calculateAggregation(type: AggregationType, dataPoints: DataPoint[]): number {
    if (dataPoints.length === 0) return 0;

    const values = dataPoints.map(dp => dp.value);

    switch (type) {
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);

      case 'avg':
        return values.reduce((sum, v) => sum + v, 0) / values.length;

      case 'min':
        return Math.min(...values);

      case 'max':
        return Math.max(...values);

      case 'count':
        return values.length;

      case 'rate':
        if (dataPoints.length < 2) return 0;
        const firstPoint = dataPoints[0];
        const lastPoint = dataPoints[dataPoints.length - 1];
        const timeDiff = (lastPoint.timestamp.getTime() - firstPoint.timestamp.getTime()) / 1000;
        return timeDiff > 0 ? (lastPoint.value - firstPoint.value) / timeDiff : 0;

      case 'p50':
        return this.percentile(values, 50);

      case 'p90':
        return this.percentile(values, 90);

      case 'p99':
        return this.percentile(values, 99);

      default:
        return 0;
    }
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;

    return sorted[Math.max(0, index)];
  }

  private groupByLabels(
    dataPoints: DataPoint[],
    groupBy: string[],
    aggregation: AggregationType
  ): Map<string, number> {
    const groups = new Map<string, DataPoint[]>();

    for (const dp of dataPoints) {
      const key = groupBy.map(g => `${g}=${dp.labels[g] || ''}`).join(',');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(dp);
    }

    const results = new Map<string, number>();
    for (const [key, points] of groups) {
      results.set(key, this.calculateAggregation(aggregation, points));
    }

    return results;
  }

  private downsample(dataPoints: DataPoint[], interval: number): DataPoint[] {
    if (dataPoints.length === 0 || interval <= 0) return dataPoints;

    const result: DataPoint[] = [];
    let currentBucket: DataPoint[] = [];
    let bucketStart = dataPoints[0].timestamp.getTime();

    for (const dp of dataPoints) {
      const dpTime = dp.timestamp.getTime();

      if (dpTime >= bucketStart + interval) {
        if (currentBucket.length > 0) {
          const avgValue = currentBucket.reduce((sum, p) => sum + p.value, 0) / currentBucket.length;
          result.push({
            timestamp: new Date(bucketStart + interval / 2),
            value: avgValue,
            labels: currentBucket[0].labels,
          });
        }
        bucketStart = Math.floor(dpTime / interval) * interval;
        currentBucket = [dp];
      } else {
        currentBucket.push(dp);
      }
    }

    // Handle last bucket
    if (currentBucket.length > 0) {
      const avgValue = currentBucket.reduce((sum, p) => sum + p.value, 0) / currentBucket.length;
      result.push({
        timestamp: new Date(bucketStart + interval / 2),
        value: avgValue,
        labels: currentBucket[0].labels,
      });
    }

    return result;
  }

  // ==========================================================================
  // Snapshots
  // ==========================================================================

  /**
   * Create a snapshot of current metrics
   */
  createSnapshot(): MetricSnapshot {
    const snapshot: MetricSnapshot = {
      id: uuidv4(),
      timestamp: new Date(),
      metrics: new Map(),
    };

    for (const series of this.timeSeries.values()) {
      const latestPoint = series.dataPoints[series.dataPoints.length - 1];
      if (!latestPoint) continue;

      if (!snapshot.metrics.has(series.metricName)) {
        snapshot.metrics.set(series.metricName, []);
      }

      snapshot.metrics.get(series.metricName)!.push({
        value: latestPoint.value,
        labels: latestPoint.labels,
        timestamp: latestPoint.timestamp,
      });
    }

    this.snapshots.push(snapshot);

    // Enforce max snapshots
    while (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    this.emit('snapshot:created', snapshot);

    return snapshot;
  }

  /**
   * Get snapshot by ID
   */
  getSnapshot(id: string): MetricSnapshot | undefined {
    return this.snapshots.find(s => s.id === id);
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): MetricSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  /**
   * List all snapshots
   */
  listSnapshots(limit?: number): MetricSnapshot[] {
    if (limit) {
      return this.snapshots.slice(-limit);
    }
    return [...this.snapshots];
  }

  // ==========================================================================
  // Maintenance
  // ==========================================================================

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod);
    let expiredCount = 0;

    for (const series of this.timeSeries.values()) {
      const originalLength = series.dataPoints.length;
      series.dataPoints = series.dataPoints.filter(dp => dp.timestamp >= cutoff);
      expiredCount += originalLength - series.dataPoints.length;
    }

    // Remove empty series
    for (const [key, series] of this.timeSeries) {
      if (series.dataPoints.length === 0) {
        this.timeSeries.delete(key);
      }
    }

    if (expiredCount > 0) {
      this.emit('data:expired', expiredCount);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.timeSeries.clear();
    this.snapshots = [];
    this.collectionCount = 0;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get collector statistics
   */
  getStats(): CollectorStats {
    let totalDataPoints = 0;
    let oldest: Date | undefined;
    let newest: Date | undefined;

    for (const series of this.timeSeries.values()) {
      totalDataPoints += series.dataPoints.length;

      for (const dp of series.dataPoints) {
        if (!oldest || dp.timestamp < oldest) oldest = dp.timestamp;
        if (!newest || dp.timestamp > newest) newest = dp.timestamp;
      }
    }

    return {
      totalDataPoints,
      totalSeries: this.timeSeries.size,
      totalSnapshots: this.snapshots.length,
      collectionCount: this.collectionCount,
      lastCollectionTime: newest,
      oldestDataPoint: oldest,
      newestDataPoint: newest,
    };
  }

  /**
   * Get collector name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Check if collector is running
   */
  get isRunning(): boolean {
    return this.started;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getSeriesKey(metricName: string, labels: MetricLabels): string {
    const sortedLabels = Object.keys(labels)
      .sort()
      .map(k => `${k}=${labels[k]}`)
      .join(',');

    return `${metricName}{${sortedLabels}}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a metrics collector instance
 */
export function createMetricsCollector(config: MetricsCollectorConfig = {}): MetricsCollector {
  return new MetricsCollector(config);
}

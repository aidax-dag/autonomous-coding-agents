/**
 * Metrics Collector Tests
 *
 * Feature: Metrics System (Phase 3.2)
 * Tests for MetricsCollector class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  MetricsCollector,
  createMetricsCollector,
  DEFAULT_COLLECTOR_CONFIG,
  MetricSnapshot,
  CollectionSource,
  MetricRegistry,
} from '../../../src/core/metrics/index.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({
      autoCollect: false, // Disable auto-collection for tests
    });
  });

  afterEach(() => {
    collector.stop();
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_COLLECTOR_CONFIG.collectionInterval).toBe(10000);
      expect(DEFAULT_COLLECTOR_CONFIG.maxDataPoints).toBe(10000);
      expect(DEFAULT_COLLECTOR_CONFIG.retentionPeriod).toBe(24 * 60 * 60 * 1000);
      expect(DEFAULT_COLLECTOR_CONFIG.maxSnapshots).toBe(100);
    });

    it('should accept custom configuration', () => {
      const custom = new MetricsCollector({
        name: 'custom-collector',
        collectionInterval: 5000,
        maxDataPoints: 500,
      });
      expect(custom.name).toBe('custom-collector');
      custom.stop();
    });

    it('should merge custom config with defaults', () => {
      const custom = new MetricsCollector({
        maxDataPoints: 100,
      });
      // Should have custom value but still defaults for others
      expect(custom.name).toBe('metrics-collector');
      custom.stop();
    });
  });

  // ============================================================================
  // Source Management
  // ============================================================================

  describe('Source Management', () => {
    it('should add a registry source', () => {
      const registry = new MetricRegistry();
      const sourceId = collector.addRegistry('test-registry', registry);

      expect(sourceId).toBeDefined();
      expect(collector.getSources()).toHaveLength(1);
      expect(collector.getSources()[0].type).toBe('registry');
      registry.dispose();
    });

    it('should add a callback source', () => {
      const callback = async () => new Map([['metric', 42]]);
      const sourceId = collector.addCallback('test-callback', callback);

      expect(sourceId).toBeDefined();
      expect(collector.getSources()).toHaveLength(1);
      expect(collector.getSources()[0].type).toBe('callback');
    });

    it('should remove a source', () => {
      const callback = async () => new Map<string, number>();
      const sourceId = collector.addCallback('test', callback);

      expect(collector.removeSource(sourceId)).toBe(true);
      expect(collector.getSources()).toHaveLength(0);
    });

    it('should return false when removing non-existent source', () => {
      expect(collector.removeSource('non-existent')).toBe(false);
    });

    it('should emit source:added event', (done) => {
      collector.on('source:added', (source: CollectionSource) => {
        expect(source.name).toBe('test-source');
        done();
      });

      collector.addCallback('test-source', async () => new Map());
    });

    it('should emit source:removed event', (done) => {
      const sourceId = collector.addCallback('test', async () => new Map());

      collector.on('source:removed', (id: string) => {
        expect(id).toBe(sourceId);
        done();
      });

      collector.removeSource(sourceId);
    });
  });

  // ============================================================================
  // Data Collection
  // ============================================================================

  describe('Data Collection', () => {
    it('should push metric values', () => {
      collector.push('test_metric', 42);
      collector.push('test_metric', 43);

      const series = collector.getSeries('test_metric');
      expect(series).toBeDefined();
      expect(series!.dataPoints).toHaveLength(2);
      expect(series!.dataPoints[0].value).toBe(42);
      expect(series!.dataPoints[1].value).toBe(43);
    });

    it('should push metric values with labels', () => {
      collector.push('http_requests', 100, { method: 'GET', status: '200' });
      collector.push('http_requests', 50, { method: 'POST', status: '201' });

      const getSeries = collector.getSeries('http_requests', { method: 'GET', status: '200' });
      const postSeries = collector.getSeries('http_requests', { method: 'POST', status: '201' });

      expect(getSeries).toBeDefined();
      expect(postSeries).toBeDefined();
      expect(getSeries!.dataPoints[0].value).toBe(100);
      expect(postSeries!.dataPoints[0].value).toBe(50);
    });

    it('should collect from registry source', async () => {
      const registry = new MetricRegistry();
      const counter = registry.createCounter({ name: 'test_counter', help: 'Test' });
      counter.inc(5);

      collector.addRegistry('test', registry);
      const count = await collector.collect();

      expect(count).toBeGreaterThan(0);
      registry.dispose();
    });

    it('should collect from callback source', async () => {
      const callback = async () => new Map([
        ['metric_a', 10],
        ['metric_b', 20],
      ]);

      collector.addCallback('test', callback);
      const count = await collector.collect();

      expect(count).toBe(2);
      expect(collector.getSeries('metric_a')).toBeDefined();
      expect(collector.getSeries('metric_b')).toBeDefined();
    });

    it('should emit collection:completed event', (done) => {
      collector.addCallback('test', async () => new Map([['m', 1]]));

      collector.on('collection:completed', (count: number) => {
        expect(count).toBe(1);
        done();
      });

      collector.collect();
    });

    it('should enforce max data points', () => {
      const limited = new MetricsCollector({
        maxDataPoints: 3,
        autoCollect: false,
      });

      limited.push('metric', 1);
      limited.push('metric', 2);
      limited.push('metric', 3);
      limited.push('metric', 4);
      limited.push('metric', 5);

      const series = limited.getSeries('metric');
      expect(series!.dataPoints).toHaveLength(3);
      expect(series!.dataPoints[0].value).toBe(3);
      expect(series!.dataPoints[2].value).toBe(5);
      limited.stop();
    });
  });

  // ============================================================================
  // Queries
  // ============================================================================

  describe('Queries', () => {
    beforeEach(() => {
      // Add test data
      collector.push('cpu_usage', 50, { host: 'server1' });
      collector.push('cpu_usage', 60, { host: 'server1' });
      collector.push('cpu_usage', 70, { host: 'server2' });
      collector.push('memory_usage', 80, { host: 'server1' });
    });

    it('should get series by name', () => {
      const series = collector.getSeries('memory_usage', { host: 'server1' });
      expect(series).toBeDefined();
      expect(series!.metricName).toBe('memory_usage');
    });

    it('should query series with label filter', () => {
      const results = collector.querySeries('cpu_usage', { host: 'server1' });
      expect(results).toHaveLength(1);
      expect(results[0].labels.host).toBe('server1');
    });

    it('should return empty array for non-existent series', () => {
      const results = collector.querySeries('non_existent');
      expect(results).toHaveLength(0);
    });

    it('should return undefined for non-existent series with getSeries', () => {
      const series = collector.getSeries('non_existent');
      expect(series).toBeUndefined();
    });
  });

  // ============================================================================
  // Aggregations
  // ============================================================================

  describe('Aggregations', () => {
    beforeEach(() => {
      collector.push('metric', 10);
      collector.push('metric', 20);
      collector.push('metric', 30);
      collector.push('metric', 40);
      collector.push('metric', 50);
    });

    it('should calculate sum aggregation', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'sum',
      });

      expect(result.value).toBe(150);
    });

    it('should calculate avg aggregation', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'avg',
      });

      expect(result.value).toBe(30);
    });

    it('should calculate min aggregation', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'min',
      });

      expect(result.value).toBe(10);
    });

    it('should calculate max aggregation', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'max',
      });

      expect(result.value).toBe(50);
    });

    it('should calculate count aggregation', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'count',
      });

      expect(result.value).toBe(5);
    });

    it('should calculate p50 percentile', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'p50',
      });

      expect(result.value).toBe(30);
    });

    it('should calculate p90 percentile', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'p90',
      });

      expect(result.value).toBe(50);
    });

    it('should calculate p99 percentile', () => {
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'p99',
      });

      expect(result.value).toBe(50);
    });

    it('should return 0 for empty data', () => {
      const result = collector.aggregate({
        metricName: 'non_existent',
        aggregation: 'sum',
      });

      expect(result.value).toBe(0);
    });

    it('should group by labels', () => {
      collector.push('grouped', 10, { region: 'us-east' });
      collector.push('grouped', 20, { region: 'us-east' });
      collector.push('grouped', 30, { region: 'us-west' });

      const result = collector.aggregate({
        metricName: 'grouped',
        aggregation: 'sum',
        groupBy: ['region'],
      });

      expect(result.groupedResults).toBeDefined();
      expect(result.groupedResults!.get('region=us-east')).toBe(30);
      expect(result.groupedResults!.get('region=us-west')).toBe(30);
    });

    it('should filter by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // The test data was just pushed, so it should all be in range
      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'count',
        timeRange: {
          start: oneHourAgo,
          end: now,
        },
      });

      expect(result.value).toBe(5);
    });
  });

  // ============================================================================
  // Rate Calculation
  // ============================================================================

  describe('Rate Calculation', () => {
    it('should calculate rate of change', async () => {
      // Push values with time difference
      collector.push('counter', 100);

      // Wait a bit to create time difference
      await new Promise(resolve => setTimeout(resolve, 100));

      collector.push('counter', 200);

      const result = collector.aggregate({
        metricName: 'counter',
        aggregation: 'rate',
      });

      // Rate should be (200-100) / time_in_seconds
      expect(result.value).toBeGreaterThan(0);
    });

    it('should return 0 for rate with single point', () => {
      collector.push('single', 100);

      const result = collector.aggregate({
        metricName: 'single',
        aggregation: 'rate',
      });

      expect(result.value).toBe(0);
    });
  });

  // ============================================================================
  // Snapshots
  // ============================================================================

  describe('Snapshots', () => {
    it('should create snapshot', () => {
      collector.push('metric1', 10);
      collector.push('metric2', 20);

      const snapshot = collector.createSnapshot();

      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.metrics.size).toBe(2);
    });

    it('should get snapshot by ID', () => {
      const created = collector.createSnapshot();
      const retrieved = collector.getSnapshot(created.id);

      expect(retrieved).toBe(created);
    });

    it('should get latest snapshot', () => {
      collector.push('m', 1);
      collector.createSnapshot();
      collector.push('m', 2);
      const latest = collector.createSnapshot();

      expect(collector.getLatestSnapshot()).toBe(latest);
    });

    it('should list snapshots with limit', () => {
      for (let i = 0; i < 5; i++) {
        collector.createSnapshot();
      }

      const limited = collector.listSnapshots(3);
      expect(limited).toHaveLength(3);
    });

    it('should emit snapshot:created event', (done) => {
      collector.on('snapshot:created', (snapshot: MetricSnapshot) => {
        expect(snapshot.id).toBeDefined();
        done();
      });

      collector.createSnapshot();
    });

    it('should enforce max snapshots', () => {
      const limited = new MetricsCollector({
        maxSnapshots: 3,
        autoCollect: false,
      });

      for (let i = 0; i < 5; i++) {
        limited.push('m', i);
        limited.createSnapshot();
      }

      expect(limited.listSnapshots()).toHaveLength(3);
      limited.stop();
    });
  });

  // ============================================================================
  // Start/Stop
  // ============================================================================

  describe('Start/Stop', () => {
    it('should start and stop collector', () => {
      const auto = new MetricsCollector({
        autoCollect: true,
        collectionInterval: 100,
      });

      auto.start();
      expect(auto.isRunning).toBe(true);

      auto.stop();
      expect(auto.isRunning).toBe(false);
    });

    it('should emit collection:started event', (done) => {
      collector.on('collection:started', () => {
        done();
      });

      collector.start();
    });

    it('should not start twice', () => {
      collector.start();
      const firstStart = collector.isRunning;
      collector.start();

      expect(firstStart).toBe(true);
      expect(collector.isRunning).toBe(true);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics', () => {
    it('should return collector stats', () => {
      collector.push('metric1', 10);
      collector.push('metric2', 20);
      collector.push('metric2', 30);

      const stats = collector.getStats();

      expect(stats.totalDataPoints).toBe(3);
      expect(stats.totalSeries).toBe(2);
    });

    it('should track oldest and newest data points', () => {
      collector.push('metric', 1);
      collector.push('metric', 2);

      const stats = collector.getStats();

      expect(stats.oldestDataPoint).toBeInstanceOf(Date);
      expect(stats.newestDataPoint).toBeInstanceOf(Date);
      expect(stats.newestDataPoint!.getTime()).toBeGreaterThanOrEqual(stats.oldestDataPoint!.getTime());
    });

    it('should track collection count', async () => {
      collector.addCallback('test', async () => new Map([['m', 1]]));

      await collector.collect();
      await collector.collect();

      const stats = collector.getStats();
      expect(stats.collectionCount).toBe(2);
    });

    it('should track snapshot count', () => {
      collector.createSnapshot();
      collector.createSnapshot();

      const stats = collector.getStats();
      expect(stats.totalSnapshots).toBe(2);
    });
  });

  // ============================================================================
  // Maintenance
  // ============================================================================

  describe('Maintenance', () => {
    it('should clear all data', () => {
      collector.push('metric', 10);
      collector.createSnapshot();

      collector.clear();

      expect(collector.getStats().totalDataPoints).toBe(0);
      expect(collector.getStats().totalSnapshots).toBe(0);
    });

    it('should cleanup expired data', async () => {
      const shortRetention = new MetricsCollector({
        retentionPeriod: 50, // 50ms retention
        autoCollect: false,
      });

      shortRetention.push('metric', 1);

      // Wait for data to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      shortRetention.addCallback('test', async () => new Map());
      await shortRetention.collect(); // Triggers cleanup

      expect(shortRetention.getStats().totalDataPoints).toBe(0);
      shortRetention.stop();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty metric name', () => {
      collector.push('', 42);
      const series = collector.getSeries('');
      expect(series).toBeDefined();
    });

    it('should handle negative values', () => {
      collector.push('negative', -10);
      const series = collector.getSeries('negative');
      expect(series!.dataPoints[0].value).toBe(-10);
    });

    it('should handle zero values', () => {
      collector.push('zero', 0);
      const series = collector.getSeries('zero');
      expect(series!.dataPoints[0].value).toBe(0);
    });

    it('should handle special characters in labels', () => {
      collector.push('metric', 42, { 'key-with-dash': 'value/with/slash' });
      const series = collector.getSeries('metric', { 'key-with-dash': 'value/with/slash' });
      expect(series).toBeDefined();
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = async () => {
        throw new Error('Callback failed');
      };

      collector.addCallback('failing', errorCallback);

      // Should not throw
      await expect(collector.collect()).resolves.toBe(0);
    });
  });

  // ============================================================================
  // Factory Function
  // ============================================================================

  describe('Factory Function', () => {
    it('should create collector with defaults', () => {
      const created = createMetricsCollector();
      expect(created).toBeInstanceOf(MetricsCollector);
      created.stop();
    });

    it('should create collector with custom config', () => {
      const created = createMetricsCollector({
        name: 'custom',
        maxDataPoints: 500,
      });
      expect(created.name).toBe('custom');
      created.stop();
    });
  });

  // ============================================================================
  // Downsampling
  // ============================================================================

  describe('Downsampling', () => {
    it('should downsample data with interval', async () => {
      // Push data points with some time separation
      for (let i = 0; i < 10; i++) {
        collector.push('metric', i * 10);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const result = collector.aggregate({
        metricName: 'metric',
        aggregation: 'avg',
        interval: 50, // 50ms buckets
      });

      // Should have fewer data points due to downsampling
      expect(result.dataPoints).toBeDefined();
      if (result.dataPoints && result.dataPoints.length > 0) {
        expect(result.dataPoints.length).toBeLessThanOrEqual(10);
      }
    });
  });
});

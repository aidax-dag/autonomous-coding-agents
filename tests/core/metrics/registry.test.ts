/**
 * Metric Registry Tests
 *
 * Feature: F0.7 - Metrics Foundation
 * Tests for metric registry implementation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  MetricRegistry,
  getMetricRegistry,
  resetMetricRegistry,
  Counter,
  Gauge,
  MetricType,
} from '../../../src/core/metrics/index.js';

describe('MetricRegistry', () => {
  let registry: MetricRegistry;

  beforeEach(() => {
    registry = new MetricRegistry();
  });

  afterEach(() => {
    registry.dispose();
  });

  describe('register', () => {
    it('should register a metric', () => {
      const counter = new Counter({
        name: 'test_counter',
        help: 'Test counter',
      });

      const registered = registry.register(counter);

      expect(registered).toBe(counter);
      expect(registry.get('test_counter')).toBe(counter);
    });

    it('should reject duplicate metric names', () => {
      const counter1 = new Counter({ name: 'duplicate', help: 'First' });
      const counter2 = new Counter({ name: 'duplicate', help: 'Second' });

      registry.register(counter1);

      expect(() => registry.register(counter2)).toThrow(
        /already registered/
      );
    });
  });

  describe('unregister', () => {
    it('should unregister a metric', () => {
      const counter = new Counter({ name: 'to_remove', help: 'Test' });
      registry.register(counter);

      const result = registry.unregister('to_remove');

      expect(result).toBe(true);
      expect(registry.get('to_remove')).toBeUndefined();
    });

    it('should return false for non-existent metric', () => {
      expect(registry.unregister('non_existent')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return registered metric', () => {
      const counter = new Counter({ name: 'my_counter', help: 'Test' });
      registry.register(counter);

      expect(registry.get('my_counter')).toBe(counter);
    });

    it('should return undefined for non-existent metric', () => {
      expect(registry.get('non_existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no metrics', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered metrics', () => {
      const counter = new Counter({ name: 'counter', help: 'Counter' });
      const gauge = new Gauge({ name: 'gauge', help: 'Gauge' });

      registry.register(counter);
      registry.register(gauge);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(counter);
      expect(all).toContain(gauge);
    });
  });

  describe('createCounter', () => {
    it('should create and register a counter', () => {
      const counter = registry.createCounter({
        name: 'created_counter',
        help: 'Created counter',
      });

      expect(counter.type).toBe(MetricType.COUNTER);
      expect(registry.get('created_counter')).toBe(counter);
    });
  });

  describe('createGauge', () => {
    it('should create and register a gauge', () => {
      const gauge = registry.createGauge({
        name: 'created_gauge',
        help: 'Created gauge',
      });

      expect(gauge.type).toBe(MetricType.GAUGE);
      expect(registry.get('created_gauge')).toBe(gauge);
    });
  });

  describe('createHistogram', () => {
    it('should create and register a histogram', () => {
      const histogram = registry.createHistogram({
        name: 'created_histogram',
        help: 'Created histogram',
      });

      expect(histogram.type).toBe(MetricType.HISTOGRAM);
      expect(registry.get('created_histogram')).toBe(histogram);
    });

    it('should use custom buckets', () => {
      const histogram = registry.createHistogram({
        name: 'custom_histogram',
        help: 'Custom histogram',
        buckets: [1, 5, 10],
      });

      expect(histogram.getBuckets()).toContain(1);
      expect(histogram.getBuckets()).toContain(5);
      expect(histogram.getBuckets()).toContain(10);
    });
  });

  describe('createSummary', () => {
    it('should throw not implemented error', () => {
      expect(() => registry.createSummary({
        name: 'summary',
        help: 'Summary',
      })).toThrow(/not implemented/);
    });
  });

  describe('resetAll', () => {
    it('should reset all metrics', () => {
      const counter = registry.createCounter({ name: 'counter', help: 'Counter' });
      const gauge = registry.createGauge({ name: 'gauge', help: 'Gauge' });

      counter.inc(5);
      gauge.set(10);

      registry.resetAll();

      expect(counter.get()).toBe(0);
      expect(gauge.get()).toBe(0);
    });
  });

  describe('getMetricsAsText', () => {
    it('should return empty string for no metrics', () => {
      // Creates metrics with 0 values
      expect(registry.getMetricsAsText()).toBe('');
    });

    it('should format counter correctly', () => {
      const counter = registry.createCounter({
        name: 'http_requests_total',
        help: 'Total HTTP requests',
      });
      counter.inc(5);

      const text = registry.getMetricsAsText();

      expect(text).toContain('# HELP http_requests_total Total HTTP requests');
      expect(text).toContain('# TYPE http_requests_total counter');
      expect(text).toContain('http_requests_total 5');
    });

    it('should format gauge correctly', () => {
      const gauge = registry.createGauge({
        name: 'temperature',
        help: 'Current temperature',
      });
      gauge.set(23.5);

      const text = registry.getMetricsAsText();

      expect(text).toContain('# HELP temperature Current temperature');
      expect(text).toContain('# TYPE temperature gauge');
      expect(text).toContain('temperature 23.5');
    });

    it('should format labels correctly', () => {
      const counter = registry.createCounter({
        name: 'requests',
        help: 'Requests',
        labelNames: ['method', 'status'],
      });
      counter.inc({ method: 'GET', status: '200' });

      const text = registry.getMetricsAsText();

      expect(text).toContain('requests{method="GET",status="200"} 1');
    });

    it('should format histogram correctly', () => {
      const histogram = registry.createHistogram({
        name: 'duration',
        help: 'Duration',
        buckets: [0.1, 0.5, 1],
      });
      histogram.observe(0.3);

      const text = registry.getMetricsAsText();

      expect(text).toContain('# TYPE duration histogram');
      expect(text).toContain('duration_bucket{le="0.1"} 0');
      expect(text).toContain('duration_bucket{le="0.5"} 1');
      expect(text).toContain('duration_bucket{le="1"} 1');
      expect(text).toContain('duration_bucket{le="+Inf"} 1');
      expect(text).toContain('duration_sum 0.3');
      expect(text).toContain('duration_count 1');
    });

    it('should escape help text', () => {
      registry.createCounter({
        name: 'test',
        help: 'Help with\nnewline and \\backslash',
      });

      const text = registry.getMetricsAsText();

      expect(text).toContain('Help with\\nnewline and \\\\backslash');
    });

    it('should escape label values', () => {
      const counter = registry.createCounter({
        name: 'escape_test',
        help: 'Test escaping',
        labelNames: ['path'],
      });
      counter.inc({ path: '/api/users' });

      const text = registry.getMetricsAsText();

      expect(text).toContain('escape_test{path="/api/users"} 1');
    });
  });

  describe('getMetricsAsJson', () => {
    it('should return empty array for no metrics', () => {
      expect(registry.getMetricsAsJson()).toEqual([]);
    });

    it('should return metrics as JSON', () => {
      const counter = registry.createCounter({
        name: 'requests',
        help: 'Requests',
      });
      counter.inc(3);

      const json = registry.getMetricsAsJson();

      expect(json).toHaveLength(1);
      expect(json[0].name).toBe('requests');
      expect(json[0].type).toBe('counter');
      expect(json[0].value).toBe(3);
    });

    it('should include labels in JSON', () => {
      const counter = registry.createCounter({
        name: 'requests',
        help: 'Requests',
        labelNames: ['method'],
      });
      counter.inc({ method: 'GET' });

      const json = registry.getMetricsAsJson();

      expect(json[0].labels).toEqual({ method: 'GET' });
    });
  });

  describe('dispose', () => {
    it('should throw error after disposal', () => {
      registry.dispose();

      expect(() => registry.get('test')).toThrow(/disposed/);
      expect(() => registry.getAll()).toThrow(/disposed/);
      expect(() => registry.createCounter({ name: 'test', help: 'Test' })).toThrow(/disposed/);
    });
  });
});

describe('Global MetricRegistry', () => {
  afterEach(() => {
    resetMetricRegistry();
  });

  it('should return singleton instance', () => {
    const registry1 = getMetricRegistry();
    const registry2 = getMetricRegistry();

    expect(registry1).toBe(registry2);
  });

  it('should create new instance after reset', () => {
    const registry1 = getMetricRegistry();
    resetMetricRegistry();
    const registry2 = getMetricRegistry();

    expect(registry1).not.toBe(registry2);
  });

  it('should work as expected', () => {
    const registry = getMetricRegistry();
    const counter = registry.createCounter({
      name: 'global_counter',
      help: 'Global counter',
    });

    counter.inc(5);

    expect(registry.get('global_counter')).toBe(counter);
    expect(counter.get()).toBe(5);
  });
});

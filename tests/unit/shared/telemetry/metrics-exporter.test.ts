/**
 * Metrics Exporter Tests
 */

import {
  MetricsExporter,
  createMetricsExporter,
} from '../../../../src/shared/telemetry/metrics-exporter';
import type { MetricPoint } from '../../../../src/shared/telemetry/interfaces/telemetry.interface';

describe('MetricsExporter', () => {
  let exporter: MetricsExporter;

  beforeEach(() => {
    exporter = new MetricsExporter();
  });

  describe('record', () => {
    it('should store a raw metric point', () => {
      const point: MetricPoint = {
        name: 'http.requests',
        value: 42,
        timestamp: Date.now(),
        labels: { method: 'GET', path: '/api' },
        type: 'counter',
      };

      exporter.record(point);

      const metrics = exporter.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(point);
    });
  });

  describe('increment', () => {
    it('should record a counter metric with default value 1', () => {
      exporter.increment('task.completed');

      const metrics = exporter.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('task.completed');
      expect(metrics[0].value).toBe(1);
      expect(metrics[0].type).toBe('counter');
      expect(metrics[0].labels).toEqual({});
    });

    it('should record a counter with custom value and labels', () => {
      exporter.increment('bytes.sent', { endpoint: '/upload' }, 1024);

      const metrics = exporter.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(1024);
      expect(metrics[0].labels).toEqual({ endpoint: '/upload' });
    });
  });

  describe('gauge', () => {
    it('should record a gauge metric', () => {
      exporter.gauge('cpu.usage', 73.5, { host: 'node-1' });

      const metrics = exporter.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('cpu.usage');
      expect(metrics[0].value).toBe(73.5);
      expect(metrics[0].type).toBe('gauge');
      expect(metrics[0].labels).toEqual({ host: 'node-1' });
    });

    it('should default labels to empty object', () => {
      exporter.gauge('memory.free', 2048);

      const metrics = exporter.getMetrics();
      expect(metrics[0].labels).toEqual({});
    });
  });

  describe('histogram', () => {
    it('should record a histogram metric', () => {
      exporter.histogram('response.latency', 145.7, { route: '/api/users' });

      const metrics = exporter.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('response.latency');
      expect(metrics[0].value).toBe(145.7);
      expect(metrics[0].type).toBe('histogram');
      expect(metrics[0].labels).toEqual({ route: '/api/users' });
    });
  });

  describe('getMetrics', () => {
    it('should return all recorded metrics in order', () => {
      exporter.increment('a');
      exporter.gauge('b', 10);
      exporter.histogram('c', 20);

      const metrics = exporter.getMetrics();
      expect(metrics).toHaveLength(3);
      expect(metrics.map((m) => m.name)).toEqual(['a', 'b', 'c']);
    });

    it('should return a copy of the internal array', () => {
      exporter.increment('x');
      const metrics = exporter.getMetrics();
      metrics.pop();

      expect(exporter.getMetrics()).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      exporter.increment('a');
      exporter.gauge('b', 5);
      exporter.histogram('c', 10);
      expect(exporter.getMetrics()).toHaveLength(3);

      exporter.reset();

      expect(exporter.getMetrics()).toHaveLength(0);
    });
  });

  describe('createMetricsExporter factory', () => {
    it('should return a functional MetricsExporter instance', () => {
      const me = createMetricsExporter();
      expect(me).toBeInstanceOf(MetricsExporter);

      me.increment('factory.test');
      expect(me.getMetrics()).toHaveLength(1);
    });
  });
});

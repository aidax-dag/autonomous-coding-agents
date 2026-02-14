/**
 * PrometheusExporter Unit Tests
 */

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockServerListen = jest.fn(
  (_port: number, cb: () => void) => cb(),
);
const mockServerClose = jest.fn((cb: () => void) => cb());
const mockServerOn = jest.fn();
let serverHandler: Function;

jest.mock('http', () => ({
  createServer: jest.fn((handler: Function) => {
    serverHandler = handler;
    return {
      listen: mockServerListen,
      close: mockServerClose,
      on: mockServerOn,
    };
  }),
}));

import {
  PrometheusExporter,
  createPrometheusExporter,
} from '../../../../src/shared/telemetry/prometheus-exporter';
import type {
  IMetricsExporter,
  MetricPoint,
} from '../../../../src/shared/telemetry/interfaces/telemetry.interface';

function makeMetricsSource(metrics: MetricPoint[]): IMetricsExporter {
  return {
    record: jest.fn(),
    increment: jest.fn(),
    gauge: jest.fn(),
    histogram: jest.fn(),
    getMetrics: () => metrics,
    reset: jest.fn(),
  };
}

describe('PrometheusExporter', () => {
  let exporter: PrometheusExporter;

  beforeEach(() => {
    jest.clearAllMocks();
    exporter = new PrometheusExporter({ port: 9464, prefix: 'aca' });
  });

  // ==========================================================================
  // Output generation
  // ==========================================================================

  describe('generateOutput', () => {
    it('should format counter metrics', () => {
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'requests_total',
            value: 5,
            timestamp: 1000,
            labels: { method: 'GET' },
            type: 'counter',
          },
          {
            name: 'requests_total',
            value: 3,
            timestamp: 1001,
            labels: { method: 'POST' },
            type: 'counter',
          },
        ]),
      );

      const output = exporter.generateOutput();
      expect(output).toContain('# TYPE aca_requests_total counter');
      expect(output).toContain('aca_requests_total{method="GET"} 5');
      expect(output).toContain('aca_requests_total{method="POST"} 3');
    });

    it('should format gauge metrics', () => {
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'active_tasks',
            value: 42,
            timestamp: 1000,
            labels: {},
            type: 'gauge',
          },
        ]),
      );

      const output = exporter.generateOutput();
      expect(output).toContain('# TYPE aca_active_tasks gauge');
      expect(output).toContain('aca_active_tasks 42');
    });

    it('should format histogram metrics with buckets', () => {
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'request_duration',
            value: 0.1,
            timestamp: 1000,
            labels: {},
            type: 'histogram',
          },
          {
            name: 'request_duration',
            value: 0.5,
            timestamp: 1001,
            labels: {},
            type: 'histogram',
          },
          {
            name: 'request_duration',
            value: 2.0,
            timestamp: 1002,
            labels: {},
            type: 'histogram',
          },
        ]),
      );

      const output = exporter.generateOutput();
      expect(output).toContain('# TYPE aca_request_duration histogram');
      expect(output).toContain('aca_request_duration_bucket{le="0.1"} 1');
      expect(output).toContain('aca_request_duration_count 3');
    });

    it('should apply default labels', () => {
      exporter = new PrometheusExporter({
        prefix: 'aca',
        defaultLabels: { env: 'test' },
      });
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'counter',
            value: 1,
            timestamp: 1000,
            labels: {},
            type: 'counter',
          },
        ]),
      );

      const output = exporter.generateOutput();
      expect(output).toContain('env="test"');
    });

    it('should escape label values', () => {
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'test',
            value: 1,
            timestamp: 1000,
            labels: { path: '/api/"test"' },
            type: 'counter',
          },
        ]),
      );

      const output = exporter.generateOutput();
      expect(output).toContain('\\"test\\"');
    });

    it('should sanitize metric names', () => {
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'my-metric.count',
            value: 1,
            timestamp: 1000,
            labels: {},
            type: 'counter',
          },
        ]),
      );

      const output = exporter.generateOutput();
      expect(output).toContain('aca_my_metric_count');
    });

    it('should handle empty metrics', () => {
      exporter.setMetricsSource(makeMetricsSource([]));
      const output = exporter.generateOutput();
      expect(output).toBe('\n');
    });

    it('should include custom recorded metrics', () => {
      exporter.record({
        name: 'custom',
        value: 99,
        timestamp: 1000,
        labels: {},
        type: 'gauge',
      });
      const output = exporter.generateOutput();
      expect(output).toContain('aca_custom 99');
    });

    it('should aggregate counters with same labels', () => {
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'total',
            value: 5,
            timestamp: 1000,
            labels: { src: 'a' },
            type: 'counter',
          },
          {
            name: 'total',
            value: 3,
            timestamp: 1001,
            labels: { src: 'a' },
            type: 'counter',
          },
        ]),
      );

      const output = exporter.generateOutput();
      expect(output).toContain('aca_total{src="a"} 8');
    });
  });

  // ==========================================================================
  // Server lifecycle
  // ==========================================================================

  describe('server lifecycle', () => {
    it('should start server on configured port', async () => {
      await exporter.start();
      expect(exporter.isRunning()).toBe(true);
      expect(mockServerListen).toHaveBeenCalledWith(
        9464,
        expect.any(Function),
      );
    });

    it('should stop server', async () => {
      await exporter.start();
      await exporter.stop();
      expect(exporter.isRunning()).toBe(false);
      expect(mockServerClose).toHaveBeenCalled();
    });

    it('should be idempotent on start', async () => {
      await exporter.start();
      await exporter.start();
      const http = require('http');
      expect(http.createServer).toHaveBeenCalledTimes(1);
    });

    it('should respond with metrics on /metrics', async () => {
      exporter.setMetricsSource(
        makeMetricsSource([
          {
            name: 'test',
            value: 1,
            timestamp: 1000,
            labels: {},
            type: 'counter',
          },
        ]),
      );
      await exporter.start();

      const mockRes = { writeHead: jest.fn(), end: jest.fn() };
      serverHandler({ url: '/metrics', method: 'GET' }, mockRes);
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200,
        expect.any(Object),
      );
      expect(mockRes.end).toHaveBeenCalledWith(
        expect.stringContaining('aca_test'),
      );
    });

    it('should return 404 for other paths', async () => {
      await exporter.start();
      const mockRes = { writeHead: jest.fn(), end: jest.fn() };
      serverHandler({ url: '/health', method: 'GET' }, mockRes);
      expect(mockRes.writeHead).toHaveBeenCalledWith(404);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createPrometheusExporter', () => {
    it('should create an instance', () => {
      const e = createPrometheusExporter();
      expect(e).toBeInstanceOf(PrometheusExporter);
    });
  });
});

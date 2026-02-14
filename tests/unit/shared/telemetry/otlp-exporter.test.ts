/**
 * OTLPTraceExporter Unit Tests
 */

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import {
  OTLPTraceExporter,
  createOTLPTraceExporter,
} from '../../../../src/shared/telemetry/otlp-exporter';
import type { Span } from '../../../../src/shared/telemetry/interfaces/telemetry.interface';

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    name: 'test-span',
    context: { traceId: 'abc123', spanId: 'def456' },
    startTime: 1000,
    endTime: 2000,
    attributes: { 'task.id': 'task-1' },
    status: 'ok',
    events: [],
    ...overrides,
  };
}

describe('OTLPTraceExporter', () => {
  let exporter: OTLPTraceExporter;
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);
    exporter = new OTLPTraceExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      exportIntervalMs: 5000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    mockFetch.mockRestore();
  });

  // ==========================================================================
  // Enqueue
  // ==========================================================================

  describe('enqueue', () => {
    it('should buffer spans', () => {
      exporter.enqueue(makeSpan());
      expect(exporter.getStats().buffered).toBe(1);
    });

    it('should auto-flush at batch size', () => {
      const batchExporter = new OTLPTraceExporter({ batchSize: 2 });
      batchExporter.enqueue(makeSpan({ name: 's1' }));
      batchExporter.enqueue(makeSpan({ name: 's2' }));
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Flush
  // ==========================================================================

  describe('flush', () => {
    it('should send spans to endpoint', async () => {
      exporter.enqueue(makeSpan());
      await exporter.flush();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4318/v1/traces',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(exporter.getStats().exported).toBe(1);
      expect(exporter.getStats().buffered).toBe(0);
    });

    it('should do nothing on empty buffer', async () => {
      await exporter.flush();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should re-queue on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);
      exporter.enqueue(makeSpan());
      await exporter.flush();
      expect(exporter.getStats().errors).toBe(1);
      expect(exporter.getStats().buffered).toBe(1);
    });

    it('should re-queue on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      exporter.enqueue(makeSpan());
      await exporter.flush();
      expect(exporter.getStats().errors).toBe(1);
      expect(exporter.getStats().buffered).toBe(1);
    });
  });

  // ==========================================================================
  // Start / Stop
  // ==========================================================================

  describe('start/stop', () => {
    it('should start periodic export', () => {
      exporter.start();
      exporter.enqueue(makeSpan());
      jest.advanceTimersByTime(5000);
      // Periodic flush triggered
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should be idempotent on start', () => {
      exporter.start();
      exporter.start(); // no error
    });

    it('should stop and flush remaining', async () => {
      exporter.start();
      exporter.enqueue(makeSpan());
      await exporter.stop();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // OTLP Payload
  // ==========================================================================

  describe('payload format', () => {
    it('should include resource attributes', async () => {
      const customExporter = new OTLPTraceExporter({
        serviceName: 'test-service',
        resourceAttributes: { 'deployment.environment': 'test' },
      });
      customExporter.enqueue(makeSpan());
      await customExporter.flush();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const attrs = body.resourceSpans[0].resource.attributes;
      expect(attrs).toEqual(
        expect.arrayContaining([
          { key: 'service.name', value: { stringValue: 'test-service' } },
          {
            key: 'deployment.environment',
            value: { stringValue: 'test' },
          },
        ]),
      );
    });

    it('should include span events', async () => {
      const span = makeSpan({
        events: [
          {
            name: 'exception',
            timestamp: 1500,
            attributes: { 'error.type': 'TypeError' },
          },
        ],
      });
      exporter.enqueue(span);
      await exporter.flush();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const events =
        body.resourceSpans[0].scopeSpans[0].spans[0].events;
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('exception');
    });

    it('should set correct status codes', async () => {
      exporter.enqueue(makeSpan({ status: 'error' }));
      await exporter.flush();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const status =
        body.resourceSpans[0].scopeSpans[0].spans[0].status;
      expect(status.code).toBe(2); // ERROR
    });

    it('should include custom headers', async () => {
      const authExporter = new OTLPTraceExporter({
        headers: { Authorization: 'Bearer token' },
      });
      authExporter.enqueue(makeSpan());
      await authExporter.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // Stats
  // ==========================================================================

  describe('getStats', () => {
    it('should track export statistics', async () => {
      exporter.enqueue(makeSpan());
      await exporter.flush();
      const stats = exporter.getStats();
      expect(stats.exported).toBe(1);
      expect(stats.errors).toBe(0);
      expect(stats.buffered).toBe(0);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createOTLPTraceExporter', () => {
    it('should create an instance', () => {
      const e = createOTLPTraceExporter();
      expect(e).toBeInstanceOf(OTLPTraceExporter);
    });
  });
});

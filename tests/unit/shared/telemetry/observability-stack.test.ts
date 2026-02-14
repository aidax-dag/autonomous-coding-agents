/**
 * ObservabilityStack Unit Tests
 */

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockOTLPStart = jest.fn();
const mockOTLPStop = jest.fn().mockResolvedValue(undefined);
const mockOTLPEnqueue = jest.fn();

jest.mock('../../../../src/shared/telemetry/otlp-exporter', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation(() => ({
    start: mockOTLPStart,
    stop: mockOTLPStop,
    enqueue: mockOTLPEnqueue,
  })),
}));

const mockPromStart = jest.fn().mockResolvedValue(undefined);
const mockPromStop = jest.fn().mockResolvedValue(undefined);
const mockPromSetSource = jest.fn();

jest.mock('../../../../src/shared/telemetry/prometheus-exporter', () => ({
  PrometheusExporter: jest.fn().mockImplementation(() => ({
    start: mockPromStart,
    stop: mockPromStop,
    setMetricsSource: mockPromSetSource,
  })),
}));

import {
  ObservabilityStack,
  createObservabilityStack,
} from '../../../../src/shared/telemetry/observability-stack';
import { OTelProvider } from '../../../../src/shared/telemetry/otel-provider';

describe('ObservabilityStack', () => {
  let provider: OTelProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OTelProvider({ serviceName: 'test-svc' });
    provider.initialize();
  });

  // ==========================================================================
  // Start
  // ==========================================================================

  describe('start', () => {
    it('should start both exporters by default', async () => {
      const stack = new ObservabilityStack(provider);
      await stack.start();
      expect(mockOTLPStart).toHaveBeenCalled();
      expect(mockPromStart).toHaveBeenCalled();
      expect(mockPromSetSource).toHaveBeenCalled();
    });

    it('should disable tracing when configured', async () => {
      const stack = new ObservabilityStack(provider, {
        enableTracing: false,
      });
      await stack.start();
      expect(mockOTLPStart).not.toHaveBeenCalled();
      expect(mockPromStart).toHaveBeenCalled();
    });

    it('should disable metrics when configured', async () => {
      const stack = new ObservabilityStack(provider, {
        enableMetrics: false,
      });
      await stack.start();
      expect(mockOTLPStart).toHaveBeenCalled();
      expect(mockPromStart).not.toHaveBeenCalled();
    });

    it('should use custom service name', async () => {
      const stack = new ObservabilityStack(provider, {
        serviceName: 'custom',
      });
      await stack.start();

      const {
        OTLPTraceExporter,
      } = require('../../../../src/shared/telemetry/otlp-exporter');
      expect(OTLPTraceExporter).toHaveBeenCalledWith(
        expect.objectContaining({ serviceName: 'custom' }),
      );
    });
  });

  // ==========================================================================
  // Stop
  // ==========================================================================

  describe('stop', () => {
    it('should stop all exporters', async () => {
      const stack = new ObservabilityStack(provider);
      await stack.start();
      await stack.stop();
      expect(mockOTLPStop).toHaveBeenCalled();
      expect(mockPromStop).toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      const stack = new ObservabilityStack(provider);
      await stack.stop(); // no error
    });
  });

  // ==========================================================================
  // Span export
  // ==========================================================================

  describe('exportSpan', () => {
    it('should export span to OTLP', async () => {
      const stack = new ObservabilityStack(provider);
      await stack.start();

      const span = provider.getTraceManager().startSpan('test');
      provider.getTraceManager().endSpan(span);
      stack.exportSpan(span);

      expect(mockOTLPEnqueue).toHaveBeenCalledWith(span);
    });

    it('should handle exportSpan when tracing disabled', async () => {
      const stack = new ObservabilityStack(provider, {
        enableTracing: false,
      });
      await stack.start();

      const span = provider.getTraceManager().startSpan('test');
      stack.exportSpan(span); // no error, no enqueue
      expect(mockOTLPEnqueue).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Accessors
  // ==========================================================================

  describe('accessors', () => {
    it('should return exporters after start', async () => {
      const stack = new ObservabilityStack(provider);
      await stack.start();
      expect(stack.getOTLPExporter()).not.toBeNull();
      expect(stack.getPrometheusExporter()).not.toBeNull();
    });

    it('should return null before start', () => {
      const stack = new ObservabilityStack(provider);
      expect(stack.getOTLPExporter()).toBeNull();
      expect(stack.getPrometheusExporter()).toBeNull();
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createObservabilityStack', () => {
    it('should create an instance', () => {
      const stack = createObservabilityStack(provider);
      expect(stack).toBeInstanceOf(ObservabilityStack);
    });
  });
});

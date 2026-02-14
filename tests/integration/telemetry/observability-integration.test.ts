/**
 * Observability Integration Tests
 *
 * Validates ObservabilityStack lifecycle, Prometheus metrics endpoint,
 * and OTLP trace export via the ServiceRegistry wiring.
 *
 * @module tests/integration/telemetry/observability-integration
 */

import { OTelProvider } from '../../../src/shared/telemetry/otel-provider';
import {
  ObservabilityStack,
  createObservabilityStack,
} from '../../../src/shared/telemetry/observability-stack';
import { OTLPTraceExporter } from '../../../src/shared/telemetry/otlp-exporter';
import { PrometheusExporter } from '../../../src/shared/telemetry/prometheus-exporter';

// ============================================================================
// ObservabilityStack lifecycle
// ============================================================================

describe('ObservabilityStack Integration', () => {
  let provider: OTelProvider;
  let stack: ObservabilityStack;

  beforeEach(() => {
    provider = new OTelProvider({ serviceName: 'aca-test' });
    provider.initialize();
  });

  afterEach(async () => {
    if (stack) {
      await stack.stop();
    }
  });

  it('should start and expose OTLP and Prometheus exporters', async () => {
    stack = createObservabilityStack(provider, {
      enableTracing: true,
      enableMetrics: true,
      otlp: { endpoint: 'http://localhost:4318/v1/traces' },
      prometheus: { port: 0 }, // port 0 = OS assigns random available port
    });

    await stack.start();

    expect(stack.getOTLPExporter()).toBeInstanceOf(OTLPTraceExporter);
    expect(stack.getPrometheusExporter()).toBeInstanceOf(PrometheusExporter);
  });

  it('should start with tracing only', async () => {
    stack = createObservabilityStack(provider, {
      enableTracing: true,
      enableMetrics: false,
    });

    await stack.start();

    expect(stack.getOTLPExporter()).toBeInstanceOf(OTLPTraceExporter);
    expect(stack.getPrometheusExporter()).toBeNull();
  });

  it('should start with metrics only', async () => {
    stack = createObservabilityStack(provider, {
      enableTracing: false,
      enableMetrics: true,
      prometheus: { port: 0 },
    });

    await stack.start();

    expect(stack.getOTLPExporter()).toBeNull();
    expect(stack.getPrometheusExporter()).toBeInstanceOf(PrometheusExporter);
  });

  it('should stop gracefully after start', async () => {
    stack = createObservabilityStack(provider, {
      enableTracing: true,
      enableMetrics: false,
    });

    await stack.start();
    await stack.stop();

    expect(stack.getOTLPExporter()).toBeNull();
    expect(stack.getPrometheusExporter()).toBeNull();
  });

  it('should accept span export after start', async () => {
    stack = createObservabilityStack(provider, {
      enableTracing: true,
      enableMetrics: false,
    });

    await stack.start();

    // Should not throw
    stack.exportSpan({
      name: 'test-span',
      context: {
        traceId: 'trace-001',
        spanId: 'span-001',
      },
      startTime: Date.now(),
      endTime: Date.now() + 100,
      attributes: {},
      status: 'ok',
      events: [],
    });
  });
});

// ============================================================================
// ServiceRegistry wiring
// ============================================================================

describe('ServiceRegistry Observability Wiring', () => {
  it('should include observabilityStack in ModuleInitResult', async () => {
    // Import lazily to avoid side effects
    const { ModuleInitializer } = await import(
      '../../../src/core/services/module-initializer'
    );

    const initializer = new ModuleInitializer();
    const result = await initializer.initializeAll({
      enableObservability: true,
      observabilityConfig: {
        enableTracing: true,
        enableMetrics: false,
      },
    });

    expect(result.observabilityStack).toBeInstanceOf(ObservabilityStack);

    // Cleanup
    if (result.observabilityStack) {
      await result.observabilityStack.stop();
    }
  });

  it('should not initialize observability when disabled', async () => {
    const { ModuleInitializer } = await import(
      '../../../src/core/services/module-initializer'
    );

    const initializer = new ModuleInitializer();
    const result = await initializer.initializeAll({
      enableObservability: false,
    });

    expect(result.observabilityStack).toBeNull();
  });
});

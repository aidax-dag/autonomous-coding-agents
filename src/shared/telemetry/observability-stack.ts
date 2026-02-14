/**
 * Observability Stack
 *
 * Unified configuration for connecting OTelProvider to real backends:
 * OTLP trace export (Jaeger/Tempo) and Prometheus metrics export.
 *
 * @module shared/telemetry/observability-stack
 */

import type { Span } from './interfaces/telemetry.interface';
import type { OTLPExporterConfig } from './otlp-exporter';
import type { PrometheusExporterConfig } from './prometheus-exporter';
import { OTLPTraceExporter } from './otlp-exporter';
import { PrometheusExporter } from './prometheus-exporter';
import type { OTelProvider } from './otel-provider';
import { createAgentLogger } from '../logging/logger';

const logger = createAgentLogger('observability-stack');

// ============================================================================
// Configuration
// ============================================================================

export interface ObservabilityConfig {
  /** Enable OTLP trace export (default: true) */
  enableTracing?: boolean;
  /** Enable Prometheus metrics endpoint (default: true) */
  enableMetrics?: boolean;
  /** OTLP exporter configuration */
  otlp?: OTLPExporterConfig;
  /** Prometheus exporter configuration */
  prometheus?: PrometheusExporterConfig;
  /** Service name (applied to both exporters) */
  serviceName?: string;
}

// ============================================================================
// ObservabilityStack
// ============================================================================

/**
 * Manages the lifecycle of all observability backends.
 *
 * Connects the in-memory OTelProvider to real export endpoints
 * for traces (OTLP/Jaeger) and metrics (Prometheus).
 */
export class ObservabilityStack {
  private readonly provider: OTelProvider;
  private otlpExporter: OTLPTraceExporter | null = null;
  private prometheusExporter: PrometheusExporter | null = null;
  private readonly config: ObservabilityConfig;

  constructor(provider: OTelProvider, config: ObservabilityConfig = {}) {
    this.provider = provider;
    this.config = config;
  }

  /**
   * Initialize and start all configured backends.
   */
  async start(): Promise<void> {
    const serviceName =
      this.config.serviceName ?? this.provider.getServiceName();

    if (this.config.enableTracing !== false) {
      this.otlpExporter = new OTLPTraceExporter({
        serviceName,
        ...this.config.otlp,
      });
      this.otlpExporter.start();
      logger.info('OTLP trace exporter initialized');
    }

    if (this.config.enableMetrics !== false) {
      this.prometheusExporter = new PrometheusExporter({
        prefix: serviceName.replace(/-/g, '_'),
        ...this.config.prometheus,
      });
      this.prometheusExporter.setMetricsSource(
        this.provider.getMetricsExporter(),
      );
      await this.prometheusExporter.start();
      logger.info('Prometheus metrics exporter initialized');
    }

    logger.info('Observability stack started');
  }

  /**
   * Stop all backends and flush buffered data.
   */
  async stop(): Promise<void> {
    if (this.otlpExporter) {
      await this.otlpExporter.stop();
      this.otlpExporter = null;
    }
    if (this.prometheusExporter) {
      await this.prometheusExporter.stop();
      this.prometheusExporter = null;
    }
    logger.info('Observability stack stopped');
  }

  /**
   * Export a completed span to the OTLP backend.
   */
  exportSpan(span: Span): void {
    this.otlpExporter?.enqueue(span);
  }

  getOTLPExporter(): OTLPTraceExporter | null {
    return this.otlpExporter;
  }

  getPrometheusExporter(): PrometheusExporter | null {
    return this.prometheusExporter;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an ObservabilityStack wired to the given OTelProvider.
 */
export function createObservabilityStack(
  provider: OTelProvider,
  config?: ObservabilityConfig,
): ObservabilityStack {
  return new ObservabilityStack(provider, config);
}

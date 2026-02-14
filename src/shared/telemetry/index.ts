/**
 * Telemetry Module
 *
 * Lightweight OpenTelemetry-compatible observability for tracing, metrics,
 * and LLM cost analytics. Supports optional OTLP and Prometheus export.
 *
 * @module shared/telemetry
 */

// Interfaces
export type {
  SpanContext,
  SpanEvent,
  Span,
  MetricType,
  MetricPoint,
  CostSummary,
  ITraceManager,
  IMetricsExporter,
  ICostAnalytics,
  TelemetryConfig,
} from './interfaces/telemetry.interface';

// Trace Manager
export { TraceManager, createTraceManager } from './trace-manager';

// Metrics Exporter
export { MetricsExporter, createMetricsExporter } from './metrics-exporter';

// Cost Analytics
export { CostAnalytics, createCostAnalytics } from './cost-analytics';

// OTel Provider
export { OTelProvider, createOTelProvider } from './otel-provider';

// OTLP Exporter
export type { OTLPExporterConfig } from './otlp-exporter';
export { OTLPTraceExporter, createOTLPTraceExporter } from './otlp-exporter';

// Prometheus Exporter
export type { PrometheusExporterConfig } from './prometheus-exporter';
export { PrometheusExporter, createPrometheusExporter } from './prometheus-exporter';

// Observability Stack
export type { ObservabilityConfig } from './observability-stack';
export { ObservabilityStack, createObservabilityStack } from './observability-stack';

/**
 * Telemetry Module
 *
 * Lightweight OpenTelemetry-compatible observability for tracing, metrics,
 * and LLM cost analytics. No external SDK dependency.
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

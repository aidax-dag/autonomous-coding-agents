/**
 * Telemetry Module Interfaces
 *
 * Lightweight OpenTelemetry-compatible abstractions for tracing,
 * metrics, and LLM cost analytics. No external OTel SDK dependency;
 * designed to optionally bridge to real OTel exporters.
 *
 * @module shared/telemetry/interfaces
 */

// ---------------------------------------------------------------------------
// Tracing
// ---------------------------------------------------------------------------

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface Span {
  name: string;
  context: SpanContext;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  status: 'ok' | 'error' | 'unset';
  events: SpanEvent[];
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
  type: MetricType;
}

// ---------------------------------------------------------------------------
// Cost Analytics
// ---------------------------------------------------------------------------

export interface CostSummary {
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, { cost: number; calls: number }>;
  byProvider: Record<string, { cost: number; calls: number }>;
}

// ---------------------------------------------------------------------------
// Service contracts
// ---------------------------------------------------------------------------

export interface ITraceManager {
  startSpan(name: string, parentContext?: SpanContext): Span;
  endSpan(span: Span, status?: 'ok' | 'error'): void;
  addEvent(
    span: Span,
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void;
  getActiveSpans(): Span[];
  getCompletedSpans(): Span[];
  reset(): void;
}

export interface IMetricsExporter {
  record(point: MetricPoint): void;
  increment(name: string, labels?: Record<string, string>, value?: number): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
  getMetrics(): MetricPoint[];
  reset(): void;
}

export interface ICostAnalytics {
  recordLLMCall(
    model: string,
    provider: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
  ): void;
  getTotalCost(): number;
  getCostByModel(): Map<string, number>;
  getCostByProvider(): Map<string, number>;
  getCallCount(): number;
  getSummary(): CostSummary;
  reset(): void;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface TelemetryConfig {
  /** Master enable/disable switch. Defaults to true. */
  enabled?: boolean;
  /** Logical service name attached to all telemetry data. */
  serviceName?: string;
  /** Interval in ms for periodic metric export (0 = manual only). */
  exportInterval?: number;
}

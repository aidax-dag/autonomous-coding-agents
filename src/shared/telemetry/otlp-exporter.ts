/**
 * OTLP Trace Exporter
 *
 * Sends completed spans to an OTLP-compatible endpoint (Jaeger, Grafana Tempo)
 * using the OTLP/HTTP JSON protocol. No external OTel SDK required.
 *
 * @module shared/telemetry/otlp-exporter
 */

import type { Span } from './interfaces/telemetry.interface';
import { createAgentLogger } from '../logging/logger';

const logger = createAgentLogger('otlp-exporter');

// ============================================================================
// Configuration
// ============================================================================

export interface OTLPExporterConfig {
  /** OTLP endpoint URL (default: http://localhost:4318/v1/traces) */
  endpoint?: string;
  /** Service name for resource attribution */
  serviceName?: string;
  /** Additional resource attributes */
  resourceAttributes?: Record<string, string>;
  /** Export batch size (default: 100) */
  batchSize?: number;
  /** Export interval in ms (default: 5000) */
  exportIntervalMs?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
  /** Custom headers for authentication */
  headers?: Record<string, string>;
}

const DEFAULT_CONFIG: Required<OTLPExporterConfig> = {
  endpoint: 'http://localhost:4318/v1/traces',
  serviceName: 'aca',
  resourceAttributes: {},
  batchSize: 100,
  exportIntervalMs: 5000,
  timeoutMs: 10000,
  headers: {},
};

// ============================================================================
// OTLP Trace Exporter
// ============================================================================

/**
 * Buffers completed spans and exports them to an OTLP/HTTP endpoint.
 */
export class OTLPTraceExporter {
  private readonly config: Required<OTLPExporterConfig>;
  private buffer: Span[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private exportCount = 0;
  private errorCount = 0;

  constructor(config?: OTLPExporterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a completed span to the export buffer.
   * Auto-flushes when the buffer reaches batchSize.
   */
  enqueue(span: Span): void {
    this.buffer.push(span);
    if (this.buffer.length >= this.config.batchSize) {
      this.flush().catch((err) => logger.error('Auto-flush failed', err));
    }
  }

  /**
   * Start periodic export.
   */
  start(): void {
    if (this.timer) return;
    if (this.config.exportIntervalMs > 0) {
      this.timer = setInterval(() => {
        this.flush().catch((err) =>
          logger.error('Periodic flush failed', err),
        );
      }, this.config.exportIntervalMs);
    }
    logger.info(`OTLP exporter started -> ${this.config.endpoint}`);
  }

  /**
   * Stop periodic export and flush remaining spans.
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
    logger.info(
      `OTLP exporter stopped (exported: ${this.exportCount}, errors: ${this.errorCount})`,
    );
  }

  /**
   * Flush all buffered spans to the OTLP endpoint.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const spans = this.buffer.splice(0, this.config.batchSize);
    const payload = this.buildPayload(spans);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.errorCount++;
        logger.warn(
          `OTLP export failed: ${response.status} ${response.statusText}`,
        );
        this.buffer.unshift(...spans);
      } else {
        this.exportCount += spans.length;
        logger.debug(`Exported ${spans.length} spans to OTLP`);
      }
    } catch (error) {
      this.errorCount++;
      logger.warn(`OTLP export error: ${(error as Error).message}`);
      this.buffer.unshift(...spans);
    }
  }

  /**
   * Current export statistics.
   */
  getStats(): { exported: number; errors: number; buffered: number } {
    return {
      exported: this.exportCount,
      errors: this.errorCount,
      buffered: this.buffer.length,
    };
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private buildPayload(spans: Span[]): Record<string, unknown> {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.serviceName },
              },
              ...Object.entries(this.config.resourceAttributes).map(
                ([key, val]) => ({
                  key,
                  value: { stringValue: val },
                }),
              ),
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'aca-telemetry', version: '1.0.0' },
              spans: spans.map((span) => this.spanToOTLP(span)),
            },
          ],
        },
      ],
    };
  }

  private spanToOTLP(span: Span): Record<string, unknown> {
    return {
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.context.parentSpanId ?? '',
      name: span.name,
      kind: 1, // INTERNAL
      startTimeUnixNano: String(span.startTime * 1_000_000),
      endTimeUnixNano: String((span.endTime ?? Date.now()) * 1_000_000),
      attributes: Object.entries(span.attributes).map(([key, val]) => ({
        key,
        value:
          typeof val === 'string'
            ? { stringValue: val }
            : typeof val === 'number'
              ? { intValue: String(val) }
              : { boolValue: val },
      })),
      status: {
        code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
      },
      events: span.events.map((e) => ({
        timeUnixNano: String(e.timestamp * 1_000_000),
        name: e.name,
        attributes: Object.entries(e.attributes ?? {}).map(([k, v]) => ({
          key: k,
          value:
            typeof v === 'string'
              ? { stringValue: v }
              : typeof v === 'number'
                ? { intValue: String(v) }
                : { boolValue: v },
        })),
      })),
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an OTLP trace exporter.
 */
export function createOTLPTraceExporter(
  config?: OTLPExporterConfig,
): OTLPTraceExporter {
  return new OTLPTraceExporter(config);
}

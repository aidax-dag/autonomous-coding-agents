/**
 * Trace Manager
 *
 * In-memory span lifecycle management with OTel-compatible semantics.
 * Generates random hex trace/span IDs and tracks active vs completed spans.
 *
 * @module shared/telemetry/trace-manager
 */

import type { ITraceManager, Span, SpanContext, SpanEvent } from './interfaces/telemetry.interface';
import { randomBytes } from 'crypto';

/**
 * Generate a random hex string of the given byte length.
 */
function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * In-memory trace manager.
 *
 * Maintains two collections (active / completed) and provides the full
 * span lifecycle: start, add events, end, query, and reset.
 */
export class TraceManager implements ITraceManager {
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];

  startSpan(name: string, parentContext?: SpanContext): Span {
    const spanId = randomHex(8);
    const traceId = parentContext?.traceId ?? randomHex(16);

    const span: Span = {
      name,
      context: {
        traceId,
        spanId,
        parentSpanId: parentContext?.spanId,
      },
      startTime: Date.now(),
      attributes: {},
      status: 'unset',
      events: [],
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  endSpan(span: Span, status: 'ok' | 'error' = 'ok'): void {
    span.endTime = Date.now();
    span.status = status;
    this.activeSpans.delete(span.context.spanId);
    this.completedSpans.push(span);
  }

  addEvent(
    span: Span,
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    const event: SpanEvent = {
      name,
      timestamp: Date.now(),
      ...(attributes ? { attributes } : {}),
    };
    span.events.push(event);
  }

  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  getCompletedSpans(): Span[] {
    return [...this.completedSpans];
  }

  reset(): void {
    this.activeSpans.clear();
    this.completedSpans = [];
  }
}

/**
 * Factory: create a TraceManager instance.
 */
export function createTraceManager(): TraceManager {
  return new TraceManager();
}

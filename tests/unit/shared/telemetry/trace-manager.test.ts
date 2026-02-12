/**
 * Trace Manager Tests
 */

import { TraceManager, createTraceManager } from '../../../../src/shared/telemetry/trace-manager';

describe('TraceManager', () => {
  let manager: TraceManager;

  beforeEach(() => {
    manager = new TraceManager();
  });

  describe('startSpan', () => {
    it('should create a span with a unique traceId and spanId', () => {
      const span = manager.startSpan('test-op');

      expect(span.name).toBe('test-op');
      expect(span.context.traceId).toBeDefined();
      expect(span.context.spanId).toBeDefined();
      expect(span.context.traceId).toHaveLength(32); // 16 bytes hex
      expect(span.context.spanId).toHaveLength(16); // 8 bytes hex
      expect(span.context.parentSpanId).toBeUndefined();
      expect(span.startTime).toBeLessThanOrEqual(Date.now());
      expect(span.endTime).toBeUndefined();
      expect(span.status).toBe('unset');
      expect(span.attributes).toEqual({});
      expect(span.events).toEqual([]);
    });

    it('should generate unique IDs for each span', () => {
      const span1 = manager.startSpan('op-1');
      const span2 = manager.startSpan('op-2');

      expect(span1.context.spanId).not.toBe(span2.context.spanId);
      expect(span1.context.traceId).not.toBe(span2.context.traceId);
    });
  });

  describe('parent-child span relationships', () => {
    it('should inherit traceId from parent context', () => {
      const parentSpan = manager.startSpan('parent');
      const childSpan = manager.startSpan('child', parentSpan.context);

      expect(childSpan.context.traceId).toBe(parentSpan.context.traceId);
      expect(childSpan.context.parentSpanId).toBe(parentSpan.context.spanId);
      expect(childSpan.context.spanId).not.toBe(parentSpan.context.spanId);
    });

    it('should support multi-level nesting', () => {
      const root = manager.startSpan('root');
      const child = manager.startSpan('child', root.context);
      const grandchild = manager.startSpan('grandchild', child.context);

      expect(grandchild.context.traceId).toBe(root.context.traceId);
      expect(grandchild.context.parentSpanId).toBe(child.context.spanId);
    });
  });

  describe('endSpan', () => {
    it('should set endTime and move span to completed', () => {
      const span = manager.startSpan('work');
      expect(manager.getActiveSpans()).toHaveLength(1);
      expect(manager.getCompletedSpans()).toHaveLength(0);

      manager.endSpan(span);

      expect(span.endTime).toBeDefined();
      expect(span.endTime).toBeGreaterThanOrEqual(span.startTime);
      expect(span.status).toBe('ok');
      expect(manager.getActiveSpans()).toHaveLength(0);
      expect(manager.getCompletedSpans()).toHaveLength(1);
    });

    it('should set error status when specified', () => {
      const span = manager.startSpan('failing-op');
      manager.endSpan(span, 'error');

      expect(span.status).toBe('error');
    });
  });

  describe('addEvent', () => {
    it('should append events to the span', () => {
      const span = manager.startSpan('op');

      manager.addEvent(span, 'checkpoint-a');
      manager.addEvent(span, 'checkpoint-b', { retries: 3, cached: true });

      expect(span.events).toHaveLength(2);
      expect(span.events[0].name).toBe('checkpoint-a');
      expect(span.events[0].timestamp).toBeLessThanOrEqual(Date.now());
      expect(span.events[0].attributes).toBeUndefined();
      expect(span.events[1].name).toBe('checkpoint-b');
      expect(span.events[1].attributes).toEqual({ retries: 3, cached: true });
    });
  });

  describe('getActiveSpans / getCompletedSpans', () => {
    it('should track active and completed spans separately', () => {
      manager.startSpan('s1');
      const s2 = manager.startSpan('s2');
      manager.startSpan('s3');

      expect(manager.getActiveSpans()).toHaveLength(3);
      expect(manager.getCompletedSpans()).toHaveLength(0);

      manager.endSpan(s2);

      const active = manager.getActiveSpans();
      const completed = manager.getCompletedSpans();

      expect(active).toHaveLength(2);
      expect(active.map((s) => s.name)).toContain('s1');
      expect(active.map((s) => s.name)).toContain('s3');
      expect(completed).toHaveLength(1);
      expect(completed[0].name).toBe('s2');
    });

    it('should return copies of the internal arrays', () => {
      manager.startSpan('x');
      const active = manager.getActiveSpans();
      active.pop();

      expect(manager.getActiveSpans()).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should clear all active and completed spans', () => {
      const s1 = manager.startSpan('a');
      manager.startSpan('b');
      manager.endSpan(s1);

      expect(manager.getActiveSpans()).toHaveLength(1);
      expect(manager.getCompletedSpans()).toHaveLength(1);

      manager.reset();

      expect(manager.getActiveSpans()).toHaveLength(0);
      expect(manager.getCompletedSpans()).toHaveLength(0);
    });
  });

  describe('createTraceManager factory', () => {
    it('should return a functional TraceManager instance', () => {
      const tm = createTraceManager();
      expect(tm).toBeInstanceOf(TraceManager);

      const span = tm.startSpan('factory-test');
      tm.endSpan(span);
      expect(tm.getCompletedSpans()).toHaveLength(1);
    });
  });
});

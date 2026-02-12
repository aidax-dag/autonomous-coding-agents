/**
 * OTel Provider Tests
 */

import {
  OTelProvider,
  createOTelProvider,
} from '../../../../src/shared/telemetry/otel-provider';

describe('OTelProvider', () => {
  describe('constructor and defaults', () => {
    it('should use default config when none provided', () => {
      const provider = new OTelProvider();

      expect(provider.isEnabled()).toBe(true);
      expect(provider.getServiceName()).toBe('aca');
    });

    it('should accept custom config', () => {
      const provider = new OTelProvider({
        enabled: false,
        serviceName: 'my-service',
        exportInterval: 5000,
      });

      expect(provider.isEnabled()).toBe(false);
      expect(provider.getServiceName()).toBe('my-service');
    });
  });

  describe('initialize / shutdown', () => {
    it('should be idempotent on initialize', () => {
      const provider = new OTelProvider();

      // Should not throw on multiple calls
      provider.initialize();
      provider.initialize();

      // Still functional
      const tm = provider.getTraceManager();
      const span = tm.startSpan('init-test');
      tm.endSpan(span);
      expect(tm.getCompletedSpans()).toHaveLength(1);
    });

    it('should reset all state on shutdown', () => {
      const provider = new OTelProvider();
      provider.initialize();

      // Accumulate state
      const tm = provider.getTraceManager();
      const me = provider.getMetricsExporter();
      const ca = provider.getCostAnalytics();

      const span = tm.startSpan('work');
      tm.endSpan(span);
      me.increment('ops');
      ca.recordLLMCall('model', 'provider', 10, 5, 0.01);

      expect(tm.getCompletedSpans()).toHaveLength(1);
      expect(me.getMetrics()).toHaveLength(1);
      expect(ca.getCallCount()).toBe(1);

      provider.shutdown();

      expect(tm.getCompletedSpans()).toHaveLength(0);
      expect(me.getMetrics()).toHaveLength(0);
      expect(ca.getCallCount()).toBe(0);
    });

    it('should allow re-initialization after shutdown', () => {
      const provider = new OTelProvider();
      provider.initialize();
      provider.shutdown();
      provider.initialize();

      const span = provider.getTraceManager().startSpan('post-restart');
      provider.getTraceManager().endSpan(span);
      expect(provider.getTraceManager().getCompletedSpans()).toHaveLength(1);
    });
  });

  describe('sub-component access', () => {
    it('should provide a TraceManager instance', () => {
      const provider = new OTelProvider();
      const tm = provider.getTraceManager();

      // Verify it implements ITraceManager via duck-typing
      expect(typeof tm.startSpan).toBe('function');
      expect(typeof tm.endSpan).toBe('function');
      expect(typeof tm.addEvent).toBe('function');
      expect(typeof tm.getActiveSpans).toBe('function');
      expect(typeof tm.getCompletedSpans).toBe('function');
      expect(typeof tm.reset).toBe('function');
    });

    it('should provide a MetricsExporter instance', () => {
      const provider = new OTelProvider();
      const me = provider.getMetricsExporter();

      expect(typeof me.record).toBe('function');
      expect(typeof me.increment).toBe('function');
      expect(typeof me.gauge).toBe('function');
      expect(typeof me.histogram).toBe('function');
      expect(typeof me.getMetrics).toBe('function');
      expect(typeof me.reset).toBe('function');
    });

    it('should provide a CostAnalytics instance', () => {
      const provider = new OTelProvider();
      const ca = provider.getCostAnalytics();

      expect(typeof ca.recordLLMCall).toBe('function');
      expect(typeof ca.getTotalCost).toBe('function');
      expect(typeof ca.getCostByModel).toBe('function');
      expect(typeof ca.getCostByProvider).toBe('function');
      expect(typeof ca.getCallCount).toBe('function');
      expect(typeof ca.getSummary).toBe('function');
      expect(typeof ca.reset).toBe('function');
    });
  });

  describe('enabled/disabled behavior', () => {
    it('should report enabled=false when configured as disabled', () => {
      const provider = new OTelProvider({ enabled: false });
      expect(provider.isEnabled()).toBe(false);
    });

    it('should still allow component access when disabled', () => {
      // Disabling is a consumer concern -- the provider still creates components
      const provider = new OTelProvider({ enabled: false });
      const tm = provider.getTraceManager();

      const span = tm.startSpan('disabled-trace');
      tm.endSpan(span);
      expect(tm.getCompletedSpans()).toHaveLength(1);
    });
  });

  describe('createOTelProvider factory', () => {
    it('should create a provider with default config', () => {
      const provider = createOTelProvider();
      expect(provider).toBeInstanceOf(OTelProvider);
      expect(provider.isEnabled()).toBe(true);
      expect(provider.getServiceName()).toBe('aca');
    });

    it('should create a provider with custom config', () => {
      const provider = createOTelProvider({
        serviceName: 'custom-svc',
        enabled: false,
      });

      expect(provider).toBeInstanceOf(OTelProvider);
      expect(provider.isEnabled()).toBe(false);
      expect(provider.getServiceName()).toBe('custom-svc');
    });
  });
});
